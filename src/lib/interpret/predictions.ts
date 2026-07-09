// Weekly / monthly / yearly predictions — composed from the active dashas,
// current & upcoming gochar, chandra bala, sade sati, ashtakavarga bindus
// and the numerology personal year. Fully offline.

import type { Kundli, PlanetId } from "@/lib/astro/types";
import { PLANET_NAMES, SIGN_NAMES } from "@/lib/astro/constants";
import { activeDashas } from "@/lib/astro/dasha";
import {
  currentPositions,
  findTransitEvents,
  moonTransitSigns,
  houseFromMoon,
  sadeSatiPhase,
  FAVOURABLE_FROM_MOON,
  type SadeSatiPhase,
} from "@/lib/astro/transits";
import { HOUSE_DOMAINS, type Bi } from "./kb/core";
import { DASHA_THEMES, TRANSIT_TONE } from "./kb/dashaEffects";

const DAY_MS = 86400 * 1000;

export interface PredictionSection {
  title: Bi;
  body: Bi;
  tone: "good" | "mixed" | "caution";
}

export interface Prediction {
  period: "weekly" | "monthly" | "yearly";
  rangeStart: number;
  rangeEnd: number;
  summary: Bi;
  sections: PredictionSection[];
  /** area scores 0–100 */
  areas: { career: number; wealth: number; health: number; relationships: number };
  favourableDays?: string[];
  cautionDays?: string[];
  sadeSati: SadeSatiPhase;
}

function natalMoonSign(kundli: Kundli): number {
  return kundli.planets.find((p) => p.id === "Moon")!.sign;
}

/** Tone of a planet's current transit for this person (house from natal Moon) */
function transitTone(
  planet: PlanetId,
  transitSign: number,
  moonSign: number
): "good" | "bad" {
  const h = houseFromMoon(moonSign, transitSign);
  return FAVOURABLE_FROM_MOON[planet].includes(h) ? "good" : "bad";
}

/** Area scores from slow transits + dasha lord nature */
function computeAreas(kundli: Kundli, nowMs: number) {
  const moonSign = natalMoonSign(kundli);
  const pos = currentPositions(nowMs);
  const get = (id: PlanetId) => pos.find((p) => p.id === id)!;

  const jupGood = transitTone("Jupiter", get("Jupiter").sign, moonSign);
  const satGood = transitTone("Saturn", get("Saturn").sign, moonSign);
  const venGood = transitTone("Venus", get("Venus").sign, moonSign);
  const merGood = transitTone("Mercury", get("Mercury").sign, moonSign);
  const sunGood = transitTone("Sun", get("Sun").sign, moonSign);
  const marGood = transitTone("Mars", get("Mars").sign, moonSign);

  const sav = kundli.ashtakavarga.sav;
  const savJup = sav[get("Jupiter").sign] >= 28 ? 5 : -3;
  const savSat = sav[get("Saturn").sign] >= 28 ? 5 : -3;

  const base = (good: boolean) => (good ? 65 : 42);
  return {
    career: Math.round(
      (base(satGood === "good") + base(sunGood === "good") + base(merGood === "good")) / 3 + savSat
    ),
    wealth: Math.round(
      (base(jupGood === "good") + base(venGood === "good") + base(merGood === "good")) / 3 + savJup
    ),
    health: Math.round(
      (base(sunGood === "good") + base(marGood === "good") + base(satGood === "good")) / 3
    ),
    relationships: Math.round(
      (base(venGood === "good") + base(jupGood === "good") + base(get("Moon") ? transitTone("Moon", get("Moon").sign, moonSign) === "good" : true)) / 3
    ),
  };
}

function dashaSection(kundli: Kundli, nowMs: number): PredictionSection {
  const chain = activeDashas(kundli.dasha, nowMs);
  const md = chain[0];
  const ad = chain[1];
  if (!md) {
    return {
      title: { en: "Dasha", hi: "दशा" },
      body: { en: "", hi: "" },
      tone: "mixed",
    };
  }
  const mdN = PLANET_NAMES[md.lord];
  const adPart = ad
    ? {
        en: ` Within it, the ${PLANET_NAMES[ad.lord].en} antardasha (until ${new Date(ad.end).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}) colours day-to-day events: ${DASHA_THEMES[ad.lord].en}.`,
        hi: ` इसके भीतर ${PLANET_NAMES[ad.lord].hi} की अंतर्दशा दैनिक घटनाओं को रंग देती है: ${DASHA_THEMES[ad.lord].hi}।`,
      }
    : { en: "", hi: "" };
  return {
    title: { en: "Running Dasha", hi: "वर्तमान दशा" },
    body: {
      en: `${mdN.en} mahadasha continues — ${DASHA_THEMES[md.lord].en}.${adPart.en}`,
      hi: `${mdN.hi} महादशा चल रही है — ${DASHA_THEMES[md.lord].hi}।${adPart.hi}`,
    },
    tone: "mixed",
  };
}

function sadeSatiSection(phase: SadeSatiPhase): PredictionSection | null {
  if (phase === "none") return null;
  const bodies: Record<Exclude<SadeSatiPhase, "none">, Bi> = {
    rising: {
      en: "Sade Sati's first phase is running (Saturn in the 12th from your Moon): expenses and background stress rise — simplify commitments and protect sleep.",
      hi: "साढ़े साती का प्रथम चरण चल रहा है (चंद्र से 12वें में शनि): खर्च और मानसिक बोझ बढ़ता है — दायित्व सरल रखें और नींद की रक्षा करें।",
    },
    peak: {
      en: "Sade Sati's peak phase is running (Saturn over your natal Moon): the most testing but most transformative period — health, mind and key relationships need patient, disciplined care. Saturday discipline and service are classic remedies.",
      hi: "साढ़े साती का शिखर चरण चल रहा है (जन्म चंद्र पर शनि): सबसे कठिन किंतु सबसे रूपांतरकारी समय — स्वास्थ्य, मन और प्रमुख संबंधों को धैर्यपूर्ण देखभाल चाहिए। शनिवार का अनुशासन और सेवा श्रेष्ठ उपाय हैं।",
    },
    setting: {
      en: "Sade Sati's final phase is running (Saturn in the 2nd from your Moon): finances and family matters carry residual weight, but relief is approaching as lessons consolidate.",
      hi: "साढ़े साती का अंतिम चरण चल रहा है (चंद्र से 2रे में शनि): धन और परिवार पर शेष भार है, पर राहत निकट है।",
    },
  };
  return {
    title: { en: "Sade Sati", hi: "साढ़े साती" },
    body: bodies[phase],
    tone: phase === "peak" ? "caution" : "mixed",
  };
}

function slowTransitSections(kundli: Kundli, nowMs: number): PredictionSection[] {
  const moonSign = natalMoonSign(kundli);
  const pos = currentPositions(nowMs);
  const out: PredictionSection[] = [];
  for (const id of ["Jupiter", "Saturn", "Rahu"] as PlanetId[]) {
    const p = pos.find((x) => x.id === id)!;
    const h = houseFromMoon(moonSign, p.sign);
    const good = FAVOURABLE_FROM_MOON[id].includes(h);
    const tone = TRANSIT_TONE[id][good ? "good" : "bad"];
    const name = PLANET_NAMES[id];
    out.push({
      title: {
        en: `${name.en} transit`,
        hi: `${name.hi} गोचर`,
      },
      body: {
        en: `${name.en} is transiting ${SIGN_NAMES[p.sign].en}, the ${h}${h === 1 ? "st" : h === 2 ? "nd" : h === 3 ? "rd" : "th"} from your Moon — ${tone.en}. This influences ${HOUSE_DOMAINS[h - 1].en}.`,
        hi: `${name.hi} ${SIGN_NAMES[p.sign].hi} राशि में, आपके चंद्रमा से ${h}वें भाव में गोचर कर रहे हैं — ${tone.hi}। इसका प्रभाव ${HOUSE_DOMAINS[h - 1].hi} पर रहेगा।`,
      },
      tone: good ? "good" : "caution",
    });
  }
  return out;
}

const WEEKDAY: Record<"en" | "hi", string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  hi: ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"],
};

export function weeklyPrediction(kundli: Kundli, nowMs = Date.now()): Prediction {
  const moonSign = natalMoonSign(kundli);
  const end = nowMs + 7 * DAY_MS;
  const segments = moonTransitSigns(nowMs, 7);

  const favourableDays: string[] = [];
  const cautionDays: string[] = [];
  const seen = new Set<string>();
  for (const seg of segments) {
    const h = houseFromMoon(moonSign, seg.sign);
    const good = FAVOURABLE_FROM_MOON.Moon.includes(h);
    // walk each calendar day the segment covers
    for (let t = seg.startMs; t < seg.endMs; t += DAY_MS) {
      const d = new Date(t);
      const key = d.toDateString();
      if (seen.has(key)) continue;
      seen.add(key);
      const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      (good ? favourableDays : cautionDays).push(label);
    }
  }

  const areas = computeAreas(kundli, nowMs);
  const sections: PredictionSection[] = [
    dashaSection(kundli, nowMs),
    ...slowTransitSections(kundli, nowMs),
  ];
  const pos = currentPositions(nowMs);
  const sat = pos.find((p) => p.id === "Saturn")!;
  const phase = sadeSatiPhase(sat.sign, moonSign);
  const ss = sadeSatiSection(phase);
  if (ss) sections.push(ss);

  const avg = Math.round((areas.career + areas.wealth + areas.health + areas.relationships) / 4);
  return {
    period: "weekly",
    rangeStart: nowMs,
    rangeEnd: end,
    summary: {
      en:
        avg >= 58
          ? "A supportive week overall — the Moon's path favours action on several days. Use the favourable days for important starts."
          : avg >= 48
            ? "A mixed week — progress comes in patches. Time key conversations and decisions to the favourable days."
            : "A demanding week — move steadily, avoid launching new ventures on caution days, and protect your energy.",
      hi:
        avg >= 58
          ? "कुल मिलाकर अनुकूल सप्ताह — कई दिनों में चंद्र-बल आपके साथ है। महत्वपूर्ण शुरुआत शुभ दिनों में करें।"
          : avg >= 48
            ? "मिश्रित सप्ताह — प्रगति टुकड़ों में मिलेगी। मुख्य निर्णय शुभ दिनों में करें।"
            : "चुनौतीपूर्ण सप्ताह — धीरे चलें, सावधानी वाले दिनों में नए कार्य न आरंभ करें, ऊर्जा बचाएँ।",
    },
    sections,
    areas,
    favourableDays: favourableDays.slice(0, 5),
    cautionDays: cautionDays.slice(0, 4),
    sadeSati: phase,
  };
}

export function monthlyPrediction(kundli: Kundli, nowMs = Date.now()): Prediction {
  const moonSign = natalMoonSign(kundli);
  const end = nowMs + 30 * DAY_MS;
  const areas = computeAreas(kundli, nowMs);

  const sections: PredictionSection[] = [
    dashaSection(kundli, nowMs),
    ...slowTransitSections(kundli, nowMs),
  ];

  // Ingress / station events this month, personalised
  const events = findTransitEvents(nowMs, end).slice(0, 6);
  for (const ev of events) {
    const name = PLANET_NAMES[ev.planet];
    const dateStr = new Date(ev.timeMs).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const dateStrHi = new Date(ev.timeMs).toLocaleDateString("hi-IN", { day: "numeric", month: "short" });
    if (ev.type === "ingress" && ev.toSign !== undefined) {
      const h = houseFromMoon(moonSign, ev.toSign);
      const good = FAVOURABLE_FROM_MOON[ev.planet].includes(h);
      const tone = TRANSIT_TONE[ev.planet][good ? "good" : "bad"];
      sections.push({
        title: {
          en: `${name.en} enters ${SIGN_NAMES[ev.toSign].en} (${dateStr})`,
          hi: `${name.hi} का ${SIGN_NAMES[ev.toSign].hi} में प्रवेश (${dateStrHi})`,
        },
        body: {
          en: `From ${dateStr}, ${name.en} moves to your ${h}th from Moon — ${tone.en}.`,
          hi: `${dateStrHi} से ${name.hi} आपके चंद्र से ${h}वें भाव में — ${tone.hi}।`,
        },
        tone: good ? "good" : "caution",
      });
    } else if (ev.type !== "ingress") {
      const retro = ev.type === "retrograde";
      sections.push({
        title: {
          en: `${name.en} turns ${retro ? "retrograde" : "direct"} (${dateStr})`,
          hi: `${name.hi} ${retro ? "वक्री" : "मार्गी"} (${dateStrHi})`,
        },
        body: {
          en: retro
            ? `Review and redo themes connected with ${name.en}; avoid brand-new commitments in its sphere for a while.`
            : `${name.en}'s forward motion releases stalled matters connected with it.`,
          hi: retro
            ? `${name.hi} से जुड़े विषयों की समीक्षा करें; कुछ समय इसके क्षेत्र में नई प्रतिबद्धता से बचें।`
            : `${name.hi} के मार्गी होने से रुके कार्य गति पकड़ेंगे।`,
        },
        tone: retro ? "caution" : "good",
      });
    }
  }

  const pos = currentPositions(nowMs);
  const sat = pos.find((p) => p.id === "Saturn")!;
  const phase = sadeSatiPhase(sat.sign, moonSign);
  const ss = sadeSatiSection(phase);
  if (ss) sections.push(ss);

  const avg = Math.round((areas.career + areas.wealth + areas.health + areas.relationships) / 4);
  return {
    period: "monthly",
    rangeStart: nowMs,
    rangeEnd: end,
    summary: {
      en:
        avg >= 58
          ? "A constructive month — transits back your efforts, especially in the stronger areas below. Push important work forward."
          : avg >= 48
            ? "A month of steady, uneven progress — match your effort to the planetary weather below and it will compound."
            : "A month that rewards caution — consolidate rather than expand, and let the harder transits pass before big moves.",
      hi:
        avg >= 58
          ? "रचनात्मक माह — गोचर आपके प्रयासों का साथ देंगे, विशेषकर नीचे दिए मजबूत क्षेत्रों में। महत्वपूर्ण कार्य आगे बढ़ाएँ।"
          : avg >= 48
            ? "स्थिर किंतु असमान प्रगति का माह — नीचे दिए ग्रह-मौसम के अनुसार प्रयास करें, लाभ बढ़ेगा।"
            : "संयम का माह — विस्तार के बजाय समेकन करें, कठिन गोचर बीतने दें।",
    },
    sections,
    areas,
    sadeSati: phase,
  };
}

export function yearlyPrediction(kundli: Kundli, nowMs = Date.now()): Prediction {
  const moonSign = natalMoonSign(kundli);
  const end = nowMs + 365 * DAY_MS;
  const areas = computeAreas(kundli, nowMs);
  const sections: PredictionSection[] = [dashaSection(kundli, nowMs)];

  // Dasha changes within the year
  const chainNow = activeDashas(kundli.dasha, nowMs);
  const mdNow = chainNow[0];
  if (mdNow && mdNow.end < end) {
    const nextIdx = kundli.dasha.findIndex((d) => d.start === mdNow.end);
    if (nextIdx >= 0) {
      const next = kundli.dasha[nextIdx];
      const dateStr = new Date(mdNow.end).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      const dateStrHi = new Date(mdNow.end).toLocaleDateString("hi-IN", { month: "long", year: "numeric" });
      sections.push({
        title: {
          en: `Mahadasha change: ${PLANET_NAMES[next.lord].en} begins (${dateStr})`,
          hi: `महादशा परिवर्तन: ${PLANET_NAMES[next.lord].hi} आरंभ (${dateStrHi})`,
        },
        body: {
          en: `A major life-chapter shift — ${DASHA_THEMES[next.lord].en}. The first year of a mahadasha sets its tone; begin it consciously.`,
          hi: `जीवन-अध्याय का बड़ा परिवर्तन — ${DASHA_THEMES[next.lord].hi}। महादशा का पहला वर्ष उसकी दिशा तय करता है; इसे सजगता से आरंभ करें।`,
        },
        tone: "mixed",
      });
    }
  }

  sections.push(...slowTransitSections(kundli, nowMs));

  // Major ingresses this year (Jupiter/Saturn/Rahu only)
  const events = findTransitEvents(nowMs, end).filter((e) =>
    ["Jupiter", "Saturn", "Rahu", "Ketu"].includes(e.planet) && e.type === "ingress"
  );
  for (const ev of events.slice(0, 4)) {
    if (ev.toSign === undefined) continue;
    const name = PLANET_NAMES[ev.planet];
    const h = houseFromMoon(moonSign, ev.toSign);
    const good = FAVOURABLE_FROM_MOON[ev.planet].includes(h);
    const tone = TRANSIT_TONE[ev.planet][good ? "good" : "bad"];
    const dateStr = new Date(ev.timeMs).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const dateStrHi = new Date(ev.timeMs).toLocaleDateString("hi-IN", { month: "long", year: "numeric" });
    sections.push({
      title: {
        en: `${name.en} enters ${SIGN_NAMES[ev.toSign].en} — ${dateStr}`,
        hi: `${name.hi} का ${SIGN_NAMES[ev.toSign].hi} में प्रवेश — ${dateStrHi}`,
      },
      body: {
        en: `${name.en} will transit your ${h}th from Moon, influencing ${HOUSE_DOMAINS[h - 1].en} — ${tone.en}.`,
        hi: `${name.hi} आपके चंद्र से ${h}वें भाव में गोचर करेंगे, प्रभाव ${HOUSE_DOMAINS[h - 1].hi} पर — ${tone.hi}।`,
      },
      tone: good ? "good" : "caution",
    });
  }

  const pos = currentPositions(nowMs);
  const sat = pos.find((p) => p.id === "Saturn")!;
  const phase = sadeSatiPhase(sat.sign, moonSign);
  const ss = sadeSatiSection(phase);
  if (ss) sections.push(ss);

  // Numerology personal year
  const py = kundli.numerology.personalYear;
  const pyThemes: Record<number, Bi> = {
    1: { en: "a year of new beginnings — plant seeds boldly", hi: "नई शुरुआत का वर्ष — साहस से बीज बोएँ" },
    2: { en: "a year of partnerships and patience", hi: "साझेदारी और धैर्य का वर्ष" },
    3: { en: "a year of expression, creativity and visibility", hi: "अभिव्यक्ति, सृजन और पहचान का वर्ष" },
    4: { en: "a year of foundations and disciplined work", hi: "नींव और अनुशासित परिश्रम का वर्ष" },
    5: { en: "a year of change, travel and freedom", hi: "परिवर्तन, यात्रा और स्वतंत्रता का वर्ष" },
    6: { en: "a year of family, love and responsibility", hi: "परिवार, प्रेम और उत्तरदायित्व का वर्ष" },
    7: { en: "a year of introspection and learning", hi: "आत्मचिंतन और अध्ययन का वर्ष" },
    8: { en: "a year of power, karma and material results", hi: "शक्ति, कर्म और भौतिक फल का वर्ष" },
    9: { en: "a year of completion and release", hi: "पूर्णता और मुक्ति का वर्ष" },
  };
  sections.push({
    title: { en: `Personal Year ${py}`, hi: `व्यक्तिगत वर्ष ${py}` },
    body: {
      en: `Numerologically this is ${pyThemes[py]?.en ?? "a transition year"} for you.`,
      hi: `अंक ज्योतिष के अनुसार यह आपके लिए ${pyThemes[py]?.hi ?? "संक्रमण वर्ष"} है।`,
    },
    tone: "mixed",
  });

  const avg = Math.round((areas.career + areas.wealth + areas.health + areas.relationships) / 4);
  return {
    period: "yearly",
    rangeStart: nowMs,
    rangeEnd: end,
    summary: {
      en:
        avg >= 58
          ? "The year ahead carries strong momentum — major transits and your dasha support growth. The timeline below shows when each door opens."
          : avg >= 48
            ? "A year of building — some quarters flow, others test you. The timeline below maps the shifts so you can time major moves."
            : "A karmic, consolidating year — progress is real but earned. Respect the harder windows below and use the supportive ones fully.",
      hi:
        avg >= 58
          ? "आने वाला वर्ष प्रबल गति लिए है — प्रमुख गोचर और दशा उन्नति का साथ देंगे। नीचे की समयरेखा बताती है कि कौन-सा द्वार कब खुलेगा।"
          : avg >= 48
            ? "निर्माण का वर्ष — कुछ तिमाहियाँ सहज, कुछ परीक्षा लेंगी। बड़े निर्णयों का समय नीचे की समयरेखा से चुनें।"
            : "कार्मिक, समेकन का वर्ष — प्रगति होगी पर परिश्रम से। कठिन अवधि में संयम रखें, अनुकूल अवधि का पूर्ण उपयोग करें।",
    },
    sections,
    areas,
    sadeSati: phase,
  };
}
