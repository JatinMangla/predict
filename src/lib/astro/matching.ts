// Kundli Milan — Ashtakoota (36-guna) matching from the two natal Moons,
// plus the checks a careful astrologer adds before trusting the number:
// Manglik parity, Nadi/Bhakoot dosha cancellations, and the South-Indian
// Rajju and Vedha tests.
//
// Tables follow the widely used North-Indian (Muhurta Chintamani) scheme.
// Where published tables are asymmetric, rows are the groom and columns the
// bride, as printed in the sources:
//   Yoni   — saravali.github.io/astrology/koota_yoni.html
//   Vashya — freehoroscopesonline.in/vashyakoota.php (bride rows there;
//            transposed here so every table reads groom → bride)

import type { Kundli, PlanetId } from "./types";
import { SIGN_LORDS, FRIENDS, ENEMIES } from "./constants";

export interface KootaScore {
  key: "varna" | "vashya" | "tara" | "yoni" | "maitri" | "gana" | "bhakoot" | "nadi";
  max: number;
  score: number;
  /** what each side contributes, e.g. "Deva × Rakshasa" */
  detail: string;
  /** set when a classical exception neutralises a zero score's dosha */
  cancelledBy?: string;
}

export interface MatchResult {
  kootas: KootaScore[];
  total: number;
  /** 36-point verdict band */
  verdict: "excellent" | "good" | "average" | "poor";
  manglik: {
    groom: boolean;
    bride: boolean;
    /** balanced = both or neither actively manglik */
    balanced: boolean;
  };
  /** South-Indian checks */
  rajju: { same: boolean; part: string };
  vedha: boolean;
  /** major doshas still active after exceptions */
  activeDoshas: string[];
}

export interface MoonInput {
  nakshatra: number; // 0–26
  sign: number; // 0–11
  /** sidereal longitude, needed only for the split Sagittarius/Capricorn vashya */
  longitude: number;
  pada: number;
}

// ── Varna (1) ──────────────────────────────────────────────────────
// Brahmin 4 (water signs), Kshatriya 3 (fire), Vaishya 2 (earth), Shudra 1 (air)
const VARNA_OF_SIGN = [3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1, 4];
const VARNA_NAMES: Record<number, string> = { 4: "Brahmin", 3: "Kshatriya", 2: "Vaishya", 1: "Shudra" };

// ── Vashya (2) ─────────────────────────────────────────────────────
type Vashya = 0 | 1 | 2 | 3 | 4; // Chatushpada, Manava, Jalachara, Vanachara, Keeta
const VASHYA_NAMES = ["Chatushpada", "Manava", "Jalachara", "Vanachara", "Keeta"];

function vashyaOf(sign: number, longitude: number): Vashya {
  const deg = longitude % 30;
  switch (sign) {
    case 0: case 1: return 0;
    case 2: case 5: case 6: case 10: return 1;
    case 3: case 11: return 2;
    case 4: return 3;
    case 7: return 4;
    case 8: return deg < 15 ? 1 : 0; // Dhanu: first half human, second quadruped
    case 9: return deg < 15 ? 0 : 2; // Makara: first half quadruped, second aquatic
  }
  return 1;
}

// Published table is bride-row / groom-column; indexed here [bride][groom].
const VASHYA_TABLE_BRIDE_GROOM: number[][] = [
  [2, 1, 1, 1.5, 1],
  [1, 2, 1.5, 0, 1],
  [1, 1.5, 2, 1, 1],
  [0, 0, 0, 2, 0],
  [1, 1, 1, 0, 2],
];

// ── Yoni (4) ───────────────────────────────────────────────────────
const YONI_NAMES = [
  "Horse", "Elephant", "Sheep", "Serpent", "Dog", "Cat", "Rat",
  "Cow", "Buffalo", "Tiger", "Deer", "Monkey", "Mongoose", "Lion",
];
/** yoni animal per nakshatra (index into YONI_NAMES) */
const YONI_OF_NAK = [
  0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1,
];
/** [groom][bride] */
const YONI_TABLE: number[][] = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
  [1, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
  [1, 0, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 4],
];

// ── Gana (6) ───────────────────────────────────────────────────────
const GANA_NAMES = ["Deva", "Manushya", "Rakshasa"];
const GANA_OF_NAK = [
  0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0,
];
/** [groom][bride] */
const GANA_TABLE: number[][] = [
  [6, 6, 1],
  [5, 6, 0],
  [1, 0, 6],
];

// ── Nadi (8) ───────────────────────────────────────────────────────
const NADI_NAMES = ["Adi (Vata)", "Madhya (Pitta)", "Antya (Kapha)"];
/** Nadi repeats Adi, Madhya, Antya, Antya, Madhya, Adi through the 27 stars */
export function nadiOf(nak: number): number {
  return [0, 1, 2, 2, 1, 0][nak % 6];
}

// ── Rajju / Vedha (South Indian) ───────────────────────────────────
const RAJJU_NAMES = ["Pada (feet)", "Kati (waist)", "Nabhi (navel)", "Kantha (neck)", "Shira (head)"];
function rajjuOf(nak: number): number {
  return [0, 1, 2, 3, 4, 3, 2, 1, 0][nak % 9];
}
const VEDHA_PAIRS: [number, number][] = [
  [0, 17], [1, 16], [2, 15], [3, 14], [5, 21], [6, 20], [7, 19], [8, 18],
  [9, 26], [10, 25], [11, 24], [12, 23], [4, 13], [13, 22], [4, 22],
];

// ── Graha Maitri (5) ───────────────────────────────────────────────
type Rel = "friend" | "neutral" | "enemy";
function rel(a: PlanetId, b: PlanetId): Rel {
  if (FRIENDS[a].includes(b)) return "friend";
  if (ENEMIES[a].includes(b)) return "enemy";
  return "neutral";
}
function maitriScore(a: PlanetId, b: PlanetId): number {
  if (a === b) return 5;
  const r = [rel(a, b), rel(b, a)].sort().join("-");
  switch (r) {
    case "friend-friend": return 5;
    case "friend-neutral": return 4;
    case "neutral-neutral": return 3;
    case "enemy-friend": return 1;
    case "enemy-neutral": return 0.5;
    default: return 0;
  }
}

/** Tara: counts 3, 5, 7 (mod 9) from the other's star are inauspicious */
function taraGood(from: number, to: number): boolean {
  const n = ((to - from + 27) % 27) + 1;
  return ![3, 5, 7].includes(n % 9);
}

export function moonInput(k: Kundli): MoonInput {
  const m = k.planets.find((p) => p.id === "Moon")!;
  return { nakshatra: m.nakshatra, sign: m.sign, longitude: m.longitude, pada: m.pada };
}

export function ashtakoota(groom: MoonInput, bride: MoonInput): KootaScore[] {
  const out: KootaScore[] = [];

  // Varna
  const vg = VARNA_OF_SIGN[groom.sign];
  const vb = VARNA_OF_SIGN[bride.sign];
  out.push({ key: "varna", max: 1, score: vg >= vb ? 1 : 0, detail: `${VARNA_NAMES[vg]} × ${VARNA_NAMES[vb]}` });

  // Vashya
  const wg = vashyaOf(groom.sign, groom.longitude);
  const wb = vashyaOf(bride.sign, bride.longitude);
  out.push({
    key: "vashya",
    max: 2,
    score: VASHYA_TABLE_BRIDE_GROOM[wb][wg],
    detail: `${VASHYA_NAMES[wg]} × ${VASHYA_NAMES[wb]}`,
  });

  // Tara
  const t1 = taraGood(bride.nakshatra, groom.nakshatra);
  const t2 = taraGood(groom.nakshatra, bride.nakshatra);
  out.push({
    key: "tara",
    max: 3,
    score: t1 && t2 ? 3 : t1 || t2 ? 1.5 : 0,
    detail: `${t1 ? "good" : "adverse"} from bride's star, ${t2 ? "good" : "adverse"} from groom's star`,
  });

  // Yoni
  const yg = YONI_OF_NAK[groom.nakshatra];
  const yb = YONI_OF_NAK[bride.nakshatra];
  out.push({ key: "yoni", max: 4, score: YONI_TABLE[yg][yb], detail: `${YONI_NAMES[yg]} × ${YONI_NAMES[yb]}` });

  // Graha Maitri
  const lg = SIGN_LORDS[groom.sign];
  const lb = SIGN_LORDS[bride.sign];
  const maitri = maitriScore(lg, lb);
  out.push({ key: "maitri", max: 5, score: maitri, detail: `${lg} × ${lb}` });

  // Gana
  const gg = GANA_OF_NAK[groom.nakshatra];
  const gb = GANA_OF_NAK[bride.nakshatra];
  const gana: KootaScore = { key: "gana", max: 6, score: GANA_TABLE[gg][gb], detail: `${GANA_NAMES[gg]} × ${GANA_NAMES[gb]}` };
  if (gana.score <= 1 && maitri >= 4) gana.cancelledBy = "Moon-sign lords are friends (Graha Maitri 4+)";
  out.push(gana);

  // Bhakoot
  const d = ((bride.sign - groom.sign + 12) % 12) + 1;
  const back = ((groom.sign - bride.sign + 12) % 12) + 1;
  const pair = [d, back].sort((a, b) => a - b).join("/");
  const bhakootBad = ["2/12", "5/9", "6/8"].includes(pair);
  const bhakoot: KootaScore = {
    key: "bhakoot",
    max: 7,
    score: bhakootBad ? 0 : 7,
    detail: `Moons ${pair} from each other`,
  };
  if (bhakootBad) {
    if (lg === lb) bhakoot.cancelledBy = "both Moon signs share one lord";
    else if (rel(lg, lb) === "friend" && rel(lb, lg) === "friend") bhakoot.cancelledBy = "Moon-sign lords are mutual friends";
  }
  out.push(bhakoot);

  // Nadi
  const ng = nadiOf(groom.nakshatra);
  const nb = nadiOf(bride.nakshatra);
  const nadi: KootaScore = { key: "nadi", max: 8, score: ng === nb ? 0 : 8, detail: `${NADI_NAMES[ng]} × ${NADI_NAMES[nb]}` };
  if (ng === nb) {
    if (groom.nakshatra === bride.nakshatra && groom.sign !== bride.sign)
      nadi.cancelledBy = "same nakshatra but different Moon signs";
    else if (groom.sign === bride.sign && groom.nakshatra !== bride.nakshatra)
      nadi.cancelledBy = "same Moon sign but different nakshatras";
    else if (groom.nakshatra === bride.nakshatra && groom.pada !== bride.pada)
      nadi.cancelledBy = "same nakshatra but different padas";
  }
  out.push(nadi);

  return out;
}

function activeManglik(k: Kundli): boolean {
  const m = k.yogas.find((y) => y.key === "manglik");
  return Boolean(m && !m.cancelledBy?.length && m.strength >= 2);
}

export function matchKundlis(groom: Kundli, bride: Kundli): MatchResult {
  const g = moonInput(groom);
  const b = moonInput(bride);
  const kootas = ashtakoota(g, b);
  const total = kootas.reduce((s, k) => s + k.score, 0);

  const mg = activeManglik(groom);
  const mb = activeManglik(bride);

  const rg = rajjuOf(g.nakshatra);
  const rb = rajjuOf(b.nakshatra);
  const vedha = VEDHA_PAIRS.some(
    ([x, y]) => (x === g.nakshatra && y === b.nakshatra) || (y === g.nakshatra && x === b.nakshatra)
  );

  const activeDoshas: string[] = [];
  for (const k of kootas) {
    if (k.score === 0 && !k.cancelledBy && ["nadi", "bhakoot", "gana"].includes(k.key)) {
      activeDoshas.push(`${k.key}-dosha`);
    }
  }
  if (mg !== mb) activeDoshas.push("manglik-mismatch");
  if (rg === rb) activeDoshas.push("rajju");
  if (vedha) activeDoshas.push("vedha");

  const verdict: MatchResult["verdict"] =
    total >= 32 ? "excellent" : total >= 25 ? "good" : total >= 18 ? "average" : "poor";

  return {
    kootas,
    total,
    verdict,
    manglik: { groom: mg, bride: mb, balanced: mg === mb },
    rajju: { same: rg === rb, part: RAJJU_NAMES[rg] },
    vedha,
    activeDoshas,
  };
}

export const KOOTA_INFO: Record<KootaScore["key"], { name: { en: string; hi: string }; about: { en: string; hi: string } }> = {
  varna: { name: { en: "Varna", hi: "वर्ण" }, about: { en: "Spiritual temperament and ego compatibility", hi: "आध्यात्मिक स्वभाव व अहं का मेल" } },
  vashya: { name: { en: "Vashya", hi: "वश्य" }, about: { en: "Mutual attraction and who influences whom", hi: "परस्पर आकर्षण व प्रभाव" } },
  tara: { name: { en: "Tara", hi: "तारा" }, about: { en: "Destiny and health luck between the birth stars", hi: "जन्म नक्षत्रों के बीच भाग्य व स्वास्थ्य" } },
  yoni: { name: { en: "Yoni", hi: "योनि" }, about: { en: "Physical and intimate compatibility", hi: "शारीरिक व दांपत्य अनुकूलता" } },
  maitri: { name: { en: "Graha Maitri", hi: "ग्रह मैत्री" }, about: { en: "Mental wavelength — friendship of the Moon-sign lords", hi: "मानसिक तालमेल — राशि स्वामियों की मित्रता" } },
  gana: { name: { en: "Gana", hi: "गण" }, about: { en: "Temperament: Deva, Manushya or Rakshasa nature", hi: "स्वभाव: देव, मनुष्य या राक्षस गण" } },
  bhakoot: { name: { en: "Bhakoot", hi: "भकूट" }, about: { en: "Family welfare, finances and growth together", hi: "पारिवारिक सुख, धन और संतान वृद्धि" } },
  nadi: { name: { en: "Nadi", hi: "नाड़ी" }, about: { en: "Health and progeny — the heaviest koota (8)", hi: "स्वास्थ्य व संतान — सबसे भारी कूट (8)" } },
};
