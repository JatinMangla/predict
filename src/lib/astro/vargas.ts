// Divisional charts (vargas) per classical Parashari rules.
// All functions take a sidereal longitude and return a sign index 0–11.

import { norm360 } from "./constants";

export type VargaKey =
  | "D1" | "D2" | "D3" | "D4" | "D7" | "D9" | "D10" | "D12"
  | "D16" | "D20" | "D24" | "D27" | "D30" | "D40" | "D45" | "D60";

export const VARGA_LIST: { key: VargaKey; name: string; signifies: string }[] = [
  { key: "D1", name: "Rasi", signifies: "Overall life" },
  { key: "D2", name: "Hora", signifies: "Wealth" },
  { key: "D3", name: "Drekkana", signifies: "Siblings, courage" },
  { key: "D4", name: "Chaturthamsa", signifies: "Property, fortune" },
  { key: "D7", name: "Saptamsa", signifies: "Children" },
  { key: "D9", name: "Navamsa", signifies: "Marriage, dharma" },
  { key: "D10", name: "Dasamsa", signifies: "Career" },
  { key: "D12", name: "Dwadasamsa", signifies: "Parents" },
  { key: "D16", name: "Shodasamsa", signifies: "Vehicles, comforts" },
  { key: "D20", name: "Vimsamsa", signifies: "Spiritual progress" },
  { key: "D24", name: "Chaturvimsamsa", signifies: "Learning, education" },
  { key: "D27", name: "Bhamsa", signifies: "Strengths, weaknesses" },
  { key: "D30", name: "Trimsamsa", signifies: "Misfortunes" },
  { key: "D40", name: "Khavedamsa", signifies: "Maternal legacy" },
  { key: "D45", name: "Akshavedamsa", signifies: "Paternal legacy, character" },
  { key: "D60", name: "Shashtiamsa", signifies: "Past karma" },
];

export function vargaSign(siderealLon: number, key: VargaKey): number {
  const lon = norm360(siderealLon);
  const sign = Math.floor(lon / 30) % 12;
  const deg = lon % 30;
  const isOdd = sign % 2 === 0; // Aries(0) is an odd sign in Vedic counting
  // modality: 0 movable (chara), 1 fixed (sthira), 2 dual (dwiswabhava)
  const modality = sign % 3;

  switch (key) {
    case "D1":
      return sign;
    case "D2": {
      // Hora: odd signs — first half Sun (Leo), second Moon (Cancer); even reversed
      const firstHalf = deg < 15;
      if (isOdd) return firstHalf ? 4 : 3;
      return firstHalf ? 3 : 4;
    }
    case "D3": {
      // Drekkana: 1st, 5th, 9th from the sign
      const part = Math.floor(deg / 10);
      return (sign + 4 * part) % 12;
    }
    case "D4": {
      // Chaturthamsa: 1st, 4th, 7th, 10th from the sign
      const part = Math.floor(deg / 7.5);
      return (sign + 3 * part) % 12;
    }
    case "D7": {
      // Saptamsa: odd signs count from the sign, even from its 7th
      const part = Math.floor(deg / (30 / 7));
      return (sign + (isOdd ? 0 : 6) + part) % 12;
    }
    case "D9": {
      // Navamsa: continuous 3°20′ divisions from Aries
      return Math.floor(lon / (10 / 3)) % 12;
    }
    case "D10": {
      // Dasamsa: odd signs from the sign, even from its 9th
      const part = Math.floor(deg / 3);
      return (sign + (isOdd ? 0 : 8) + part) % 12;
    }
    case "D12": {
      // Dwadasamsa: twelve 2.5° parts counted from the sign itself
      const part = Math.floor(deg / 2.5);
      return (sign + part) % 12;
    }
    case "D30": {
      // Trimsamsa: unequal divisions ruled by the five tara grahas
      if (isOdd) {
        if (deg < 5) return 0;   // Mars → Aries
        if (deg < 10) return 10; // Saturn → Aquarius
        if (deg < 18) return 8;  // Jupiter → Sagittarius
        if (deg < 25) return 2;  // Mercury → Gemini
        return 6;                // Venus → Libra
      }
      if (deg < 5) return 1;     // Venus → Taurus
      if (deg < 12) return 5;    // Mercury → Virgo
      if (deg < 20) return 11;   // Jupiter → Pisces
      if (deg < 25) return 9;    // Saturn → Capricorn
      return 7;                  // Mars → Scorpio
    }
    case "D16": {
      // movable from Aries, fixed from Leo, dual from Sagittarius
      const part = Math.floor(deg / (30 / 16));
      return ([0, 4, 8][modality] + part) % 12;
    }
    case "D20": {
      // movable from Aries, fixed from Sagittarius, dual from Leo
      const part = Math.floor(deg / 1.5);
      return ([0, 8, 4][modality] + part) % 12;
    }
    case "D24": {
      // odd signs from Leo, even signs from Cancer
      const part = Math.floor(deg / 1.25);
      return ((isOdd ? 4 : 3) + part) % 12;
    }
    case "D27": {
      // fire from Aries, earth from Cancer, air from Libra, water from Capricorn
      const part = Math.floor(deg / (30 / 27));
      return ([0, 3, 6, 9][sign % 4] + part) % 12;
    }
    case "D40": {
      // odd signs from Aries, even signs from Libra
      const part = Math.floor(deg / 0.75);
      return ((isOdd ? 0 : 6) + part) % 12;
    }
    case "D45": {
      // movable from Aries, fixed from Leo, dual from Sagittarius
      const part = Math.floor(deg / (30 / 45));
      return ([0, 4, 8][modality] + part) % 12;
    }
    case "D60": {
      // Shashtiamsa: sixty 0.5° parts counted from the sign itself
      const part = Math.floor(deg / 0.5);
      return (sign + part) % 12;
    }
  }
}
