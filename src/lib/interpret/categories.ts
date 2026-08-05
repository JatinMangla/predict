// Life-area categories used by the Rashi Deep-Dive page. Each names the
// houses, karakas and chart factors a classical astrologer examines for
// that area — the same factors a Moon-sign (rashi) forecast generalises
// about, which the AI then verifies against this specific chart.

import type { PlanetId } from "@/lib/astro/types";
import type { Bi } from "./kb/core";

export interface CategoryDef {
  key: string;
  label: Bi;
  icon: string;
  /** primary houses examined */
  houses: number[];
  /** natural significators */
  karakas: PlanetId[];
  /** divisional chart that refines this area */
  varga: string;
  /** plain-language description of what a rashi-level forecast claims here */
  scope: Bi;
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: "career",
    label: { en: "Career & Job", hi: "करियर और नौकरी" },
    icon: "💼",
    houses: [10, 6, 2],
    karakas: ["Saturn", "Sun", "Mercury"],
    varga: "D10",
    scope: {
      en: "promotion, job change, business growth, recognition, workplace conflict",
      hi: "पदोन्नति, नौकरी परिवर्तन, व्यापार वृद्धि, मान-सम्मान, कार्यस्थल विवाद",
    },
  },
  {
    key: "wealth",
    label: { en: "Wealth & Income", hi: "धन और आय" },
    icon: "💰",
    houses: [2, 11, 9],
    karakas: ["Jupiter", "Venus"],
    varga: "D2",
    scope: {
      en: "earnings, savings, gains, investments, loans and unexpected expenses",
      hi: "आय, बचत, लाभ, निवेश, ऋण और अप्रत्याशित व्यय",
    },
  },
  {
    key: "marriage",
    label: { en: "Marriage & Relationships", hi: "विवाह और संबंध" },
    icon: "💍",
    houses: [7, 2, 11],
    karakas: ["Venus", "Jupiter"],
    varga: "D9",
    scope: {
      en: "marriage timing, spouse nature, harmony, separation risk, love matters",
      hi: "विवाह का समय, जीवनसाथी का स्वभाव, सामंजस्य, वियोग की आशंका, प्रेम प्रसंग",
    },
  },
  {
    key: "health",
    label: { en: "Health", hi: "स्वास्थ्य" },
    icon: "🩺",
    houses: [1, 6, 8],
    karakas: ["Sun", "Moon", "Saturn"],
    varga: "D30",
    scope: {
      en: "vitality, chronic issues, accidents, surgery, mental peace",
      hi: "जीवनी शक्ति, पुराने रोग, दुर्घटना, शल्य-क्रिया, मानसिक शांति",
    },
  },
  {
    key: "education",
    label: { en: "Education & Competition", hi: "शिक्षा और प्रतियोगिता" },
    icon: "📚",
    houses: [4, 5, 9],
    karakas: ["Mercury", "Jupiter"],
    varga: "D24",
    scope: {
      en: "studies, exams, competitive results, higher education, concentration",
      hi: "अध्ययन, परीक्षा, प्रतियोगी परिणाम, उच्च शिक्षा, एकाग्रता",
    },
  },
  {
    key: "family",
    label: { en: "Family & Children", hi: "परिवार और संतान" },
    icon: "👨‍👩‍👧",
    houses: [2, 4, 5],
    karakas: ["Jupiter", "Moon"],
    varga: "D7",
    scope: {
      en: "family harmony, parents' wellbeing, children, progeny matters",
      hi: "पारिवारिक सामंजस्य, माता-पिता का कुशल, संतान, संतति विषय",
    },
  },
  {
    key: "property",
    label: { en: "Property & Vehicles", hi: "संपत्ति और वाहन" },
    icon: "🏠",
    houses: [4, 11, 12],
    karakas: ["Mars", "Venus", "Moon"],
    varga: "D4",
    scope: {
      en: "buying or selling property, land, home construction, vehicles",
      hi: "संपत्ति क्रय-विक्रय, भूमि, गृह निर्माण, वाहन",
    },
  },
  {
    key: "foreign",
    label: { en: "Foreign & Travel", hi: "विदेश और यात्रा" },
    icon: "✈️",
    houses: [12, 9, 3],
    karakas: ["Rahu", "Moon", "Jupiter"],
    varga: "D9",
    scope: {
      en: "foreign travel, visa, overseas settlement, relocation",
      hi: "विदेश यात्रा, वीज़ा, विदेश में बसना, स्थानांतरण",
    },
  },
  {
    key: "obstacles",
    label: { en: "Obstacles & Enemies", hi: "बाधाएँ और शत्रु" },
    icon: "⚔️",
    houses: [6, 8, 12],
    karakas: ["Mars", "Saturn", "Rahu"],
    varga: "D1",
    scope: {
      en: "disputes, court cases, hidden opposition, debts, sudden setbacks",
      hi: "विवाद, मुकदमे, गुप्त शत्रुता, ऋण, आकस्मिक बाधाएँ",
    },
  },
  {
    key: "spirituality",
    label: { en: "Fortune & Spirituality", hi: "भाग्य और आध्यात्म" },
    icon: "🕉️",
    houses: [9, 5, 12],
    karakas: ["Jupiter", "Ketu", "Sun"],
    varga: "D20",
    scope: {
      en: "luck, blessings, dharma, guru, meditation, pilgrimage",
      hi: "भाग्य, आशीर्वाद, धर्म, गुरु, ध्यान, तीर्थयात्रा",
    },
  },
];

export function findCategory(key: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.key === key);
}
