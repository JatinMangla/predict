// Numerology meanings 1–9 (+ masters), with the Vedic planet association,
// lucky colours/days, and the UI theme accent for each number.

import type { Bi } from "./core";

export interface NumberProfile {
  planet: Bi;
  traits: Bi;
  luckyColors: Bi;
  luckyDays: Bi;
  /** CSS accent for numerology-based UI theming */
  accent: string;
  accentSoft: string;
}

export const NUMBER_PROFILES: Record<number, NumberProfile> = {
  1: {
    planet: { en: "Sun", hi: "सूर्य" },
    traits: {
      en: "Natural leader — independent, original and ambitious. Shines when taking initiative; must guard against dominance.",
      hi: "जन्मजात नेता — स्वतंत्र, मौलिक और महत्वाकांक्षी। पहल करने में चमकते हैं; अहंकार से बचें।",
    },
    luckyColors: { en: "Gold, orange, copper", hi: "सुनहरा, नारंगी, ताम्र" },
    luckyDays: { en: "Sunday, Monday", hi: "रविवार, सोमवार" },
    accent: "#d97706",
    accentSoft: "#fef3c7",
  },
  2: {
    planet: { en: "Moon", hi: "चंद्र" },
    traits: {
      en: "Gentle diplomat — intuitive, cooperative and artistic. Thrives in partnership; needs emotional steadiness.",
      hi: "कोमल कूटनीतिज्ञ — सहज-बुद्धि, सहयोगी और कलात्मक। साझेदारी में सफल; भावनात्मक स्थिरता आवश्यक।",
    },
    luckyColors: { en: "White, silver, sea-green", hi: "श्वेत, चांदी, समुद्री हरा" },
    luckyDays: { en: "Monday, Friday", hi: "सोमवार, शुक्रवार" },
    accent: "#0e7490",
    accentSoft: "#cffafe",
  },
  3: {
    planet: { en: "Jupiter", hi: "गुरु" },
    traits: {
      en: "Wise optimist — expressive, generous and disciplined in knowledge. Grows through teaching and guiding others.",
      hi: "ज्ञानी आशावादी — अभिव्यक्त, उदार और विद्या-अनुशासित। शिक्षण और मार्गदर्शन से उन्नति।",
    },
    luckyColors: { en: "Yellow, saffron, gold", hi: "पीला, केसरिया, सुनहरा" },
    luckyDays: { en: "Thursday, Tuesday", hi: "गुरुवार, मंगलवार" },
    accent: "#ca8a04",
    accentSoft: "#fef9c3",
  },
  4: {
    planet: { en: "Rahu", hi: "राहु" },
    traits: {
      en: "Unconventional builder — practical, sudden in fortune, drawn to technology and the unusual. Stability comes from routine.",
      hi: "अपरंपरागत निर्माता — व्यावहारिक, आकस्मिक भाग्य, तकनीक और नवीनता की ओर आकर्षित। दिनचर्या से स्थिरता।",
    },
    luckyColors: { en: "Electric blue, grey", hi: "विद्युत नीला, धूसर" },
    luckyDays: { en: "Saturday, Sunday", hi: "शनिवार, रविवार" },
    accent: "#4f46e5",
    accentSoft: "#e0e7ff",
  },
  5: {
    planet: { en: "Mercury", hi: "बुध" },
    traits: {
      en: "Quick communicator — versatile, commercial and youthful. Wins through wit and adaptability; scatter is the risk.",
      hi: "तीव्र संवादक — बहुमुखी, व्यापार-कुशल और चिर-युवा। बुद्धि और लचीलेपन से विजय; बिखराव से बचें।",
    },
    luckyColors: { en: "Green, light brown", hi: "हरा, हल्का भूरा" },
    luckyDays: { en: "Wednesday, Friday", hi: "बुधवार, शुक्रवार" },
    accent: "#059669",
    accentSoft: "#d1fae5",
  },
  6: {
    planet: { en: "Venus", hi: "शुक्र" },
    traits: {
      en: "Loving harmonizer — charming, responsible and drawn to beauty. Prospers in art, luxury and care-giving roles.",
      hi: "स्नेही समन्वयक — आकर्षक, उत्तरदायी और सौंदर्य-प्रेमी। कला, वैभव और सेवा क्षेत्रों में समृद्धि।",
    },
    luckyColors: { en: "Pink, white, pastel blue", hi: "गुलाबी, श्वेत, हल्का नीला" },
    luckyDays: { en: "Friday, Wednesday", hi: "शुक्रवार, बुधवार" },
    accent: "#db2777",
    accentSoft: "#fce7f3",
  },
  7: {
    planet: { en: "Ketu", hi: "केतु" },
    traits: {
      en: "Mystic thinker — introspective, analytical and spiritually inclined. Finds truth beneath surfaces; needs solitude.",
      hi: "रहस्यवादी चिंतक — आत्मनिरीक्षक, विश्लेषक और आध्यात्मिक। सतह के नीचे सत्य खोजते हैं; एकांत आवश्यक।",
    },
    luckyColors: { en: "Smoke grey, violet", hi: "धूम्र धूसर, बैंगनी" },
    luckyDays: { en: "Monday, Thursday", hi: "सोमवार, गुरुवार" },
    accent: "#7c3aed",
    accentSoft: "#ede9fe",
  },
  8: {
    planet: { en: "Saturn", hi: "शनि" },
    traits: {
      en: "Patient achiever — disciplined, just and enduring. Late but massive success through persistence and integrity.",
      hi: "धैर्यवान साधक — अनुशासित, न्यायप्रिय और सहनशील। निष्ठा और निरंतरता से विलंबित किंतु विशाल सफलता।",
    },
    luckyColors: { en: "Dark blue, black, navy", hi: "गहरा नीला, काला, नेवी" },
    luckyDays: { en: "Saturday, Friday", hi: "शनिवार, शुक्रवार" },
    accent: "#1e40af",
    accentSoft: "#dbeafe",
  },
  9: {
    planet: { en: "Mars", hi: "मंगल" },
    traits: {
      en: "Courageous humanitarian — energetic, protective and driven to complete things. Channels fire into service and leadership.",
      hi: "साहसी लोकसेवी — ऊर्जावान, रक्षक और कार्य पूर्ण करने की धुन। अग्नि को सेवा और नेतृत्व में लगाते हैं।",
    },
    luckyColors: { en: "Red, crimson, coral", hi: "लाल, रक्तवर्ण, मूंगा" },
    luckyDays: { en: "Tuesday, Thursday", hi: "मंगलवार, गुरुवार" },
    accent: "#dc2626",
    accentSoft: "#fee2e2",
  },
};

export const MASTER_MEANINGS: Record<number, Bi> = {
  11: {
    en: "Master Number 11 — heightened intuition and inspiration; a spiritual messenger when grounded.",
    hi: "मास्टर अंक 11 — तीव्र अंतर्ज्ञान और प्रेरणा; स्थिर रहने पर आध्यात्मिक संदेशवाहक।",
  },
  22: {
    en: "Master Number 22 — the master builder; capable of turning grand visions into concrete reality.",
    hi: "मास्टर अंक 22 — महान निर्माता; बड़े स्वप्नों को ठोस वास्तविकता में बदलने की क्षमता।",
  },
  33: {
    en: "Master Number 33 — the master teacher; uplifting others through compassion and service.",
    hi: "मास्टर अंक 33 — महान शिक्षक; करुणा और सेवा से दूसरों का उत्थान।",
  },
};
