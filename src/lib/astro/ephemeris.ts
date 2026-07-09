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
import { lahiriAyanamsa, meanObliquity, centuriesFromJ2000 } from "./ayanamsa";
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
  return norm360(tropicalLongitude(planet, utcMs) - lahiriAyanamsa(utcMs));
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
 * RAMC = local apparent sidereal time in degrees; standard ascendant formula.
 */
export function ascendantSidereal(
  utcMs: number,
  latitude: number,
  longitude: number
): number {
  const gastHours = SiderealTime(new Date(utcMs)); // Greenwich apparent sidereal time
  const ramc = norm360(gastHours * 15 + longitude); // east-positive longitude
  const eps = meanObliquity(utcMs) * DEG;
  const phi = latitude * DEG;
  const ramcR = ramc * DEG;

  const y = -Math.cos(ramcR);
  const x = Math.sin(ramcR) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps);
  const ascTropical = norm360(Math.atan2(y, x) / DEG);
  return norm360(ascTropical - lahiriAyanamsa(utcMs));
}

/** Sidereal midheaven (MC) longitude */
export function midheavenSidereal(utcMs: number, longitude: number): number {
  const gastHours = SiderealTime(new Date(utcMs));
  const ramc = norm360(gastHours * 15 + longitude) * DEG;
  const eps = meanObliquity(utcMs) * DEG;
  const mcTropical = norm360(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) / DEG);
  return norm360(mcTropical - lahiriAyanamsa(utcMs));
}

/** Sunrise/sunset (UTC ms) for the calendar day containing the given local instant */
export function sunriseSunset(
  utcMs: number,
  latitude: number,
  longitude: number
): { sunrise?: number; sunset?: number } {
  try {
    const observer = new Observer(latitude, longitude, 0);
    // Search from local midnight (approximate: UTC instant minus 15h covers all zones)
    const start = new Date(utcMs - 15 * 3600 * 1000);
    const rise = SearchRiseSet(Body.Sun, observer, +1, start, 2);
    const set = SearchRiseSet(Body.Sun, observer, -1, start, 2);
    return {
      sunrise: rise ? rise.date.getTime() : undefined,
      sunset: set ? set.date.getTime() : undefined,
    };
  } catch {
    return {};
  }
}
