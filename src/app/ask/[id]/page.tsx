"use client";

// Q&A: every question is answered instantly by the offline kundli engine
// with BOTH supportive factors and challenges. AI escalation respects the
// user's AI mode and daily limit; usage + estimated cost stay visible.

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useKundli } from "@/lib/useKundli";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ProfileTheme } from "@/components/ProfileTheme";
import { answerQuestion, ESCALATE_THRESHOLD } from "@/lib/interpret/qa";
import {
  getAiConfig,
  getUsageSummary,
  callAi,
  aiAvailable,
  fmtCost,
  type AiConfig,
  type UsageSummary,
} from "@/lib/aiClient";
import { db, type QARecord } from "@/lib/db";

interface ChatItem {
  question: string;
  answer: string;
  source: "engine" | "ai";
  confidence?: number;
  provider?: string;
  lowConfidence?: boolean;
  costUsd?: number;
}

export default function AskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const profileId = Number(id);
  const { profile, kundli, loading, error } = useKundli(profileId);
  const { t, lang } = useI18n();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [question, setQuestion] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [notice, setNotice] = useState("");
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

  const refreshUsage = useCallback(() => {
    getUsageSummary().then(setUsage);
  }, []);

  useEffect(() => {
    getAiConfig().then(setCfg);
    refreshUsage();
  }, [refreshUsage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  const canUseAi = cfg !== null && cfg.mode !== "never" && aiAvailable(cfg);
  const limitReached =
    cfg !== null && usage !== null && usage.callsToday >= cfg.dailyLimit;

  const saveRecord = async (rec: Omit<QARecord, "id">) => {
    try {
      await db.qaHistory.add(rec);
    } catch {
      // history is best-effort
    }
  };

  const askAI = useCallback(
    async (q: string, auto = false) => {
      if (!kundli || !cfg || aiBusy) return;
      if (limitReached) {
        if (!auto) setNotice(t("aiLimitReached"));
        return;
      }
      setAiBusy(true);
      setNotice("");
      const result = await callAi(q, kundli, lang, cfg);
      setAiBusy(false);
      refreshUsage();
      if (typeof result === "string") {
        if (result === "limit-reached") setNotice(t("aiLimitReached"));
        else if (!auto) setNotice(t("aiUnavailable"));
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          question: q,
          answer: result.answer,
          source: "ai",
          provider: result.provider,
          costUsd: result.costUsd,
        },
      ]);
      void saveRecord({
        profileId,
        question: q,
        answer: result.answer,
        source: "ai",
        createdAt: Date.now(),
      });
    },
    [kundli, cfg, aiBusy, limitReached, lang, t, profileId, refreshUsage]
  );

  const askEngine = (q: string, escalateIfUnsure: boolean) => {
    if (!kundli || !cfg) return;
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
    if (escalateIfUnsure && low && canUseAi && navigator.onLine) {
      void askAI(q, true);
    }
  };

  /** AI-first: send straight to AI; only fall back to the engine if AI fails */
  const askAiFirst = async (q: string) => {
    if (!kundli || !cfg) return;
    setAiBusy(true);
    setNotice("");
    const result = await callAi(q, kundli, lang, cfg);
    setAiBusy(false);
    refreshUsage();
    if (typeof result === "string") {
      // AI unreachable/limited — offline engine keeps the app functional
      if (result === "limit-reached") setNotice(t("aiLimitReached"));
      else setNotice(t("aiUnavailable"));
      askEngine(q, false);
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        question: q,
        answer: result.answer,
        source: "ai",
        provider: result.provider,
        costUsd: result.costUsd,
      },
    ]);
    void saveRecord({
      profileId,
      question: q,
      answer: result.answer,
      source: "ai",
      createdAt: Date.now(),
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    const aiFirst =
      cfg?.mode === "always" && canUseAi && navigator.onLine && !limitReached;
    if (aiFirst) void askAiFirst(q);
    else askEngine(q, cfg?.mode === "fallback");
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
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-(--color-gold-soft)">
              {t("askQuestion")} — {profile.name}
            </h1>
            {/* AI usage meter — always visible so costs never surprise */}
            {cfg && usage && cfg.mode !== "never" && (
              <Link
                href="/settings"
                className={`rounded-full border px-3 py-1 text-xs ${
                  limitReached
                    ? "border-red-500/50 text-red-300"
                    : "border-(--color-line) text-(--color-ink-soft)"
                }`}
                title={t("aiUsageToday")}
              >
                ✨ {Math.max(0, cfg.dailyLimit - usage.callsToday)} {t("remainingToday")} ({usage.callsToday}/{cfg.dailyLimit}) · {fmtCost(usage.costTodayUsd)}
              </Link>
            )}
          </div>
          <p className="mb-5 text-xs text-(--color-ink-soft)">
            ✓ {t("generatedOffline")}
            {cfg && cfg.mode !== "never" && (canUseAi ? " · AI ✓" : ` · ${t("aiNotConfigured")}`)}
          </p>

          {notice && (
            <p className="mb-4 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-300">
              {notice}
            </p>
          )}

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
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
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
                      {item.source === "ai" && item.costUsd !== undefined && (
                        <span className="text-(--color-ink-soft)">
                          {item.costUsd === 0 ? t("free") : fmtCost(item.costUsd)}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.answer}</p>
                    {item.lowConfidence && canUseAi && cfg?.mode === "fallback" && (
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
            {canUseAi && lastQuestion && (
              <button
                type="button"
                disabled={aiBusy || limitReached}
                onClick={() => askAI(lastQuestion)}
                className="rounded-xl border border-violet-500/40 px-4 py-3 text-sm text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-50"
                title={limitReached ? t("aiLimitReached") : t("askAI")}
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
