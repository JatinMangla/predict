// The classical five-step precision funnel, computed end to end:
//
//   1. Birth-time rectification confidence — how far the birth minute can be
//      wrong before the lagna (and the far more sensitive navamsa lagna)
//      changes, i.e. how much this chart can be trusted at all.
//   2. Natal promise — does the chart even promise the asked event?
//   3. Dasha — which 2–3 year periods can deliver it.
//   4. Gochara — the 15–30 day stretches inside those periods when slow
//      transits actually open the door (read from lagna AND Chandra).
//   5. Muhurta — the exact day and clock window to act.

import type { Kundli, PlanetId } from "./types";
import { SIGN_LORDS, ASPECTS } from "./constants";
import { ascendantSidereal } from "./ephemeris";
import { siderealLongitude } from "./ephemeris";
import { birthToUtcMs } from "./kundli";
import { vargaSign } from "./vargas";
import { activeDashas } from "./dasha";
import { strengthScore } from "./strength";
import { rulesHouses, judgeTransit, binduFor } from "./chartJudgement";
import {
  personalDayWindows,
  bestDays,
  type FavourableWindow,
} from "./favourableWindows";

const MIN_MS = 60 * 1000;
const DAY_MS = 86400 * 1000;
const YEAR_MS = 365.25 * DAY_MS;

// ── Step 1: birth-time rectification confidence ─────────────────────

export interface BirthTimeConfidence {
  /** minutes before/after the stated time that keep the SAME lagna sign */
  lagnaFromMs: number;
  lagnaToMs: number;
  lagnaMinutesBefore: number;
  lagnaMinutesAfter: number;
  /** the same for the navamsa (D9) lagna — far tighter, ~13 minutes */
  navamsaMinutesBefore: number;
  navamsaMinutesAfter: number;
  /** how safe the reading is: wide navamsa window = trustworthy */
  confidence: "high" | "medium" | "low";
}

function lagnaSignAt(k: Kundli, ms: number): number {
  return Math.floor(ascendantSidereal(ms, k.birth.latitude, k.birth.longitude) / 30) % 12;
}
function navamsaSignAt(k: Kundli, ms: number): number {
  return vargaSign(ascendantSidereal(ms, k.birth.latitude, k.birth.longitude), "D9");
}

/** Walk out from the birth instant until `signOf` changes, then bisect */
function boundary(
  k: Kundli,
  signOf: (k: Kundli, ms: number) => number,
  direction: 1 | -1,
  maxMinutes: number
): number {
  const base = signOf(k, k.utcMs);
  const step = MIN_MS;
  let last = k.utcMs;
  for (let m = 1; m <= maxMinutes; m++) {
    const t = k.utcMs + direction * m * step;
    if (signOf(k, t) !== base) {
      // bisect between last (same) and t (different)
      let lo = last;
      let hi = t;
      while (Math.abs(hi - lo) > 10_000) {
        const mid = Math.floor((lo + hi) / 2);
        if (signOf(k, mid) === base) lo = mid;
        else hi = mid;
      }
      return lo;
    }
    last = t;
  }
  return k.utcMs + direction * maxMinutes * step;
}

export function birthTimeConfidence(kundli: Kundli): BirthTimeConfidence {
  const lagnaFromMs = boundary(kundli, lagnaSignAt, -1, 150);
  const lagnaToMs = boundary(kundli, lagnaSignAt, 1, 150);
  const navFrom = boundary(kundli, navamsaSignAt, -1, 40);
  const navTo = boundary(kundli, navamsaSignAt, 1, 40);

  const navBefore = Math.round((kundli.utcMs - navFrom) / MIN_MS);
  const navAfter = Math.round((navTo - kundli.utcMs) / MIN_MS);
  const tightest = Math.min(navBefore, navAfter);

  return {
    lagnaFromMs,
    lagnaToMs,
    lagnaMinutesBefore: Math.round((kundli.utcMs - lagnaFromMs) / MIN_MS),
    lagnaMinutesAfter: Math.round((lagnaToMs - kundli.utcMs) / MIN_MS),
    navamsaMinutesBefore: navBefore,
    navamsaMinutesAfter: navAfter,
    confidence: tightest >= 5 ? "high" : tightest >= 2 ? "medium" : "low",
  };
}

// ── Step 2: natal promise ───────────────────────────────────────────

export interface NatalPromise {
  /** 0–100: how strongly the chart promises this area at all */
  score: number;
  verdict: "strong" | "moderate" | "conditional" | "weak";
  supports: string[];
  blocks: string[];
}

function lordOf(kundli: Kundli, house: number) {
  const sign = (kundli.lagna.sign + house - 1) % 12;
  return kundli.planets.find((p) => p.id === SIGN_LORDS[sign])!;
}

export function natalPromise(
  kundli: Kundli,
  houses: number[],
  karakas: PlanetId[]
): NatalPromise {
  const supports: string[] = [];
  const blocks: string[] = [];
  let total = 0;
  let weight = 0;

  for (const h of houses) {
    const lord = lordOf(kundli, h);
    const s = strengthScore({
      dignity: lord.dignity,
      combust: lord.combust,
      retrograde: lord.retrograde,
      house: lord.house,
      planet: lord.id,
    });
    total += s * 2;
    weight += 2;
    if (s >= 60) supports.push(`H${h} lord ${lord.id} strong (${lord.dignity}) in H${lord.house}`);
    else if (s <= 45)
      blocks.push(`H${h} lord ${lord.id} weak (${lord.dignity}${lord.combust ? ", combust" : ""}) in H${lord.house}`);

    // occupants of the house itself
    for (const occ of kundli.planets.filter((p) => p.house === h)) {
      const os = strengthScore({
        dignity: occ.dignity,
        combust: occ.combust,
        retrograde: occ.retrograde,
        house: occ.house,
        planet: occ.id,
      });
      total += os;
      weight += 1;
      if (["Jupiter", "Venus", "Mercury", "Moon"].includes(occ.id) && os >= 50)
        supports.push(`benefic ${occ.id} occupies H${h}`);
      if (["Saturn", "Mars", "Rahu", "Ketu"].includes(occ.id))
        blocks.push(`${occ.id} occupies H${h}`);
    }

    // benefic aspects to the house
    const aspecting = kundli.planets.filter((p) =>
      ASPECTS[p.id].some((a) => ((p.house + a - 2) % 12) + 1 === h)
    );
    for (const p of aspecting) {
      if (["Jupiter", "Venus"].includes(p.id)) {
        total += 62;
        weight += 1;
        supports.push(`${p.id} aspects H${h}`);
      }
    }
  }

  for (const k of karakas) {
    const p = kundli.planets.find((x) => x.id === k)!;
    const s = strengthScore({
      dignity: p.dignity,
      combust: p.combust,
      retrograde: p.retrograde,
      house: p.house,
      planet: p.id,
    });
    total += s;
    weight += 1;
    if (s >= 60) supports.push(`karaka ${k} strong in H${p.house}`);
    else if (s <= 45) blocks.push(`karaka ${k} weak in H${p.house}`);
  }

  const score = weight > 0 ? Math.round(total / weight) : 50;
  const verdict: NatalPromise["verdict"] =
    score >= 65 ? "strong" : score >= 53 ? "moderate" : score >= 45 ? "conditional" : "weak";
  return { score, verdict, supports: supports.slice(0, 6), blocks: blocks.slice(0, 6) };
}

// ── Step 3: dasha windows ───────────────────────────────────────────

export interface DashaWindow {
  mahaLord: PlanetId;
  antarLord: PlanetId;
  /** present for short scopes, where this is the level that actually moves */
  pratyantarLord?: PlanetId;
  startMs: number;
  endMs: number;
  /** 0–100 relevance of this period to the asked houses */
  relevance: number;
  reasons: string[];
}

/** Relevance of a dasha lord to the asked houses, from THIS chart */
function lordRelevance(
  kundli: Kundli,
  lord: PlanetId,
  houses: number[],
  karakas: PlanetId[]
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const rules = rulesHouses(kundli.lagna.sign, lord).filter((h) => houses.includes(h));
  if (rules.length) {
    score += 45;
    reasons.push(`rules H${rules.join("/")}`);
  }
  const pos = kundli.planets.find((p) => p.id === lord)!;
  if (houses.includes(pos.house)) {
    score += 30;
    reasons.push(`sits in H${pos.house}`);
  }
  if (karakas.includes(lord)) {
    score += 25;
    reasons.push("natural karaka");
  }
  const st = strengthScore({
    dignity: pos.dignity,
    combust: pos.combust,
    retrograde: pos.retrograde,
    house: pos.house,
    planet: pos.id,
  });
  score += Math.round((st - 50) / 4);
  if (st >= 60) reasons.push(`strong (${pos.dignity})`);
  if (st <= 40) reasons.push(`weak (${pos.dignity})`);
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

/**
 * Dasha periods overlapping a date range. For short ranges the
 * pratyantardasha level is included, since that is what actually changes
 * within a week or a month.
 */
export function dashaWindowsInRange(
  kundli: Kundli,
  houses: number[],
  karakas: PlanetId[],
  fromMs: number,
  toMs: number,
  includePratyantar: boolean
): DashaWindow[] {
  const out: DashaWindow[] = [];
  for (const md of kundli.dasha) {
    if (md.end < fromMs || md.start > toMs || !md.children) continue;
    for (const ad of md.children) {
      if (ad.end < fromMs || ad.start > toMs) continue;
      const m = lordRelevance(kundli, md.lord, houses, karakas);
      const a = lordRelevance(kundli, ad.lord, houses, karakas);

      if (includePratyantar && ad.children) {
        for (const pd of ad.children) {
          if (pd.end < fromMs || pd.start > toMs) continue;
          const p = lordRelevance(kundli, pd.lord, houses, karakas);
          out.push({
            mahaLord: md.lord,
            antarLord: ad.lord,
            pratyantarLord: pd.lord,
            startMs: Math.max(pd.start, fromMs),
            endMs: Math.min(pd.end, toMs),
            relevance: Math.round(m.score * 0.25 + a.score * 0.35 + p.score * 0.4),
            reasons: [
              ...a.reasons.map((r) => `${ad.lord} (AD) ${r}`),
              ...p.reasons.map((r) => `${pd.lord} (PD) ${r}`),
            ].slice(0, 4),
          });
        }
      } else {
        out.push({
          mahaLord: md.lord,
          antarLord: ad.lord,
          startMs: Math.max(ad.start, fromMs),
          endMs: Math.min(ad.end, toMs),
          relevance: Math.round(m.score * 0.45 + a.score * 0.55),
          reasons: [
            ...m.reasons.map((r) => `${md.lord} (MD) ${r}`),
            ...a.reasons.map((r) => `${ad.lord} (AD) ${r}`),
          ].slice(0, 4),
        });
      }
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs).slice(0, 8);
}

export function dashaWindows(
  kundli: Kundli,
  houses: number[],
  karakas: PlanetId[],
  fromMs: number,
  years = 5
): DashaWindow[] {
  const horizon = fromMs + years * YEAR_MS;
  const out: DashaWindow[] = [];

  const relevanceOf = (lord: PlanetId): { score: number; reasons: string[] } => {
    const reasons: string[] = [];
    let score = 0;
    const rules = rulesHouses(kundli.lagna.sign, lord).filter((h) => houses.includes(h));
    if (rules.length) {
      score += 45;
      reasons.push(`rules H${rules.join("/")}`);
    }
    const pos = kundli.planets.find((p) => p.id === lord)!;
    if (houses.includes(pos.house)) {
      score += 30;
      reasons.push(`sits in H${pos.house}`);
    }
    if (karakas.includes(lord)) {
      score += 25;
      reasons.push("natural karaka");
    }
    const st = strengthScore({
      dignity: pos.dignity,
      combust: pos.combust,
      retrograde: pos.retrograde,
      house: pos.house,
      planet: pos.id,
    });
    score += Math.round((st - 50) / 4);
    if (st >= 60) reasons.push(`strong (${pos.dignity})`);
    if (st <= 40) reasons.push(`weak (${pos.dignity})`);
    return { score: Math.max(0, Math.min(100, score)), reasons };
  };

  for (const md of kundli.dasha) {
    if (md.end < fromMs || md.start > horizon || !md.children) continue;
    for (const ad of md.children) {
      if (ad.end < fromMs || ad.start > horizon) continue;
      const m = relevanceOf(md.lord);
      const a = relevanceOf(ad.lord);
      const relevance = Math.round(m.score * 0.45 + a.score * 0.55);
      if (relevance < 25) continue;
      out.push({
        mahaLord: md.lord,
        antarLord: ad.lord,
        startMs: Math.max(ad.start, fromMs),
        endMs: ad.end,
        relevance,
        reasons: [
          ...m.reasons.map((r) => `${md.lord} (MD) ${r}`),
          ...a.reasons.map((r) => `${ad.lord} (AD) ${r}`),
        ].slice(0, 4),
      });
    }
  }
  return out.sort((a, b) => b.relevance - a.relevance || a.startMs - b.startMs).slice(0, 6);
}

// ── Step 4: gochara narrowing ───────────────────────────────────────

export interface GocharaWindow {
  startMs: number;
  endMs: number;
  /** which slow planet opened this window */
  planet: PlanetId;
  houseFromLagna: number;
  houseFromChandra: number;
  bindus: number | null;
  note: string;
}

/** Does this planet support the asked houses from its transit sign? */
function supportsHouses(
  kundli: Kundli,
  planet: PlanetId,
  transitSign: number,
  houses: number[]
): { ok: boolean; house: number } {
  const houseFromLagna = ((transitSign - kundli.lagna.sign + 12) % 12) + 1;
  if (houses.includes(houseFromLagna)) return { ok: true, house: houseFromLagna };
  // graha drishti onto the target houses
  for (const a of ASPECTS[planet]) {
    const aspected = ((houseFromLagna + a - 2) % 12) + 1;
    if (houses.includes(aspected)) return { ok: true, house: aspected };
  }
  return { ok: false, house: houseFromLagna };
}

/**
 * Inside a dasha window, find the stretches when Jupiter or Saturn actually
 * touches the asked houses with usable ashtakavarga support.
 */
export function gocharaWindows(
  kundli: Kundli,
  houses: number[],
  fromMs: number,
  toMs: number,
  /** which grahas to scan — fast movers matter for short scopes */
  planets: PlanetId[] = ["Jupiter", "Saturn"],
  stepMs = 5 * DAY_MS
): GocharaWindow[] {
  const out: GocharaWindow[] = [];
  const step = stepMs;
  const span = Math.min(toMs - fromMs, 3 * YEAR_MS);

  for (const planet of planets) {
    let openFrom: number | null = null;
    let openInfo: { house: number; sign: number } | null = null;

    for (let t = fromMs; t <= fromMs + span; t += step) {
      const sign = Math.floor(siderealLongitude(planet, t) / 30) % 12;
      const sup = supportsHouses(kundli, planet, sign, houses);
      const bindus = binduFor(kundli, planet, sign);
      const usable = sup.ok && (bindus === null || bindus >= 4);

      if (usable && openFrom === null) {
        openFrom = t;
        openInfo = { house: sup.house, sign };
      } else if (!usable && openFrom !== null && openInfo) {
        const j = judgeTransit(kundli, planet, openInfo.sign);
        out.push({
          startMs: openFrom,
          endMs: t,
          planet,
          houseFromLagna: j.houseFromLagna,
          houseFromChandra: j.houseFromChandra,
          bindus: j.bindus,
          note: `${planet} activating H${openInfo.house}`,
        });
        openFrom = null;
        openInfo = null;
      }
    }
    if (openFrom !== null && openInfo) {
      const j = judgeTransit(kundli, planet, openInfo.sign);
      out.push({
        startMs: openFrom,
        endMs: fromMs + span,
        planet,
        houseFromLagna: j.houseFromLagna,
        houseFromChandra: j.houseFromChandra,
        bindus: j.bindus,
        note: `${planet} activating H${openInfo.house}`,
      });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs).slice(0, 6);
}

// ── Step 5: muhurta ─────────────────────────────────────────────────

export function muhurtaPicks(
  kundli: Kundli,
  houses: number[],
  karakas: PlanetId[],
  fromMs: number,
  days: number,
  tzOffsetMinutes: number,
  count = 5
): FavourableWindow[] {
  const scan = personalDayWindows(
    kundli,
    houses,
    karakas,
    fromMs,
    Math.min(days, 60),
    tzOffsetMinutes
  );
  const best = bestDays(scan, count);
  return best.length ? best : scan.sort((a, b) => b.score - a.score).slice(0, count);
}

// ── Whole funnel ────────────────────────────────────────────────────

export type ScopeKind = "daily" | "weekly" | "monthly" | "yearly";

export interface TimeScope {
  kind: ScopeKind;
  /** local-midnight ms of the first day in scope */
  fromMs: number;
  days: number;
}

export interface PrecisionFunnel {
  scope: TimeScope;
  step1: BirthTimeConfidence;
  step2: NatalPromise;
  step3: DashaWindow[];
  step4: GocharaWindow[];
  step5: FavourableWindow[];
}

/** Which grahas to watch, and how finely, for each scope */
const SCOPE_GOCHARA: Record<ScopeKind, { planets: PlanetId[]; stepMs: number }> = {
  // within a day or a week the Moon and the fast planets are what move
  daily: {
    planets: ["Moon", "Mercury", "Venus", "Sun", "Mars", "Jupiter", "Saturn"],
    stepMs: 2 * 3600 * 1000,
  },
  weekly: {
    planets: ["Moon", "Mercury", "Venus", "Sun", "Mars", "Jupiter", "Saturn"],
    stepMs: 6 * 3600 * 1000,
  },
  monthly: {
    planets: ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"],
    stepMs: DAY_MS,
  },
  yearly: { planets: ["Jupiter", "Saturn", "Rahu"], stepMs: 5 * DAY_MS },
};

export function runPrecisionFunnel(
  kundli: Kundli,
  houses: number[],
  karakas: PlanetId[],
  scope: TimeScope,
  tzOffsetMinutes: number
): PrecisionFunnel {
  const fromMs = scope.fromMs;
  const toMs = fromMs + scope.days * DAY_MS;

  const step1 = birthTimeConfidence(kundli);
  const step2 = natalPromise(kundli, houses, karakas);

  // Step 3 — dashas actually running in the chosen window. Short scopes get
  // the pratyantardasha, which is the level that changes within days.
  const shortScope = scope.kind === "daily" || scope.kind === "weekly";
  let step3 = dashaWindowsInRange(kundli, houses, karakas, fromMs, toMs, shortScope);
  // For a long view also surface the strongest upcoming periods
  if (scope.kind === "yearly" && step3.length < 3) {
    step3 = [...step3, ...dashaWindows(kundli, houses, karakas, fromMs, 3)]
      .filter((w, i, arr) => arr.findIndex((x) => x.startMs === w.startMs) === i)
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 8);
  }

  // Step 4 — transits inside the same window, at a resolution that suits it
  const g = SCOPE_GOCHARA[scope.kind];
  const step4 = gocharaWindows(kundli, houses, fromMs, toMs, g.planets, g.stepMs);

  // Step 5 — exact days and clock windows inside the scope
  const picks = scope.kind === "daily" ? 1 : scope.kind === "weekly" ? 7 : scope.kind === "monthly" ? 6 : 10;
  const step5 =
    scope.kind === "daily" || scope.kind === "weekly"
      ? personalDayWindows(kundli, houses, karakas, fromMs, scope.days, tzOffsetMinutes).slice(
          0,
          scope.days
        )
      : muhurtaPicks(kundli, houses, karakas, fromMs, scope.days, tzOffsetMinutes, picks);

  return { scope, step1, step2, step3, step4, step5 };
}

export { birthToUtcMs };
