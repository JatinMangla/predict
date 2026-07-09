// Planetary dignity and simple strength assessment.

import type { Dignity, PlanetId } from "./types";
import {
  EXALTATION,
  MOOLATRIKONA,
  OWN_SIGNS,
  SIGN_LORDS,
  FRIENDS,
  ENEMIES,
} from "./constants";

/** Dignity of a planet at a sidereal longitude */
export function dignityOf(planet: PlanetId, siderealLon: number): Dignity {
  const sign = Math.floor(siderealLon / 30) % 12;
  const degInSign = siderealLon % 30;

  const ex = EXALTATION[planet];
  if (ex) {
    if (sign === ex.sign) return "exalted";
    if (sign === (ex.sign + 6) % 12) return "debilitated";
  }

  const mt = MOOLATRIKONA[planet];
  if (mt && sign === mt.sign && degInSign >= mt.from && degInSign <= mt.to) {
    return "moolatrikona";
  }

  if (OWN_SIGNS[planet].includes(sign)) return "own";

  const lord = SIGN_LORDS[sign];
  if (lord === planet) return "own";
  if (FRIENDS[planet].includes(lord)) return "friend";
  if (ENEMIES[planet].includes(lord)) return "enemy";
  return "neutral";
}

/** Numeric strength score 0–100 used by the interpretation engine */
export function strengthScore(opts: {
  dignity: Dignity;
  combust: boolean;
  retrograde: boolean;
  house: number;
  planet: PlanetId;
}): number {
  let score = 50;
  const dignityBonus: Record<Dignity, number> = {
    exalted: 35,
    moolatrikona: 28,
    own: 22,
    friend: 10,
    neutral: 0,
    enemy: -15,
    debilitated: -30,
  };
  score += dignityBonus[opts.dignity];
  if (opts.combust) score -= 20;
  // Retrograde planets are traditionally considered strong (chesta bala)
  if (opts.retrograde && opts.planet !== "Rahu" && opts.planet !== "Ketu") {
    score += 8;
  }
  // Dig bala: directional strength by house
  const digBala: Partial<Record<PlanetId, number>> = {
    Jupiter: 1, Mercury: 1, // 1st house
    Moon: 4, Venus: 4,      // 4th house
    Saturn: 7,              // 7th house
    Sun: 10, Mars: 10,      // 10th house
  };
  if (digBala[opts.planet] === opts.house) score += 10;
  // Dusthana placement weakens somewhat
  if ([6, 8, 12].includes(opts.house)) score -= 8;
  // Kendra/trikona placement strengthens
  if ([1, 4, 7, 10, 5, 9].includes(opts.house)) score += 6;
  return Math.max(0, Math.min(100, score));
}
