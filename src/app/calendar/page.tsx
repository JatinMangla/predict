"use client";

// Hindu calendar (panchang): month grid with each day's tithi and the Moon
// drawn exactly as it appears that day, lunar month + Vikram Samvat, and
// Purnima / Amavasya / Ekadashi / Sankranti highlights. Fully offline.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { MoonPhase } from "@/components/MoonPhase";
import { PanchangCard } from "@/components/kundli/PanchangCard";
import {
  buildMonthCalendar,
  lunarMonthInfo,
  LUNAR_MONTHS,
  type CalendarDayInfo,
} from "@/lib/astro/hinduCalendar";
import { computePanchang } from "@/lib/astro/panchang";
import { SIGN_NAMES, VARA_NAMES } from "@/lib/astro/constants";
import { nakshatraName, tithiName } from "@/lib/format";

export default function CalendarPage() {
  const { t, lang } = useI18n();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0–11
  const [selected, setSelected] = useState<CalendarDayInfo | null>(null);

  // Sunrise location: first saved profile's birthplace, else Delhi
  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const place = useMemo(
    () =>
      profiles?.[0]
        ? { lat: profiles[0].latitude, lon: profiles[0].longitude }
        : { lat: 28.6139, lon: 77.209 },
    [profiles]
  );

  const days = useMemo(
    () =>
      buildMonthCalendar(
        year,
        month,
        place.lat,
        place.lon,
        new Date(year, month, 15).getTimezoneOffset()
      ),
    [year, month, place]
  );

  // Lunar month + samvat for the middle of the displayed month
  const lunar = useMemo(() => {
    const midMs = Date.UTC(year, month, 15, 12);
    return lunarMonthInfo(midMs);
  }, [year, month]);

  const selectedPanchang = useMemo(() => {
    if (!selected) return null;
    const d = new Date(selected.dayStartMs + 12 * 3600 * 1000);
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return computePanchang(selected.refMs, place.lat, place.lon, localDate);
  }, [selected, place]);

  const prevMonth = () => {
    setSelected(null);
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSelected(null);
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    lang === "hi" ? "hi-IN" : "en-IN",
    { month: "long", year: "numeric" }
  );

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday

  const specialBadge = (d: CalendarDayInfo): { text: string; cls: string } | null => {
    if (d.isPurnima)
      return { text: lang === "hi" ? "पूर्णिमा" : "Purnima", cls: "bg-amber-400/20 text-amber-300" };
    if (d.isAmavasya)
      return { text: lang === "hi" ? "अमावस्या" : "Amavasya", cls: "bg-slate-400/20 text-slate-300" };
    if (d.isEkadashi)
      return { text: lang === "hi" ? "एकादशी" : "Ekadashi", cls: "bg-emerald-400/20 text-emerald-300" };
    if (d.sankrantiSign !== undefined)
      return {
        text: `${t("sankranti")}`,
        cls: "bg-violet-400/20 text-violet-300",
      };
    return null;
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-(--color-gold-soft)">
              {t("hinduCalendarTitle")}
            </h1>
            <p className="mt-0.5 text-sm text-(--color-ink-soft)">
              {t("lunarMonth")}:{" "}
              <span className="accent-text font-medium">
                {lang === "hi" ? LUNAR_MONTHS[lunar.index].hi : LUNAR_MONTHS[lunar.index].en}
              </span>{" "}
              · {t("vikramSamvat")} {lunar.vikramSamvat}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="rounded-lg border border-(--color-line) px-3 py-2 text-sm text-(--color-ink-soft) transition hover:text-(--color-ink)"
              aria-label="previous month"
            >
              ←
            </button>
            <span className="min-w-36 text-center font-medium">{monthLabel}</span>
            <button
              onClick={nextMonth}
              className="rounded-lg border border-(--color-line) px-3 py-2 text-sm text-(--color-ink-soft) transition hover:text-(--color-ink)"
              aria-label="next month"
            >
              →
            </button>
          </div>
        </div>

        {/* Personal calendar shortcuts */}
        {profiles && profiles.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-(--color-ink-soft)">{t("viewPersonalCalendar")}:</span>
            {profiles.map((p) => (
              <Link
                key={p.id}
                href={`/calendar/${p.id}`}
                className="accent-bg rounded-md px-3 py-1.5 transition hover:brightness-125"
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-(--color-ink-soft)">
          {VARA_NAMES.map((v) => (
            <div key={v.en} className="py-1">
              {lang === "hi" ? v.hi.slice(0, 3) : v.en.slice(0, 3)}
            </div>
          ))}
        </div>

        {/* Month grid */}
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map((d) => {
            const isToday = `${year}-${month}-${d.day}` === todayKey;
            const badge = specialBadge(d);
            const isSelected = selected?.day === d.day;
            return (
              <button
                key={d.day}
                onClick={() => setSelected(d)}
                className={`card flex min-h-24 flex-col items-center gap-0.5 p-1.5 text-center transition hover:border-(--accent) ${
                  isSelected ? "border-(--accent) accent-bg" : ""
                } ${isToday ? "ring-1 ring-(--accent)" : ""}`}
              >
                <div className="flex w-full items-center justify-between px-0.5">
                  <span className={`text-sm font-semibold ${isToday ? "accent-text" : ""}`}>
                    {d.day}
                  </span>
                  {isToday && (
                    <span className="accent-text text-[9px]">{t("todayLabel")}</span>
                  )}
                </div>
                <MoonPhase
                  elongation={d.elongation}
                  size={26}
                  title={tithiName(d.tithi, lang)}
                />
                <span className="text-[10px] leading-tight text-(--color-ink-soft)">
                  {tithiName(d.tithi, lang)}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${
                    d.paksha === "shukla" ? "bg-amber-300" : "bg-slate-500"
                  }`}
                  title={d.paksha === "shukla" ? t("shukla") : t("krishna")}
                />
                {badge && (
                  <span className={`rounded px-1 text-[9px] leading-tight ${badge.cls}`}>
                    {badge.text}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <p className="mt-2 text-xs text-(--color-ink-soft)">
          <span className="mr-3">● <span className="text-amber-300">{t("shukla")}</span></span>
          <span className="mr-3">● <span className="text-slate-400">{t("krishna")}</span></span>
          {t("selectDayHint")}
        </p>

        {/* Day detail */}
        {selected && selectedPanchang && (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="card flex flex-col items-center justify-center p-6">
              <MoonPhase elongation={selected.elongation} size={110} />
              <p className="mt-3 text-sm font-medium text-(--color-gold-soft)">
                {new Date(selected.dayStartMs + 12 * 3600 * 1000).toLocaleDateString(
                  lang === "hi" ? "hi-IN" : "en-IN",
                  { weekday: "long", day: "numeric", month: "long", year: "numeric" }
                )}
              </p>
              <p className="mt-1 text-xs text-(--color-ink-soft)">
                {t("moonToday")} · {tithiName(selected.tithi, lang)} (
                {selected.paksha === "shukla" ? t("shukla") : t("krishna")})
              </p>
              <p className="mt-0.5 text-xs text-(--color-ink-soft)">
                {t("nakshatra")}: {nakshatraName(selected.nakshatra, lang)}
              </p>
              {selected.sankrantiSign !== undefined && (
                <p className="mt-1 rounded bg-violet-400/20 px-2 py-0.5 text-xs text-violet-300">
                  {t("sankranti")}:{" "}
                  {lang === "hi"
                    ? SIGN_NAMES[selected.sankrantiSign].hi
                    : SIGN_NAMES[selected.sankrantiSign].en}
                </p>
              )}
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
  );
}
