// Personal favourable/unfavourable date windows WITH exact clock times,
// judged from THIS birth chart — not from the Moon sign.
//
// Each day is scored on four chart-specific factors:
//   • Tarabala        — the day's star counted from THIS native's birth star
//   • Moon's transit  — which house of THIS chart it activates, weighted by
//                       the native's own Moon ashtakavarga bindus
//   • Vara lord       — weekday ruler matching the life area's karaka
//   • Running dasha   — whether the pratyantardasha lord rules or occupies
//                       the houses of the asked area in THIS chart
// Times come from the day's real sunrise/sunset, so they are exact.

import type { Kundli, PlanetId } from "./types";
import {
  buildMonthCalendar,
  dayTimings,
  TARABALA9,
  type CalendarDayInfo,
} from "./hinduCalendar";
import { binduFor, dashaContext, functionalNature } from "./chartJudgement";

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
  /** house of THIS chart the transiting Moon activates (from lagna) */
  moonHouseFromLagna: number;
  /** native's own Moon bindus in the sign the Moon transits */
  moonBindus: number | null;
  /** weekday lord rules this life area? */
  varaMatch: boolean;
  varaLord: PlanetId;
  /** running pratyantardasha lord and whether it activates the area */
  dashaLord: PlanetId | null;
  dashaSupports: boolean;
  /** 0–100 personal score for the day */
  score: number;
  rating: "excellent" | "good" | "mixed" | "avoid";
  /** best acting window (Abhijit muhurta) */
  bestFrom?: number;
  bestTo?: number;
  /** window to avoid (Rahu Kaal) */
  avoidFrom?: number;
  avoidTo?: number;
  festivals: { en: string; hi: string }[];
}

function scoreDay(
  kundli: Kundli,
  day: CalendarDayInfo,
  birthNakshatra: number,
  areaHouses: number[],
  karakas: PlanetId[]
): FavourableWindow {
  const lagna = kundli.lagna.sign;

  // 1. Tarabala — counted from this native's own birth star
  const taraIndex = (((day.nakshatra - birthNakshatra + 27) % 27) % 9 + 9) % 9;
  const tara = TARABALA9[taraIndex];

  // 2. The transiting Moon judged against THIS chart (house from lagna +
  //    this native's own Moon bindus in that sign)
  const moonHouseFromLagna = ((day.moonSign - lagna + 12) % 12) + 1;
  const moonBindus = binduFor(kundli, "Moon", day.moonSign);

  // 3. Weekday lord relevant to the asked area
  const varaLord = VARA_LORDS[day.weekday];
  const varaMatch = karakas.includes(varaLord);

  // 4. The dasha actually running for this native on that day
  const dc = dashaContext(kundli, day.refMs);
  const dashaLord = dc?.pratyantarLord ?? dc?.antarLord ?? dc?.mahaLord ?? null;
  const dashaSupports = dc
    ? dc.activatesHouses.some((h) => areaHouses.includes(h))
    : false;

  let score = 40;
  if (tara.good === true) score += 26;
  else if (tara.good === false) score -= 26;
  else score += 3;

  if (areaHouses.includes(moonHouseFromLagna)) score += 10;
  else if ([6, 8, 12].includes(moonHouseFromLagna)) score -= 12;
  else if ([1, 5, 9, 10, 11].includes(moonHouseFromLagna)) score += 6;

  if (moonBindus !== null) {
    if (moonBindus >= 5) score += 12;
    else if (moonBindus <= 2) score -= 12;
  }

  if (varaMatch) score += 10;
  if (dashaSupports) score += 10;
  if (dc && dc.nature === "malefic") score -= 8;
  else if (dc && dc.nature === "benefic") score += 6;

  if (day.isAmavasya) score -= 5;
  score = Math.max(0, Math.min(100, score));

  const rating: FavourableWindow["rating"] =
    score >= 76 ? "excellent" : score >= 60 ? "good" : score >= 42 ? "mixed" : "avoid";

  const tm = dayTimings(day);
  return {
    dayStartMs: day.dayStartMs,
    taraIndex,
    taraName: tara.name,
    taraGood: tara.good,
    moonHouseFromLagna,
    moonBindus,
    varaMatch,
    varaLord,
    dashaLord,
    dashaSupports,
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
 * Scan `days` days from `fromMs`, scoring each against THIS chart for the
 * given life area (its houses and karakas).
 */
export function personalDayWindows(
  kundli: Kundli,
  areaHouses: number[],
  karakas: PlanetId[],
  fromMs: number,
  days: number,
  tzOffsetMinutes: number,
  /** where the native is NOW — sunrise-based clock windows follow this */
  where?: { latitude: number; longitude: number }
): FavourableWindow[] {
  const moon = kundli.planets.find((p) => p.id === "Moon")!;
  const lat = where?.latitude ?? kundli.birth.latitude;
  const lon = where?.longitude ?? kundli.birth.longitude;
  const start = new Date(fromMs);
  const out: FavourableWindow[] = [];

  let cursorYear = start.getFullYear();
  let cursorMonth = start.getMonth();
  const endMs = fromMs + days * 86400 * 1000;

  for (let guard = 0; guard < 14 && out.length < days + 31; guard++) {
    const month = buildMonthCalendar(
      cursorYear,
      cursorMonth,
      lat,
      lon,
      tzOffsetMinutes
    );
    for (const d of month) {
      // Skip days that are already over: the previous day ends exactly at a
      // midnight `fromMs`, so this must be `<=`, not `<`, or that day leaks in.
      if (d.dayStartMs + 86400 * 1000 <= fromMs) continue;
      // `endMs` is the first instant past the range, so a day starting on it
      // belongs to the next window.
      if (d.dayStartMs >= endMs) break;
      out.push(scoreDay(kundli, d, moon.nakshatra, areaHouses, karakas));
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

export { functionalNature };
