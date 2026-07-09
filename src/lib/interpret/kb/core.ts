// Compositional knowledge base: houses, planet natures, sign qualities.
// The reading engine combines these fragments with dignity, aspects and
// dasha context, then overlays curated classical statements (special.ts).

import type { PlanetId } from "@/lib/astro/types";

export interface Bi {
  en: string;
  hi: string;
}

/** What each house governs (index 0 = 1st house) */
export const HOUSE_DOMAINS: Bi[] = [
  { en: "self, body, personality and overall life direction", hi: "स्वयं, शरीर, व्यक्तित्व और जीवन की दिशा" },
  { en: "wealth, savings, family and speech", hi: "धन, संचय, परिवार और वाणी" },
  { en: "courage, siblings, communication and short journeys", hi: "पराक्रम, भाई-बहन, संवाद और छोटी यात्राएँ" },
  { en: "home, mother, property, vehicles and inner peace", hi: "घर, माता, संपत्ति, वाहन और मानसिक शांति" },
  { en: "intelligence, education, children, romance and creativity", hi: "बुद्धि, शिक्षा, संतान, प्रेम और रचनात्मकता" },
  { en: "health, service, debts, competition and daily work", hi: "स्वास्थ्य, सेवा, ऋण, प्रतिस्पर्धा और दैनिक कार्य" },
  { en: "marriage, partnerships and public dealings", hi: "विवाह, साझेदारी और सार्वजनिक व्यवहार" },
  { en: "longevity, transformation, inheritance and hidden matters", hi: "आयु, परिवर्तन, विरासत और गूढ़ विषय" },
  { en: "fortune, dharma, father, higher learning and long journeys", hi: "भाग्य, धर्म, पिता, उच्च शिक्षा और लंबी यात्राएँ" },
  { en: "career, status, authority and public achievement", hi: "करियर, पद, अधिकार और सार्वजनिक उपलब्धि" },
  { en: "gains, income, ambitions and social circle", hi: "लाभ, आय, महत्वाकांक्षा और मित्र मंडली" },
  { en: "expenses, losses, foreign lands, isolation and liberation", hi: "व्यय, हानि, विदेश, एकांत और मोक्ष" },
];

/** How each planet expresses itself */
export const PLANET_NATURE: Record<PlanetId, Bi> = {
  Sun: { en: "authority, vitality, leadership and self-esteem", hi: "अधिकार, ऊर्जा, नेतृत्व और आत्म-सम्मान" },
  Moon: { en: "emotions, intuition, nurturing and adaptability", hi: "भावनाएँ, अंतर्ज्ञान, पोषण और अनुकूलनशीलता" },
  Mars: { en: "drive, courage, competitiveness and raw energy", hi: "साहस, ऊर्जा, प्रतिस्पर्धा और पराक्रम" },
  Mercury: { en: "intellect, analysis, communication and commerce", hi: "बुद्धि, विश्लेषण, संवाद और व्यापार" },
  Jupiter: { en: "wisdom, expansion, optimism and blessings", hi: "ज्ञान, विस्तार, आशावाद और आशीर्वाद" },
  Venus: { en: "love, beauty, comfort, art and refinement", hi: "प्रेम, सौंदर्य, सुख, कला और परिष्कार" },
  Saturn: { en: "discipline, patience, delay and hard-earned results", hi: "अनुशासन, धैर्य, विलंब और परिश्रम से मिले फल" },
  Rahu: { en: "obsession, unconventional ambition and worldly desire", hi: "तीव्र इच्छा, अपरंपरागत महत्वाकांक्षा और सांसारिक कामना" },
  Ketu: { en: "detachment, spirituality, past-life mastery and sudden separation", hi: "वैराग्य, आध्यात्म, पूर्वजन्म की सिद्धि और आकस्मिक वियोग" },
};

/** Karaka (significator) roles used by the Q&A engine */
export const KARAKAS: Record<string, PlanetId[]> = {
  career: ["Saturn", "Sun", "Mercury"],
  marriage: ["Venus", "Jupiter"],
  wealth: ["Jupiter", "Venus"],
  health: ["Sun", "Moon"],
  education: ["Mercury", "Jupiter"],
  children: ["Jupiter"],
  travel: ["Rahu", "Moon"],
  property: ["Mars", "Moon"],
  spirituality: ["Ketu", "Jupiter"],
  litigation: ["Mars", "Saturn"],
};

/** Dignity → tone modifier for generated readings */
export const DIGNITY_TONE: Record<string, Bi> = {
  exalted: {
    en: "Being exalted here, it gives its best results with confidence and ease.",
    hi: "उच्च राशि में होने से यह अपने श्रेष्ठ फल सहजता से देता है।",
  },
  moolatrikona: {
    en: "In its moolatrikona sign, it functions with great strength.",
    hi: "मूलत्रिकोण राशि में होने से यह प्रबल रूप से कार्य करता है।",
  },
  own: {
    en: "In its own sign, it is comfortable and delivers steady, reliable results.",
    hi: "स्वराशि में होने से यह स्थिर और विश्वसनीय फल देता है।",
  },
  friend: {
    en: "Placed in a friendly sign, results are largely supportive.",
    hi: "मित्र राशि में होने से फल प्रायः अनुकूल रहते हैं।",
  },
  neutral: {
    en: "In a neutral sign, results are mixed and shaped by aspects and dasha.",
    hi: "सम राशि में फल मिश्रित रहते हैं और दृष्टि व दशा पर निर्भर करते हैं।",
  },
  enemy: {
    en: "In an unfriendly sign, its results come with friction and require extra effort.",
    hi: "शत्रु राशि में इसके फल संघर्ष के साथ आते हैं और अधिक प्रयास माँगते हैं।",
  },
  debilitated: {
    en: "Being debilitated, its significations need conscious strengthening; results improve with maturity and remedies.",
    hi: "नीच राशि में होने से इसके कारकत्व कमजोर होते हैं; समय, परिपक्वता और उपायों से फल सुधरते हैं।",
  },
};

export const COMBUST_NOTE: Bi = {
  en: "Being combust (too close to the Sun), its outward expression is weakened.",
  hi: "अस्त होने के कारण इसका बाहरी प्रभाव कुछ क्षीण रहता है।",
};

export const RETRO_NOTE: Bi = {
  en: "Its retrograde motion internalizes and intensifies these themes.",
  hi: "वक्री गति इन विषयों को और गहरा व आंतरिक बना देती है।",
};

/** Ordinal helper for English house names */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
