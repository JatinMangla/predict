"use client";

// Precision Timing — the classical five-step funnel, computed end to end:
//   1 Birth-time confidence → 2 Natal promise → 3 Dasha years →
//   4 Gochara weeks → 5 Muhurta (exact day + clock window)
// Each step narrows the one above it. AI reads the whole funnel at the end.

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useKundli } from "@/lib/useKundli";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ProfileTheme } from "@/components/ProfileTheme";
import { CATEGORIES, type CategoryDef } from "@/lib/interpret/categories";
import {
  runPrecisionFunnel,
  type PrecisionFunnel,
  type ScopeKind,
} from "@/lib/astro/precisionTiming";
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
import { fmtDate, fmtTime, planetName } from "@/lib/format";

const DAY_MS = 86400 * 1000;

/** yyyy-mm-dd for a local date */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayStart(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}
function weekStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - ((d.getDay() + 6) % 7) * DAY_MS;
}
function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function TimingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, kundli, loading, error } = useKundli(Number(id));
  const { t, lang } = useI18n();
  const [category, setCategory] = useState<CategoryDef | null>(null);
  const [scopeKind, setScopeKind] = useState<ScopeKind>("monthly");
  const [pickedDate, setPickedDate] = useState(() => isoDate(new Date()));
  const [weekAnchor, setWeekAnchor] = useState(() => weekStart(Date.now()));
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [reading, setReading] = useState<{ text: string; provider: string; costUsd: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getAiConfig().then(setCfg);
    getUsageSummary().then(setUsage);
  }, []);

  const scope = useMemo(() => {
    if (scopeKind === "daily") return { kind: scopeKind, fromMs: dayStart(pickedDate), days: 1 };
    if (scopeKind === "weekly") return { kind: scopeKind, fromMs: weekAnchor, days: 7 };
    if (scopeKind === "monthly") return { kind: scopeKind, fromMs: todayStart(), days: 30 };
    return { kind: scopeKind, fromMs: todayStart(), days: 365 };
  }, [scopeKind, pickedDate, weekAnchor]);

  const funnel: PrecisionFunnel | null = useMemo(() => {
    if (!kundli || !category) return null;
    return runPrecisionFunnel(
      kundli,
      category.houses,
      category.karakas,
      scope,
      new Date().getTimezoneOffset()
    );
  }, [kundli, category, scope]);

  const canUseAi = cfg !== null && aiAvailable(cfg);
  const quotaExhausted =
    cfg !== null && usage !== null && usage.geminiRemaining <= 0 && !cfg.serverClaude;

  const askAi = useCallback(async () => {
    if (!kundli || !cfg || !category || !funnel || busy) return;
    setBusy(true);
    setNotice("");
    const f = funnel;
    const dashaLines = f.step3
      .map((w) => `${w.mahaLord}-${w.antarLord}: ${new Date(w.startMs).toISOString().slice(0, 10)} to ${new Date(w.endMs).toISOString().slice(0, 10)} (relevance ${w.relevance}/100; ${w.reasons.join("; ")})`)
      .join("\n");
    const gocharaLines = f.step4
      .map((w) => `${w.planet}: ${new Date(w.startMs).toISOString().slice(0, 10)} to ${new Date(w.endMs).toISOString().slice(0, 10)} — ${w.note}, H${w.houseFromLagna} from lagna / H${w.houseFromChandra} from Moon${w.bindus !== null ? `, ${w.bindus} bindus` : ""}`)
      .join("\n");
    const muhurtaLines = f.step5
      .map((w) => `${new Date(w.dayStartMs + 43200000).toISOString().slice(0, 10)} score ${w.score}/100, act ${w.bestFrom ? fmtTime(w.bestFrom, "en") : "?"}-${w.bestTo ? fmtTime(w.bestTo, "en") : "?"}, avoid ${w.avoidFrom ? fmtTime(w.avoidFrom, "en") : "?"}-${w.avoidTo ? fmtTime(w.avoidTo, "en") : "?"}`)
      .join("\n");

    const scopeLabel = {
      daily: `the single day ${pickedDate}`,
      weekly: `the week of ${isoDate(new Date(weekAnchor))}`,
      monthly: "the next 30 days",
      yearly: "the next 12 months",
    }[scopeKind];

    const question =
      `Life area: ${category.label.en} (${category.scope.en}).\n` +
      `Timeframe under examination: ${scopeLabel}.\n` +
      `I have already run the classical five-step precision funnel on this chart for that timeframe. Read it as a whole and give the final verdict.\n\n` +
      `STEP 1 — Birth-time confidence: lagna stable ${f.step1.lagnaMinutesBefore}min before / ${f.step1.lagnaMinutesAfter}min after the stated time; navamsa lagna stable only ${f.step1.navamsaMinutesBefore}/${f.step1.navamsaMinutesAfter}min (confidence: ${f.step1.confidence}).\n\n` +
      `STEP 2 — Natal promise: ${f.step2.score}/100 (${f.step2.verdict}).\nSupports: ${f.step2.supports.join("; ") || "none"}\nBlocks: ${f.step2.blocks.join("; ") || "none"}\n\n` +
      `STEP 3 — Dasha windows:\n${dashaLines || "none relevant"}\n\n` +
      `STEP 4 — Gochara windows:\n${gocharaLines || "none"}\n\n` +
      `STEP 5 — Muhurta candidates:\n${muhurtaLines || "none"}\n\n` +
      `Answer for ${scopeLabel}: (a) does the chart promise this at all and how strongly, (b) which running period drives it and why, (c) the strongest stretch inside the timeframe, (d) the exact date and clock window to act, (e) what to avoid and any precaution. Use the supplied dates and times exactly.`;

    const result = await callAi(question, kundli, lang, cfg, "schedule");
    setBusy(false);
    getUsageSummary().then(setUsage);
    if (typeof result === "string") {
      setNotice(result === "quota-exhausted" ? t("aiQuotaExhausted") : t("aiUnavailable"));
      return;
    }
    setReading({ text: result.answer, provider: result.provider, costUsd: result.costUsd });
  }, [kundli, cfg, category, funnel, busy, lang, t, scopeKind, pickedDate, weekAnchor]);

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

  const Step = ({
    n,
    title,
    subtitle,
    children,
  }: {
    n: number;
    title: string;
    subtitle: string;
    children: React.ReactNode;
  }) => (
    <section className="card p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="accent-bg accent-text flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
          {n}
        </span>
        <div>
          <h2 className="text-sm font-medium text-(--color-gold-soft)">{title}</h2>
          <p className="text-xs text-(--color-ink-soft)">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );

  return (
    <ProfileTheme birthdayNumber={kundli.numerology.birthdayNumber}>
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-(--color-gold-soft)">
                🎯 {t("precisionTiming")} — {profile.name}
              </h1>
              <p className="mt-0.5 text-sm text-(--color-ink-soft)">{t("precisionTimingNote")}</p>
            </div>
            {usage && (
              <Link
                href="/settings"
                className={`rounded-full border px-3 py-1 text-xs ${
                  quotaExhausted ? "border-red-500/50 text-red-300" : "border-(--color-line) text-(--color-ink-soft)"
                }`}
              >
                ✨ {usage.geminiRemaining}/{GEMINI_FREE_RPD} {t("freeCallsLeft")}
              </Link>
            )}
          </div>

          {/* Timeframe + date/week pickers */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-(--color-line) p-1 text-sm">
              {(["daily", "weekly", "monthly", "yearly"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setScopeKind(s);
                    setReading(null);
                  }}
                  className={`rounded-md px-3 py-1.5 transition ${
                    scopeKind === s ? "accent-bg accent-text font-medium" : "text-(--color-ink-soft)"
                  }`}
                >
                  {t(s)}
                </button>
              ))}
            </div>

            {scopeKind === "daily" && (
              <input
                type="date"
                value={pickedDate}
                onChange={(e) => {
                  setPickedDate(e.target.value);
                  setReading(null);
                }}
                className="rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm outline-none focus:border-(--accent)"
              />
            )}

            {scopeKind === "weekly" && (
              <div className="flex items-center gap-1 rounded-lg border border-(--color-line) p-1 text-sm">
                <button
                  onClick={() => {
                    setWeekAnchor((w) => w - 7 * DAY_MS);
                    setReading(null);
                  }}
                  className="rounded-md px-2 py-1 text-(--color-ink-soft) hover:text-(--color-ink)"
                >
                  ←
                </button>
                <span className="px-2 text-xs">
                  {fmtDate(weekAnchor + 43200000, lang)} – {fmtDate(weekAnchor + 6 * DAY_MS + 43200000, lang)}
                </span>
                <button
                  onClick={() => {
                    setWeekAnchor((w) => w + 7 * DAY_MS);
                    setReading(null);
                  }}
                  className="rounded-md px-2 py-1 text-(--color-ink-soft) hover:text-(--color-ink)"
                >
                  →
                </button>
                <button
                  onClick={() => {
                    setWeekAnchor(weekStart(Date.now()));
                    setReading(null);
                  }}
                  className="rounded-md px-2 py-1 text-xs accent-text"
                >
                  {t("todayLabel")}
                </button>
              </div>
            )}
          </div>

          {/* Goal picker */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => {
                  setCategory(cat);
                  setReading(null);
                }}
                className={`card flex flex-col items-center gap-1 p-3 text-center text-xs transition hover:border-(--accent) ${
                  category?.key === cat.key ? "accent-bg border-(--accent)" : ""
                }`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="leading-tight">{lang === "hi" ? cat.label.hi : cat.label.en}</span>
              </button>
            ))}
          </div>

          {!category && (
            <div className="card p-8 text-center text-sm text-(--color-ink-soft)">
              👆 {t("pickGoalHint")}
            </div>
          )}

          {category && funnel && (
            <div className="space-y-3">
              {/* Step 1 — birth time */}
              <Step n={1} title={t("step1Title")} subtitle={t("step1Sub")}>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        funnel.step1.confidence === "high"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : funnel.step1.confidence === "medium"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {t(`btr_${funnel.step1.confidence}` as never)}
                    </span>
                  </div>
                  <p className="text-(--color-ink-soft)">
                    {t("lagnaStable")}: −{funnel.step1.lagnaMinutesBefore} / +{funnel.step1.lagnaMinutesAfter} {t("minutes")}
                  </p>
                  <p className="text-(--color-ink-soft)">
                    {t("navamsaStable")}: −{funnel.step1.navamsaMinutesBefore} / +{funnel.step1.navamsaMinutesAfter} {t("minutes")}
                  </p>
                  <p className="text-xs text-(--color-ink-soft)">{t("btrNote")}</p>
                </div>
              </Step>

              {/* Step 2 — natal promise */}
              <Step n={2} title={t("step2Title")} subtitle={t("step2Sub")}>
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-2xl font-semibold accent-text">{funnel.step2.score}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      funnel.step2.verdict === "strong"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : funnel.step2.verdict === "moderate"
                          ? "bg-sky-500/15 text-sky-300"
                          : funnel.step2.verdict === "conditional"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-red-500/15 text-red-300"
                    }`}
                  >
                    {t(`promise_${funnel.step2.verdict}` as never)}
                  </span>
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-emerald-300">✓ {t("supportiveFactors")}</p>
                    <ul className="space-y-0.5 text-xs text-(--color-ink-soft)">
                      {funnel.step2.supports.length ? (
                        funnel.step2.supports.map((s, i) => <li key={i}>• {s}</li>)
                      ) : (
                        <li>—</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-red-300">✕ {t("challengesLabel")}</p>
                    <ul className="space-y-0.5 text-xs text-(--color-ink-soft)">
                      {funnel.step2.blocks.length ? (
                        funnel.step2.blocks.map((s, i) => <li key={i}>• {s}</li>)
                      ) : (
                        <li>—</li>
                      )}
                    </ul>
                  </div>
                </div>
              </Step>

              {/* Step 3 — dasha */}
              <Step
                n={3}
                title={t("step3Title")}
                subtitle={
                  scopeKind === "daily" || scopeKind === "weekly"
                    ? t("step3SubShort")
                    : t("step3Sub")
                }
              >
                <div className="space-y-2">
                  {funnel.step3.length === 0 ? (
                    <p className="text-sm text-(--color-ink-soft)">—</p>
                  ) : (
                    funnel.step3.map((w, i) => (
                      <div key={i} className="rounded-lg border border-(--color-line) p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {planetName(w.mahaLord, lang)} – {planetName(w.antarLord, lang)}
                            {w.pratyantarLord && ` – ${planetName(w.pratyantarLord, lang)}`}
                          </span>
                          <span className="text-xs accent-text">{w.relevance}/100</span>
                        </div>
                        <p className="text-xs text-(--color-ink-soft)">
                          {fmtDate(w.startMs, lang)} → {fmtDate(w.endMs, lang)}
                        </p>
                        <p className="mt-1 text-xs text-(--color-ink-soft)">{w.reasons.join(" · ")}</p>
                      </div>
                    ))
                  )}
                </div>
              </Step>

              {/* Step 4 — gochara */}
              <Step
                n={4}
                title={t("step4Title")}
                subtitle={
                  scopeKind === "daily" || scopeKind === "weekly"
                    ? t("step4SubShort")
                    : t("step4Sub")
                }
              >
                <div className="space-y-2">
                  {funnel.step4.length === 0 ? (
                    <p className="text-sm text-(--color-ink-soft)">{t("noGocharaWindow")}</p>
                  ) : (
                    funnel.step4.map((w, i) => (
                      <div key={i} className="rounded-lg border border-(--color-line) p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">{planetName(w.planet, lang)}</span>
                          <span className="text-xs text-(--color-ink-soft)">
                            {fmtDate(w.startMs, lang)} → {fmtDate(w.endMs, lang)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-(--color-ink-soft)">
                          {t("yourHouse")} {w.houseFromLagna} · {t("fromChandra")} {w.houseFromChandra}
                          {w.bindus !== null && ` · ${w.bindus}/8 ${t("bindus")}`}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Step>

              {/* Step 5 — muhurta */}
              <Step n={5} title={t("step5Title")} subtitle={t("step5Sub")}>
                <div className="divide-y divide-(--color-line)/50">
                  {funnel.step5.map((w) => (
                    <div key={w.dayStartMs} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div>
                        <span className="text-sm font-medium">
                          {new Date(w.dayStartMs + 43200000).toLocaleDateString(
                            lang === "hi" ? "hi-IN" : "en-IN",
                            { weekday: "short", day: "numeric", month: "short", year: "numeric" }
                          )}
                        </span>
                        <p className="text-xs text-(--color-ink-soft)">
                          {lang === "hi" ? w.taraName.hi : w.taraName.en} · {t("yourHouse")} {w.moonHouseFromLagna}
                          {w.dashaSupports && w.dashaLord ? ` · ${planetName(w.dashaLord, lang)} ✓` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        {w.bestFrom !== undefined && (
                          <div className="text-emerald-300">
                            ✓ {fmtTime(w.bestFrom, lang)} – {fmtTime(w.bestTo!, lang)}
                          </div>
                        )}
                        {w.avoidFrom !== undefined && (
                          <div className="text-red-300">
                            ✕ {fmtTime(w.avoidFrom, lang)} – {fmtTime(w.avoidTo!, lang)}
                          </div>
                        )}
                        <div className="text-(--color-ink-soft)">{w.score}/100</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Step>

              {/* AI synthesis of the whole funnel */}
              <section className="card border-l-4 border-violet-500/40 p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-violet-300">✨ {t("finalVerdict")}</h2>
                  {!busy && canUseAi && (
                    <button
                      onClick={askAi}
                      disabled={quotaExhausted}
                      className="rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-50"
                    >
                      {reading ? "↻" : t("getAiInsight")}
                    </button>
                  )}
                </div>
                {busy && <p className="text-sm text-(--color-ink-soft)">✨ {t("aiThinking")}</p>}
                {notice && <p className="text-sm text-orange-300">{notice}</p>}
                {!canUseAi && !busy && (
                  <p className="text-sm text-(--color-ink-soft)">
                    {t("aiNotConfigured")} — <Link href="/settings" className="underline">{t("settings")}</Link>
                  </p>
                )}
                {reading && (
                  <>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{reading.text}</p>
                    <p className="mt-3 text-xs text-(--color-ink-soft)">
                      ✨ {reading.provider} · {reading.costUsd === 0 ? t("free") : fmtCost(reading.costUsd)}
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
