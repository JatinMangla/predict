// Gochar (transits): current sky, upcoming sign changes & retrograde
// stations, and their classical effects relative to the natal Moon.

import type { PlanetId } from "./types";
import { PLANETS, norm360 } from "./constants";
import { siderealLongitude, planetSpeed } from "./ephemeris";

const DAY_MS = 86400 * 1000;

export interface TransitPosition {
  id: PlanetId;
  longitude: number;
  sign: number;
  degInSign: number;
  retrograde: boolean;
  /** house from a natal reference sign, filled by caller */
  houseFromMoon?: number;
}

export interface TransitEvent {
  planet: PlanetId;
  type: "ingress" | "retrograde" | "direct";
  timeMs: number;
  /** for ingress */
  fromSign?: number;
  toSign?: number;
}

/** Current sidereal positions of all grahas */
export function currentPositions(utcMs: number): TransitPosition[] {
  return PLANETS.map((id) => {
    const lon = siderealLongitude(id, utcMs);
    const speed = planetSpeed(id, utcMs);
    return {
      id,
      longitude: lon,
      sign: Math.floor(lon / 30) % 12,
      degInSign: lon % 30,
      retrograde: id === "Rahu" || id === "Ketu" ? true : speed < 0,
    };
  });
}

/** Sampling interval per planet (days) — fast movers need finer steps */
const SAMPLE_DAYS: Record<PlanetId, number> = {
  Sun: 5,
  Moon: 0.25,
  Mars: 5,
  Mercury: 1,
  Jupiter: 10,
  Venus: 2,
  Saturn: 15,
  Rahu: 15,
  Ketu: 15,
};

/** Planets worth listing in the upcoming-movements timeline */
const TIMELINE_PLANETS: PlanetId[] = [
  "Sun",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
];

/**
 * Find sign ingresses and retrograde/direct stations between two instants.
 * Uses coarse sampling + bisection to ~1 hour precision.
 */
export function findTransitEvents(
  fromMs: number,
  toMs: number
): TransitEvent[] {
  const events: TransitEvent[] = [];

  for (const planet of TIMELINE_PLANETS) {
    const stepMs = SAMPLE_DAYS[planet] * DAY_MS;

    // Sign ingresses
    let t = fromMs;
    let prevSign = Math.floor(siderealLongitude(planet, t) / 30) % 12;
    while (t < toMs) {
      const next = Math.min(t + stepMs, toMs);
      const nextSign = Math.floor(siderealLongitude(planet, next) / 30) % 12;
      if (nextSign !== prevSign) {
        const exact = bisectSignChange(planet, t, next);
        const sExact = Math.floor(siderealLongitude(planet, exact + 60000) / 30) % 12;
        events.push({
          planet,
          type: "ingress",
          timeMs: exact,
          fromSign: prevSign,
          toSign: sExact,
        });
        prevSign = sExact;
      } else {
        prevSign = nextSign;
      }
      t = next;
    }

    // Retrograde stations (nodes are always retrograde — skip)
    if (planet === "Rahu" || planet === "Ketu" || planet === "Sun") continue;
    t = fromMs;
    let prevRetro = planetSpeed(planet, t) < 0;
    while (t < toMs) {
      const next = Math.min(t + stepMs, toMs);
      const nextRetro = planetSpeed(planet, next) < 0;
      if (nextRetro !== prevRetro) {
        const exact = bisectStation(planet, t, next);
        events.push({
          planet,
          type: nextRetro ? "retrograde" : "direct",
          timeMs: exact,
        });
        prevRetro = nextRetro;
      }
      t = next;
    }
  }

  return events.sort((a, b) => a.timeMs - b.timeMs);
}

function bisectSignChange(planet: PlanetId, lo: number, hi: number): number {
  const signAt = (ms: number) =>
    Math.floor(siderealLongitude(planet, ms) / 30) % 12;
  const target = signAt(hi);
  while (hi - lo > 3600 * 1000) {
    const mid = (lo + hi) / 2;
    if (signAt(mid) === target) hi = mid;
    else lo = mid;
  }
  return hi;
}

function bisectStation(planet: PlanetId, lo: number, hi: number): number {
  const retroAt = (ms: number) => planetSpeed(planet, ms) < 0;
  const target = retroAt(hi);
  while (hi - lo > 3600 * 1000) {
    const mid = (lo + hi) / 2;
    if (retroAt(mid) === target) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Classical gochar rules: houses (from natal Moon) where each planet's
 * transit gives good results.
 */
export const FAVOURABLE_FROM_MOON: Record<PlanetId, number[]> = {
  Sun: [3, 6, 10, 11],
  Moon: [1, 3, 6, 7, 10, 11],
  Mars: [3, 6, 11],
  Mercury: [2, 4, 6, 8, 10, 11],
  Jupiter: [2, 5, 7, 9, 11],
  Venus: [1, 2, 3, 4, 5, 8, 9, 11, 12],
  Saturn: [3, 6, 11],
  Rahu: [3, 6, 11],
  Ketu: [3, 6, 11],
};

export type SadeSatiPhase = "none" | "rising" | "peak" | "setting";

/** Sade Sati status: Saturn transiting 12th, 1st or 2nd from natal Moon */
export function sadeSatiPhase(
  saturnSign: number,
  natalMoonSign: number
): SadeSatiPhase {
  const rel = ((saturnSign - natalMoonSign + 12) % 12) + 1;
  if (rel === 12) return "rising";
  if (rel === 1) return "peak";
  if (rel === 2) return "setting";
  return "none";
}

/** House of a transiting sign counted from the natal Moon sign (1–12) */
export function houseFromMoon(natalMoonSign: number, transitSign: number): number {
  return ((transitSign - natalMoonSign + 12) % 12) + 1;
}

/**
 * Vedha (obstruction) positions — a benefic transit is nullified if another
 * planet sits in the vedha house. Simplified: not applied for Sun–Saturn
 * mutual vedha exemptions; used to soften confidence, not flip results.
 */
export const VEDHA: Partial<Record<PlanetId, Record<number, number>>> = {
  Sun: { 3: 9, 6: 12, 10: 4, 11: 5 },
  Moon: { 1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8 },
  Mars: { 3: 12, 6: 9, 11: 5 },
  Mercury: { 2: 5, 4: 3, 6: 9, 8: 1, 10: 8, 11: 12 },
  Jupiter: { 2: 12, 5: 4, 7: 3, 9: 10, 11: 8 },
  Venus: { 1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 5, 9: 11, 11: 6, 12: 3 },
  Saturn: { 3: 12, 6: 9, 11: 5 },
};

/** Moon sign (rashi) transit of the Moon over the next `days` days — for weekly predictions */
export function moonTransitSigns(
  fromMs: number,
  days: number
): { sign: number; startMs: number; endMs: number }[] {
  const out: { sign: number; startMs: number; endMs: number }[] = [];
  const step = 3 * 3600 * 1000; // 3h sampling
  const end = fromMs + days * DAY_MS;
  let t = fromMs;
  let sign = Math.floor(siderealLongitude("Moon", t) / 30) % 12;
  let segStart = t;
  while (t < end) {
    t += step;
    const s = Math.floor(siderealLongitude("Moon", Math.min(t, end)) / 30) % 12;
    if (s !== sign || t >= end) {
      out.push({ sign, startMs: segStart, endMs: Math.min(t, end) });
      sign = s;
      segStart = t;
    }
  }
  return out;
}
