import type { PlanetId } from "./types";

/** The nine grahas in traditional order */
export const PLANETS: PlanetId[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
];

/** The seven physical planets (used by ashtakavarga, combustion, etc.) */
export const SAPTA_GRAHAS: PlanetId[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
];

export interface TriName {
  en: string;
  hi: string;
  sa: string; // transliterated Sanskrit
}

export const SIGN_NAMES: TriName[] = [
  { en: "Aries", hi: "मेष", sa: "Mesha" },
  { en: "Taurus", hi: "वृषभ", sa: "Vrishabha" },
  { en: "Gemini", hi: "मिथुन", sa: "Mithuna" },
  { en: "Cancer", hi: "कर्क", sa: "Karka" },
  { en: "Leo", hi: "सिंह", sa: "Simha" },
  { en: "Virgo", hi: "कन्या", sa: "Kanya" },
  { en: "Libra", hi: "तुला", sa: "Tula" },
  { en: "Scorpio", hi: "वृश्चिक", sa: "Vrishchika" },
  { en: "Sagittarius", hi: "धनु", sa: "Dhanu" },
  { en: "Capricorn", hi: "मकर", sa: "Makara" },
  { en: "Aquarius", hi: "कुंभ", sa: "Kumbha" },
  { en: "Pisces", hi: "मीन", sa: "Meena" },
];

export const PLANET_NAMES: Record<PlanetId, TriName> = {
  Sun: { en: "Sun", hi: "सूर्य", sa: "Surya" },
  Moon: { en: "Moon", hi: "चंद्र", sa: "Chandra" },
  Mars: { en: "Mars", hi: "मंगल", sa: "Mangal" },
  Mercury: { en: "Mercury", hi: "बुध", sa: "Budha" },
  Jupiter: { en: "Jupiter", hi: "गुरु", sa: "Guru" },
  Venus: { en: "Venus", hi: "शुक्र", sa: "Shukra" },
  Saturn: { en: "Saturn", hi: "शनि", sa: "Shani" },
  Rahu: { en: "Rahu", hi: "राहु", sa: "Rahu" },
  Ketu: { en: "Ketu", hi: "केतु", sa: "Ketu" },
};

export const NAKSHATRA_NAMES: TriName[] = [
  { en: "Ashwini", hi: "अश्विनी", sa: "Ashwini" },
  { en: "Bharani", hi: "भरणी", sa: "Bharani" },
  { en: "Krittika", hi: "कृत्तिका", sa: "Krittika" },
  { en: "Rohini", hi: "रोहिणी", sa: "Rohini" },
  { en: "Mrigashira", hi: "मृगशिरा", sa: "Mrigashira" },
  { en: "Ardra", hi: "आर्द्रा", sa: "Ardra" },
  { en: "Punarvasu", hi: "पुनर्वसु", sa: "Punarvasu" },
  { en: "Pushya", hi: "पुष्य", sa: "Pushya" },
  { en: "Ashlesha", hi: "आश्लेषा", sa: "Ashlesha" },
  { en: "Magha", hi: "मघा", sa: "Magha" },
  { en: "Purva Phalguni", hi: "पूर्व फाल्गुनी", sa: "Purva Phalguni" },
  { en: "Uttara Phalguni", hi: "उत्तर फाल्गुनी", sa: "Uttara Phalguni" },
  { en: "Hasta", hi: "हस्त", sa: "Hasta" },
  { en: "Chitra", hi: "चित्रा", sa: "Chitra" },
  { en: "Swati", hi: "स्वाति", sa: "Swati" },
  { en: "Vishakha", hi: "विशाखा", sa: "Vishakha" },
  { en: "Anuradha", hi: "अनुराधा", sa: "Anuradha" },
  { en: "Jyeshtha", hi: "ज्येष्ठा", sa: "Jyeshtha" },
  { en: "Mula", hi: "मूल", sa: "Mula" },
  { en: "Purva Ashadha", hi: "पूर्वाषाढ़ा", sa: "Purva Ashadha" },
  { en: "Uttara Ashadha", hi: "उत्तराषाढ़ा", sa: "Uttara Ashadha" },
  { en: "Shravana", hi: "श्रवण", sa: "Shravana" },
  { en: "Dhanishta", hi: "धनिष्ठा", sa: "Dhanishta" },
  { en: "Shatabhisha", hi: "शतभिषा", sa: "Shatabhisha" },
  { en: "Purva Bhadrapada", hi: "पूर्व भाद्रपद", sa: "Purva Bhadrapada" },
  { en: "Uttara Bhadrapada", hi: "उत्तर भाद्रपद", sa: "Uttara Bhadrapada" },
  { en: "Revati", hi: "रेवती", sa: "Revati" },
];

/** Nakshatra lords repeat this 9-planet cycle three times from Ashwini */
export const NAKSHATRA_LORD_CYCLE: PlanetId[] = [
  "Ketu",
  "Venus",
  "Sun",
  "Moon",
  "Mars",
  "Rahu",
  "Jupiter",
  "Saturn",
  "Mercury",
];

export const TITHI_NAMES: TriName[] = [
  { en: "Pratipada", hi: "प्रतिपदा", sa: "Pratipada" },
  { en: "Dwitiya", hi: "द्वितीया", sa: "Dwitiya" },
  { en: "Tritiya", hi: "तृतीया", sa: "Tritiya" },
  { en: "Chaturthi", hi: "चतुर्थी", sa: "Chaturthi" },
  { en: "Panchami", hi: "पंचमी", sa: "Panchami" },
  { en: "Shashthi", hi: "षष्ठी", sa: "Shashthi" },
  { en: "Saptami", hi: "सप्तमी", sa: "Saptami" },
  { en: "Ashtami", hi: "अष्टमी", sa: "Ashtami" },
  { en: "Navami", hi: "नवमी", sa: "Navami" },
  { en: "Dashami", hi: "दशमी", sa: "Dashami" },
  { en: "Ekadashi", hi: "एकादशी", sa: "Ekadashi" },
  { en: "Dwadashi", hi: "द्वादशी", sa: "Dwadashi" },
  { en: "Trayodashi", hi: "त्रयोदशी", sa: "Trayodashi" },
  { en: "Chaturdashi", hi: "चतुर्दशी", sa: "Chaturdashi" },
  { en: "Purnima", hi: "पूर्णिमा", sa: "Purnima" },
  { en: "Amavasya", hi: "अमावस्या", sa: "Amavasya" },
];

export const YOGA_NAMES: string[] = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda",
  "Sukarma", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata",
  "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva",
  "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti",
];

export const KARANA_MOVABLE: string[] = [
  "Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti",
];
export const KARANA_FIXED = { first: "Kimstughna", others: ["Shakuni", "Chatushpada", "Naga"] };

export const VARA_NAMES: TriName[] = [
  { en: "Sunday", hi: "रविवार", sa: "Ravivara" },
  { en: "Monday", hi: "सोमवार", sa: "Somavara" },
  { en: "Tuesday", hi: "मंगलवार", sa: "Mangalavara" },
  { en: "Wednesday", hi: "बुधवार", sa: "Budhavara" },
  { en: "Thursday", hi: "गुरुवार", sa: "Guruvara" },
  { en: "Friday", hi: "शुक्रवार", sa: "Shukravara" },
  { en: "Saturday", hi: "शनिवार", sa: "Shanivara" },
];

/** Sign lords: index = sign (0 = Aries) */
export const SIGN_LORDS: PlanetId[] = [
  "Mars",    // Aries
  "Venus",   // Taurus
  "Mercury", // Gemini
  "Moon",    // Cancer
  "Sun",     // Leo
  "Mercury", // Virgo
  "Venus",   // Libra
  "Mars",    // Scorpio
  "Jupiter", // Sagittarius
  "Saturn",  // Capricorn
  "Saturn",  // Aquarius
  "Jupiter", // Pisces
];

/** Exaltation: sign + exact degree of deepest exaltation. Debilitation is the 7th sign from it. */
export const EXALTATION: Partial<Record<PlanetId, { sign: number; deg: number }>> = {
  Sun: { sign: 0, deg: 10 },      // Aries 10°
  Moon: { sign: 1, deg: 3 },      // Taurus 3°
  Mars: { sign: 9, deg: 28 },     // Capricorn 28°
  Mercury: { sign: 5, deg: 15 },  // Virgo 15°
  Jupiter: { sign: 3, deg: 5 },   // Cancer 5°
  Venus: { sign: 11, deg: 27 },   // Pisces 27°
  Saturn: { sign: 6, deg: 20 },   // Libra 20°
  Rahu: { sign: 1, deg: 20 },     // Taurus (traditional)
  Ketu: { sign: 7, deg: 20 },     // Scorpio (traditional)
};

/** Moolatrikona ranges: sign + [fromDeg, toDeg] */
export const MOOLATRIKONA: Partial<Record<PlanetId, { sign: number; from: number; to: number }>> = {
  Sun: { sign: 4, from: 0, to: 20 },
  Moon: { sign: 1, from: 4, to: 30 },
  Mars: { sign: 0, from: 0, to: 12 },
  Mercury: { sign: 5, from: 16, to: 20 },
  Jupiter: { sign: 8, from: 0, to: 10 },
  Venus: { sign: 6, from: 0, to: 15 },
  Saturn: { sign: 10, from: 0, to: 20 },
};

/** Own signs per planet */
export const OWN_SIGNS: Record<PlanetId, number[]> = {
  Sun: [4],
  Moon: [3],
  Mars: [0, 7],
  Mercury: [2, 5],
  Jupiter: [8, 11],
  Venus: [1, 6],
  Saturn: [9, 10],
  Rahu: [],
  Ketu: [],
};

/** Naisargika (natural) friendship table */
export const FRIENDS: Record<PlanetId, PlanetId[]> = {
  Sun: ["Moon", "Mars", "Jupiter"],
  Moon: ["Sun", "Mercury"],
  Mars: ["Sun", "Moon", "Jupiter"],
  Mercury: ["Sun", "Venus"],
  Jupiter: ["Sun", "Moon", "Mars"],
  Venus: ["Mercury", "Saturn"],
  Saturn: ["Mercury", "Venus"],
  Rahu: ["Mercury", "Venus", "Saturn"],
  Ketu: ["Mars", "Venus", "Saturn"],
};

export const ENEMIES: Record<PlanetId, PlanetId[]> = {
  Sun: ["Venus", "Saturn"],
  Moon: [],
  Mars: ["Mercury"],
  Mercury: ["Moon"],
  Jupiter: ["Mercury", "Venus"],
  Venus: ["Sun", "Moon"],
  Saturn: ["Sun", "Moon", "Mars"],
  Rahu: ["Sun", "Moon", "Mars"],
  Ketu: ["Sun", "Moon"],
};

/**
 * Vedic special aspects (graha drishti) — houses aspected counting from the
 * planet's own position (7th is common to all).
 */
export const ASPECTS: Record<PlanetId, number[]> = {
  Sun: [7],
  Moon: [7],
  Mars: [4, 7, 8],
  Mercury: [7],
  Jupiter: [5, 7, 9],
  Venus: [7],
  Saturn: [3, 7, 10],
  Rahu: [5, 7, 9],
  Ketu: [5, 7, 9],
};

/** Combustion orbs in degrees from the Sun (direct motion) */
export const COMBUSTION_ORB: Partial<Record<PlanetId, number>> = {
  Moon: 12,
  Mars: 17,
  Mercury: 14,
  Jupiter: 11,
  Venus: 10,
  Saturn: 15,
};

/** Vimshottari dasha years per lord (total 120) */
export const DASHA_YEARS: Record<PlanetId, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

/** Vimshottari lord order starting from Ketu (Ashwini's lord) */
export const DASHA_ORDER: PlanetId[] = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
];

/** Natural benefics/malefics (Moon & Mercury treated contextually elsewhere) */
export const NATURAL_BENEFICS: PlanetId[] = ["Jupiter", "Venus", "Moon", "Mercury"];
export const NATURAL_MALEFICS: PlanetId[] = ["Saturn", "Mars", "Sun", "Rahu", "Ketu"];

/** Days per Vimshottari year (solar year convention used by most software) */
export const DASHA_YEAR_DAYS = 365.25;

export const DEG = Math.PI / 180;

/** Normalize an angle to [0, 360) */
export function norm360(x: number): number {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
}

/** Signed shortest angular difference a - b in (-180, 180] */
export function angleDiff(a: number, b: number): number {
  let d = norm360(a - b);
  if (d > 180) d -= 360;
  return d;
}
