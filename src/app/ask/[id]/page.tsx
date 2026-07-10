"use client";

// Q&A: every question is answered instantly by the offline kundli engine.
// If confidence is low (and the app is online + AI configured), the user is
// offered AI escalation; an explicit "Ask AI" button is always available.

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useKundli } from "@/lib/useKundli";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ProfileTheme } from "@/components/ProfileTheme";
import { answerQuestion, ESCALATE_THRESHOLD } from "@/lib/interpret/qa";
import { buildKundliSummary } from "@/lib/kundliSummary";
import { db, type QARecord } from "@/lib/db";

interface ChatItem {
  question: string;
  answer: string;
  source: "engine" | "ai";
  confidence?: number;
  provider?: string;
  lowConfidence?: boolean;
}

export default function AskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const profileId = Number(id);
  const { profile, kundli, loading, error } = useKundli(profileId);
  const { t, lang } = useI18n();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [question, setQuestion] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const history = useLiveQuery(
    () =>
      db.qaHistory
        .where("profileId")
        .equals(profileId)
        .reverse()
        .limit(10)
        .toArray(),
    [profileId]
  );

  useEffect(() => {
    fetch("/api/ask-ai")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAiAvailable(Boolean(d && (d.claude || d.gemini))))
      .catch(() => setAiAvailable(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  const saveRecord = async (rec: Omit<QARecord, "id">) => {
    try {
      await db.qaHistory.add(rec);
    } catch {
      // history is best-effort
    }
  };

  const askEngine = (q: string) => {
    if (!kundli) return;
    const result = answerQuestion(q, kundli);
    const answer = lang === "hi" ? result.answer.hi : result.answer.en;
    const low = result.confidence < ESCALATE_THRESHOLD;
    setItems((prev) => [
      ...prev,
      {
        question: q,
        answer,
        source: "engine",
        confidence: result.confidence,
        lowConfidence: low,
      },
    ]);
    void saveRecord({
      profileId,
      question: q,
      answer,
      source: "engine",
      confidence: result.confidence,
      createdAt: Date.now(),
    });
    // Auto-escalate to AI when the engine isn't confident
    if (low && aiAvailable && navigator.onLine) {
      void askAI(q, true);
    }
  };

  const askAI = async (q: string, auto = false) => {
    if (!kundli || aiBusy) return;
    setAiBusy(true);
    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: q,
          lang,
          kundli: buildKundliSummary(kundli),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => [
          ...prev,
          { question: q, answer: data.answer, source: "ai", provider: data.provider },
        ]);
        void saveRecord({
          profileId,
          question: q,
          answer: data.answer,
          source: "ai",
          createdAt: Date.now(),
        });
      } else if (!auto) {
        setItems((prev) => [
          ...prev,
          { question: q, answer: t("aiUnavailable"), source: "engine" },
        ]);
      }
    } catch {
      if (!auto) {
        setItems((prev) => [
          ...prev,
          { question: q, answer: t("aiUnavailable"), source: "engine" },
        ]);
      }
    } finally {
      setAiBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    askEngine(q);
  };

  if (loading) return <AppShell><p className="p-8 text-center text-(--color-ink-soft)">{t("loading")}</p></AppShell>;
  if (error || !kundli || !profile) {
    return (
      <AppShell>
        <div className="card mx-auto max-w-md p-8 text-center">
          <p className="text-red-300">{error ?? t("error")}</p>
          <Link href="/" className="accent-text mt-4 inline-block text-sm underline">← {t("dashboard")}</Link>
        </div>
      </AppShell>
    );
  }

  const lastQuestion = items.length > 0 ? items[items.length - 1].question : null;

  return (
    <ProfileTheme birthdayNumber={kundli.numerology.birthdayNumber}>
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-1 text-xl font-semibold text-(--color-gold-soft)">
            {t("askQuestion")} — {profile.name}
          </h1>
          <p className="mb-5 text-xs text-(--color-ink-soft)">
            {aiAvailable === false
              ? `✓ ${t("generatedOffline")}`
              : `✓ ${t("generatedOffline")} · AI: ${aiAvailable ? "✓" : "…"}`}
          </p>

          {/* Chat area */}
          <div className="space-y-4">
            {items.length === 0 && history && history.length > 0 && (
              <div className="card p-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-(--color-ink-soft)">
                  {t("history")}
                </h3>
                <ul className="space-y-1 text-sm text-(--color-ink-soft)">
                  {history.map((h) => (
                    <li key={h.id}>
                      <button
                        className="text-left hover:text-(--color-ink)"
                        onClick={() => setQuestion(h.question)}
                      >
                        • {h.question}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {items.map((item, i) => (
              <div key={i}>
                <div className="mb-2 flex justify-end">
                  <div className="accent-bg max-w-[85%] rounded-xl rounded-br-sm px-4 py-2.5 text-sm">
                    {item.question}
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="card max-w-[90%] rounded-xl rounded-bl-sm px-4 py-3">
                    <div className="mb-1.5 flex items-center gap-2 text-xs">
                      <span
                        className={`rounded-full border px-2 py-0.5 ${
                          item.source === "ai"
                            ? "border-violet-500/40 text-violet-300"
                            : "border-emerald-500/40 text-emerald-300"
                        }`}
                      >
                        {item.source === "ai"
                          ? `${t("aiAnswer")}${item.provider ? ` · ${item.provider}` : ""}`
                          : t("engineAnswer")}
                      </span>
                      {item.confidence !== undefined && (
                        <span className="text-(--color-ink-soft)">
                          {t("confidence")}: {item.confidence}%
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.answer}</p>
                    {item.lowConfidence && aiAvailable && (
                      <p className="mt-2 text-xs text-(--color-ink-soft)">{t("lowConfidenceNote")}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {aiBusy && (
              <div className="flex justify-start">
                <div className="card rounded-xl px-4 py-3 text-sm text-(--color-ink-soft)">
                  ✨ {t("aiThinking")}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={submit} className="sticky bottom-4 mt-6 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("askPlaceholder")}
              maxLength={600}
              className="flex-1 rounded-xl border border-(--color-line) bg-(--color-surface-2) px-4 py-3 text-sm outline-none focus:border-(--accent)"
            />
            <button
              type="submit"
              className="rounded-xl bg-(--accent) px-5 py-3 text-sm font-medium text-[#14100a] transition hover:brightness-110"
            >
              {t("ask")}
            </button>
            {aiAvailable && lastQuestion && (
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => askAI(lastQuestion)}
                className="rounded-xl border border-violet-500/40 px-4 py-3 text-sm text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-50"
                title={t("askAI")}
              >
                ✨ {t("askAI")}
              </button>
            )}
          </form>
        </div>
      </AppShell>
    </ProfileTheme>
  );
}
