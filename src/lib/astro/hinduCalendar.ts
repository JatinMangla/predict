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
      tithi,
      paksha: tithi < 15 ? "shukla" : "krishna",
      nakshatra: nakshatraOf(moonLon),
      moonSign: Math.floor(moonLon / 30) % 12,
      elongation: elong,
      sunSign,
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
    cur.isPurnima = covered.includes(14);
    cur.isAmavasya = covered.includes(29);
    cur.isEkadashi = covered.includes(10) || covered.includes(25);
  }
  return out;
}
