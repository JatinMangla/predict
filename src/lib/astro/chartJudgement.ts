// Judgement made from THIS birth chart — never from the Moon sign.
//
// A Moon-sign forecast asks "where is Saturn relative to everyone's Moon?".
// This module instead asks the questions a chart reading asks:
//   • which houses does this planet rule FROM THIS LAGNA (functional nature)
//   • how many bindus does it hold in THIS native's own ashtakavarga
//   • which house of THIS chart is it transiting
//   • which dasha lord is running for THIS native
// Those four are all chart-specific, so two people born the same day with
// different lagnas get different answers.

import type { Kundli, PlanetId } from "./types";
import { SIGN_LORDS } from "./constants";
import { activeDashas } from "./dasha";

/** Houses (1–12) a planet rules counted from this chart's lagna */
export function rulesHouses(lagnaSign: number, planet: PlanetId): number[] {
  const out: number[] = [];
  for (let h = 1; h <= 12; h++) {
    if (SIGN_LORDS[(lagnaSign + h - 1) % 12] === planet) out.push(h);
  }
  return out;
}

export type FunctionalNature = "benefic" | "malefic" | "neutral";

/**
 * Parashari functional nature for this lagna: trikona (1/5/9) lords are
 * benefic, dusthana (6/8/12) lords malefic, the rest neutral. Nodes take
 * the nature of their dispositor's rulership.
 */
export function functionalNature(
  lagnaSign: number,
  planet: PlanetId
): FunctionalNature {
  const houses = rulesHouses(lagnaSign, planet);
  if (houses.length === 0) return "neutral"; // Rahu/Ketu own no sign
  const trikona = houses.some((h) => [1, 5, 9].includes(h));
  const dusthana = houses.some((h) => [6, 8, 12].includes(h));
  if (trikona && !dusthana) return "benefic";
  if (dusthana && !trikona) return "malefic";
  return "neutral";
}

/**
 * Bindus this native's own ashtakavarga gives a planet in a sign.
 * Classical transit rule: 4 is the pivot — 5+ gives results, 3 or fewer
 * struggles, regardless of what the sign-level forecast says.
 */
export function binduFor(
  kundli: Kundli,
  planet: PlanetId,
  sign: number
): number | null {
  const row = kundli.ashtakavarga.bav[planet];
  if (!row) return null; // Rahu/Ketu have no BAV
  return row[((sign % 12) + 12) % 12];
}

export interface TransitJudgement {
  /** house of THIS chart being transited (from lagna) */
  houseFromLagna: number;
  /**
   * House counted from the natal Moon — the Chandra Kundli reading.
   * Classical gochar anchors here; used ALONGSIDE the lagna house, never
   * alone, so the verdict stays specific to this chart rather than to
   * everyone sharing the Moon sign.
   */
  houseFromChandra: number;
  /** houses this planet rules in THIS chart */
  rules: number[];
  nature: FunctionalNature;
  /** own-ashtakavarga bindus in the transited sign (null for nodes) */
  bindus: number | null;
  /** −100…+100 favourability for THIS chart */
  score: number;
  favourable: boolean;
  /** do the lagna and Chandra readings agree? */
  bothAgree: boolean;
}

/** Houses whose transit is structurally difficult from the lagna */
const HARSH_HOUSES = [6, 8, 12];
/** Houses whose transit is structurally supportive from the lagna */
const KIND_HOUSES = [1, 3, 5, 9, 10, 11];

/** Classical gochar: houses from the natal Moon where each graha does well */
const GOOD_FROM_CHANDRA: Record<PlanetId, number[]> = {
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

export function judgeTransit(
  kundli: Kundli,
  planet: PlanetId,
  transitSign: number
): TransitJudgement {
  const lagna = kundli.lagna.sign;
  const natalMoonSign = kundli.planets.find((p) => p.id === "Moon")!.sign;
  const houseFromLagna = ((transitSign - lagna + 12) % 12) + 1;
  const houseFromChandra = ((transitSign - natalMoonSign + 12) % 12) + 1;
  const rules = rulesHouses(lagna, planet);
  const nature = functionalNature(lagna, planet);
  const bindus = binduFor(kundli, planet, transitSign);

  let score = 0;
  // 1. Ashtakavarga — the strongest personal filter, unique to this chart
  if (bindus !== null) {
    if (bindus >= 6) score += 36;
    else if (bindus === 5) score += 22;
    else if (bindus === 4) score += 4;
    else if (bindus === 3) score -= 16;
    else score -= 28;
  }
  // 2. Which house of THIS chart it activates (lagna reading)
  if (KIND_HOUSES.includes(houseFromLagna)) score += 16;
  else if (HARSH_HOUSES.includes(houseFromLagna)) score -= 18;
  // 3. Classical gochar from the natal Moon (Chandra Kundli reading)
  const chandraGood = GOOD_FROM_CHANDRA[planet].includes(houseFromChandra);
  score += chandraGood ? 14 : -14;
  // 4. Functional nature for this lagna
  if (nature === "benefic") score += 18;
  else if (nature === "malefic") score -= 14;
  // 5. A planet transiting a house it rules strengthens that house's matters
  if (rules.includes(houseFromLagna)) score += 8;

  score = Math.max(-100, Math.min(100, score));
  const lagnaGood = KIND_HOUSES.includes(houseFromLagna);
  return {
    houseFromLagna,
    houseFromChandra,
    rules,
    nature,
    bindus,
    score,
    favourable: score >= 10,
    bothAgree: lagnaGood === chandraGood,
  };
}

export interface DashaContext {
  mahaLord: PlanetId;
  antarLord?: PlanetId;
  pratyantarLord?: PlanetId;
  /** does the running period rule or signify the asked houses? */
  activatesHouses: number[];
  /** functional nature of the deepest running lord */
  nature: FunctionalNature;
}

/** The dasha actually running for THIS native at an instant */
export function dashaContext(kundli: Kundli, atMs: number): DashaContext | null {
  const chain = activeDashas(kundli.dasha, atMs);
  if (chain.length === 0) return null;
  const lagna = kundli.lagna.sign;
  const deepest = chain[chain.length - 1].lord;
  const activates = new Set<number>();
  for (const p of chain) {
    for (const h of rulesHouses(lagna, p.lord)) activates.add(h);
    const pos = kundli.planets.find((x) => x.id === p.lord);
    if (pos) activates.add(pos.house);
  }
  return {
    mahaLord: chain[0].lord,
    antarLord: chain[1]?.lord,
    pratyantarLord: chain[2]?.lord,
    activatesHouses: [...activates].sort((a, b) => a - b),
    nature: functionalNature(lagna, deepest),
  };
}
