// Core shared types for the Vedic astrology engine.
// All longitudes are in degrees. Signs are 0-indexed (0 = Aries/Mesha).
// Houses are 1-indexed (1 = lagna). Nakshatras are 0-indexed (0 = Ashwini).

export type PlanetId =
  | "Sun"
  | "Moon"
  | "Mars"
  | "Mercury"
  | "Jupiter"
  | "Venus"
  | "Saturn"
  | "Rahu"
  | "Ketu";

export type Dignity =
  | "exalted"
  | "moolatrikona"
  | "own"
  | "friend"
  | "neutral"
  | "enemy"
  | "debilitated";

export interface PlanetPosition {
  id: PlanetId;
  /** Sidereal ecliptic longitude (Lahiri), 0–360 */
  longitude: number;
  /** Tropical ecliptic longitude of date, 0–360 */
  tropicalLongitude: number;
  /** 0–11, Aries = 0 */
  sign: number;
  /** Degrees within the sign, 0–30 */
  degInSign: number;
  /** 0–26 */
  nakshatra: number;
  /** 1–4 */
  pada: number;
  /** Motion in degrees/day (negative = retrograde) */
  speed: number;
  retrograde: boolean;
  combust: boolean;
  /** Whole-sign house from lagna, 1–12 */
  house: number;
  dignity: Dignity;
}

export interface LagnaInfo {
  longitude: number; // sidereal
  sign: number;
  degInSign: number;
  nakshatra: number;
  pada: number;
}

export interface BirthDetails {
  name: string;
  gender: "male" | "female" | "other";
  /** Local birth date-time, ISO without zone e.g. "1995-08-15T14:30" */
  localDateTime: string;
  /** IANA timezone, e.g. "Asia/Kolkata" */
  timezone: string;
  latitude: number;
  longitude: number;
  place: string;
}

export interface PanchangInfo {
  /** 0–29 (0 = Shukla Pratipada, 15 = Krishna Pratipada, 14 = Purnima, 29 = Amavasya) */
  tithi: number;
  tithiName: string;
  paksha: "shukla" | "krishna";
  /** 0–6, 0 = Sunday */
  vara: number;
  /** 0–26 nitya yoga */
  yoga: number;
  /** 0–59 karana index within lunar month */
  karana: number;
  /** Nakshatra of the Moon, 0–26 */
  nakshatra: number;
  /** Sunrise/sunset local ISO strings if resolvable */
  sunrise?: string;
  sunset?: string;
}

export interface DashaPeriod {
  lord: PlanetId;
  /** UTC ms */
  start: number;
  end: number;
  /** Nested sub-periods (antardasha inside mahadasha, etc.) */
  children?: DashaPeriod[];
}

export interface VargaPosition {
  planet: PlanetId | "Lagna";
  sign: number;
}

/** One divisional chart: planet/lagna → sign */
export type VargaChart = VargaPosition[];

export interface YogaResult {
  /** stable key used for i18n / KB lookup, e.g. "gajakesari" */
  key: string;
  /** whether this is a benefic yoga or a dosha */
  kind: "yoga" | "dosha";
  /** planets/houses that formed it — for display */
  detail: string;
  /** strength 1 (weak) – 3 (strong) */
  strength: 1 | 2 | 3;
}

export interface AshtakavargaResult {
  /** bhinnashtakavarga: planet → 12 sign bindus (index 0 = Aries) */
  bav: Record<string, number[]>;
  /** sarvashtakavarga: 12 sign totals */
  sav: number[];
}

export interface NumerologyResult {
  birthdayNumber: number; // moolank
  lifePathNumber: number; // bhagyank
  /** master number before reduction, if any (11/22/33) */
  lifePathMaster?: number;
  expressionNumber?: number; // from name
  soulUrgeNumber?: number; // vowels
  personalityNumber?: number; // consonants
  personalYear: number;
  personalMonth: number;
  /** ruling planet of the birthday number */
  rulingPlanet: PlanetId;
}

export interface Kundli {
  birth: BirthDetails;
  /** birth instant in UTC ms */
  utcMs: number;
  ayanamsa: number;
  lagna: LagnaInfo;
  planets: PlanetPosition[];
  /** divisional charts keyed by e.g. "D1", "D9", "D10" */
  vargas: Record<string, VargaChart>;
  panchang: PanchangInfo;
  /** Vimshottari mahadasha timeline with antardashas + pratyantardashas */
  dasha: DashaPeriod[];
  yogas: YogaResult[];
  ashtakavarga: AshtakavargaResult;
  numerology: NumerologyResult;
}

export interface StoredProfile extends BirthDetails {
  id?: number;
  createdAt: number;
  updatedAt: number;
}
