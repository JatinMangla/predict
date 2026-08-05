"use client";

// Rashi Deep-Dive: pick a life area and get the two-layer reading a
// professional Moon-sign forecaster gives — the general prediction for the
// rashi, then a point-by-point verification of which parts actually hold
// for THIS chart (✅ applies / ⚠️ modified / ❌ doesn't apply).

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useKundli } from "@/lib/useKundli";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ProfileTheme } from "@/components/ProfileTheme";
import { CATEGORIES, type CategoryDef } from "@/lib/interpret/categories";
import { SIGN_NAMES, NAKSHATRA_NAMES } from "@/lib/astro/constants";
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

type Period = "month" | "year";

export default function RashiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, kundli, loading, error } = useKundli(Number(id));
  const { t, lang } = useI18n();
  const [category, setCategory] = useState<CategoryDef | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [reading, setReading] = useState<{ text: string; provider: string; costUsd: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getAiConfig().then(setCfg);
    getUsageSummary().then(setUsage);
  }, []);

  const moon = useMemo(
    () => kundli?.planets.find((p) => p.id === "Moon") ?? null,
    [kundli]
  );

  const canUseAi = cfg !== null && aiAvailable(cfg);
  const quotaExhausted =
    cfg !== null && usage !== null && usage.geminiRemaining <= 0 && !cfg.serverClaude;

  const fetchReading = useCallback(
    async (cat: CategoryDef, p: Period) => {
      if (!kundli || !cfg || !moon || busy) return;
      setBusy(true);
      setNotice("");
      setReading(null);
      const rashi = SIGN_NAMES[moon.sign].en;
      const window = p === "month" ? "this month" : "this year";
      const question =
        `Life area: ${cat.label.en} (${cat.scope.en}). Timeframe: ${window}.\n` +
        `The native's Moon sign (rashi) is ${rashi}, birth nakshatra ${NAKSHATRA_NAMES[moon.nakshatra].en}.\n` +
        `Primary houses for this area: ${cat.houses.join(", ")}. Karakas: ${cat.karakas.join(", ")}. Refining varga: ${cat.varga}.\n` +
        `First give the general ${rashi} rashi forecast for this area for ${window}, then verify each point against this chart.`;
      const result = await callAi(question, kundli, lang, cfg, "rashi");
      setBusy(false);
      getUsageSummary().then(setUsage);
      if (typeof result === "string") {
        setNotice(result === "quota-exhausted" ? t("aiQuotaExhausted") : t("aiUnavailable"));
        return;
      }
      setReading({ text: result.answer, provider: result.provider, costUsd: result.costUsd });
    },
    [kundli, cfg, moon, busy, lang, t]
  );

  const pickCategory = (cat: CategoryDef) => {
    setCategory(cat);
    void fetchReading(cat, period);
  };

  const changePeriod = (p: Period) => {
    setPeriod(p);
    if (category) void fetchReading(category, p);
  };

  if (loading) return <AppShell><p className="p-8 text-center text-(--color-ink-soft)">{t("loading")}</p></AppShell>;
  if (error || !kundli || !profile || !moon) {
    return (
      <AppShell>
        <div className="card mx-auto max-w-md p-8 text-center">
          <p className="text-red-300">{error ?? t("error")}</p>
          <Link href="/" className="accent-text mt-4 inline-block text-sm underline">← {t("dashboard")}</Link>
        </div>
      </AppShell>
    );
  }

  const rashiName = lang === "hi" ? SIGN_NAMES[moon.sign].hi : SIGN_NAMES[moon.sign].en;

  return (
    <ProfileTheme birthdayNumber={kundli.numerology.birthdayNumber}>
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-(--color-gold-soft)">
                {t("rashiDeepDive")} — {profile.name}
              </h1>
              <p className="mt-0.5 text-sm text-(--color-ink-soft)">
                {t("moonSign")}: <span className="accent-text font-medium">{rashiName}</span> ·{" "}
                {t("birthNakshatra")}:{" "}
                {lang === "hi"
                  ? NAKSHATRA_NAMES[moon.nakshatra].hi
                  : NAKSHATRA_NAMES[moon.nakshatra].en}
              </p>
            </div>
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

          <p className="mb-4 text-sm text-(--color-ink-soft)">{t("rashiDeepDiveNote")}</p>

          {/* Timeframe */}
          <div className="mb-4 flex gap-1 rounded-lg border border-(--color-line) p-1 text-sm">
            {(["month", "year"] as const).map((p) => (
              <button
                key={p}
                onClick={() => changePeriod(p)}
                className={`rounded-md px-4 py-1.5 transition ${
                  period === p ? "accent-bg accent-text font-medium" : "text-(--color-ink-soft)"
                }`}
              >
                {p === "month" ? t("monthly") : t("yearly")}
              </button>
            ))}
          </div>

          {/* Category picker */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => pickCategory(cat)}
                disabled={busy}
                className={`card flex flex-col items-center gap-1 p-3 text-center text-xs transition hover:border-(--accent) disabled:opacity-60 ${
                  category?.key === cat.key ? "accent-bg border-(--accent)" : ""
                }`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="leading-tight">
                  {lang === "hi" ? cat.label.hi : cat.label.en}
                </span>
              </button>
            ))}
          </div>

          {/* Reading */}
          {!category && (
            <div className="card p-8 text-center text-sm text-(--color-ink-soft)">
              👆 {t("pickCategoryHint")}
            </div>
          )}

          {category && (
            <div className="card border-l-4 border-violet-500/40 p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium text-(--color-gold-soft)">
                  {category.icon} {lang === "hi" ? category.label.hi : category.label.en}
                  <span className="ml-2 text-xs font-normal text-(--color-ink-soft)">
                    {t("houses")} {category.houses.join(", ")} · {category.karakas.join(", ")} · {category.varga}
                  </span>
                </h2>
                {reading && !busy && (
                  <button
                    onClick={() => fetchReading(category, period)}
                    disabled={quotaExhausted}
                    className="rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-50"
                  >
                    ↻
                  </button>
                )}
              </div>

              {busy && (
                <p className="text-sm text-(--color-ink-soft)">✨ {t("aiThinking")}</p>
              )}
              {notice && <p className="text-sm text-orange-300">{notice}</p>}
              {!canUseAi && !busy && (
                <p className="text-sm text-(--color-ink-soft)">
                  {t("aiNotConfigured")} —{" "}
                  <Link href="/settings" className="underline">{t("settings")}</Link>
                </p>
              )}
              {reading && (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{reading.text}</p>
                  <p className="mt-3 text-xs text-(--color-ink-soft)">
                    ✨ {reading.provider} ·{" "}
                    {reading.costUsd === 0 ? t("free") : fmtCost(reading.costUsd)}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </AppShell>
    </ProfileTheme>
  );
}
