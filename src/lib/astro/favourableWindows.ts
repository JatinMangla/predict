// Personal favourable/unfavourable date windows WITH exact clock times,
// computed from this kundli alone (not sign-level):
//   • Tarabala   — the day's nakshatra counted from the native's birth star
//   • Chandra bala — transiting Moon's house from the natal Moon
//   • Vara lord  — weekday ruler matching the life area's karaka
//   • Muhurta    — Abhijit as the acting window, Rahu Kaal etc. as the block
// Everything here is arithmetic, so the times are exact rather than guessed.

import type { Kundli, PlanetId } from "./types";
import {
  buildMonthCalendar,
  dayTimings,
  personalDayQuality,
  TARABALA9,
  type CalendarDayInfo,
} from "./hinduCalendar";

/** Weekday rulers, Sunday first */
export const VARA_LORDS: PlanetId[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
];

export interface FavourableWindow {
  /** UTC ms of local midnight for the day */
  dayStartMs: number;
  /** 0–8 tarabala index */
  taraIndex: number;
  taraName: { en: string; hi: string };
  taraGood: boolean | null;
  /** transiting Moon's house from natal Moon */
  chandraHouse: number;
  chandraGood: boolean;
  /** weekday lord rules this life area? */
  varaMatch: boolean;
  varaLord: PlanetId;
  /** 0–100 personal score for the day */
  score: number;
  rating: "excellent" | "good" | "mixed" | "avoid";
  /** best acting window (Abhijit muhurta) */
  bestFrom?: number;
  bestTo?: number;
  /** window to avoid (Rahu Kaal) */
  avoidFrom?: number;
  avoidTo?: number;
  /** festivals on the day, if any */
  festivals: { en: string; hi: string }[];
}

function scoreDay(
  day: CalendarDayInfo,
  birthNakshatra: number,
  natalMoonSign: number,
  karakas: PlanetId[]
): FavourableWindow {
  const q = personalDayQuality(day, birthNakshatra, natalMoonSign);
  const varaLord = VARA_LORDS[day.weekday];
  const varaMatch = karakas.includes(varaLord);

  // Tarabala carries the most weight, then chandra bala, then the vara lord.
  let score = 40;
  if (q.taraGood === true) score += 30;
  else if (q.taraGood === false) score -= 28;
  else score += 4; // Janma tara: neutral-ish
  score += q.chandraGood ? 20 : -18;
  if (varaMatch) score += 12;
  // Purnima/Amavasya add volatility to an otherwise ordinary day
  if (day.isAmavasya) score -= 6;
  if (day.isPurnima) score += 3;
  score = Math.max(0, Math.min(100, score));

  const rating: FavourableWindow["rating"] =
    score >= 78 ? "excellent" : score >= 60 ? "good" : score >= 42 ? "mixed" : "avoid";

  const tm = dayTimings(day);
  return {
    dayStartMs: day.dayStartMs,
    taraIndex: q.taraIndex,
    taraName: TARABALA9[q.taraIndex],
    taraGood: q.taraGood,
    chandraHouse: q.chandraHouse,
    chandraGood: q.chandraGood,
    varaMatch,
    varaLord,
    score,
    rating,
    bestFrom: tm.abhijit?.[0],
    bestTo: tm.abhijit?.[1],
    avoidFrom: tm.rahuKaal?.[0],
    avoidTo: tm.rahuKaal?.[1],
    festivals: day.festivals,
  };
}

/**
 * Scan `days` days from `fromMs` and return every day scored for this native.
 * `karakas` are the life area's significators (from the category definition).
 */
export function personalDayWindows(
  kundli: Kundli,
  karakas: PlanetId[],
  fromMs: number,
  days: number,
  tzOffsetMinutes: number
): FavourableWindow[] {
  const moon = kundli.planets.find((p) => p.id === "Moon")!;
  const start = new Date(fromMs);
  const out: FavourableWindow[] = [];

  // Walk month by month so sunrise/tithi come from the shared builder
  let cursorYear = start.getFullYear();
  let cursorMonth = start.getMonth();
  const endMs = fromMs + days * 86400 * 1000;

  for (let guard = 0; guard < 14 && out.length < days + 31; guard++) {
    const month = buildMonthCalendar(
      cursorYear,
      cursorMonth,
      kundli.birth.latitude,
      kundli.birth.longitude,
      tzOffsetMinutes
    );
    for (const d of month) {
      if (d.dayStartMs + 86400 * 1000 < fromMs) continue;
      if (d.dayStartMs > endMs) break;
      out.push(scoreDay(d, moon.nakshatra, moon.sign, karakas));
    }
    if (month.length && month[month.length - 1].dayStartMs > endMs) break;
    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }
  return out.sort((a, b) => a.dayStartMs - b.dayStartMs);
}

/** The best N days in the scanned range, strongest first */
export function bestDays(
  windows: FavourableWindow[],
  count = 6
): FavourableWindow[] {
  return [...windows]
    .filter((w) => w.rating === "excellent" || w.rating === "good")
    .sort((a, b) => b.score - a.score || a.dayStartMs - b.dayStartMs)
    .slice(0, count)
    .sort((a, b) => a.dayStartMs - b.dayStartMs);
}

/** The days to avoid in the scanned range */
export function cautionDays(
  windows: FavourableWindow[],
  count = 5
): FavourableWindow[] {
  return [...windows]
    .filter((w) => w.rating === "avoid")
    .sort((a, b) => a.score - b.score || a.dayStartMs - b.dayStartMs)
    .slice(0, count)
    .sort((a, b) => a.dayStartMs - b.dayStartMs);
}
