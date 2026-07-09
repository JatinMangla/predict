// Kundli assembly: birth details in, complete chart out. Runs entirely
// client-side; the only external dependency is luxon for timezone conversion.

import { DateTime } from "luxon";
import type {
  BirthDetails,
  Kundli,
  LagnaInfo,
  PlanetPosition,
  VargaChart,
} from "./types";
import { PLANETS, COMBUSTION_ORB, norm360, angleDiff } from "./constants";
import { lahiriAyanamsa } from "./ayanamsa";
import {
  siderealLongitude,
  tropicalLongitude,
  planetSpeed,
  ascendantSidereal,
} from "./ephemeris";
import { nakshatraOf, padaOf } from "./nakshatra";
import { dignityOf } from "./strength";
import { vargaSign, VARGA_LIST, type VargaKey } from "./vargas";
import { buildVimshottari } from "./dasha";
import { computePanchang } from "./panchang";
import { detectYogas } from "./yogas";
import { computeAshtakavarga } from "./ashtakavarga";
import { computeNumerology } from "./numerology";

/** Convert local birth date-time + IANA zone to UTC milliseconds */
export function birthToUtcMs(localDateTime: string, timezone: string): number {
  const dt = DateTime.fromISO(localDateTime, { zone: timezone });
  if (!dt.isValid) {
    throw new Error(`Invalid birth time: ${dt.invalidReason ?? "unknown"}`);
  }
  return dt.toUTC().toMillis();
}

/** Whole-sign house of a sign relative to the lagna sign (1–12) */
export function houseOfSign(lagnaSign: number, sign: number): number {
  return ((sign - lagnaSign + 12) % 12) + 1;
}

export function computeKundli(birth: BirthDetails): Kundli {
  const utcMs = birthToUtcMs(birth.localDateTime, birth.timezone);
  const ayanamsa = lahiriAyanamsa(utcMs);

  // Lagna
  const lagnaLon = ascendantSidereal(utcMs, birth.latitude, birth.longitude);
  const lagna: LagnaInfo = {
    longitude: lagnaLon,
    sign: Math.floor(lagnaLon / 30) % 12,
    degInSign: lagnaLon % 30,
    nakshatra: nakshatraOf(lagnaLon),
    pada: padaOf(lagnaLon),
  };

  // Planets
  const sunTropical = tropicalLongitude("Sun", utcMs);
  const planets: PlanetPosition[] = PLANETS.map((id) => {
    const lon = siderealLongitude(id, utcMs);
    const tropical = tropicalLongitude(id, utcMs);
    const speed = planetSpeed(id, utcMs);
    const retrograde = speed < 0;
    const sign = Math.floor(lon / 30) % 12;

    let combust = false;
    if (id !== "Sun" && COMBUSTION_ORB[id] !== undefined) {
      let orb = COMBUSTION_ORB[id]!;
      // Retrograde Mercury/Venus have tighter combustion orbs
      if (retrograde && id === "Mercury") orb = 12;
      if (retrograde && id === "Venus") orb = 8;
      combust = Math.abs(angleDiff(tropical, sunTropical)) <= orb;
    }

    return {
      id,
      longitude: lon,
      tropicalLongitude: tropical,
      sign,
      degInSign: lon % 30,
      nakshatra: nakshatraOf(lon),
      pada: padaOf(lon),
      speed,
      retrograde: id === "Rahu" || id === "Ketu" ? true : retrograde,
      combust,
      house: houseOfSign(lagna.sign, sign),
      dignity: dignityOf(id, lon),
    };
  });

  // Divisional charts
  const vargas: Record<string, VargaChart> = {};
  for (const { key } of VARGA_LIST) {
    const chart: VargaChart = planets.map((p) => ({
      planet: p.id,
      sign: vargaSign(p.longitude, key as VargaKey),
    }));
    chart.push({ planet: "Lagna", sign: vargaSign(lagnaLon, key as VargaKey) });
    vargas[key] = chart;
  }

  const moon = planets.find((p) => p.id === "Moon")!;
  const localDate = birth.localDateTime.slice(0, 10);

  return {
    birth,
    utcMs,
    ayanamsa,
    lagna,
    planets,
    vargas,
    panchang: computePanchang(utcMs, birth.latitude, birth.longitude, localDate),
    dasha: buildVimshottari(moon.longitude, utcMs, 3),
    yogas: detectYogas(planets, lagna),
    ashtakavarga: computeAshtakavarga(planets, lagna.sign),
    numerology: computeNumerology(birth.name, localDate),
  };
}
