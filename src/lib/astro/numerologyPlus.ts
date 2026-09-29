// Numerology beyond the basics — the systems practising Indian numerologists
// actually use side by side:
//   • Chaldean (Cheiro) name number, with the unreduced COMPOUND number and
//     its classical meaning — the standard for name correction in India
//   • Lo Shu grid from the date of birth (+ driver/conductor), its planes,
//     arrows and missing numbers
//   • Kua number (Eight Mansions), with the solar-year boundary at Lichun
//   • Pythagorean pinnacles, challenges and maturity number
//   • Personal day, and a name-number vs. birth-number compatibility check
//     derived from the planetary friendships of the ruling planets

import type { PlanetId } from "./types";
import { FRIENDS, ENEMIES } from "./constants";
import { NUMBER_PLANETS, reduceNumber } from "./numerology";

type Bi = { en: string; hi: string };

// ── Chaldean ─────────────────────────────────────────────────────────
// Cheiro's table: no letter is valued 9 (9 is held sacred).
const CHALDEAN: Record<string, number> = {
  a: 1, i: 1, j: 1, q: 1, y: 1,
  b: 2, k: 2, r: 2,
  c: 3, g: 3, l: 3, s: 3,
  d: 4, m: 4, t: 4,
  e: 5, h: 5, n: 5, x: 5,
  u: 6, v: 6, w: 6,
  o: 7, z: 7,
  f: 8, p: 8,
};

export function chaldeanCompound(name: string): number {
  let total = 0;
  for (const c of name.toLowerCase()) total += CHALDEAN[c] ?? 0;
  return total;
}

/** Cheiro's compound numbers 10–52 (higher values fold back by −9 steps as he prescribes) */
export const COMPOUND_MEANINGS: Record<number, { title: Bi; tone: "fortunate" | "mixed" | "caution"; meaning: Bi }> = {
  10: { title: { en: "Wheel of Fortune", hi: "भाग्य चक्र" }, tone: "fortunate", meaning: { en: "Honour, faith and self-confidence; rise and fall by your own plans — plans get carried out.", hi: "सम्मान, विश्वास, आत्मबल; अपनी योजना से उत्थान — योजनाएँ पूरी होती हैं।" } },
  11: { title: { en: "The Clenched Hand", hi: "बंद मुट्ठी" }, tone: "caution", meaning: { en: "Hidden dangers, trials and treachery from others; needs caution and clear dealings.", hi: "छिपे खतरे, परीक्षाएँ व दूसरों से धोखा; सावधानी और स्पष्ट व्यवहार आवश्यक।" } },
  12: { title: { en: "The Sacrifice", hi: "बलिदान" }, tone: "caution", meaning: { en: "Suffering through others' plans; tends to be sacrificed for others' ends.", hi: "दूसरों की योजनाओं से कष्ट; दूसरों के लिए स्वयं का त्याग।" } },
  13: { title: { en: "Change & Upheaval", hi: "परिवर्तन व उथल-पुथल" }, tone: "mixed", meaning: { en: "Power that turns destructive if misused; sudden changes of plan and place.", hi: "शक्ति जो दुरुपयोग पर विनाशकारी; योजना व स्थान में अचानक बदलाव।" } },
  14: { title: { en: "Movement", hi: "गतिशीलता" }, tone: "mixed", meaning: { en: "Travel, trade and combinations of people; risk from speculation and natural forces.", hi: "यात्रा, व्यापार, लोगों का मेल; सट्टे व प्राकृतिक आपदा से जोखिम।" } },
  15: { title: { en: "The Magician", hi: "जादूगर" }, tone: "fortunate", meaning: { en: "Eloquence, gifts and favours from others; strong personal magnetism for money.", hi: "वाक्पटुता, उपहार व दूसरों की कृपा; धन के प्रति प्रबल आकर्षण।" } },
  16: { title: { en: "The Shattered Citadel", hi: "टूटा दुर्ग" }, tone: "caution", meaning: { en: "Sudden accidents and defeat of plans; think ahead to avoid collapse.", hi: "आकस्मिक दुर्घटना व योजनाओं की विफलता; पहले से सोचकर चलें।" } },
  17: { title: { en: "Star of the Magi", hi: "मागी का तारा" }, tone: "fortunate", meaning: { en: "Peace and love; rises above trials to lasting fame — immortal number.", hi: "शांति व प्रेम; परीक्षाओं से ऊपर उठकर स्थायी कीर्ति।" } },
  18: { title: { en: "Conflict", hi: "संघर्ष" }, tone: "caution", meaning: { en: "Bitter quarrels, deception and treachery from friends and family.", hi: "कटु विवाद, धोखा, मित्रों-परिजनों से विश्वासघात।" } },
  19: { title: { en: "Prince of Heaven", hi: "स्वर्ग का राजकुमार" }, tone: "fortunate", meaning: { en: "Success, esteem and happiness; one of the most fortunate numbers.", hi: "सफलता, सम्मान व सुख; सबसे शुभ अंकों में से एक।" } },
  20: { title: { en: "The Awakening", hi: "जागरण" }, tone: "mixed", meaning: { en: "A call to action for a great cause; not material but spiritual success.", hi: "महान उद्देश्य हेतु आह्वान; भौतिक नहीं, आध्यात्मिक सफलता।" } },
  21: { title: { en: "Crown of the Magi", hi: "मागी का मुकुट" }, tone: "fortunate", meaning: { en: "Advancement, honours and victory after long struggle.", hi: "लंबे संघर्ष के बाद उन्नति, सम्मान और विजय।" } },
  22: { title: { en: "The Illusion", hi: "भ्रम" }, tone: "caution", meaning: { en: "Living in a fool's paradise; poor judgement and others' influence.", hi: "भ्रम में जीना; गलत निर्णय और दूसरों का प्रभाव।" } },
  23: { title: { en: "Royal Star of the Lion", hi: "सिंह का राजसी तारा" }, tone: "fortunate", meaning: { en: "Success in plans, help from superiors and protection from those in power.", hi: "योजनाओं में सफलता, वरिष्ठों की सहायता व शक्तिशालियों का संरक्षण।" } },
  24: { title: { en: "Love & Money", hi: "प्रेम व धन" }, tone: "fortunate", meaning: { en: "Assistance from those of rank; gains through love and creativity.", hi: "प्रतिष्ठित लोगों से सहायता; प्रेम व रचनात्मकता से लाभ।" } },
  25: { title: { en: "Strength through Trials", hi: "परीक्षाओं से शक्ति" }, tone: "fortunate", meaning: { en: "Wisdom from observation; success after early struggles.", hi: "अवलोकन से ज्ञान; आरंभिक संघर्ष के बाद सफलता।" } },
  26: { title: { en: "Partnerships' Ruin", hi: "साझेदारी में हानि" }, tone: "caution", meaning: { en: "Grave warnings for the future; losses through bad advice and partnerships.", hi: "भविष्य हेतु गंभीर चेतावनी; गलत सलाह व साझेदारी से हानि।" } },
  27: { title: { en: "The Sceptre", hi: "राजदंड" }, tone: "fortunate", meaning: { en: "Authority and command; rewards from creative intellect — trust your own plans.", hi: "अधिकार व नेतृत्व; रचनात्मक बुद्धि से पुरस्कार — अपनी योजनाओं पर चलें।" } },
  28: { title: { en: "Contradictions", hi: "विरोधाभास" }, tone: "caution", meaning: { en: "Great promise that is lost through trust in others; must plan for the future.", hi: "बड़ी संभावनाएँ जो दूसरों पर भरोसे से खो जाती हैं; भविष्य की योजना आवश्यक।" } },
  29: { title: { en: "Grace under Pressure", hi: "दबाव में धैर्य" }, tone: "caution", meaning: { en: "Uncertainties, treachery and trials through the opposite sex.", hi: "अनिश्चितता, विश्वासघात, विपरीत लिंग से परीक्षाएँ।" } },
  30: { title: { en: "Thoughtful Deduction", hi: "गंभीर चिंतन" }, tone: "mixed", meaning: { en: "Mental superiority; fortunate or not according to the will — often solitary.", hi: "मानसिक श्रेष्ठता; इच्छाशक्ति अनुसार शुभ-अशुभ — प्रायः एकांतप्रिय।" } },
  31: { title: { en: "The Hermit", hi: "एकांतवासी" }, tone: "mixed", meaning: { en: "Self-contained and isolated; not fortunate from a worldly view.", hi: "आत्मनिर्भर व एकाकी; सांसारिक दृष्टि से कम शुभ।" } },
  32: { title: { en: "Communication", hi: "संवाद" }, tone: "fortunate", meaning: { en: "Magical power of words and people; fortunate if you hold to your own judgement.", hi: "वाणी व जन-संपर्क की शक्ति; अपने निर्णय पर टिके रहें तो शुभ।" } },
  37: { title: { en: "Good Friendships", hi: "शुभ मित्रता" }, tone: "fortunate", meaning: { en: "Good partnerships, love and fortunate connections with both sexes.", hi: "अच्छी साझेदारी, प्रेम और सौभाग्यशाली संबंध।" } },
  43: { title: { en: "Revolution", hi: "क्रांति" }, tone: "caution", meaning: { en: "Upheaval, strife and failure of plans — an unfortunate number.", hi: "उथल-पुथल, संघर्ष व योजनाओं की विफलता — अशुभ अंक।" } },
  51: { title: { en: "The Warrior", hi: "योद्धा" }, tone: "fortunate", meaning: { en: "Sudden advancement in whatever is undertaken; but beware of enemies.", hi: "हर कार्य में अचानक उन्नति; पर शत्रुओं से सावधान।" } },
};

/** Cheiro folds numbers above 52 (and the gaps 33–50) onto their classical equivalents */
export function compoundMeaningFor(n: number) {
  if (n < 10) return null;
  let x = n;
  while (x > 52) x -= 9;
  if (COMPOUND_MEANINGS[x]) return { number: x, ...COMPOUND_MEANINGS[x] };
  // 33→24, 34→25, 35→26, 36→27, 38→29 … 42→24, 44→26 … 52→43
  const fold: Record<number, number> = {
    33: 24, 34: 25, 35: 26, 36: 27, 38: 29, 39: 30, 40: 31, 41: 32, 42: 24,
    44: 26, 45: 27, 46: 37, 47: 29, 48: 30, 49: 31, 50: 32, 52: 43,
  };
  const f = fold[x];
  return f && COMPOUND_MEANINGS[f] ? { number: f, ...COMPOUND_MEANINGS[f] } : null;
}

// ── Lo Shu ───────────────────────────────────────────────────────────
/** Lo Shu magic square layout (row-major) */
export const LO_SHU_LAYOUT = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
];

export const LO_SHU_PLANES: { key: string; numbers: number[]; name: Bi; meaning: Bi }[] = [
  { key: "mental", numbers: [4, 9, 2], name: { en: "Mental plane", hi: "मानसिक तल" }, meaning: { en: "Thinking, memory, intellect", hi: "चिंतन, स्मृति, बुद्धि" } },
  { key: "emotional", numbers: [3, 5, 7], name: { en: "Emotional plane", hi: "भावनात्मक तल" }, meaning: { en: "Feelings, spirituality, balance", hi: "भावनाएँ, आध्यात्मिकता, संतुलन" } },
  { key: "practical", numbers: [8, 1, 6], name: { en: "Practical plane", hi: "व्यावहारिक तल" }, meaning: { en: "Material skill, money, execution", hi: "भौतिक कौशल, धन, क्रियान्वयन" } },
  { key: "thought", numbers: [4, 3, 8], name: { en: "Thought plane", hi: "विचार तल" }, meaning: { en: "Planning and ideas", hi: "योजना व विचार" } },
  { key: "will", numbers: [9, 5, 1], name: { en: "Will plane", hi: "इच्छाशक्ति तल" }, meaning: { en: "Determination and persistence", hi: "दृढ़ संकल्प व लगन" } },
  { key: "action", numbers: [2, 7, 6], name: { en: "Action plane", hi: "कर्म तल" }, meaning: { en: "Getting things done", hi: "कार्य संपन्न करना" } },
  { key: "golden", numbers: [4, 5, 6], name: { en: "Golden Raj Yog (success)", hi: "स्वर्ण राजयोग (सफलता)" }, meaning: { en: "Success, wealth and recognition", hi: "सफलता, धन और पहचान" } },
  { key: "property", numbers: [2, 5, 8], name: { en: "Silver Raj Yog (property)", hi: "रजत राजयोग (संपत्ति)" }, meaning: { en: "Property, assets and stability", hi: "संपत्ति, जायदाद और स्थिरता" } },
];

export const MISSING_NUMBER_NOTES: Record<number, Bi> = {
  1: { en: "Self-expression and communication need conscious effort", hi: "आत्म-अभिव्यक्ति व संवाद में सजग प्रयास आवश्यक" },
  2: { en: "Sensitivity and intuition are under-used; patience in relationships", hi: "संवेदनशीलता व अंतर्ज्ञान कम प्रयुक्त; संबंधों में धैर्य" },
  3: { en: "Imagination and confidence in learning need nurturing", hi: "कल्पनाशीलता व सीखने में आत्मविश्वास बढ़ाएँ" },
  4: { en: "Order and discipline don't come naturally — build routines", hi: "अनुशासन व व्यवस्था स्वाभाविक नहीं — दिनचर्या बनाएँ" },
  5: { en: "Emotional balance and a stable centre need work", hi: "भावनात्मक संतुलन व स्थिरता पर कार्य आवश्यक" },
  6: { en: "Home, family responsibility and comfort need attention", hi: "घर, पारिवारिक दायित्व व सुविधा पर ध्यान दें" },
  7: { en: "Lessons come through loss or disappointment until faith grows", hi: "आस्था बढ़ने तक हानि/निराशा से सीख मिलती है" },
  8: { en: "Money management and attention to detail need care", hi: "धन प्रबंधन व बारीकियों पर ध्यान आवश्यक" },
  9: { en: "Idealism and ambition may lack drive — set bigger goals", hi: "आदर्श व महत्वाकांक्षा में ऊर्जा कम — बड़े लक्ष्य रखें" },
};

export interface LoShuResult {
  /** count of each digit 1–9 */
  counts: Record<number, number>;
  missing: number[];
  /** planes whose three numbers are all present */
  completePlanes: string[];
  /** planes whose three numbers are all absent */
  emptyPlanes: string[];
}

/** Lo Shu from a DOB with the Indian practice of adding driver + conductor */
export function loShu(dateISO: string, driver: number, conductor: number): LoShuResult {
  const digits = dateISO.replace(/-/g, "").split("").map(Number).filter((d) => d > 0);
  digits.push(driver, conductor);
  const counts: Record<number, number> = {};
  for (let n = 1; n <= 9; n++) counts[n] = 0;
  for (const d of digits) if (d >= 1 && d <= 9) counts[d] += 1;
  const missing = Object.keys(counts).map(Number).filter((n) => counts[n] === 0);
  return {
    counts,
    missing,
    completePlanes: LO_SHU_PLANES.filter((p) => p.numbers.every((n) => counts[n] > 0)).map((p) => p.key),
    emptyPlanes: LO_SHU_PLANES.filter((p) => p.numbers.every((n) => counts[n] === 0)).map((p) => p.key),
  };
}

// ── Kua ──────────────────────────────────────────────────────────────
export interface KuaResult {
  kua: number;
  group: "East" | "West";
  bestDirection: Bi;
}

const KUA_BEST: Record<number, Bi> = {
  1: { en: "South-East", hi: "दक्षिण-पूर्व" },
  2: { en: "North-East", hi: "उत्तर-पूर्व" },
  3: { en: "South", hi: "दक्षिण" },
  4: { en: "North", hi: "उत्तर" },
  6: { en: "West", hi: "पश्चिम" },
  7: { en: "North-West", hi: "उत्तर-पश्चिम" },
  8: { en: "South-West", hi: "दक्षिण-पश्चिम" },
  9: { en: "East", hi: "पूर्व" },
};

/**
 * Kua number. The Chinese solar year starts at Lichun (~4 Feb), so births
 * on 1 Jan – 3 Feb count as the previous year.
 */
export function kuaNumber(dateISO: string, gender: "male" | "female" | "other"): KuaResult {
  const [y0, m, d] = dateISO.split("-").map(Number);
  const y = m < 2 || (m === 2 && d < 4) ? y0 - 1 : y0;
  const r = reduceNumber(String(y).split("").reduce((s, c) => s + Number(c), 0));
  // With the FULL year's digit sum the rule is century-independent (the
  // usual "last two digits, 10− / +5 before 2000, 9− / +6 after" is the
  // same arithmetic mod 9).
  let kua: number;
  if (gender === "female") {
    kua = reduceNumber(r + 4);
    if (kua === 5) kua = 8;
  } else {
    kua = reduceNumber(11 - r);
    if (kua === 5) kua = 2;
  }
  return {
    kua,
    group: [1, 3, 4, 9].includes(kua) ? "East" : "West",
    bestDirection: KUA_BEST[kua],
  };
}

// ── Pinnacles & challenges ───────────────────────────────────────────
export interface PinnacleCycle {
  pinnacle: number;
  challenge: number;
  fromAge: number;
  /** null for the last, open-ended cycle */
  toAge: number | null;
}

export function pinnacles(dateISO: string, lifePath: number): PinnacleCycle[] {
  const [y, m, d] = dateISO.split("-").map(Number);
  const rm = reduceNumber(m);
  const rd = reduceNumber(d);
  const ry = reduceNumber(y);
  const p1 = reduceNumber(rm + rd, true);
  const p2 = reduceNumber(rd + ry, true);
  const p3 = reduceNumber(reduceNumber(p1) + reduceNumber(p2), true);
  const p4 = reduceNumber(rm + ry, true);
  const c1 = Math.abs(rm - rd);
  const c2 = Math.abs(rd - ry);
  const c3 = Math.abs(c1 - c2);
  const c4 = Math.abs(rm - ry);
  const end1 = 36 - reduceNumber(lifePath);
  return [
    { pinnacle: p1, challenge: c1, fromAge: 0, toAge: end1 },
    { pinnacle: p2, challenge: c2, fromAge: end1 + 1, toAge: end1 + 9 },
    { pinnacle: p3, challenge: c3, fromAge: end1 + 10, toAge: end1 + 18 },
    { pinnacle: p4, challenge: c4, fromAge: end1 + 19, toAge: null },
  ];
}

// ── Compatibility of a name number with the birth numbers ─────────────
export type NumberRelation = "friendly" | "neutral" | "hostile";

export function numberRelation(a: number, b: number): NumberRelation {
  const pa = NUMBER_PLANETS[reduceNumber(a)];
  const pb = NUMBER_PLANETS[reduceNumber(b)];
  if (pa === pb) return "friendly";
  const f = (x: PlanetId, y: PlanetId) => FRIENDS[x].includes(y);
  const e = (x: PlanetId, y: PlanetId) => ENEMIES[x].includes(y);
  if (e(pa, pb) || e(pb, pa)) return "hostile";
  if (f(pa, pb) || f(pb, pa)) return "friendly";
  return "neutral";
}

export interface NameCheck {
  compound: number;
  nameNumber: number;
  withDriver: NumberRelation;
  withConductor: NumberRelation;
  compoundTone: "fortunate" | "mixed" | "caution" | null;
  verdict: "supportive" | "workable" | "conflicting";
  /** single-digit name numbers friendly to both birth numbers */
  suggestedNumbers: number[];
}

export function checkName(name: string, driver: number, conductor: number): NameCheck {
  const compound = chaldeanCompound(name);
  const nameNumber = reduceNumber(compound);
  const withDriver = numberRelation(nameNumber, driver);
  const withConductor = numberRelation(nameNumber, conductor);
  const tone = compoundMeaningFor(compound)?.tone ?? null;
  const hostile = [withDriver, withConductor].filter((r) => r === "hostile").length;
  const friendly = [withDriver, withConductor].filter((r) => r === "friendly").length;
  const verdict: NameCheck["verdict"] =
    hostile > 0 || tone === "caution" ? "conflicting" : friendly >= 1 ? "supportive" : "workable";
  const suggestedNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
    (n) => numberRelation(n, driver) !== "hostile" && numberRelation(n, conductor) !== "hostile" &&
      (numberRelation(n, driver) === "friendly" || numberRelation(n, conductor) === "friendly")
  );
  return { compound, nameNumber, withDriver, withConductor, compoundTone: tone, verdict, suggestedNumbers };
}

/** Personal day = personal month + calendar day, reduced */
export function personalDay(personalMonth: number, date: Date = new Date()): number {
  return reduceNumber(personalMonth + date.getDate());
}

/** Pythagorean maturity number = life path + expression */
export function maturityNumber(lifePath: number, expression: number | undefined): number | undefined {
  return expression === undefined ? undefined : reduceNumber(lifePath + expression, true);
}

/** Navaratna stone of each number's planet (classical association) */
export const NUMBER_GEMS: Record<number, Bi> = {
  1: { en: "Ruby (Manik)", hi: "माणिक्य" },
  2: { en: "Pearl (Moti)", hi: "मोती" },
  3: { en: "Yellow sapphire (Pukhraj)", hi: "पुखराज" },
  4: { en: "Hessonite (Gomed)", hi: "गोमेद" },
  5: { en: "Emerald (Panna)", hi: "पन्ना" },
  6: { en: "Diamond / white sapphire", hi: "हीरा / श्वेत पुखराज" },
  7: { en: "Cat's eye (Lehsunia)", hi: "लहसुनिया" },
  8: { en: "Blue sapphire (Neelam)", hi: "नीलम" },
  9: { en: "Red coral (Moonga)", hi: "मूंगा" },
};
