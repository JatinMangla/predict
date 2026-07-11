"use client";

// Personal kundli calendar: the Hindu month grid scored for ONE person's
// chart — each day coloured by their Tarabala (day star vs birth star) and
// Chandra Bala (transit Moon vs natal Moon), with the running dasha and the
// full panchang in the detail view. Fully offline.

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useKundli } from "@/lib/useKundli";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ProfileTheme } from "@/components/ProfileTheme";
import { MoonPhase } from "@/components/MoonPhase";
import { PanchangCard } from "@/components/kundli/PanchangCard";
import {
  buildMonthCalendar,
  lunarMonthInfo,
  personalDayQuality,
  LUNAR_MONTHS,
  TARABALA9,
  type CalendarDayInfo,
} from "@/lib/astro/hinduCalendar";
import { computePanchang } from "@/lib/astro/panchang";
import { activeDashas } from "@/lib/astro/dasha";
import { VARA_NAMES } from "@/lib/astro/constants";
import { nakshatraName, planetName, tithiName } from "@/lib/format";

export default function PersonalCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile, kundli, loading, error } = useKundli(Number(id));
  const { t, lang } = useI18n();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<CalendarDayInfo | null>(null);

  const days = useMemo(() => {
    if (!profile) return [];
    return buildMonthCalendar(
      year,
      month,
      profile.latitude,
      profile.longitude,
      new Date(year, month, 15).getTimezoneOffset()
    );
  }, [year, month, profile]);

  const lunar = useMemo(
    () => lunarMonthInfo(Date.UTC(year, month, 15, 12)),
    [year, month]
  );

  const natal = useMemo(() => {
    if (!kundli) return null;
    const moon = kundli.planets.find((p) => p.id === "Moon")!;
    return { nakshatra: moon.nakshatra, moonSign: moon.sign };
  }, [kundli]);

  const selectedPanchang = useMemo(() => {
    if (!selected || !profile) return null;
    const d = new Date(selected.dayStartMs + 12 * 3600 * 1000);
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return computePanchang(selected.refMs, profile.latitude, profile.longitude, localDate);
  }, [selected, profile]);

  if (loading) return <AppShell><p className="p-8 text-center text-(--color-ink-soft)">{t("loading")}</p></AppShell>;
  if (error || !kundli || !profile || !natal) {
    return (
      <AppShell>
        <div className="card mx-auto max-w-md p-8 text-center">
          <p className="text-red-300">{error ?? t("error")}</p>
          <Link href="/" className="accent-text mt-4 inline-block text-sm underline">← {t("dashboard")}</Link>
        </div>
      </AppShell>
    );
  }

  const prevMonth = () => {
    setSelected(null);
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSelected(null);
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1);
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    lang === "hi" ? "hi-IN" : "en-IN",
    { month: "long", year: "numeric" }
  );
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const firstWeekday = new Date(year, month, 1).getDay();

  const qualityCls = [
    "border-red-500/50 bg-red-500/10",       // 0 caution
    "border-amber-500/50 bg-amber-500/10",   // 1 mixed
    "border-emerald-500/50 bg-emerald-500/10", // 2 favourable
  ];
  const qualityLabel = (q: 0 | 1 | 2) =>
    q === 2 ? t("favourable") : q === 1 ? t("neutralT") : t("unfavourable");

  const selectedQ = selected ? personalDayQuality(selected, natal.nakshatra, natal.moonSign) : null;
  const selectedDasha = selected ? activeDashas(kundli.dasha, selected.refMs) : [];

  return (
    <ProfileTheme birthdayNumber={kundli.numerology.birthdayNumber}>
      <AppShell>
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-(--color-gold-soft)">
                {t("personalCalendarTitle")} — {profile.name}
              </h1>
              <p className="mt-0.5 text-sm text-(--color-ink-soft)">
                {t("lunarMonth")}:{" "}
                <span className="accent-text font-medium">
                  {lang === "hi" ? LUNAR_MONTHS[lunar.index].hi : LUNAR_MONTHS[lunar.index].en}
                </span>{" "}
                · {t("vikramSamvat")} {lunar.vikramSamvat} ·{" "}
                <Link href="/calendar" className="underline">{t("generalCalendar")}</Link>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="rounded-lg border border-(--color-line) px-3 py-2 text-sm text-(--color-ink-soft) transition hover:text-(--color-ink)" aria-label="previous month">←</button>
              <span className="min-w-36 text-center font-medium">{monthLabel}</span>
              <button onClick={nextMonth} className="rounded-lg border border-(--color-line) px-3 py-2 text-sm text-(--color-ink-soft) transition hover:text-(--color-ink)" aria-label="next month">→</button>
            </div>
          </div>

          <p className="mb-3 text-xs text-(--color-ink-soft)">{t("dayQualityNote")}</p>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-(--color-ink-soft)">
            {VARA_NAMES.map((v) => (
              <div key={v.en} className="py-1">
                {lang === "hi" ? v.hi.slice(0, 3) : v.en.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Personal month grid */}
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((d) => {
              const q = personalDayQuality(d, natal.nakshatra, natal.moonSign);
              const isToday = `${year}-${month}-${d.day}` === todayKey;
              const isSelected = selected?.day === d.day;
              return (
                <button
                  key={d.day}
                  onClick={() => setSelected(d)}
                  className={`flex min-h-24 flex-col items-center gap-0.5 rounded-xl border p-1.5 text-center transition hover:brightness-125 ${qualityCls[q.quality]} ${
                    isSelected ? "ring-2 ring-(--accent)" : isToday ? "ring-1 ring-(--accent)" : ""
                  }`}
                >
                  <div className="flex w-full items-center justify-between px-0.5">
                    <span className={`text-sm font-semibold ${isToday ? "accent-text" : ""}`}>{d.day}</span>
                    {isToday && <span className="accent-text text-[9px]">{t("todayLabel")}</span>}
                  </div>
                  <MoonPhase elongation={d.elongation} size={22} title={tithiName(d.tithi, lang)} />
                  <span className="text-[10px] leading-tight">
                    {lang === "hi" ? TARABALA9[q.taraIndex].hi : TARABALA9[q.taraIndex].en}
                  </span>
                  <span className="text-[9px] leading-tight text-(--color-ink-soft)">
                    {tithiName(d.tithi, lang)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Day detail — personal reading */}
          {selected && selectedQ && selectedPanchang && (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="card p-5">
                <div className="flex items-center gap-4">
                  <MoonPhase elongation={selected.elongation} size={64} />
                  <div>
                    <p className="font-medium text-(--color-gold-soft)">
                      {new Date(selected.dayStartMs + 12 * 3600 * 1000).toLocaleDateString(
                        lang === "hi" ? "hi-IN" : "en-IN",
                        { weekday: "long", day: "numeric", month: "long" }
                      )}
                    </p>
                    <p
                      className={`mt-0.5 text-sm font-semibold ${
                        selectedQ.quality === 2
                          ? "text-emerald-300"
                          : selectedQ.quality === 1
                            ? "text-amber-300"
                            : "text-red-300"
                      }`}
                    >
                      {qualityLabel(selectedQ.quality)}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-(--color-ink-soft)">{t("taraOfDay")}</dt>
                    <dd>
                      {lang === "hi" ? TARABALA9[selectedQ.taraIndex].hi : TARABALA9[selectedQ.taraIndex].en}{" "}
                      <span className={selectedQ.taraGood === true ? "text-emerald-300" : selectedQ.taraGood === false ? "text-red-300" : "text-amber-300"}>
                        ({selectedQ.taraGood === true ? t("favourable") : selectedQ.taraGood === false ? t("unfavourable") : t("neutralT")})
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-(--color-ink-soft)">{t("chandraOfDay")}</dt>
                    <dd>
                      {selectedQ.chandraHouse} {t("fromYourMoonShort")}{" "}
                      <span className={selectedQ.chandraGood ? "text-emerald-300" : "text-red-300"}>
                        ({selectedQ.chandraGood ? t("favourable") : t("unfavourable")})
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-(--color-ink-soft)">{t("currentDasha")}</dt>
                    <dd>
                      {selectedDasha
                        .slice(0, 2)
                        .map((p) => planetName(p.lord, lang))
                        .join(" – ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-(--color-ink-soft)">{t("nakshatra")}</dt>
                    <dd>{nakshatraName(selected.nakshatra, lang)}</dd>
                  </div>
                </dl>
              </div>
              <div className="md:col-span-2">
                <PanchangCard
                  panchang={selectedPanchang}
                  title={`${t("tithi")} · ${t("vara")} · ${t("nakshatra")} · ${t("yogaP")} · ${t("karana")}`}
                />
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </ProfileTheme>
  );
}
