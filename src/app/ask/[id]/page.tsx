"use client";

// Q&A: every question is answered by AI reading the full computed chart.
// The real Gemini free-quota meter stays visible; if AI is unreachable the
// page says so plainly (no engine-written answers).

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useKundli } from "@/lib/useKundli";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ProfileTheme } from "@/components/ProfileTheme";
import {
  getAiConfig,
  getUsageSummary,
  callAi,
  aiAvailable,
  fmtCost,
  GEMINI_FREE_RPD,
  type AiConfig,
  type UsageSummary,
} from "@/lib/aiClient";
import { db, type QARecord } from "@/lib/db";

interface ChatItem {
  question: string;
  answer: string;
  provider?: string;
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

  const canUseAi = cfg !== null && aiAvailable(cfg);
  const quotaExhausted =
    cfg !== null && usage !== null && usage.geminiRemaining <= 0 && !cfg.serverClaude;

  const askAI = useCallback(
    async (q: string) => {
      if (!kundli || !cfg || aiBusy) return;
      setAiBusy(true);
      setNotice("");
      const result = await callAi(q, kundli, lang, cfg);
      setAiBusy(false);
      refreshUsage();
      if (typeof result === "string") {
        if (result === "quota-exhausted") setNotice(t("aiQuotaExhausted"));
        else setNotice(t("aiUnavailable"));
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          question: q,
          answer: result.answer,
          provider: result.provider,
          costUsd: result.costUsd,
        },
      ]);
      try {
        await db.qaHistory.add({
          profileId,
          question: q,
          answer: result.answer,
          source: "ai",
          createdAt: Date.now(),
        } satisfies Omit<QARecord, "id">);
      } catch {
        // history is best-effort
      }
    },
    [kundli, cfg, aiBusy, lang, t, profileId, refreshUsage]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || aiBusy) return;
    setQuestion("");
    void askAI(q);
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

  return (
    <ProfileTheme birthdayNumber={kundli.numerology.birthdayNumber}>
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-(--color-gold-soft)">
              {t("askQuestion")} — {profile.name}
            </h1>
            {/* Real free-quota meter — costs never surprise */}
            {usage && (
              <Link
                href="/settings"
                className={`rounded-full border px-3 py-1 text-xs ${
                  quotaExhausted
                    ? "border-red-500/50 text-red-300"
                    : "border-(--color-line) text-(--color-ink-soft)"
                }`}
                title={t("quotaNote")}
              >
                ✨ {usage.geminiRemaining}/{GEMINI_FREE_RPD} {t("freeCallsLeft")}
                {usage.costTodayUsd > 0 ? ` · ${fmtCost(usage.costTodayUsd)}` : ""}
              </Link>
            )}
          </div>
          <p className="mb-5 text-xs text-(--color-ink-soft)">
            {canUseAi ? "✨ AI" : t("aiNotConfigured")}
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
                      <span className="rounded-full border border-violet-500/40 px-2 py-0.5 text-violet-300">
                        ✨ {t("aiAnswer")}
                        {item.provider ? ` · ${item.provider}` : ""}
                      </span>
                      {item.costUsd !== undefined && (
                        <span className="text-(--color-ink-soft)">
                          {item.costUsd === 0 ? t("free") : fmtCost(item.costUsd)}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.answer}</p>
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
              disabled={aiBusy || !canUseAi}
              className="rounded-xl bg-(--accent) px-5 py-3 text-sm font-medium text-[#14100a] transition hover:brightness-110 disabled:opacity-50"
            >
              ✨ {t("ask")}
            </button>
          </form>
        </div>
      </AppShell>
    </ProfileTheme>
  );
}
