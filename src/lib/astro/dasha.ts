// Vimshottari dasha: 120-year cycle keyed to the Moon's nakshatra at birth.

import type { DashaPeriod, PlanetId } from "./types";
import { DASHA_ORDER, DASHA_YEARS, DASHA_YEAR_DAYS } from "./constants";
import { nakshatraOf, nakshatraFraction } from "./nakshatra";

const DAY_MS = 86400 * 1000;
const YEAR_MS = DASHA_YEAR_DAYS * DAY_MS;

/**
 * Build the full Vimshottari timeline (mahadasha → antardasha → pratyantardasha).
 *
 * The first mahadasha begins notionally before birth: the fraction of the
 * Moon's nakshatra already traversed is the fraction of that dasha elapsed.
 * Periods are generated for the full 120-year cycle from that notional start.
 */
export function buildVimshottari(
  moonSiderealLon: number,
  birthUtcMs: number,
  levels: 1 | 2 | 3 = 3
): DashaPeriod[] {
  const nak = nakshatraOf(moonSiderealLon);
  const startLordIdx = nak % 9;
  const elapsedFrac = nakshatraFraction(moonSiderealLon);

  const firstLord = DASHA_ORDER[startLordIdx];
  const notionalStart =
    birthUtcMs - elapsedFrac * DASHA_YEARS[firstLord] * YEAR_MS;

  const periods: DashaPeriod[] = [];
  let cursor = notionalStart;
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(startLordIdx + i) % 9];
    const span = DASHA_YEARS[lord] * YEAR_MS;
    const period: DashaPeriod = { lord, start: cursor, end: cursor + span };
    if (levels >= 2) {
      period.children = subdivide(period, levels - 1);
    }
    periods.push(period);
    cursor += span;
  }
  return periods;
}

/** Subdivide a period into its 9 sub-periods (proportional to dasha years) */
function subdivide(parent: DashaPeriod, remainingLevels: number): DashaPeriod[] {
  const span = parent.end - parent.start;
  const startIdx = DASHA_ORDER.indexOf(parent.lord);
  const children: DashaPeriod[] = [];
  let cursor = parent.start;
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(startIdx + i) % 9];
    const childSpan = (span * DASHA_YEARS[lord]) / 120;
    const child: DashaPeriod = { lord, start: cursor, end: cursor + childSpan };
    if (remainingLevels >= 2) {
      child.children = subdivide(child, remainingLevels - 1);
    }
    children.push(child);
    cursor += childSpan;
  }
  return children;
}

/** The chain of active periods (MD, AD, PD) at a given instant */
export function activeDashas(
  timeline: DashaPeriod[],
  atMs: number
): DashaPeriod[] {
  const chain: DashaPeriod[] = [];
  let level: DashaPeriod[] | undefined = timeline;
  while (level) {
    const current: DashaPeriod | undefined = level.find(
      (p) => atMs >= p.start && atMs < p.end
    );
    if (!current) break;
    chain.push(current);
    level = current.children;
  }
  return chain;
}

/** Balance of the first mahadasha at birth, in years (for display/tests) */
export function dashaBalanceYears(moonSiderealLon: number): {
  lord: PlanetId;
  years: number;
} {
  const nak = nakshatraOf(moonSiderealLon);
  const lord = DASHA_ORDER[nak % 9];
  const remaining = (1 - nakshatraFraction(moonSiderealLon)) * DASHA_YEARS[lord];
  return { lord, years: remaining };
}
