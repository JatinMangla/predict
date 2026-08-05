"use client";

// Personal life-area reading. Four clearly separated blocks:
//   1. Chart factors   — the placements for this area (no dates mixed in)
//   2. Favourable / caution dates — computed from THIS kundli, with times
//   3. AI reading      — personal only, never sign-level generic
//   4. Verify a forecast — paste any prediction you heard; every claim is
//      tested against this chart and only what holds survives.

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useKundli } from "@/lib/useKundli";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ProfileTheme } from "@/components/ProfileTheme";
import { CATEGORIES, type CategoryDef } from "@/lib/interpret/categories";
import {
  personalDayWindows,
  bestDays,
  cautionDays,
  type FavourableWindow,
} from "@/lib/astro/favourableWindows";
import { SIGN_LORDS, SIGN_NAMES, NAKSHATRA_NAMES } from "@/lib/astro/constants";
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
import {
  fmtDate,
  fmtDegInSign,
  fmtTime,
  planetName,
  signName,
} from "@/lib/format";

type Period = "month" | "year";
const PERIOD_DAYS: Record<Period, number> = { month: 30, year: 365 };

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
  // Verify-a-forecast state
  const [pasted, setPasted] = useState("");
  const [verifyOut, setVerifyOut] = useState<{ text: string; provider: string; costUsd: number } | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  useEffect(() => {
    getAiConfig().then(setCfg);
    getUsageSummary().then(setUsage);
  }, []);

  const moon = useMemo(
    () => kundli?.planets.find((p) => p.id === "Moon") ?? null,
    [kundli]
  );

  /** Placements that decide the selected life area — evidence only, no dates */
  const chartFactors = useMemo(() => {
    if (!kundli || !category) return [];
    const rows: { label: string; detail: string; good: boolean | null }[] = [];
    for (const h of category.houses) {
      const sign = (kundli.lagna.sign + h - 1) % 12;
      const lordId = SIGN_LORDS[sign];
      const lord = kundli.planets.find((p) => p.id === lordId)!;
      const strong = ["exalted", "own", "moolatrikona"].includes(lord.dignity);
      const weak = ["debilitated", "enemy"].includes(lord.dignity) || lord.combust;
      rows.push({
        label: `${t("houses")} ${h} — ${signName(sign, lang)}`,
        detail: `${t("lord")} ${planetName(lordId, lang)} → ${t("house")} ${lord.house} (${signName(lord.sign, lang)}, ${fmtDegInSign(lord.degInSign)}, ${t(lord.dignity as never)}${lord.combust ? `, ${t("combust")}` : ""})`,
        good: strong ? true : weak ? false : null,
      });
    }
    for (const k of category.karakas) {
      const p = kundli.planets.find((x) => x.id === k)!;
      const strong = ["exalted", "own", "moolatrikona"].includes(p.dignity);
      const weak = ["debilitated", "enemy"].includes(p.dignity) || p.combust;
      rows.push({
        label: `${t("karaka")} ${planetName(k, lang)}`,
        detail: `${t("house")} ${p.house} (${signName(p.sign, lang)}, ${fmtDegInSign(p.degInSign)}, ${t(p.dignity as never)}${p.combust ? `, ${t("combust")}` : ""}${p.retrograde && k !== "Rahu" && k !== "Ketu" ? `, ${t("retrograde")}` : ""})`,
        good: strong ? true : weak ? false : null,
      });
    }
    return rows;
  }, [kundli, category, lang, t]);

  /** Personal date windows for this area — computed, with exact times */
  const windows = useMemo(() => {
    if (!kundli || !category) return { good: [] as FavourableWindow[], bad: [] as FavourableWindow[] };
    const all = personalDayWindows(
      kundli,
      category.karakas,
      Date.now(),
      PERIOD_DAYS[period],
      new Date().getTimezoneOffset()
    );
    return { good: bestDays(all, period === "month" ? 6 : 10), bad: cautionDays(all, 5) };
  }, [kundli, category, period]);

  const canUseAi = cfg !== null && aiAvailable(cfg);
  const quotaExhausted =
    cfg !== null && usage !== null && usage.geminiRemaining <= 0 && !cfg.serverClaude;

  const fetchReading = useCallback(
    async (cat: CategoryDef, p: Period) => {
      if (!kundli || !cfg || !moon || busy) return;
      setBusy(true);
      setNotice("");
      setReading(null);
      const window = p === "month" ? "the next 30 days" : "the next 12 months";
      const question =
        `Life area: ${cat.label.en} (${cat.scope.en}). Timeframe: ${window}.\n` +
        `Primary houses: ${cat.houses.join(", ")}. Karakas: ${cat.karakas.join(", ")}. Refining varga: ${cat.varga}.\n` +
        `Give the personal reading for THIS native only — no sign-level generalisation.`;
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

  const verifyForecast = useCallback(async () => {
    const text = pasted.trim();
    if (!kundli || !cfg || !text || verifyBusy) return;
    setVerifyBusy(true);
    setNotice("");
    setVerifyOut(null);
    const question =
      `Here is a prediction made for my Moon sign by someone else. Test every claim against MY chart and keep only what is actually true for me:\n\n"""\n${text.slice(0, 3500)}\n"""`;
    const result = await callAi(question, kundli, lang, cfg, "verify");
    setVerifyBusy(false);
    getUsageSummary().then(setUsage);
    if (typeof result === "string") {
      setNotice(result === "quota-exhausted" ? t("aiQuotaExhausted") : t("aiUnavailable"));
      return;
    }
    setVerifyOut({ text: result.answer, provider: result.provider, costUsd: result.costUsd });
  }, [pasted, kundli, cfg, verifyBusy, lang, t]);

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

  const DayRow = ({ w, good }: { w: FavourableWindow; good: boolean }) => (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
      <div>
        <span className="font-medium">{fmtDate(w.dayStartMs + 43200000, lang)}</span>
        <span className="ml-2 text-xs text-(--color-ink-soft)">
          {lang === "hi" ? w.taraName.hi : w.taraName.en} ·{" "}
          {t("chandraOfDay")} {w.chandraHouse}
          {w.varaMatch ? ` · ${planetName(w.varaLord, lang)}` : ""}
        </span>
        {w.festivals.length > 0 && (
          <span className="ml-2 text-xs text-rose-300">
            🪔 {(lang === "hi" ? w.festivals[0].hi : w.festivals[0].en).split(" · ")[0]}
          </span>
        )}
      </div>
      <div className="shrink-0 text-right text-xs">
        {good ? (
          w.bestFrom !== undefined ? (
            <span className="text-emerald-300">
              ✓ {fmtTime(w.bestFrom, lang)} – {fmtTime(w.bestTo!, lang)}
            </span>
          ) : null
        ) : w.avoidFrom !== undefined ? (
          <span className="text-red-300">
            ✕ {fmtTime(w.avoidFrom, lang)} – {fmtTime(w.avoidTo!, lang)}
          </span>
        ) : null}
        <div className="text-(--color-ink-soft)">{w.score}/100</div>
      </div>
    </div>
  );

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
              </Link>
            )}
          </div>

          {/* Timeframe */}
          <div className="mb-4 flex gap-1 rounded-lg border border-(--color-line) p-1 text-sm">
            {(["month", "year"] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p);
                  if (category) void fetchReading(category, p);
                }}
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
                onClick={() => {
                  setCategory(cat);
                  void fetchReading(cat, period);
                }}
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

          {!category && (
            <div className="card p-8 text-center text-sm text-(--color-ink-soft)">
              👆 {t("pickCategoryHint")}
            </div>
          )}

          {category && (
            <div className="space-y-4">
              {/* ── 1. Chart factors (no dates here) ───────────────── */}
              <section className="card p-5">
                <h2 className="mb-3 text-sm font-medium text-(--color-gold-soft)">
                  🪐 {t("chartFactors")} — {category.icon}{" "}
                  {lang === "hi" ? category.label.hi : category.label.en}
                </h2>
                <div className="space-y-2 text-sm">
                  {chartFactors.map((f, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-2">
                      <span
                        className={
                          f.good === true
                            ? "text-emerald-300"
                            : f.good === false
                              ? "text-red-300"
                              : "text-(--color-ink-soft)"
                        }
                      >
                        {f.good === true ? "✓" : f.good === false ? "✕" : "•"}
                      </span>
                      <span className="font-medium">{f.label}</span>
                      <span className="text-(--color-ink-soft)">{f.detail}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-(--color-ink-soft)">
                  {t("varga")}: {category.varga}
                </p>
              </section>

              {/* ── 2. Dates & times (no placements here) ──────────── */}
              <section className="grid gap-4 md:grid-cols-2">
                <div className="card">
                  <h3 className="border-b border-(--color-line) px-4 py-3 text-sm font-medium text-emerald-300">
                    ✓ {t("favourableDatesTimes")}
                  </h3>
                  <div className="divide-y divide-(--color-line)/50">
                    {windows.good.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-(--color-ink-soft)">—</p>
                    ) : (
                      windows.good.map((w) => <DayRow key={w.dayStartMs} w={w} good />)
                    )}
                  </div>
                </div>
                <div className="card">
                  <h3 className="border-b border-(--color-line) px-4 py-3 text-sm font-medium text-red-300">
                    ✕ {t("cautionDatesTimes")}
                  </h3>
                  <div className="divide-y divide-(--color-line)/50">
                    {windows.bad.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-(--color-ink-soft)">—</p>
                    ) : (
                      windows.bad.map((w) => <DayRow key={w.dayStartMs} w={w} good={false} />)
                    )}
                  </div>
                </div>
              </section>
              <p className="text-xs text-(--color-ink-soft)">{t("datesNote")}</p>

              {/* ── 3. AI personal reading ─────────────────────────── */}
              <section className="card border-l-4 border-violet-500/40 p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-violet-300">
                    ✨ {t("personalReading")}
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
                {busy && <p className="text-sm text-(--color-ink-soft)">✨ {t("aiThinking")}</p>}
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
              </section>

              {/* ── 4. Verify someone else's forecast ──────────────── */}
              <section className="card border-l-4 border-amber-500/40 p-5">
                <h2 className="mb-1 text-sm font-medium text-amber-300">
                  🔍 {t("verifyForecast")}
                </h2>
                <p className="mb-3 text-xs text-(--color-ink-soft)">{t("verifyForecastNote")}</p>
                <textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder={t("verifyPlaceholder")}
                  rows={5}
                  maxLength={3500}
                  className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) p-3 text-sm outline-none focus:border-(--accent)"
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={verifyForecast}
                    disabled={verifyBusy || !pasted.trim() || quotaExhausted || !canUseAi}
                    className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    🔍 {t("checkAgainstMyChart")}
                  </button>
                  <span className="text-xs text-(--color-ink-soft)">
                    {pasted.length}/3500
                  </span>
                </div>
                {verifyBusy && (
                  <p className="mt-3 text-sm text-(--color-ink-soft)">✨ {t("aiThinking")}</p>
                )}
                {verifyOut && (
                  <>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                      {verifyOut.text}
                    </p>
                    <p className="mt-3 text-xs text-(--color-ink-soft)">
                      ✨ {verifyOut.provider} ·{" "}
                      {verifyOut.costUsd === 0 ? t("free") : fmtCost(verifyOut.costUsd)}
                    </p>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </AppShell>
    </ProfileTheme>
  );
}
