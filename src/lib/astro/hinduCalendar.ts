// Hindu calendar (panchang) month data: tithi at local sunrise for each day,
// the Moon's elongation (for drawing its true appearance), lunar (Amanta)
// month name, Vikram Samvat year, and special-day markers.

import { siderealLongitude, sunriseSunset } from "./ephemeris";
import { nakshatraOf } from "./nakshatra";
import { norm360 } from "./constants";

const DAY_MS = 86400 * 1000;

export interface CalendarDayInfo {
  /** UTC ms of the reference moment (local sunrise, or noon fallback) */
  refMs: number;
  /** ms at local midnight (cell identity) */
  dayStartMs: number;
  /** Gregorian day of month */
  day: number;
  /** 0–6, 0 = Sunday (local weekday) */
  weekday: number;
  /** 0–29 tithi at sunrise */
  tithi: number;
  paksha: "shukla" | "krishna";
  /** Moon's nakshatra at sunrise, 0–26 */
  nakshatra: number;
  /** Moon's sidereal sign at sunrise, 0–11 */
  moonSign: number;
  /** Sun–Moon elongation 0–360 (drives the moon drawing) */
  elongation: number;
  /** Sun's sidereal sign 0–11 */
  sunSign: number;
  /** exact sunrise/sunset UTC ms when resolvable */
  sunriseMs?: number;
  sunsetMs?: number;
  /** Amanta lunar month 0–11 (index into LUNAR_MONTHS) */
  lunarMonth: number;
  /** tithis occurring between this sunrise and the next (kshaya-aware) */
  coveredTithis: number[];
  /** festivals falling on this day */
  festivals: { en: string; hi: string }[];
  isPurnima: boolean;
  isAmavasya: boolean;
  isEkadashi: boolean;
  /** set when the Sun enters a new sidereal sign this day (Sankranti) */
  sankrantiSign?: number;
}

export interface LunarMonthInfo {
  /** 0–11 index into LUNAR_MONTHS */
  index: number;
  vikramSamvat: number;
}

export const LUNAR_MONTHS: { en: string; hi: string }[] = [
  { en: "Chaitra", hi: "चैत्र" },
  { en: "Vaishakha", hi: "वैशाख" },
  { en: "Jyeshtha", hi: "ज्येष्ठ" },
  { en: "Ashadha", hi: "आषाढ़" },
  { en: "Shravana", hi: "श्रावण" },
  { en: "Bhadrapada", hi: "भाद्रपद" },
  { en: "Ashwin", hi: "आश्विन" },
  { en: "Kartik", hi: "कार्तिक" },
  { en: "Margashirsha", hi: "मार्गशीर्ष" },
  { en: "Pausha", hi: "पौष" },
  { en: "Magha", hi: "माघ" },
  { en: "Phalguna", hi: "फाल्गुन" },
];

function elongationAt(ms: number): number {
  return norm360(siderealLongitude("Moon", ms) - siderealLongitude("Sun", ms));
}

/**
 * Amanta lunar month for an instant: the month begins at the last new moon,
 * and is named after the sign the Sun enters during it (sign at the new
 * moon + 1). Vikram Samvat ≈ CE + 57 (yearly rollover at Chaitra).
 */
export function lunarMonthInfo(ms: number): LunarMonthInfo {
  // Walk back to the most recent new moon (elongation wraps 360 → 0)
  let t = ms;
  let prev = elongationAt(t);
  for (let i = 0; i < 130; i++) {
    const t2 = t - 6 * 3600 * 1000;
    const e2 = elongationAt(t2);
    if (e2 > prev) {
      // crossed the new moon between t2 and t
      break;
    }
    t = t2;
    prev = e2;
  }
  const sunSignAtNewMoon = Math.floor(siderealLongitude("Sun", t) / 30) % 12;
  const index = (sunSignAtNewMoon + 1) % 12;

  const gYear = new Date(ms).getUTCFullYear();
  // Vikram Samvat increments at Chaitra (≈ March/April)
  const month = new Date(ms).getUTCMonth(); // 0-11
  const samvat = gYear + (month >= 3 || (month >= 2 && index === 0) ? 57 : 56);
  return { index, vikramSamvat: samvat };
}

// ── Festivals (Amanta lunar month + tithi rules; solar for sankrantis) ──
// tithi encoding: 0–14 = Shukla 1..Purnima, 15–29 = Krishna 1..Amavasya

// `night: true` = the festival follows the tithi running at night (nishita/
// pradosh rule: Shivratri, Janmashtami, Diwali…) rather than at sunrise.
const FESTIVALS: {
  month: number;
  tithi: number;
  en: string;
  hi: string;
  night?: boolean;
}[] = [
  { month: 0, tithi: 0, en: "Gudi Padwa · Chaitra Navratri begins", hi: "गुड़ी पड़वा · चैत्र नवरात्रि आरंभ" },
  { month: 0, tithi: 8, en: "Rama Navami", hi: "राम नवमी" },
  { month: 0, tithi: 14, en: "Hanuman Jayanti", hi: "हनुमान जयंती" },
  { month: 1, tithi: 2, en: "Akshaya Tritiya", hi: "अक्षय तृतीया" },
  { month: 1, tithi: 14, en: "Buddha Purnima", hi: "बुद्ध पूर्णिमा" },
  { month: 2, tithi: 9, en: "Ganga Dussehra", hi: "गंगा दशहरा" },
  { month: 2, tithi: 14, en: "Vat Purnima", hi: "वट पूर्णिमा" },
  { month: 3, tithi: 10, en: "Devshayani Ekadashi", hi: "देवशयनी एकादशी" },
  { month: 3, tithi: 14, en: "Guru Purnima", hi: "गुरु पूर्णिमा" },
  { month: 4, tithi: 4, en: "Nag Panchami", hi: "नाग पंचमी" },
  { month: 4, tithi: 14, en: "Raksha Bandhan", hi: "रक्षा बंधन" },
  { month: 4, tithi: 22, en: "Krishna Janmashtami", hi: "कृष्ण जन्माष्टमी", night: true },
  { month: 5, tithi: 3, en: "Ganesh Chaturthi", hi: "गणेश चतुर्थी" },
  { month: 5, tithi: 13, en: "Anant Chaturdashi", hi: "अनंत चतुर्दशी" },
  { month: 5, tithi: 15, en: "Pitru Paksha begins", hi: "पितृ पक्ष आरंभ" },
  { month: 5, tithi: 29, en: "Sarva Pitru Amavasya", hi: "सर्व पितृ अमावस्या" },
  { month: 6, tithi: 0, en: "Sharad Navratri begins", hi: "शारदीय नवरात्रि आरंभ" },
  { month: 6, tithi: 7, en: "Durga Ashtami", hi: "दुर्गा अष्टमी" },
  { month: 6, tithi: 9, en: "Dussehra (Vijayadashami)", hi: "दशहरा (विजयादशमी)" },
  { month: 6, tithi: 14, en: "Sharad Purnima", hi: "शरद पूर्णिमा", night: true },
  { month: 6, tithi: 18, en: "Karwa Chauth", hi: "करवा चौथ", night: true },
  { month: 6, tithi: 27, en: "Dhanteras", hi: "धनतेरस" },
  { month: 6, tithi: 29, en: "Diwali (Lakshmi Puja)", hi: "दिवाली (लक्ष्मी पूजा)", night: true },
  { month: 7, tithi: 0, en: "Govardhan Puja", hi: "गोवर्धन पूजा" },
  { month: 7, tithi: 1, en: "Bhai Dooj", hi: "भाई दूज" },
  { month: 7, tithi: 5, en: "Chhath Puja", hi: "छठ पूजा" },
  { month: 7, tithi: 10, en: "Devutthana Ekadashi · Tulsi Vivah", hi: "देवउठनी एकादशी · तुलसी विवाह" },
  { month: 7, tithi: 14, en: "Kartik Purnima · Dev Deepawali", hi: "कार्तिक पूर्णिमा · देव दीपावली" },
  { month: 8, tithi: 10, en: "Gita Jayanti", hi: "गीता जयंती" },
  { month: 10, tithi: 4, en: "Vasant Panchami", hi: "वसंत पंचमी" },
  { month: 10, tithi: 28, en: "Maha Shivratri", hi: "महाशिवरात्रि", night: true },
  { month: 11, tithi: 14, en: "Holika Dahan", hi: "होलिका दहन", night: true },
  { month: 11, tithi: 15, en: "Holi (Dhulandi)", hi: "होली (धुलंडी)", night: true },
];

const SANKRANTI_FESTIVALS: Record<number, { en: string; hi: string }> = {
  9: { en: "Makar Sankranti · Pongal", hi: "मकर संक्रांति · पोंगल" },
  0: { en: "Mesha Sankranti · Baisakhi", hi: "मेष संक्रांति · बैसाखी" },
};

// ── Daily time windows (from sunrise/sunset octants) ────────────────
// Classical part indices (1–8 of the day) per weekday, Sunday first.

const RAHU_PART = [8, 2, 7, 5, 6, 4, 3];
const YAMAGANDA_PART = [5, 4, 3, 2, 1, 7, 6];
const GULIKA_PART = [7, 6, 5, 4, 3, 2, 1];

export interface DayTimings {
  rahuKaal?: [number, number];
  yamaganda?: [number, number];
  gulika?: [number, number];
  /** null on Wednesday (Abhijit is avoided that day) */
  abhijit?: [number, number] | null;
}

export function dayTimings(day: CalendarDayInfo): DayTimings {
  if (day.sunriseMs === undefined || day.sunsetMs === undefined) return {};
  const rise = day.sunriseMs;
  const span = day.sunsetMs - rise;
  if (span <= 0) return {};
  const part = (i: number): [number, number] => [
    rise + ((i - 1) * span) / 8,
    rise + (i * span) / 8,
  ];
  const w = day.weekday;
  const mid = rise + span / 2;
  const abhijitHalf = span / 30; // the 8th of 15 muhurtas
  return {
    rahuKaal: part(RAHU_PART[w]),
    yamaganda: part(YAMAGANDA_PART[w]),
    gulika: part(GULIKA_PART[w]),
    abhijit: w === 3 ? null : [mid - abhijitHalf, mid + abhijitHalf],
  };
}

// ── Personal (kundli-based) day quality ─────────────────────────────

export const TARABALA9: { en: string; hi: string; good: boolean | null }[] = [
  { en: "Janma", hi: "जन्म", good: null },
  { en: "Sampat", hi: "संपत्", good: true },
  { en: "Vipat", hi: "विपत्", good: false },
  { en: "Kshema", hi: "क्षेम", good: true },
  { en: "Pratyari", hi: "प्रत्यरि", good: false },
  { en: "Sadhaka", hi: "साधक", good: true },
  { en: "Vadha", hi: "वध", good: false },
  { en: "Mitra", hi: "मैत्र", good: true },
  { en: "Ati-Mitra", hi: "अति मैत्र", good: true },
];

/** Chandra bala: favourable transit-Moon houses from the natal Moon */
const CHANDRA_GOOD_HOUSES = [1, 3, 6, 7, 10, 11];

/** What each tarabala day is good for / must avoid (personal guidance) */
export const TARA_GUIDANCE: {
  do: { en: string; hi: string };
  avoid: { en: string; hi: string };
  note: { en: string; hi: string };
}[] = [
  {
    // 0 Janma
    do: { en: "Self-care, planning, worship, light routine work", hi: "आत्म-देखभाल, योजना, पूजा-पाठ, हल्के नियमित कार्य" },
    avoid: { en: "Risky new starts, elective surgery, long journeys", hi: "जोखिम भरी नई शुरुआत, वैकल्पिक शल्य-क्रिया, लंबी यात्रा" },
    note: { en: "Birth-star day: emotions run strong — decide slowly.", hi: "जन्म तारा दिन: भावनाएँ प्रबल — निर्णय धीरे लें।" },
  },
  {
    // 1 Sampat
    do: { en: "Money matters, investments, purchases (gold/property), new ventures", hi: "धन कार्य, निवेश, खरीदारी (स्वर्ण/संपत्ति), नए उद्यम" },
    avoid: { en: "Nothing major — a wealth-giving day", hi: "कोई बड़ी मनाही नहीं — धनदायक दिन" },
    note: { en: "One of the best days for financial gain.", hi: "आर्थिक लाभ के लिए श्रेष्ठ दिनों में से एक।" },
  },
  {
    // 2 Vipat
    do: { en: "Routine chores, clearing pending work, quiet study", hi: "नियमित कार्य, लंबित काम निपटाना, शांत अध्ययन" },
    avoid: { en: "Travel, lending money, arguments, launches, signing deals", hi: "यात्रा, धन उधार, विवाद, नई शुरुआत, अनुबंध" },
    note: { en: "Danger star: risk of loss — double-check everything, drive carefully.", hi: "विपत् तारा: हानि की आशंका — सब दोबारा जाँचें, वाहन सावधानी से चलाएँ।" },
  },
  {
    // 3 Kshema
    do: { en: "Family functions, health treatments, shopping, reconciliation", hi: "पारिवारिक कार्य, चिकित्सा/उपचार, खरीदारी, मेल-मिलाप" },
    avoid: { en: "Nothing major", hi: "कोई बड़ी मनाही नहीं" },
    note: { en: "A day of well-being and protection.", hi: "कल्याण और रक्षा का दिन।" },
  },
  {
    // 4 Pratyari
    do: { en: "Review, research, preparation — finish, don't begin", hi: "समीक्षा, शोध, तैयारी — काम पूर्ण करें, आरंभ न करें" },
    avoid: { en: "Agreements, launches, interviews, confrontation", hi: "अनुबंध, शुभारंभ, साक्षात्कार, टकराव" },
    note: { en: "Obstacle star: keep time buffers, expect delays.", hi: "प्रत्यरि तारा: समय की गुंजाइश रखें, विलंब संभावित।" },
  },
  {
    // 5 Sadhaka
    do: { en: "Goal completion, exams, interviews, meeting seniors, starting projects", hi: "लक्ष्य पूर्ति, परीक्षा, साक्षात्कार, वरिष्ठों से भेंट, परियोजना आरंभ" },
    avoid: { en: "Nothing major", hi: "कोई बड़ी मनाही नहीं" },
    note: { en: "Achievement star: effort succeeds today.", hi: "साधक तारा: आज प्रयास सफल होते हैं।" },
  },
  {
    // 6 Vadha
    do: { en: "Rest, devotion, strictly routine work only", hi: "विश्राम, भक्ति, केवल नियमित कार्य" },
    avoid: { en: "Major decisions, big money moves, elective surgery, long travel", hi: "बड़े निर्णय, बड़े धन-व्यवहार, वैकल्पिक शल्य-क्रिया, लंबी यात्रा" },
    note: { en: "Highest-risk star day — postpone whatever can wait.", hi: "सर्वाधिक जोखिम वाला तारा दिन — जो टल सकता है, टालें।" },
  },
  {
    // 7 Mitra
    do: { en: "Partnerships, networking, proposals, travel, new contacts", hi: "साझेदारी, मेल-जोल, प्रस्ताव, यात्रा, नए संपर्क" },
    avoid: { en: "Nothing major", hi: "कोई बड़ी मनाही नहीं" },
    note: { en: "Friendly star: cooperation flows easily.", hi: "मैत्र तारा: सहयोग सहज मिलता है।" },
  },
  {
    // 8 Ati-Mitra
    do: { en: "All important works — ceremonies, joint ventures, big purchases", hi: "सभी महत्वपूर्ण कार्य — संस्कार, संयुक्त उद्यम, बड़ी खरीद" },
    avoid: { en: "Nothing major", hi: "कोई बड़ी मनाही नहीं" },
    note: { en: "Best-friend star: the most supportive day of the cycle.", hi: "अति मैत्र तारा: चक्र का सबसे अनुकूल दिन।" },
  },
];

export const CHANDRA_WEAK_NOTE = {
  en: "Moon strength is weak today — the mind may be restless; avoid purely emotional decisions and prefer the Abhijit window for anything important.",
  hi: "आज चंद्रबल कमजोर है — मन अशांत रह सकता है; केवल भावनाओं में आकर निर्णय न लें, महत्वपूर्ण कार्य अभिजीत मुहूर्त में करें।",
};

export interface PersonalDayQuality {
  /** 0–8 index into TARABALA9 */
  taraIndex: number;
  taraGood: boolean | null;
  /** transiting Moon's house from natal Moon, 1–12 */
  chandraHouse: number;
  chandraGood: boolean;
  /** overall: 2 = favourable, 1 = mixed, 0 = caution */
  quality: 0 | 1 | 2;
}

export function personalDayQuality(
  day: CalendarDayInfo,
  birthNakshatra: number,
  natalMoonSign: number
): PersonalDayQuality {
  const taraIndex = (((day.nakshatra - birthNakshatra + 27) % 27) % 9 + 9) % 9;
  const taraGood = TARABALA9[taraIndex].good;
  const chandraHouse = ((day.moonSign - natalMoonSign + 12) % 12) + 1;
  const chandraGood = CHANDRA_GOOD_HOUSES.includes(chandraHouse);
  const score = (taraGood === true ? 1 : taraGood === null ? 0.5 : 0) + (chandraGood ? 1 : 0);
  const quality: 0 | 1 | 2 = score >= 1.5 ? 2 : score >= 1 ? 1 : 0;
  return { taraIndex, taraGood, chandraHouse, chandraGood, quality };
}

/**
 * Build the panchang data for every day of a Gregorian month.
 * `tzOffsetMinutes` is the viewer's local offset (from Date.getTimezoneOffset).
 */
export function buildMonthCalendar(
  year: number,
  month: number, // 0–11
  latitude: number,
  longitude: number,
  tzOffsetMinutes: number
): CalendarDayInfo[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const out: CalendarDayInfo[] = [];
  let prevSunSign: number | null = null;

  for (let d = 1; d <= daysInMonth; d++) {
    // Local midnight expressed in UTC ms
    const dayStartMs = Date.UTC(year, month, d) + tzOffsetMinutes * 60 * 1000;
    const noonMs = dayStartMs + 12 * 3600 * 1000;

    const rs = sunriseSunset(noonMs, latitude, longitude);
    const refMs =
      rs.sunrise !== undefined &&
      rs.sunrise >= dayStartMs &&
      rs.sunrise < dayStartMs + DAY_MS
        ? rs.sunrise
        : noonMs;

    const elong = elongationAt(refMs);
    const tithi = Math.floor(elong / 12) % 30;
    const moonLon = siderealLongitude("Moon", refMs);
    const sunSign = Math.floor(siderealLongitude("Sun", refMs) / 30) % 12;

    const info: CalendarDayInfo = {
      refMs,
      dayStartMs,
      day: d,
      weekday: new Date(Date.UTC(year, month, d)).getUTCDay(),
      tithi,
      paksha: tithi < 15 ? "shukla" : "krishna",
      nakshatra: nakshatraOf(moonLon),
      moonSign: Math.floor(moonLon / 30) % 12,
      elongation: elong,
      sunSign,
      sunriseMs:
        rs.sunrise !== undefined &&
        rs.sunrise >= dayStartMs &&
        rs.sunrise < dayStartMs + DAY_MS
          ? rs.sunrise
          : undefined,
      sunsetMs:
        rs.sunset !== undefined &&
        rs.sunset >= dayStartMs &&
        rs.sunset < dayStartMs + DAY_MS
          ? rs.sunset
          : undefined,
      lunarMonth: 0, // filled in the post-pass below
      coveredTithis: [],
      festivals: [],
      isPurnima: tithi === 14,
      isAmavasya: tithi === 29,
      isEkadashi: tithi === 10 || tithi === 25,
    };
    if (prevSunSign !== null && sunSign !== prevSunSign) {
      info.sankrantiSign = sunSign;
    }
    prevSunSign = sunSign;
    out.push(info);
  }

  // Special-day badges must use the tithis COVERED between this sunrise and
  // the next — a tithi that begins after sunrise and ends before the next
  // sunrise (kshaya) would otherwise never be marked (e.g. Amavasya
  // 9 Feb 2024, which never prevailed at a Delhi sunrise).
  for (let i = 0; i < out.length; i++) {
    const cur = out[i];
    const nextTithi =
      i + 1 < out.length
        ? out[i + 1].tithi
        : Math.floor(elongationAt(cur.refMs + DAY_MS) / 12) % 30;
    const covered: number[] = [cur.tithi];
    let t = cur.tithi;
    let guard = 0;
    while (t !== nextTithi && guard < 3) {
      t = (t + 1) % 30;
      if (t !== nextTithi) covered.push(t);
      guard++;
    }
    cur.coveredTithis = covered;
    cur.isPurnima = covered.includes(14);
    cur.isAmavasya = covered.includes(29);
    cur.isEkadashi = covered.includes(10) || covered.includes(25);
  }

  // Amanta lunar month per day: starts from the first day's month, and
  // advances the day after each Amavasya completes.
  let lm = lunarMonthInfo(out[0].refMs).index;
  for (let i = 0; i < out.length; i++) {
    if (i > 0 && out[i - 1].coveredTithis.includes(29)) {
      lm = (lm + 1) % 12;
    }
    out[i].lunarMonth = lm;
  }

  // Festivals. Day festivals match the tithis covered from this sunrise;
  // night festivals (nishita/pradosh rule) match the tithi running at the
  // local midnight that ends this day. A covered tithi belongs to this
  // day's lunar month unless it wrapped past Amavasya.
  for (const d of out) {
    const nightTithi =
      Math.floor(elongationAt(d.dayStartMs + DAY_MS) / 12) % 30;
    const monthFor = (t: number) =>
      t >= d.tithi ? d.lunarMonth : (d.lunarMonth + 1) % 12;

    for (const f of FESTIVALS) {
      const matched = f.night
        ? nightTithi === f.tithi && f.month === monthFor(nightTithi)
        : d.coveredTithis.includes(f.tithi) && f.month === monthFor(f.tithi);
      if (matched) d.festivals.push({ en: f.en, hi: f.hi });
    }
    if (d.sankrantiSign !== undefined && SANKRANTI_FESTIVALS[d.sankrantiSign]) {
      d.festivals.push(SANKRANTI_FESTIVALS[d.sankrantiSign]);
    }
  }

  return out;
}
