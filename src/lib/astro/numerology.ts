// Numerology (Vedic + Pythagorean): birthday number (moolank), life path
// (bhagyank), name numbers, and personal year/month.

import type { NumerologyResult, PlanetId } from "./types";

/** Ruling planet for each single-digit number (Vedic convention) */
export const NUMBER_PLANETS: Record<number, PlanetId> = {
  1: "Sun",
  2: "Moon",
  3: "Jupiter",
  4: "Rahu",
  5: "Mercury",
  6: "Venus",
  7: "Ketu",
  8: "Saturn",
  9: "Mars",
};

const MASTER_NUMBERS = [11, 22, 33];

/** Reduce to a single digit; optionally stop at master numbers */
export function reduceNumber(n: number, keepMaster = false): number {
  while (n > 9) {
    if (keepMaster && MASTER_NUMBERS.includes(n)) return n;
    n = String(n)
      .split("")
      .reduce((s, c) => s + Number(c), 0);
  }
  return n;
}

const PYTHAGOREAN: Record<string, number> = {
  a: 1, j: 1, s: 1,
  b: 2, k: 2, t: 2,
  c: 3, l: 3, u: 3,
  d: 4, m: 4, v: 4,
  e: 5, n: 5, w: 5,
  f: 6, o: 6, x: 6,
  g: 7, p: 7, y: 7,
  h: 8, q: 8, z: 8,
  i: 9, r: 9,
};

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function sumLetters(name: string, filter?: (c: string) => boolean): number {
  let total = 0;
  for (const c of name.toLowerCase()) {
    if (!(c in PYTHAGOREAN)) continue;
    if (filter && !filter(c)) continue;
    total += PYTHAGOREAN[c];
  }
  return total;
}

/**
 * Full numerology profile.
 * `dateISO` is the local birth date "yyyy-mm-dd"; `now` is used for the
 * personal year/month (defaults to today).
 */
export function computeNumerology(
  name: string,
  dateISO: string,
  now: Date = new Date()
): NumerologyResult {
  const [y, m, d] = dateISO.split("-").map(Number);

  const birthdayNumber = reduceNumber(d);
  const lifePathRaw = reduceNumber(
    reduceNumber(d, true) + reduceNumber(m, true) + reduceNumber(y, true),
    true
  );
  const lifePathNumber = reduceNumber(lifePathRaw);
  const lifePathMaster = MASTER_NUMBERS.includes(lifePathRaw)
    ? lifePathRaw
    : undefined;

  const expressionNumber = name
    ? reduceNumber(sumLetters(name), false)
    : undefined;
  const soulUrgeNumber = name
    ? reduceNumber(sumLetters(name, (c) => VOWELS.has(c)))
    : undefined;
  const personalityNumber = name
    ? reduceNumber(sumLetters(name, (c) => !VOWELS.has(c)))
    : undefined;

  const personalYear = reduceNumber(d + m + now.getFullYear());
  const personalMonth = reduceNumber(personalYear + (now.getMonth() + 1));

  return {
    birthdayNumber,
    lifePathNumber,
    lifePathMaster,
    expressionNumber,
    soulUrgeNumber,
    personalityNumber,
    personalYear,
    personalMonth,
    rulingPlanet: NUMBER_PLANETS[birthdayNumber],
  };
}
