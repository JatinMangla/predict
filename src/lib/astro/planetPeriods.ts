// For each transiting planet: exactly when it entered its current sign, when
// it leaves, and what it is currently doing to this chart — so the planet
// section can show a real from/to period instead of a bare position.

import type { Kundli, PlanetId } from "./types";
import { siderealLongitude, planetSpeed } from "./ephemeris";
import { judgeTransit, type TransitJudgement } from "./chartJudgement";

const DAY_MS = 86400 * 1000;
const MIN_MS = 60 * 1000;

/** Generous upper bound (days) for how long each graha can sit in one sign */
const MAX_STAY_DAYS: Record<PlanetId, number> = {
  Moon: 4,
  Mercury: 90,
  Venus: 130,
  Sun: 34,
  Mars: 260,
  Jupiter: 420,
  Saturn: 1150,
  Rahu: 620,
  Ketu: 620,
};

export interface TransitPeriod {
  planet: PlanetId;
  sign: number;
  degInSign: number;
  retrograde: boolean;
  /** UTC ms when it entered this sign (null if beyond the search bound) */
  enteredMs: number | null;
  /** UTC ms when it leaves this sign (null if beyond the search bound) */
  leavesMs: number | null;
  /** judgement made from THIS chart: house from lagna, bindus, rulership */
  judgement: TransitJudgement;
}

function signAt(planet: PlanetId, ms: number): number {
  return Math.floor(siderealLongitude(planet, ms) / 30) % 12;
}

/** Bisect the sign boundary between two instants to one-minute precision */
function bisectBoundary(
  planet: PlanetId,
  loMs: number,
  hiMs: number,
  targetSign: number
): number {
  let lo = loMs;
  let hi = hiMs;
  while (hi - lo > MIN_MS) {
    const mid = Math.floor((lo + hi) / 2);
    if (signAt(planet, mid) === targetSign) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * The planet's current sign with the exact instants it entered and leaves.
 * Handles retrograde re-entry correctly: the entry found is the most recent
 * crossing into the current sign, not the first one historically.
 */
export function currentTransitPeriod(
  planet: PlanetId,
  kundli: Kundli,
  atMs: number = Date.now()
): TransitPeriod {
  const lon = siderealLongitude(planet, atMs);
  const sign = Math.floor(lon / 30) % 12;
  const bound = MAX_STAY_DAYS[planet] * DAY_MS;
  const step = bound / 60;

  // Walk backwards to the last moment it was in a different sign
  let enteredMs: number | null = null;
  let t = atMs;
  while (t > atMs - bound) {
    const prev = Math.max(t - step, atMs - bound);
    if (signAt(planet, prev) !== sign) {
      enteredMs = bisectBoundary(planet, prev, t, sign);
      break;
    }
    t = prev;
  }

  // Walk forwards to the first moment it is in a different sign
  let leavesMs: number | null = null;
  t = atMs;
  while (t < atMs + bound) {
    const next = Math.min(t + step, atMs + bound);
    if (signAt(planet, next) !== sign) {
      // bisect on "still in current sign" from the far side
      let lo = t;
      let hi = next;
      while (hi - lo > MIN_MS) {
        const mid = Math.floor((lo + hi) / 2);
        if (signAt(planet, mid) === sign) lo = mid;
        else hi = mid;
      }
      leavesMs = hi;
      break;
    }
    t = next;
  }

  const isNode = planet === "Rahu" || planet === "Ketu";
  return {
    planet,
    sign,
    degInSign: lon % 30,
    retrograde: isNode ? true : planetSpeed(planet, atMs) < 0,
    enteredMs,
    leavesMs,
    judgement: judgeTransit(kundli, planet, sign),
  };
}
