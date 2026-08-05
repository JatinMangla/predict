// Short keyword chips describing what a transiting planet is currently doing
// to this chart — the house domain it activates plus the planet's own tone.

import type { PlanetId } from "@/lib/astro/types";
import type { Bi } from "./core";

/** Two-word themes for the house a planet transits (index 0 = 1st house) */
export const HOUSE_KEYWORDS: Bi[][] = [
  [{ en: "self & health", hi: "स्वयं व स्वास्थ्य" }, { en: "new starts", hi: "नई शुरुआत" }],
  [{ en: "money & family", hi: "धन व परिवार" }, { en: "speech", hi: "वाणी" }],
  [{ en: "courage", hi: "साहस" }, { en: "siblings & short trips", hi: "भाई-बहन व छोटी यात्रा" }],
  [{ en: "home & mother", hi: "घर व माता" }, { en: "peace of mind", hi: "मानसिक शांति" }],
  [{ en: "children & study", hi: "संतान व शिक्षा" }, { en: "creativity", hi: "रचनात्मकता" }],
  [{ en: "health & rivals", hi: "स्वास्थ्य व प्रतिद्वंद्वी" }, { en: "daily work", hi: "दैनिक कार्य" }],
  [{ en: "marriage", hi: "विवाह" }, { en: "partnerships", hi: "साझेदारी" }],
  [{ en: "sudden change", hi: "आकस्मिक परिवर्तन" }, { en: "hidden matters", hi: "गुप्त विषय" }],
  [{ en: "luck & dharma", hi: "भाग्य व धर्म" }, { en: "father & travel", hi: "पिता व यात्रा" }],
  [{ en: "career & status", hi: "करियर व पद" }, { en: "authority", hi: "अधिकार" }],
  [{ en: "gains & income", hi: "लाभ व आय" }, { en: "friends", hi: "मित्र" }],
  [{ en: "expenses", hi: "व्यय" }, { en: "foreign & isolation", hi: "विदेश व एकांत" }],
];

/** The planet's own effect in one or two words, split by favourability */
export const PLANET_TONE_KEYWORDS: Record<PlanetId, { good: Bi; bad: Bi }> = {
  Sun: {
    good: { en: "recognition", hi: "मान-सम्मान" },
    bad: { en: "ego friction", hi: "अहं टकराव" },
  },
  Moon: {
    good: { en: "good mood", hi: "प्रसन्न मन" },
    bad: { en: "restless mind", hi: "अशांत मन" },
  },
  Mars: {
    good: { en: "drive & energy", hi: "ऊर्जा व पराक्रम" },
    bad: { en: "conflict risk", hi: "विवाद का जोखिम" },
  },
  Mercury: {
    good: { en: "clear dealings", hi: "स्पष्ट व्यवहार" },
    bad: { en: "miscommunication", hi: "संवाद में भ्रम" },
  },
  Jupiter: {
    good: { en: "growth & support", hi: "उन्नति व सहयोग" },
    bad: { en: "overreach", hi: "अति-विस्तार" },
  },
  Venus: {
    good: { en: "comfort & harmony", hi: "सुख व सामंजस्य" },
    bad: { en: "overspending", hi: "अधिक व्यय" },
  },
  Saturn: {
    good: { en: "steady gains", hi: "स्थिर लाभ" },
    bad: { en: "delay & pressure", hi: "विलंब व दबाव" },
  },
  Rahu: {
    good: { en: "bold opportunity", hi: "साहसिक अवसर" },
    bad: { en: "confusion & shortcuts", hi: "भ्रम व शॉर्टकट" },
  },
  Ketu: {
    good: { en: "insight & research", hi: "अंतर्दृष्टि व शोध" },
    bad: { en: "detachment & loss", hi: "वैराग्य व हानि" },
  },
};
