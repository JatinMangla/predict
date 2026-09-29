"use client";

// Auspicious/inauspicious windows for one day: Abhijit Muhurat (best time)
// and Rahu Kaal / Yamaganda / Gulika Kaal (times to avoid), from the exact
// local sunrise–sunset octants.

import type { CalendarDayInfo } from "@/lib/astro/hinduCalendar";
import { dayTimings } from "@/lib/astro/hinduCalendar";
import { useI18n } from "@/lib/i18n";
import { fmtTime, planetName } from "@/lib/format";
import { choghadiya, horas, CHOGHADIYA, slotAt } from "@/lib/astro/advanced";

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
      {day.sunriseMs !== undefined && day.sunsetMs !== undefined && (
        <SlotTables rise={day.sunriseMs} set={day.sunsetMs} weekday={day.weekday} />
      )}
    </div>
  );
}

/** Choghadiya and hora for the day; the running slot is highlighted */
function SlotTables({ rise, set, weekday }: { rise: number; set: number; weekday: number }) {
  const { lang } = useI18n();
  // next sunrise differs from this one by at most a couple of minutes
  const next = rise + 86400 * 1000;
  const chog = choghadiya(rise, set, next, weekday);
  const hora = horas(rise, set, next, weekday);
  const now = Date.now();
  const curC = slotAt(chog, now);
  const curH = slotAt(hora, now);
  const L = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const tone = (q: string) =>
    q === "good" ? "text-emerald-300" : q === "bad" ? "text-red-300" : "text-(--color-ink-soft)";

  return (
    <div className="mt-3 space-y-2 text-xs">
      <details open={Boolean(curC)}>
        <summary className="cursor-pointer text-(--color-gold-soft)">
          {L("Choghadiya", "चौघड़िया")}
          {curC && (
            <span className={`ml-2 ${tone(CHOGHADIYA[curC.lord].quality)}`}>
              · {L("now", "अभी")}: {lang === "hi" ? CHOGHADIYA[curC.lord].hi : CHOGHADIYA[curC.lord].en}
            </span>
          )}
        </summary>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
          {chog.map((c) => {
            const info = CHOGHADIYA[c.lord];
            return (
              <p key={c.start} className={`flex justify-between ${c === curC ? "accent-bg rounded px-1" : ""}`}>
                <span className={tone(info.quality)}>
                  {c.night ? "☾ " : "☀ "}
                  {lang === "hi" ? info.hi : info.en}
                </span>
                <span className="tabular-nums text-(--color-ink-soft)">{fmtTime(c.start, lang)}</span>
              </p>
            );
          })}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer text-(--color-gold-soft)">
          {L("Hora (planetary hours)", "होरा")}
          {curH && <span className="ml-2 text-(--color-ink-soft)">· {L("now", "अभी")}: {planetName(curH.lord, lang)}</span>}
        </summary>
        <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-0.5">
          {hora.map((h) => (
            <p key={h.start} className={`flex justify-between ${h === curH ? "accent-bg rounded px-1" : ""}`}>
              <span>{planetName(h.lord, lang)}</span>
              <span className="tabular-nums text-(--color-ink-soft)">{fmtTime(h.start, lang)}</span>
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}
