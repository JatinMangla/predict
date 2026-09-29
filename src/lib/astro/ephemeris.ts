// Planetary positions from the astronomy-engine library (pure JS, offline).
// Tropical longitudes use the true ecliptic of date; sidereal = tropical − Lahiri.

import {
  Body,
  GeoVector,
  Ecliptic,
  EclipticGeoMoon,
  SiderealTime,
  Observer,
  SearchRiseSet,
} from "astronomy-engine";
import type { PlanetId } from "./types";
import { trueAyanamsa, trueObliquity, centuriesFromJ2000 } from "./ayanamsa";
import { DEG, norm360 } from "./constants";

const BODY_MAP: Partial<Record<PlanetId, Body>> = {
  Sun: Body.Sun,
  Mars: Body.Mars,
  Mercury: Body.Mercury,
  Jupiter: Body.Jupiter,
  Venus: Body.Venus,
  Saturn: Body.Saturn,
};

/**
 * Mean lunar ascending node (Rahu), tropical longitude of date (Meeus 47.7).
 * Mean node is the convention used by classical Lahiri ephemerides.
 */
function meanNodeLongitude(utcMs: number): number {
  const T = centuriesFromJ2000(utcMs);
  const omega =
    125.0445479 -
    1934.1362891 * T +
    0.0020754 * T * T +
    (T * T * T) / 467441 -
    (T * T * T * T) / 60616000;
  return norm360(omega);
}

/** Tropical ecliptic longitude of date for any graha */
export function tropicalLongitude(planet: PlanetId, utcMs: number): number {
  const date = new Date(utcMs);
  if (planet === "Moon") {
    return norm360(EclipticGeoMoon(date).lon);
  }
  if (planet === "Rahu") {
    return meanNodeLongitude(utcMs);
  }
  if (planet === "Ketu") {
    return norm360(meanNodeLongitude(utcMs) + 180);
  }
  const vec = GeoVector(BODY_MAP[planet]!, date, true);
  return norm360(Ecliptic(vec).elon);
}

/** Sidereal (Lahiri) longitude for any graha */
export function siderealLongitude(planet: PlanetId, utcMs: number): number {
  return norm360(tropicalLongitude(planet, utcMs) - trueAyanamsa(utcMs));
}

/** Motion in degrees/day (central difference over 12 hours). Negative = retrograde. */
export function planetSpeed(planet: PlanetId, utcMs: number): number {
  const halfDayMs = 6 * 3600 * 1000;
  const lon1 = tropicalLongitude(planet, utcMs - halfDayMs);
  const lon2 = tropicalLongitude(planet, utcMs + halfDayMs);
  let d = lon2 - lon1;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d * 2; // per day
}

/**
 * Sidereal ascendant (lagna) longitude.
 * RAMC = local apparent sidereal time in degrees. The rising point is
 *   λ = atan2( cos RAMC, −(sin RAMC · cos ε + tan φ · sin ε) )
 * (the sign of BOTH arguments matters: flipping them yields the descendant).
 */
export function ascendantSidereal(
  utcMs: number,
  latitude: number,
  longitude: number
): number {
  const gastHours = SiderealTime(new Date(utcMs)); // Greenwich apparent sidereal time
  const ramc = norm360(gastHours * 15 + longitude); // east-positive longitude
  const eps = trueObliquity(utcMs) * DEG;
  const phi = latitude * DEG;
  const ramcR = ramc * DEG;

  const y = Math.cos(ramcR);
  const x = -(Math.sin(ramcR) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps));
  const ascTropical = norm360(Math.atan2(y, x) / DEG);
  return norm360(ascTropical - trueAyanamsa(utcMs));
}

/** Sidereal midheaven (MC) longitude */
export function midheavenSidereal(utcMs: number, longitude: number): number {
  const gastHours = SiderealTime(new Date(utcMs));
  const ramc = norm360(gastHours * 15 + longitude) * DEG;
  const eps = trueObliquity(utcMs) * DEG;
  const mcTropical = norm360(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) / DEG);
  return norm360(mcTropical - trueAyanamsa(utcMs));
}

/**
 * Sunrise/sunset (UTC ms) for a civil date at a place. The search starts at
 * the place's MEAN SOLAR midnight (UTC midnight shifted by longitude/15 h),
 * so the first rise found is always that date's own sunrise, whatever the
 * time zone — no "UTC minus N hours" guess that breaks for late-evening
 * instants or far-east/far-west zones.
 */
export function sunriseSunsetOnDate(
  year: number,
  month: number, // 1–12
  day: number,
  latitude: number,
  longitude: number
): { sunrise?: number; sunset?: number } {
  try {
    const observer = new Observer(latitude, longitude, 0);
    const solarMidnight = Date.UTC(year, month - 1, day) - (longitude / 15) * 3600 * 1000;
    const start = new Date(solarMidnight);
    const rise = SearchRiseSet(Body.Sun, observer, +1, start, 1.2);
    const set = rise
      ? SearchRiseSet(Body.Sun, observer, -1, rise.date, 1)
      : SearchRiseSet(Body.Sun, observer, -1, start, 1.2);
    return {
      sunrise: rise ? rise.date.getTime() : undefined,
      sunset: set ? set.date.getTime() : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Sunrise/sunset for the solar day containing the given instant at a place
 * (the civil date is taken from local mean solar time).
 */
export function sunriseSunset(
  utcMs: number,
  latitude: number,
  longitude: number
): { sunrise?: number; sunset?: number } {
  const solar = new Date(utcMs + (longitude / 15) * 3600 * 1000);
  return sunriseSunsetOnDate(
    solar.getUTCFullYear(),
    solar.getUTCMonth() + 1,
    solar.getUTCDate(),
    latitude,
    longitude
  );
}
