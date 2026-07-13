"use client";

// Daily / weekly / monthly / yearly predictions — AI-generated from the full
// computed chart (dashas, transits, vargas, ashtakavarga). Auto-loads for
// the selected period; the real free-quota meter stays visible.

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { fmtDate } from "@/lib/format";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const DAY_MS = 86400 * 1000;
const PERIOD_DAYS: Record<Period, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

export default function PredictionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, kundli, loading, error } = useKundli(Number(id));
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<Period>("daily");
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [aiText, setAiText] = useState<{ text: string; provider: string; costUsd: number } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState("");

  const range = useMemo(() => {
    const start = Date.now();
    return { start, end: start + PERIOD_DAYS[period] * DAY_MS };
  }, [period]);

  useEffect(() => {
    getAiConfig().then(setCfg);
    getUsageSummary().then(setUsage);
  }, []);

  // Reset when switching period
  useEffect(() => {
    setAiText(null);
    setAiNotice("");
  }, [period]);

  const canUseAi = cfg !== null && aiAvailable(cfg);
  const quotaExhausted =
    cfg !== null && usage !== null && usage.geminiRemaining <= 0 && !cfg.serverClaude;

  const fetchPrediction = useCallback(async () => {
    if (!kundli || !cfg || aiBusy) return;
    setAiBusy(true);
    setAiNotice("");
    const from = new Date(range.start).toISOString().slice(0, 10);
    const to = new Date(range.end).toISOString().slice(0, 10);
    const periodLabel = {
      daily: `today (${from})`,
      weekly: `this week (${from} to ${to})`,
      monthly: `this month (${from} to ${to})`,
      yearly: `the coming year (${from} to ${to})`,
    }[period];
    const question = `Give the complete ${period} prediction for ${periodLabel}. Cover career, wealth, health and relationships; name the favourable and unfavourable dates or sub-periods within this window where the dashas/transits make that determinable; give precautions for the difficult stretches. Balance positives and negatives with equal weight.`;
    const result = await callAi(question, kundli, lang, cfg);
    setAiBusy(false);
    getUsageSummary().then(setUsage);
    if (typeof result === "string") {
      setAiNotice(result === "quota-exhausted" ? t("aiQuotaExhausted") : t("aiUnavailable"));
      return;
    }
    setAiText({ text: result.answer, provider: result.provider, costUsd: result.costUsd });
  }, [kundli, cfg, aiBusy, period, range, lang, t]);

  // Auto-load the AI prediction whenever the period (or chart) is ready
  useEffect(() => {
    if (canUseAi && !aiText && !aiBusy && kundli && navigator.onLine && !quotaExhausted) {
      void fetchPrediction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, period, kundli]);

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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-(--color-gold-soft)">
              {t("predictionFor")} {profile.name}
            </h1>
            <p className="text-xs text-(--color-ink-soft)">
              {fmtDate(range.start, lang)} — {fmtDate(range.end, lang)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex gap-1 rounded-lg border border-(--color-line) p-1 text-sm">
              {(["daily", "weekly", "monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-3 py-1.5 transition ${
                    period === p ? "accent-bg accent-text font-medium" : "text-(--color-ink-soft)"
                  }`}
                >
                  {t(p)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI prediction */}
        <div className="card border-l-4 border-violet-500/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-violet-300">
              ✨ {t("aiInsight")}
              {aiText && ` · ${aiText.provider} · ${aiText.costUsd === 0 ? t("free") : fmtCost(aiText.costUsd)}`}
            </h3>
            {!aiBusy && canUseAi && (
              <button
                onClick={() => {
                  setAiText(null);
                  void fetchPrediction();
                }}
                disabled={quotaExhausted}
                className="rounded-lg border border-violet-500/40 px-4 py-2 text-sm text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-50"
                title={quotaExhausted ? t("aiQuotaExhausted") : undefined}
              >
                {aiText ? "↻" : t("getAiInsight")}
              </button>
            )}
          </div>
          {aiBusy && <p className="mt-3 text-sm text-(--color-ink-soft)">✨ {t("aiThinking")}</p>}
          {aiNotice && <p className="mt-3 text-sm text-orange-300">{aiNotice}</p>}
          {!canUseAi && (
            <p className="mt-3 text-sm text-(--color-ink-soft)">
              {t("aiNotConfigured")} — <Link href="/settings" className="underline">{t("settings")}</Link>
            </p>
          )}
          {aiText && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{aiText.text}</p>
          )}
        </div>
      </AppShell>
    </ProfileTheme>
  );
}
