// Display formatting helpers shared by the UI.

import { SIGN_NAMES, PLANET_NAMES, NAKSHATRA_NAMES, VARA_NAMES, TITHI_NAMES } from "@/lib/astro/constants";
import type { PlanetId } from "@/lib/astro/types";
import type { Lang } from "@/lib/i18n";

/** 123.456 → "3°27′" within sign */
export function fmtDegInSign(degInSign: number): string {
  const d = Math.floor(degInSign);
  const m = Math.floor((degInSign - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}′`;
}

export function signName(sign: number, lang: Lang): string {
  const s = SIGN_NAMES[((sign % 12) + 12) % 12];
  return lang === "hi" ? s.hi : s.en;
}

export function planetName(id: PlanetId, lang: Lang): string {
  return lang === "hi" ? PLANET_NAMES[id].hi : PLANET_NAMES[id].en;
}

/** Two-letter planet abbreviation for chart cells */
export function planetAbbr(id: PlanetId, lang: Lang): string {
  if (lang === "hi") {
    const map: Record<PlanetId, string> = {
      Sun: "सू", Moon: "चं", Mars: "मं", Mercury: "बु", Jupiter: "गु",
      Venus: "शु", Saturn: "श", Rahu: "रा", Ketu: "के",
    };
    return map[id];
  }
  const map: Record<PlanetId, string> = {
    Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju",
    Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
  };
  return map[id];
}

export function nakshatraName(idx: number, lang: Lang): string {
  const n = NAKSHATRA_NAMES[idx];
  return lang === "hi" ? n.hi : n.en;
}

export function varaName(idx: number, lang: Lang): string {
  const v = VARA_NAMES[idx];
  return lang === "hi" ? v.hi : v.en;
}

export function tithiName(tithi: number, lang: Lang): string {
  if (tithi === 14) return lang === "hi" ? TITHI_NAMES[14].hi : TITHI_NAMES[14].en;
  if (tithi === 29) return lang === "hi" ? TITHI_NAMES[15].hi : TITHI_NAMES[15].en;
  const t = TITHI_NAMES[tithi % 15];
  return lang === "hi" ? t.hi : t.en;
}

export function fmtDate(ms: number, lang: Lang, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

export function fmtTime(ms: number, lang: Lang): string {
  return new Date(ms).toLocaleTimeString(lang === "hi" ? "hi-IN" : "en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDateTime(ms: number, lang: Lang): string {
  return new Date(ms).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
