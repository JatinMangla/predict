"use client";

// Auspicious/inauspicious windows for one day: Abhijit Muhurat (best time)
// and Rahu Kaal / Yamaganda / Gulika Kaal (times to avoid), from the exact
// local sunrise–sunset octants.

import type { CalendarDayInfo } from "@/lib/astro/hinduCalendar";
import { dayTimings } from "@/lib/astro/hinduCalendar";
import { useI18n } from "@/lib/i18n";
import { fmtTime } from "@/lib/format";

export function DayTimingsCard({ day }: { day: CalendarDayInfo }) {
  const { t, lang } = useI18n();
  const tm = dayTimings(day);
  if (!tm.rahuKaal) return null;

  const span = (w?: [number, number] | null) =>
    w ? `${fmtTime(w[0], lang)} – ${fmtTime(w[1], lang)}` : "—";

  const rows: { label: string; value: string; good: boolean | null }[] = [
    {
      label: t("abhijitM"),
      value: tm.abhijit === null ? t("abhijitSkipped") : span(tm.abhijit),
      good: tm.abhijit === null ? null : true,
    },
    { label: t("rahuKaal"), value: span(tm.rahuKaal), good: false },
    { label: t("yamaganda"), value: span(tm.yamaganda), good: false },
    { label: t("gulikaKaal"), value: span(tm.gulika), good: false },
  ];

  return (
    <div className="card p-4">
      <h4 className="mb-2 text-sm font-medium text-(--color-gold-soft)">
        ⏰ {t("timingsLabel")}
      </h4>
      <div className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <span
              className={
                r.good === true
                  ? "text-emerald-300"
                  : r.good === false
                    ? "text-red-300"
                    : "text-(--color-ink-soft)"
              }
            >
              {r.good === true ? "✓ " : r.good === false ? "✕ " : ""}
              {r.label}
            </span>
            <span className="tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
      {day.sunriseMs !== undefined && day.sunsetMs !== undefined && (
        <p className="mt-2 text-xs text-(--color-ink-soft)">
          🌅 {fmtTime(day.sunriseMs, lang)} · 🌇 {fmtTime(day.sunsetMs, lang)}
        </p>
      )}
    </div>
  );
}
