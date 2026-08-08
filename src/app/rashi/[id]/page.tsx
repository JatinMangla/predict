"use client";

// The single reading page. Timeframe: Daily (date picker) · Weekly (week
// selector) · Monthly · Yearly. Blocks are kept strictly separate:
//   1. Chart factors     — natal placements deciding this area (no dates)
//   2. Planet periods    — each transiting planet: entered / leaves + effect
//   3. Dates & times     — computed windows with exact clock times
//   4. AI reading        — personal only; day/time-wise for daily & weekly
//   5. Verify a forecast — paste any prediction; chart decides what survives

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
import { currentTransitPeriod } from "@/lib/astro/planetPeriods";
import {
  HOUSE_KEYWORDS,
  PLANET_TONE_KEYWORDS,
} from "@/lib/interpret/kb/transitKeywords";
import { SIGN_LORDS, SIGN_NAMES, NAKSHATRA_NAMES } from "@/lib/astro/constants";
import type { PlanetId } from "@/lib/astro/types";
import { callAi, aiAvailable, aiErrorKey, fmtCost } from "@/lib/aiClient";
import { useAiQuota } from "@/lib/useAiQuota";
import {
  fmtDate,
  fmtDegInSign,
  fmtTime,
  planetName,
  signName,
} from "@/lib/format";

type Period = "daily" | "weekly" | "monthly" | "yearly";
const DAY_MS = 86400 * 1000;

/** yyyy-mm-dd for a local date */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** local midnight ms for a yyyy-mm-dd string */
function dayStart(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}
/** Monday of the week containing the given date */
function weekStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7; // Monday-first
  return d.getTime() - shift * DAY_MS;
}

export default function RashiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, kundli, loading, error } = useKundli(Number(id));
  const { t, lang } = useI18n();
  const [category, setCategory] = useState<CategoryDef | null>(null);
  const [period, setPeriod] = useState<Period>("daily");
  const [pickedDate, setPickedDate] = useState(() => isoDate(new Date()));
  const [weekAnchor, setWeekAnchor] = useState(() => weekStart(Date.now()));
  const { cfg, usage } = useAiQuota();
  const [reading, setReading] = useState<{ text: string; provider: string; costUsd: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [pasted, setPasted] = useState("");
  const [verifyOut, setVerifyOut] = useState<{ text: string; provider: string; costUsd: number } | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const moon = useMemo(
    () => kundli?.planets.find((p) => p.id === "Moon") ?? null,
    [kundli]
  );

  /** Natal placements deciding the area — evidence only, no dates */
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
        detail: `${t("house")} ${p.house} (${signName(p.sign, lang)}, ${fmtDegInSign(p.degInSign)}, ${t(p.dignity as never)}${p.combust ? `, ${t("combust")}` : ""})`,
        good: strong ? true : weak ? false : null,
      });
    }
    return rows;
  }, [kundli, category, lang, t]);

  /** Where each key planet is transiting now: from when, till when, effect */
  const planetPeriods = useMemo(() => {
    if (!kundli || !category || !moon) return [];
    const ids = new Set<PlanetId>(category.karakas);
    for (const h of category.houses) {
      ids.add(SIGN_LORDS[(kundli.lagna.sign + h - 1) % 12]);
    }
    return [...ids].map((pid) => {
      const tp = currentTransitPeriod(pid, kundli);
      const good = tp.judgement.favourable;
      const hk = HOUSE_KEYWORDS[tp.judgement.houseFromLagna - 1];
      const tone = PLANET_TONE_KEYWORDS[pid][good ? "good" : "bad"];
      return {
        ...tp,
        good,
        keywords: [hk[0], hk[1], tone].map((k) => (lang === "hi" ? k.hi : k.en)),
      };
    });
  }, [kundli, category, moon, lang]);

  /** Computed date windows for the selected timeframe */
  const windows = useMemo(() => {
    if (!kundli || !category) return { list: [] as FavourableWindow[], good: [] as FavourableWindow[], bad: [] as FavourableWindow[] };
    const tz = new Date().getTimezoneOffset();
    let from = Date.now();
    let days = 30;
    if (period === "daily") {
      from = dayStart(pickedDate);
      days = 1;
    } else if (period === "weekly") {
      from = weekAnchor;
      days = 7;
    } else if (period === "yearly") {
      days = 365;
    }
    const list = personalDayWindows(
      kundli,
      category.houses,
      category.karakas,
      from,
      days,
      tz
    ).slice(
      0,
      period === "daily" ? 1 : period === "weekly" ? 7 : undefined
    );
    return {
      list,
      good: bestDays(list, period === "yearly" ? 10 : 6),
      bad: cautionDays(list, 5),
    };
  }, [kundli, category, period, pickedDate, weekAnchor]);

  const canUseAi = cfg !== null && aiAvailable(cfg);
  const quotaExhausted =
    cfg !== null && usage !== null && usage.geminiRemaining <= 0 && !cfg.serverClaude;

  /** Compact table of computed windows handed to the AI verbatim */
  const windowTable = useCallback(
    (list: FavourableWindow[]) =>
      list
        .map((w) => {
          const d = new Date(w.dayStartMs + 43200000);
          const day = d.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          const best =
            w.bestFrom !== undefined
              ? `${fmtTime(w.bestFrom, "en")}-${fmtTime(w.bestTo!, "en")}`
              : "n/a";
          const avoid =
            w.avoidFrom !== undefined
              ? `${fmtTime(w.avoidFrom, "en")}-${fmtTime(w.avoidTo!, "en")}`
              : "n/a";
          return `${day} | score ${w.score}/100 (${w.rating}) | tara ${w.taraName.en} | Moon transits YOUR ${w.moonHouseFromLagna}th house from lagna${w.moonBindus !== null ? ` (${w.moonBindus} bindus)` : ""} | running dasha lord ${w.dashaLord ?? "?"}${w.dashaSupports ? " (activates this area)" : ""} | best window ${best} | blocked window ${avoid}${w.festivals.length ? ` | festival: ${w.festivals[0].en}` : ""}`;
        })
        .join("\n"),
    []
  );

  const fetchReading = useCallback(
    async (cat: CategoryDef, p: Period, list: FavourableWindow[]) => {
      if (!kundli || !cfg || !moon || busy) return;
      setBusy(true);
      setNotice("");
      setReading(null);

      const isSchedule = p === "daily" || p === "weekly";
      let question: string;
      if (isSchedule) {
        const label =
          p === "daily"
            ? `the single day ${pickedDate}`
            : `the week of ${isoDate(new Date(weekAnchor))}`;
        question =
          `Life area: ${cat.label.en} (${cat.scope.en}).\n` +
          `Make the date-and-time action plan for ${label}.\n` +
          `Primary houses: ${cat.houses.join(", ")}. Karakas: ${cat.karakas.join(", ")}. Varga: ${cat.varga}.\n\n` +
          `PRE-COMPUTED WINDOWS (use these exact dates and times):\n${windowTable(list)}`;
      } else {
        const window = p === "monthly" ? "the next 30 days" : "the next 12 months";
        question =
          `Life area: ${cat.label.en} (${cat.scope.en}). Timeframe: ${window}.\n` +
          `Primary houses: ${cat.houses.join(", ")}. Karakas: ${cat.karakas.join(", ")}. Varga: ${cat.varga}.\n` +
          `Give the personal reading for THIS native only — no sign-level generalisation.`;
      }

      const result = await callAi(
        question,
        kundli,
        lang,
        cfg,
        isSchedule ? "schedule" : "rashi"
      );
      setBusy(false);
      if (typeof result === "string") {
        setNotice(t(aiErrorKey(result)));
        return;
      }
      setReading({ text: result.answer, provider: result.provider, costUsd: result.costUsd });
    },
    [kundli, cfg, moon, busy, lang, t, pickedDate, weekAnchor, windowTable]
  );

  const verifyForecast = useCallback(async () => {
    const text = pasted.trim();
    if (!kundli || !cfg || !text || verifyBusy) return;
    setVerifyBusy(true);
    setNotice("");
    setVerifyOut(null);
    const question = `Here is a prediction made for my Moon sign by someone else. Test every claim against MY chart and keep only what is actually true for me:\n\n"""\n${text.slice(0, 3500)}\n"""`;
    const result = await callAi(question, kundli, lang, cfg, "verify");
    setVerifyBusy(false);
    if (typeof result === "string") {
      setNotice(t(aiErrorKey(result)));
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
  const weekEnd = weekAnchor + 6 * DAY_MS;

  const DayRow = ({ w, good }: { w: FavourableWindow; good: boolean }) => (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
      <div>
        <span className="font-medium">{fmtDate(w.dayStartMs + 43200000, lang)}</span>
        <span className="ml-2 text-xs text-(--color-ink-soft)">
          {lang === "hi" ? w.taraName.hi : w.taraName.en} · {t("yourHouse")} {w.moonHouseFromLagna}
          {w.dashaSupports && w.dashaLord ? ` · ${planetName(w.dashaLord, lang)} ✓` : ""}
          {w.varaMatch ? ` · ${planetName(w.varaLord, lang)}` : ""}
        </span>
        {w.festivals.length > 0 && (
          <span className="ml-2 text-xs text-rose-300">
            🪔 {(lang === "hi" ? w.festivals[0].hi : w.festivals[0].en).split(" · ")[0]}
          </span>
        )}
      </div>
      <div className="shrink-0 text-right text-xs">
        {good && w.bestFrom !== undefined && (
          <span className="text-emerald-300">
            ✓ {fmtTime(w.bestFrom, lang)} – {fmtTime(w.bestTo!, lang)}
          </span>
        )}
        {!good && w.avoidFrom !== undefined && (
          <span className="text-red-300">
            ✕ {fmtTime(w.avoidFrom, lang)} – {fmtTime(w.avoidTo!, lang)}
          </span>
        )}
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
                {t("ascendant")}:{" "}
                <span className="accent-text font-medium">
                  {signName(kundli.lagna.sign, lang)} {fmtDegInSign(kundli.lagna.degInSign)}
                </span>{" "}
                · {t("moonSign")}: {rashiName} · {t("birthNakshatra")}:{" "}
                {lang === "hi" ? NAKSHATRA_NAMES[moon.nakshatra].hi : NAKSHATRA_NAMES[moon.nakshatra].en}
              </p>
            </div>
            {usage && (
              <Link
                href="/settings"
                className={`rounded-full border px-3 py-1 text-xs ${
                  quotaExhausted ? "border-red-500/50 text-red-300" : "border-(--color-line) text-(--color-ink-soft)"
                }`}
                title={t("quotaNote")}
              >
                ✨ {usage.geminiRemaining}/{usage.geminiLimit} {t("freeCallsLeft")}
              </Link>
            )}
          </div>

          {/* Timeframe + date/week pickers */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-(--color-line) p-1 text-sm">
              {(["daily", "weekly", "monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setReading(null);
                  }}
                  className={`rounded-md px-3 py-1.5 transition ${
                    period === p ? "accent-bg accent-text font-medium" : "text-(--color-ink-soft)"
                  }`}
                >
                  {t(p)}
                </button>
              ))}
            </div>

            {period === "daily" && (
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

            {period === "weekly" && (
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
                  {fmtDate(weekAnchor + 43200000, lang)} – {fmtDate(weekEnd + 43200000, lang)}
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

          {/* Category picker */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat)}
                disabled={busy}
                className={`card flex flex-col items-center gap-1 p-3 text-center text-xs transition hover:border-(--accent) disabled:opacity-60 ${
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
              👆 {t("pickCategoryHint")}
            </div>
          )}

          {category && (
            <div className="space-y-4">
              {/* 1. Natal chart factors */}
              <section className="card p-5">
                <h2 className="mb-3 text-sm font-medium text-(--color-gold-soft)">
                  🪐 {t("chartFactors")} — {category.icon}{" "}
                  {lang === "hi" ? category.label.hi : category.label.en}
                </h2>
                <div className="space-y-2 text-sm">
                  {chartFactors.map((f, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-2">
                      <span className={f.good === true ? "text-emerald-300" : f.good === false ? "text-red-300" : "text-(--color-ink-soft)"}>
                        {f.good === true ? "✓" : f.good === false ? "✕" : "•"}
                      </span>
                      <span className="font-medium">{f.label}</span>
                      <span className="text-(--color-ink-soft)">{f.detail}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-(--color-ink-soft)">{t("varga")}: {category.varga}</p>
              </section>

              {/* 2. Planet transit periods: from / till / effect keywords */}
              <section className="card">
                <h2 className="border-b border-(--color-line) px-4 py-3 text-sm font-medium text-(--color-gold-soft)">
                  🔭 {t("planetPeriods")}
                </h2>
                <div className="divide-y divide-(--color-line)/50">
                  {planetPeriods.map((p) => (
                    <div key={p.planet} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm">
                          <span className="font-medium">{planetName(p.planet, lang)}</span>
                          <span className="text-(--color-ink-soft)">
                            {" "}
                            {signName(p.sign, lang)} {fmtDegInSign(p.degInSign)}
                            {p.retrograde && p.planet !== "Rahu" && p.planet !== "Ketu" ? ` · ${t("retrograde")}` : ""}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                            p.good ? "border-emerald-500/30 text-emerald-300" : "border-orange-500/30 text-orange-300"
                          }`}
                        >
                          {p.good ? t("favourable") : t("unfavourable")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-(--color-ink-soft)">
                        {t("stayFrom")}:{" "}
                        {p.enteredMs
                          ? `${fmtDate(p.enteredMs, lang)} ${fmtTime(p.enteredMs, lang)}`
                          : "—"}{" "}
                        · {t("stayTill")}:{" "}
                        {p.leavesMs
                          ? `${fmtDate(p.leavesMs, lang)} ${fmtTime(p.leavesMs, lang)}`
                          : "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-(--color-ink-soft)">
                        {t("yourHouse")} {p.judgement.houseFromLagna}
                        {p.judgement.rules.length > 0 &&
                          ` · ${t("rulesHouses")} ${p.judgement.rules.join(", ")}`}
                        {p.judgement.bindus !== null &&
                          ` · ${p.judgement.bindus}/8 ${t("bindus")}`}
                        {` · ${p.judgement.nature === "neutral" ? t("neutralNature") : t(p.judgement.nature as never)}`}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {p.keywords.map((k, i) => (
                          <span
                            key={i}
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              p.good ? "bg-emerald-500/10 text-emerald-300" : "bg-orange-500/10 text-orange-300"
                            }`}
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="px-4 py-3 text-xs text-(--color-ink-soft)">{t("planetPeriodsNote")}</p>
              </section>

              {/* 3. Dates & times */}
              {period === "daily" || period === "weekly" ? (
                <section className="card">
                  <h3 className="border-b border-(--color-line) px-4 py-3 text-sm font-medium text-(--color-gold-soft)">
                    📅 {period === "daily" ? t("daily") : t("weekly")} — {t("favourableDatesTimes")}
                  </h3>
                  <div className="divide-y divide-(--color-line)/50">
                    {windows.list.map((w) => (
                      <div key={w.dayStartMs} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {new Date(w.dayStartMs + 43200000).toLocaleDateString(
                              lang === "hi" ? "hi-IN" : "en-IN",
                              { weekday: "short", day: "numeric", month: "short" }
                            )}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              w.rating === "excellent" || w.rating === "good"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : w.rating === "mixed"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-red-500/15 text-red-300"
                            }`}
                          >
                            {w.score}/100
                          </span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-xs">
                          {w.bestFrom !== undefined && (
                            <p className="text-emerald-300">
                              ✓ {fmtTime(w.bestFrom, lang)} – {fmtTime(w.bestTo!, lang)} · {t("abhijitM")}
                            </p>
                          )}
                          {w.avoidFrom !== undefined && (
                            <p className="text-red-300">
                              ✕ {fmtTime(w.avoidFrom, lang)} – {fmtTime(w.avoidTo!, lang)} · {t("rahuKaal")}
                            </p>
                          )}
                          <p className="text-(--color-ink-soft)">
                            {lang === "hi" ? w.taraName.hi : w.taraName.en} · {t("yourHouse")} {w.moonHouseFromLagna}
          {w.dashaSupports && w.dashaLord ? ` · ${planetName(w.dashaLord, lang)} ✓` : ""}
                            {w.festivals.length > 0 && (
                              <span className="ml-2 text-rose-300">
                                🪔 {(lang === "hi" ? w.festivals[0].hi : w.festivals[0].en).split(" · ")[0]}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
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
              )}
              <p className="text-xs text-(--color-ink-soft)">{t("lagnaBasedNote")}</p>

              {/* 4. AI reading */}
              <section className="card border-l-4 border-violet-500/40 p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-violet-300">
                    ✨ {period === "daily" || period === "weekly" ? t("timeWisePlan") : t("personalReading")}
                  </h2>
                  {!busy && canUseAi && (
                    <button
                      onClick={() => fetchReading(category, period, windows.list)}
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

              {/* 5. Verify someone else's forecast */}
              <section className="card border-l-4 border-amber-500/40 p-5">
                <h2 className="mb-1 text-sm font-medium text-amber-300">🔍 {t("verifyForecast")}</h2>
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
                  <span className="text-xs text-(--color-ink-soft)">{pasted.length}/3500</span>
                </div>
                {verifyBusy && <p className="mt-3 text-sm text-(--color-ink-soft)">✨ {t("aiThinking")}</p>}
                {verifyOut && (
                  <>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{verifyOut.text}</p>
                    <p className="mt-3 text-xs text-(--color-ink-soft)">
                      ✨ {verifyOut.provider} · {verifyOut.costUsd === 0 ? t("free") : fmtCost(verifyOut.costUsd)}
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
