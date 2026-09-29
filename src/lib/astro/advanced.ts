// Second-opinion systems a professional reading uses to CONFIRM a
// prediction rather than trust one method alone:
//   • Yogini dasha (36-year cycle) — a result promised by both Vimshottari
//     and Yogini is far more reliable than one promised by either alone
//   • Jaimini chara karakas + karakamsa
//   • Sade Sati / Dhaiya (Kantaka & Ashtama Shani) timeline with dates
//   • Choghadiya and planetary hora for the day

import type { Kundli, PlanetId } from "./types";
import { SAPTA_GRAHAS } from "./constants";
import { siderealLongitude } from "./ephemeris";
import { nakshatraFraction } from "./nakshatra";
import { vargaSign } from "./vargas";

const DAY_MS = 86400 * 1000;
const YEAR_MS = 365.25 * DAY_MS;

// ── Yogini dasha ────────────────────────────────────────────────────

export const YOGINIS: { name: string; hi: string; lord: PlanetId; years: number }[] = [
  { name: "Mangala", hi: "मंगला", lord: "Moon", years: 1 },
  { name: "Pingala", hi: "पिंगला", lord: "Sun", years: 2 },
  { name: "Dhanya", hi: "धान्या", lord: "Jupiter", years: 3 },
  { name: "Bhramari", hi: "भ्रामरी", lord: "Mars", years: 4 },
  { name: "Bhadrika", hi: "भद्रिका", lord: "Mercury", years: 5 },
  { name: "Ulka", hi: "उल्का", lord: "Saturn", years: 6 },
  { name: "Siddha", hi: "सिद्धा", lord: "Venus", years: 7 },
  { name: "Sankata", hi: "संकटा", lord: "Rahu", years: 8 },
];

export interface YoginiPeriod {
  yogini: number; // index into YOGINIS
  start: number;
  end: number;
  children?: YoginiPeriod[];
}

/**
 * Yogini dasha: the starting yogini is (birth nakshatra number + 3) mod 8
 * (1 = Mangala, 0 → Sankata); the elapsed fraction of the nakshatra is the
 * elapsed fraction of that first yogini. Generated for ~120 years.
 */
export function buildYogini(moonLon: number, birthMs: number): YoginiPeriod[] {
  const nakNumber = Math.floor(moonLon / (360 / 27)) + 1; // 1–27
  const startIdx = ((nakNumber + 3) % 8 + 7) % 8; // remainder 1 → index 0
  const elapsed = nakshatraFraction(moonLon);
  let cursor = birthMs - elapsed * YOGINIS[startIdx].years * YEAR_MS;
  const out: YoginiPeriod[] = [];
  let i = startIdx;
  while (cursor < birthMs + 120 * YEAR_MS) {
    const y = YOGINIS[i];
    const span = y.years * YEAR_MS;
    const period: YoginiPeriod = { yogini: i, start: cursor, end: cursor + span, children: [] };
    let c = cursor;
    for (let j = 0; j < 8; j++) {
      const sub = (i + j) % 8;
      const subSpan = (span * YOGINIS[sub].years) / 36;
      period.children!.push({ yogini: sub, start: c, end: c + subSpan });
      c += subSpan;
    }
    out.push(period);
    cursor += span;
    i = (i + 1) % 8;
  }
  return out;
}

export function activeYogini(periods: YoginiPeriod[], atMs: number): YoginiPeriod[] {
  const md = periods.find((p) => atMs >= p.start && atMs < p.end);
  if (!md) return [];
  const ad = md.children?.find((p) => atMs >= p.start && atMs < p.end);
  return ad ? [md, ad] : [md];
}

// ── Jaimini chara karakas ───────────────────────────────────────────

export const KARAKA_NAMES: { key: string; en: string; hi: string; signifies: string }[] = [
  { key: "AK", en: "Atmakaraka", hi: "आत्मकारक", signifies: "the soul, the self, life's central lesson" },
  { key: "AmK", en: "Amatyakaraka", hi: "अमात्यकारक", signifies: "career, advisers, the means of livelihood" },
  { key: "BK", en: "Bhratrikaraka", hi: "भ्रातृकारक", signifies: "siblings, courage, the guru" },
  { key: "MK", en: "Matrikaraka", hi: "मातृकारक", signifies: "mother, home, education" },
  { key: "PK", en: "Putrakaraka", hi: "पुत्रकारक", signifies: "children, creativity, followers" },
  { key: "GK", en: "Gnatikaraka", hi: "ज्ञातिकारक", signifies: "rivals, disease, obstacles" },
  { key: "DK", en: "Darakaraka", hi: "दाराकारक", signifies: "spouse and partnerships" },
];

export interface CharaKaraka {
  key: string;
  planet: PlanetId;
  degInSign: number;
}

/** Seven-karaka scheme: the seven grahas ranked by degrees within their sign */
export function charaKarakas(k: Kundli): { karakas: CharaKaraka[]; karakamsa: number } {
  const ranked = k.planets
    .filter((p) => SAPTA_GRAHAS.includes(p.id))
    .sort((a, b) => b.degInSign - a.degInSign);
  const karakas = ranked.map((p, i) => ({ key: KARAKA_NAMES[i].key, planet: p.id, degInSign: p.degInSign }));
  const ak = ranked[0];
  return { karakas, karakamsa: vargaSign(ak.longitude, "D9") };
}

// ── Sade Sati & Dhaiya ──────────────────────────────────────────────

export type ShaniPhase = "rising" | "peak" | "setting" | "kantaka" | "ashtama";

export interface ShaniSpan {
  phase: ShaniPhase;
  start: number;
  end: number;
}

export interface SadeSatiCycle {
  start: number;
  end: number;
  spans: ShaniSpan[];
}

const PHASE_OF_HOUSE: Record<number, ShaniPhase> = {
  12: "rising",
  1: "peak",
  2: "setting",
  4: "kantaka",
  8: "ashtama",
};

function saturnSign(ms: number): number {
  return Math.floor(siderealLongitude("Saturn", ms) / 30) % 12;
}

/**
 * Every Sade Sati cycle (Saturn in the 12th, 1st and 2nd from the natal
 * Moon) and every Dhaiya (4th = Kantaka, 8th = Ashtama Shani) between the
 * two instants, with ingress dates bisected to the hour. Retrograde
 * re-entries show up as separate spans inside the same cycle.
 */
export function shaniTimeline(
  natalMoonSign: number,
  fromMs: number,
  toMs: number
): { sadeSati: SadeSatiCycle[]; dhaiya: ShaniSpan[] } {
  const spans: ShaniSpan[] = [];
  const step = 5 * DAY_MS;
  const houseAt = (ms: number) => ((saturnSign(ms) - natalMoonSign + 12) % 12) + 1;
  const boundary = (lo: number, hi: number) => {
    const target = saturnSign(hi);
    while (hi - lo > 3600 * 1000) {
      const mid = (lo + hi) / 2;
      if (saturnSign(mid) === target) hi = mid;
      else lo = mid;
    }
    return hi;
  };

  let t = fromMs;
  let h = houseAt(t);
  let spanStart = t;
  while (t < toMs) {
    const next = Math.min(t + step, toMs);
    const hn = houseAt(next);
    if (hn !== h || next >= toMs) {
      const edge = hn !== h ? boundary(t, next) : next;
      if (PHASE_OF_HOUSE[h]) spans.push({ phase: PHASE_OF_HOUSE[h], start: spanStart, end: edge });
      spanStart = edge;
      h = hn;
    }
    t = next;
  }

  const sade = spans.filter((s) => s.phase === "rising" || s.phase === "peak" || s.phase === "setting");
  const cycles: SadeSatiCycle[] = [];
  for (const s of sade) {
    const last = cycles[cycles.length - 1];
    // spans less than ~3 years apart belong to the same 7½-year cycle
    if (last && s.start - last.end < 3 * YEAR_MS) {
      last.end = s.end;
      last.spans.push(s);
    } else {
      cycles.push({ start: s.start, end: s.end, spans: [s] });
    }
  }
  return {
    sadeSati: cycles,
    dhaiya: spans.filter((s) => s.phase === "kantaka" || s.phase === "ashtama"),
  };
}

// ── Choghadiya & hora ───────────────────────────────────────────────

export const CHOGHADIYA: Record<PlanetId, { en: string; hi: string; quality: "good" | "neutral" | "bad" }> = {
  Sun: { en: "Udveg", hi: "उद्वेग", quality: "bad" },
  Venus: { en: "Char", hi: "चर", quality: "neutral" },
  Mercury: { en: "Labh", hi: "लाभ", quality: "good" },
  Moon: { en: "Amrit", hi: "अमृत", quality: "good" },
  Saturn: { en: "Kaal", hi: "काल", quality: "bad" },
  Jupiter: { en: "Shubh", hi: "शुभ", quality: "good" },
  Mars: { en: "Rog", hi: "रोग", quality: "bad" },
  Rahu: { en: "—", hi: "—", quality: "neutral" },
  Ketu: { en: "—", hi: "—", quality: "neutral" },
};

const WEEKDAY_LORDS: PlanetId[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

export interface TimeSlot {
  lord: PlanetId;
  start: number;
  end: number;
  night: boolean;
}

/**
 * Eight day and eight night choghadiyas. The day starts with the weekday
 * lord and steps five weekdays each slot (Sun → Venus → Mercury → Moon →
 * Saturn → Jupiter → Mars); the night starts with the lord of the weekday
 * four ahead and steps four.
 */
export function choghadiya(sunrise: number, sunset: number, nextSunrise: number, weekday: number): TimeSlot[] {
  const out: TimeSlot[] = [];
  const day = (sunset - sunrise) / 8;
  const night = (nextSunrise - sunset) / 8;
  for (let i = 0; i < 8; i++) {
    out.push({ lord: WEEKDAY_LORDS[(weekday + 5 * i) % 7], start: sunrise + i * day, end: sunrise + (i + 1) * day, night: false });
  }
  for (let i = 0; i < 8; i++) {
    out.push({ lord: WEEKDAY_LORDS[(weekday + 4 + 4 * i) % 7], start: sunset + i * night, end: sunset + (i + 1) * night, night: true });
  }
  return out;
}

/** Chaldean order of the horas, slowest to fastest */
const HORA_ORDER: PlanetId[] = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];

/** 12 day + 12 night planetary horas, the first ruled by the weekday lord */
export function horas(sunrise: number, sunset: number, nextSunrise: number, weekday: number): TimeSlot[] {
  const first = HORA_ORDER.indexOf(WEEKDAY_LORDS[weekday]);
  const out: TimeSlot[] = [];
  const d = (sunset - sunrise) / 12;
  const n = (nextSunrise - sunset) / 12;
  for (let i = 0; i < 24; i++) {
    const night = i >= 12;
    const start = night ? sunset + (i - 12) * n : sunrise + i * d;
    out.push({ lord: HORA_ORDER[(first + i) % 7], start, end: start + (night ? n : d), night });
  }
  return out;
}

/** The slot running at an instant, if any */
export function slotAt(slots: TimeSlot[], ms: number): TimeSlot | undefined {
  return slots.find((s) => ms >= s.start && ms < s.end);
}
