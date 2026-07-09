import type { PlanetId } from "./types";
import { NAKSHATRA_LORD_CYCLE, norm360 } from "./constants";

export const NAKSHATRA_SPAN = 360 / 27; // 13°20′
export const PADA_SPAN = NAKSHATRA_SPAN / 4; // 3°20′

/** 0-based nakshatra index for a sidereal longitude */
export function nakshatraOf(siderealLon: number): number {
  return Math.floor(norm360(siderealLon) / NAKSHATRA_SPAN) % 27;
}

/** 1–4 pada for a sidereal longitude */
export function padaOf(siderealLon: number): number {
  return (Math.floor(norm360(siderealLon) / PADA_SPAN) % 4) + 1;
}

/** Vimshottari lord of a nakshatra */
export function nakshatraLord(nakshatraIndex: number): PlanetId {
  return NAKSHATRA_LORD_CYCLE[nakshatraIndex % 9];
}

/** Fraction (0–1) of the nakshatra already traversed at this longitude */
export function nakshatraFraction(siderealLon: number): number {
  const pos = norm360(siderealLon) % NAKSHATRA_SPAN;
  return pos / NAKSHATRA_SPAN;
}
