// Panchang: the five limbs of the Vedic day — tithi, vara, nakshatra, yoga, karana.

import type { PanchangInfo } from "./types";
import {
  TITHI_NAMES,
  KARANA_MOVABLE,
  KARANA_FIXED,
  norm360,
} from "./constants";
import { siderealLongitude, sunriseSunset } from "./ephemeris";
import { nakshatraOf } from "./nakshatra";

/** Karana name for a 0–59 index within the lunar month */
export function karanaName(index: number): string {
  if (index === 0) return KARANA_FIXED.first; // Kimstughna
  if (index >= 57) return KARANA_FIXED.others[index - 57]; // Shakuni, Chatushpada, Naga
  return KARANA_MOVABLE[(index - 1) % 7];
}

/** Tithi display name (1–15 within each paksha; Purnima/Amavasya at the ends) */
export function tithiDisplayName(tithi: number): string {
  if (tithi === 14) return TITHI_NAMES[14].en; // Purnima
  if (tithi === 29) return TITHI_NAMES[15].en; // Amavasya
  const withinPaksha = tithi % 15;
  return TITHI_NAMES[withinPaksha].en;
}

/**
 * Compute panchang for an instant.
 * `localDate` (yyyy-mm-dd of the birth place calendar) determines the vara;
 * if the instant falls before sunrise, the previous day's vara applies.
 */
export function computePanchang(
  utcMs: number,
  latitude: number,
  longitude: number,
  localDate: string
): PanchangInfo {
  const moon = siderealLongitude("Moon", utcMs);
  const sun = siderealLongitude("Sun", utcMs);
  const elong = norm360(moon - sun);

  const tithi = Math.floor(elong / 12); // 0–29
  const paksha = tithi < 15 ? "shukla" : "krishna";
  const yoga = Math.floor(norm360(moon + sun) / (360 / 27)); // 0–26
  const karana = Math.floor(elong / 6); // 0–59
  const nakshatra = nakshatraOf(moon);

  // Vara: weekday of the local calendar date, shifted back one day if the
  // moment is before sunrise (the Vedic day runs sunrise to sunrise).
  const [y, m, d] = localDate.split("-").map(Number);
  let varaDayMs = Date.UTC(y, m - 1, d);
  const rs = sunriseSunset(utcMs, latitude, longitude);
  if (rs.sunrise !== undefined && utcMs < rs.sunrise) {
    varaDayMs -= 86400 * 1000;
  }
  const vara = new Date(varaDayMs).getUTCDay();

  return {
    tithi,
    tithiName: tithiDisplayName(tithi),
    paksha,
    vara,
    yoga,
    karana,
    nakshatra,
    sunrise: rs.sunrise !== undefined ? new Date(rs.sunrise).toISOString() : undefined,
    sunset: rs.sunset !== undefined ? new Date(rs.sunset).toISOString() : undefined,
  };
}
