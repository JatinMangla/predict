// Lahiri (Chitrapaksha) ayanamsa.
//
// Official definition (Indian Calendar Reform Committee, adopted by Lahiri's
// Indian Ephemeris and Swiss Ephemeris SIDM_LAHIRI): the ayanamsa equals
// 23°15′00.658″ at 1956 March 21.0 ET (JD 2435553.5), and accumulates with
// the general precession in longitude thereafter.

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // JD 2451545.0
const MS_PER_CENTURY = 36525 * 86400 * 1000;

/** Julian centuries from J2000 for a UTC millisecond timestamp */
export function centuriesFromJ2000(utcMs: number): number {
  return (utcMs - J2000_MS) / MS_PER_CENTURY;
}

/** Accumulated general precession in longitude (arcseconds), IAU 2006 */
function precessionArcsec(T: number): number {
  return 5028.796195 * T + 1.1054348 * T * T;
}

/** Reference epoch 1956-03-21.0 ET = JD 2435553.5 → centuries from J2000 */
const T_REF = (2435553.5 - 2451545.0) / 36525;
const AYAN_REF = 23 + 15 / 60 + 0.658 / 3600; // 23.250182778°

/** Lahiri ayanamsa in degrees at the given UTC instant */
export function lahiriAyanamsa(utcMs: number): number {
  const T = centuriesFromJ2000(utcMs);
  return AYAN_REF + (precessionArcsec(T) - precessionArcsec(T_REF)) / 3600;
}

/**
 * Nutation in longitude (Δψ) and obliquity (Δε), degrees — Meeus ch. 22
 * low-precision series (accurate to ~0.5″). Tropical positions from the
 * ephemeris are referred to the TRUE equinox of date, while the Lahiri
 * ayanamsa is a MEAN quantity, so Δψ must be removed to get true
 * Chitrapaksha positions (Spica stays fixed at 180°), as Swiss Ephemeris and
 * Drik Panchang do.
 */
export function nutation(utcMs: number): { dPsi: number; dEps: number } {
  const T = centuriesFromJ2000(utcMs);
  const r = Math.PI / 180;
  const omega = (125.04452 - 1934.136261 * T) * r;
  const L = (280.4665 + 36000.7698 * T) * r;
  const Lp = (218.3165 + 481267.8813 * T) * r;
  const dPsi =
    -17.2 * Math.sin(omega) -
    1.32 * Math.sin(2 * L) -
    0.23 * Math.sin(2 * Lp) +
    0.21 * Math.sin(2 * omega);
  const dEps =
    9.2 * Math.cos(omega) +
    0.57 * Math.cos(2 * L) +
    0.1 * Math.cos(2 * Lp) -
    0.09 * Math.cos(2 * omega);
  return { dPsi: dPsi / 3600, dEps: dEps / 3600 };
}

/** Ayanamsa to subtract from a true-equinox-of-date tropical longitude */
export function trueAyanamsa(utcMs: number): number {
  return lahiriAyanamsa(utcMs) + nutation(utcMs).dPsi;
}

/** True obliquity of the ecliptic (mean + nutation), degrees */
export function trueObliquity(utcMs: number): number {
  return meanObliquity(utcMs) + nutation(utcMs).dEps;
}

/** Mean obliquity of the ecliptic in degrees (Meeus) */
export function meanObliquity(utcMs: number): number {
  const T = centuriesFromJ2000(utcMs);
  return (
    23.43929111 -
    0.0130041667 * T -
    1.6389e-7 * T * T +
    5.0361e-7 * T * T * T
  );
}
