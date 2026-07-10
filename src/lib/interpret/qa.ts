// Rule-based Q&A: classify the question's intent, analyse the relevant
// houses/lords/karakas/dashas in the kundli, and compose a scored answer.
// Runs fully offline. Confidence < ESCALATE_THRESHOLD suggests AI help.

import type { Kundli, PlanetId, PlanetPosition } from "@/lib/astro/types";
import {
  SIGN_LORDS,
  PLANET_NAMES,
  NATURAL_BENEFICS,
  NATURAL_MALEFICS,
  ASPECTS,
} from "@/lib/astro/constants";
import { strengthScore } from "@/lib/astro/strength";
import { activeDashas } from "@/lib/astro/dasha";
import { HOUSE_DOMAINS, KARAKAS, ordinal, type Bi } from "./kb/core";
import { DASHA_THEMES } from "./kb/dashaEffects";

export const ESCALATE_THRESHOLD = 55;

export interface QAAnswer {
  intent: string;
  answer: Bi;
  confidence: number; // 0–100
  score: number; // 0–100 favourability of the analysed area
  factors: string[];
}

interface IntentDef {
  houses: number[];
  karakaKey: keyof typeof KARAKAS | null;
  label: Bi;
  keywords: string[];
}

const INTENTS: Record<string, IntentDef> = {
  marriage: {
    houses: [7],
    karakaKey: "marriage",
    label: { en: "marriage & partnership", hi: "विवाह और साझेदारी" },
    keywords: [
      "marriage", "marry", "married", "wedding", "spouse", "husband", "wife", "partner",
      "shaadi", "shadi", "vivah", "जीवनसाथी", "विवाह", "शादी", "पति", "पत्नी",
      "relationship", "love", "divorce", "engagement", "प्रेम", "रिश्ता",
    ],
  },
  career: {
    houses: [10],
    karakaKey: "career",
    label: { en: "career & profession", hi: "करियर और व्यवसाय" },
    keywords: [
      "career", "job", "promotion", "profession", "work", "naukri", "naukari",
      "business", "vyapar", "करियर", "नौकरी", "पदोन्नति", "व्यवसाय", "काम",
      "employment", "office", "boss", "startup", "company",
    ],
  },
  wealth: {
    houses: [2, 11],
    karakaKey: "wealth",
    label: { en: "wealth & income", hi: "धन और आय" },
    keywords: [
      "money", "wealth", "rich", "income", "salary", "finance", "financial",
      "dhan", "paisa", "धन", "पैसा", "आय", "अमीर", "संपत्ति", "loan", "debt",
      "savings", "invest", "investment", "lottery",
    ],
  },
  health: {
    houses: [1, 6, 8],
    karakaKey: "health",
    label: { en: "health & vitality", hi: "स्वास्थ्य" },
    keywords: [
      "health", "disease", "illness", "sick", "swasthya", "bimari",
      "स्वास्थ्य", "बीमारी", "रोग", "surgery", "operation", "fitness", "medical",
    ],
  },
  education: {
    houses: [4, 5],
    karakaKey: "education",
    label: { en: "education & learning", hi: "शिक्षा" },
    keywords: [
      "education", "study", "studies", "exam", "degree", "college", "school",
      "shiksha", "padhai", "शिक्षा", "पढ़ाई", "परीक्षा", "learning", "course",
      "phd", "masters", "competitive",
    ],
  },
  children: {
    houses: [5],
    karakaKey: "children",
    label: { en: "children & progeny", hi: "संतान" },
    keywords: [
      "child", "children", "baby", "son", "daughter", "pregnancy", "santan",
      "संतान", "बच्चा", "बच्चे", "गर्भ", "conceive", "progeny", "kids",
    ],
  },
  foreign: {
    houses: [12, 9, 3],
    karakaKey: "travel",
    label: { en: "foreign travel & settlement", hi: "विदेश यात्रा और प्रवास" },
    keywords: [
      "foreign", "abroad", "travel", "visa", "immigration", "settle", "videsh",
      "विदेश", "यात्रा", "प्रवास", "usa", "canada", "australia", "europe",
      "onsite", "relocation", "migrate",
    ],
  },
  property: {
    houses: [4],
    karakaKey: "property",
    label: { en: "property & vehicles", hi: "संपत्ति और वाहन" },
    keywords: [
      "property", "house", "home", "land", "plot", "flat", "vehicle", "car",
      "makan", "ghar", "जमीन", "घर", "मकान", "संपत्ति", "वाहन", "गाड़ी",
      "real estate", "construction",
    ],
  },
  litigation: {
    houses: [6],
    karakaKey: "litigation",
    label: { en: "disputes & competition", hi: "विवाद और प्रतिस्पर्धा" },
    keywords: [
      "court", "case", "legal", "litigation", "dispute", "enemy", "competition",
      "mukadma", "मुकदमा", "कोर्ट", "शत्रु", "विवाद", "lawsuit", "police",
    ],
  },
  spirituality: {
    houses: [9, 12],
    karakaKey: "spirituality",
    label: { en: "spirituality & dharma", hi: "आध्यात्म और धर्म" },
    keywords: [
      "spiritual", "moksha", "meditation", "god", "temple", "dharma", "puja",
      "आध्यात्म", "मोक्ष", "ध्यान", "भगवान", "मंदिर", "पूजा", "religion",
    ],
  },
  luck: {
    houses: [9],
    karakaKey: null,
    label: { en: "fortune & destiny", hi: "भाग्य" },
    keywords: [
      "luck", "lucky", "fortune", "destiny", "bhagya", "भाग्य", "किस्मत",
      "kismat", "fate",
    ],
  },
};

/** Detect the best-matching intent; null if nothing matches */
export function detectIntent(question: string): string | null {
  const q = question.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const [intent, def] of Object.entries(INTENTS)) {
    let score = 0;
    for (const kw of def.keywords) {
      if (q.includes(kw.toLowerCase())) score += kw.length > 4 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Planets occupying a house (whole-sign from lagna) */
function occupants(kundli: Kundli, house: number): PlanetPosition[] {
  return kundli.planets.filter((p) => p.house === house);
}

/** Planets aspecting a house by graha drishti */
function aspectingPlanets(kundli: Kundli, house: number): PlanetPosition[] {
  return kundli.planets.filter((p) =>
    ASPECTS[p.id].some((a) => ((p.house + a - 1 - 1) % 12) + 1 === house)
  );
}

function lordOfHouse(kundli: Kundli, house: number): PlanetPosition {
  const sign = (kundli.lagna.sign + house - 1) % 12;
  const lordId = SIGN_LORDS[sign];
  return kundli.planets.find((p) => p.id === lordId)!;
}

function planetStrength(p: PlanetPosition): number {
  return strengthScore({
    dignity: p.dignity,
    combust: p.combust,
    retrograde: p.retrograde,
    house: p.house,
    planet: p.id,
  });
}

/** Upcoming antardashas (within `years`) whose lord activates the given houses/karakas */
function favourableWindows(
  kundli: Kundli,
  houses: number[],
  karakas: PlanetId[],
  nowMs: number,
  years = 3
): { lord: PlanetId; start: number; end: number }[] {
  const horizon = nowMs + years * 365.25 * 86400 * 1000;
  const relevant = new Set<PlanetId>(karakas);
  for (const h of houses) {
    relevant.add(lordOfHouse(kundli, h).id);
    for (const occ of occupants(kundli, h)) relevant.add(occ.id);
  }
  const windows: { lord: PlanetId; start: number; end: number }[] = [];
  for (const md of kundli.dasha) {
    if (md.end < nowMs || md.start > horizon || !md.children) continue;
    for (const ad of md.children) {
      if (ad.end < nowMs || ad.start > horizon) continue;
      if (relevant.has(ad.lord)) {
        const p = kundli.planets.find((x) => x.id === ad.lord)!;
        if (planetStrength(p) >= 45) {
          windows.push({ lord: ad.lord, start: ad.start, end: ad.end });
        }
      }
    }
  }
  return windows.slice(0, 3);
}

function fmtMonthYear(ms: number, lang: "en" | "hi"): string {
  return new Date(ms).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
    month: "short",
    year: "numeric",
  });
}

interface AreaAnalysis {
  score: number;
  posEn: string[];
  posHi: string[];
  negEn: string[];
  negHi: string[];
}

/**
 * Analyse an area of life: 0–100 favourability score plus SEPARATE lists of
 * supportive factors and challenges, so answers always show both sides.
 */
function analyseArea(
  kundli: Kundli,
  houses: number[],
  karakas: PlanetId[]
): AreaAnalysis {
  const posEn: string[] = [];
  const posHi: string[] = [];
  const negEn: string[] = [];
  const negHi: string[] = [];
  let total = 0;
  let weight = 0;

  for (const h of houses) {
    const lord = lordOfHouse(kundli, h);
    const ls = planetStrength(lord);
    total += ls * 2;
    weight += 2;
    const lordName = PLANET_NAMES[lord.id];
    if (ls >= 60) {
      posEn.push(
        `The ${ordinal(h)} lord ${lordName.en} is strong (${lord.dignity}) in your ${ordinal(lord.house)} house.`
      );
      posHi.push(
        `${h}वें भाव के स्वामी ${lordName.hi} आपके ${lord.house}वें भाव में बली हैं।`
      );
    } else if (ls <= 45) {
      const flaws = [
        lord.dignity === "debilitated" ? "debilitated" : lord.dignity === "enemy" ? "in an enemy sign" : "weak",
        lord.combust ? "combust" : "",
        [6, 8, 12].includes(lord.house) ? `placed in the difficult ${ordinal(lord.house)} house` : "",
      ].filter(Boolean).join(", ");
      negEn.push(
        `The ${ordinal(h)} lord ${lordName.en} is ${flaws} — results in this area come slower and demand more effort.`
      );
      negHi.push(
        `${h}वें भाव के स्वामी ${lordName.hi} निर्बल${lord.combust ? "/अस्त" : ""} हैं${[6, 8, 12].includes(lord.house) ? ` और कठिन ${lord.house}वें भाव में हैं` : ""} — इस क्षेत्र के फल धीमे और अधिक परिश्रम से मिलेंगे।`
      );
    }

    for (const occ of occupants(kundli, h)) {
      const benefic = NATURAL_BENEFICS.includes(occ.id);
      const s = planetStrength(occ);
      total += benefic ? Math.max(s, 55) : Math.min(s + 10, 55);
      weight += 1;
      const occName = PLANET_NAMES[occ.id];
      if (benefic && s >= 50) {
        posEn.push(`Benefic ${occName.en} occupies the ${ordinal(h)} house and supports it.`);
        posHi.push(`शुभ ग्रह ${occName.hi} ${h}वें भाव में स्थित होकर उसे बल देते हैं।`);
      } else if (!benefic && NATURAL_MALEFICS.includes(occ.id)) {
        negEn.push(`${occName.en} sits in the ${ordinal(h)} house — expect friction, delays or interruptions in this area.`);
        negHi.push(`${h}वें भाव में ${occName.hi} — इस क्षेत्र में टकराव, विलंब या बाधाएँ संभावित हैं।`);
      }
    }

    const aspects = aspectingPlanets(kundli, h);
    const beneficAspects = aspects.filter((p) => NATURAL_BENEFICS.includes(p.id));
    const maleficAspects = aspects.filter((p) =>
      NATURAL_MALEFICS.includes(p.id) && !occupants(kundli, h).some((o) => o.id === p.id)
    );
    if (beneficAspects.length > 0) {
      total += 60;
      weight += 1;
      const names = beneficAspects.map((p) => PLANET_NAMES[p.id].en).join(", ");
      const namesHi = beneficAspects.map((p) => PLANET_NAMES[p.id].hi).join(", ");
      posEn.push(`${names} aspect${beneficAspects.length > 1 ? "" : "s"} the ${ordinal(h)} house — a protective influence.`);
      posHi.push(`${namesHi} की दृष्टि ${h}वें भाव पर है — यह रक्षक प्रभाव है।`);
    }
    if (maleficAspects.length > 0) {
      total += 42;
      weight += 1;
      const names = maleficAspects.map((p) => PLANET_NAMES[p.id].en).join(", ");
      const namesHi = maleficAspects.map((p) => PLANET_NAMES[p.id].hi).join(", ");
      negEn.push(`${names} aspect${maleficAspects.length > 1 ? "" : "s"} the ${ordinal(h)} house, adding stress and obstacles to it.`);
      negHi.push(`${namesHi} की दृष्टि ${h}वें भाव पर है — तनाव और बाधाएँ बढ़ती हैं।`);
    }
  }

  for (const k of karakas) {
    const p = kundli.planets.find((x) => x.id === k)!;
    const s = planetStrength(p);
    total += s;
    weight += 1;
    const name = PLANET_NAMES[k];
    if (s >= 60) {
      posEn.push(`Karaka ${name.en} is well placed (${p.dignity}), a natural support for this area.`);
      posHi.push(`कारक ग्रह ${name.hi} शुभ स्थिति में हैं — इस क्षेत्र के लिए स्वाभाविक सहारा।`);
    } else if (s <= 45) {
      negEn.push(`Karaka ${name.en} is weak (${p.dignity}${p.combust ? ", combust" : ""}) — the natural significator itself gives limited support here.`);
      negHi.push(`कारक ग्रह ${name.hi} निर्बल${p.combust ? "/अस्त" : ""} हैं — स्वाभाविक कारक से ही सीमित सहारा मिलेगा।`);
    }
  }

  const score = weight > 0 ? Math.round(total / weight) : 50;
  return { score, posEn, posHi, negEn, negHi };
}

/** Main entry: answer a free-text question from the kundli */
export function answerQuestion(
  question: string,
  kundli: Kundli,
  nowMs: number = Date.now()
): QAAnswer {
  const intent = detectIntent(question);

  if (!intent) {
    // General reading, low confidence → candidate for AI escalation
    const chain = activeDashas(kundli.dasha, nowMs);
    const md = chain[0];
    const theme = md ? DASHA_THEMES[md.lord] : null;
    const mdName = md ? PLANET_NAMES[md.lord] : null;
    return {
      intent: "general",
      confidence: 35,
      score: 50,
      factors: [],
      answer: {
        en: `I could not map this question to a specific life area, so here is your chart's current context: ${mdName ? `you are in the ${mdName.en} mahadasha — ${theme!.en}.` : ""} Try asking about career, marriage, wealth, health, education, children, property or foreign travel — or use "Ask AI" for a free-form reading.`,
        hi: `यह प्रश्न किसी विशेष जीवन-क्षेत्र से नहीं जुड़ पाया। वर्तमान संदर्भ: ${mdName ? `आप ${mdName.hi} की महादशा में हैं — ${theme!.hi}।` : ""} करियर, विवाह, धन, स्वास्थ्य, शिक्षा, संतान, संपत्ति या विदेश के बारे में पूछें — या विस्तृत उत्तर के लिए "AI से पूछें" दबाएँ।`,
      },
    };
  }

  const def = INTENTS[intent];
  const karakas = def.karakaKey ? KARAKAS[def.karakaKey] : [];
  const { score, posEn, posHi, negEn, negHi } = analyseArea(kundli, def.houses, karakas);

  // Dasha relevance
  const chain = activeDashas(kundli.dasha, nowMs);
  const md = chain[0];
  const ad = chain[1];
  const relevantLords = new Set<PlanetId>([
    ...karakas,
    ...def.houses.map((h) => lordOfHouse(kundli, h).id),
    ...def.houses.flatMap((h) => occupants(kundli, h).map((p) => p.id)),
  ]);
  let dashaBoost = 0;
  let dashaLineEn = "";
  let dashaLineHi = "";
  if (md && relevantLords.has(md.lord)) {
    dashaBoost = 8;
    dashaLineEn = `Importantly, your current ${PLANET_NAMES[md.lord].en} mahadasha directly activates this area right now.`;
    dashaLineHi = `महत्वपूर्ण: वर्तमान ${PLANET_NAMES[md.lord].hi} महादशा इस क्षेत्र को अभी सक्रिय कर रही है।`;
  } else if (ad && relevantLords.has(ad.lord)) {
    dashaBoost = 5;
    dashaLineEn = `Your current ${PLANET_NAMES[ad.lord].en} antardasha activates this area.`;
    dashaLineHi = `वर्तमान ${PLANET_NAMES[ad.lord].hi} अंतर्दशा इस क्षेत्र को सक्रिय करती है।`;
  }

  const windows = favourableWindows(kundli, def.houses, karakas, nowMs);
  let timingEn = "";
  let timingHi = "";
  if (windows.length > 0) {
    const w = windows[0];
    timingEn = `A favourable window runs during the ${PLANET_NAMES[w.lord].en} antardasha (${fmtMonthYear(w.start, "en")} – ${fmtMonthYear(w.end, "en")}).`;
    timingHi = `${PLANET_NAMES[w.lord].hi} की अंतर्दशा (${fmtMonthYear(w.start, "hi")} – ${fmtMonthYear(w.end, "hi")}) में अनुकूल अवसर रहेगा।`;
  }

  const finalScore = Math.min(100, score + dashaBoost);
  const verdictEn =
    finalScore >= 65
      ? `Your chart is strongly supportive for ${def.label.en}.`
      : finalScore >= 50
        ? `Your chart shows moderate, workable support for ${def.label.en} — effort and timing decide the outcome.`
        : `Your chart shows challenges around ${def.label.en}; results come, but later and with persistence.`;
  const verdictHi =
    finalScore >= 65
      ? `आपकी कुंडली ${def.label.hi} के लिए प्रबल रूप से अनुकूल है।`
      : finalScore >= 50
        ? `आपकी कुंडली ${def.label.hi} के लिए मध्यम समर्थन दिखाती है — प्रयास और समय परिणाम तय करेंगे।`
        : `आपकी कुंडली ${def.label.hi} में चुनौतियाँ दिखाती है; फल मिलेंगे, पर विलंब और परिश्रम के साथ।`;

  // Always present BOTH sides — never a one-sided reading
  const topPosEn = posEn.slice(0, 3);
  const topPosHi = posHi.slice(0, 3);
  const topNegEn = negEn.slice(0, 3);
  const topNegHi = negHi.slice(0, 3);

  const posBlockEn = topPosEn.length
    ? `Supportive factors: ${topPosEn.join(" ")}`
    : `Supportive factors: none stand out strongly in this area of your chart.`;
  const posBlockHi = topPosHi.length
    ? `अनुकूल पक्ष: ${topPosHi.join(" ")}`
    : `अनुकूल पक्ष: इस क्षेत्र में कोई विशेष बलवान योग नहीं है।`;
  const negBlockEn = topNegEn.length
    ? `Challenges: ${topNegEn.join(" ")}`
    : `Challenges: no major afflictions in this area — a genuinely clean indication.`;
  const negBlockHi = topNegHi.length
    ? `चुनौतियाँ: ${topNegHi.join(" ")}`
    : `चुनौतियाँ: इस क्षेत्र में कोई बड़ा दोष नहीं — वास्तव में स्वच्छ संकेत।`;

  const answerEn = [verdictEn, posBlockEn, negBlockEn, dashaLineEn, timingEn]
    .filter(Boolean)
    .join("\n\n");
  const answerHi = [verdictHi, posBlockHi, negBlockHi, dashaLineHi, timingHi]
    .filter(Boolean)
    .join("\n\n");

  // Confidence: how much concrete evidence we found + decisiveness
  const evidence = Math.min(20, (topPosEn.length + topNegEn.length + windows.length) * 4);
  const decisiveness = Math.min(15, Math.abs(finalScore - 50));
  const confidence = Math.min(95, 55 + evidence + decisiveness);

  return {
    intent,
    confidence,
    score: finalScore,
    factors: [...topPosEn, ...topNegEn],
    answer: { en: answerEn, hi: answerHi },
  };
}
