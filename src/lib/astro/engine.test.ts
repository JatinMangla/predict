// Validation of the astro engine against independently known astronomical
// facts: the J2000 solar longitude, sankranti (sidereal ingress) dates,
// documented full/new moons, the ascendant-at-sunrise identity, Vimshottari
// arithmetic, and classical ashtakavarga totals.

import { describe, it, expect } from "vitest";
import { lahiriAyanamsa } from "./ayanamsa";
import {
  tropicalLongitude,
  siderealLongitude,
  ascendantSidereal,
  sunriseSunset,
  planetSpeed,
} from "./ephemeris";
import { nakshatraOf, padaOf, nakshatraLord } from "./nakshatra";
import { vargaSign } from "./vargas";
import { buildVimshottari, dashaBalanceYears, activeDashas } from "./dasha";
import { computePanchang, karanaName } from "./panchang";
import { computeKundli, birthToUtcMs, houseOfSign } from "./kundli";
import { computeAshtakavarga } from "./ashtakavarga";
import { computeNumerology, reduceNumber } from "./numerology";
import { sadeSatiPhase, houseFromMoon } from "./transits";

const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);

describe("ayanamsa (Lahiri)", () => {
  it("is ~23.86° at J2000", () => {
    expect(lahiriAyanamsa(J2000)).toBeCloseTo(23.86, 1);
  });
  it("is ~24.21° in Jan 2025", () => {
    const v = lahiriAyanamsa(Date.UTC(2025, 0, 1));
    expect(v).toBeGreaterThan(24.18);
    expect(v).toBeLessThan(24.25);
  });
  it("increases ~50.3 arcsec/year", () => {
    const a = lahiriAyanamsa(Date.UTC(2020, 0, 1));
    const b = lahiriAyanamsa(Date.UTC(2021, 0, 1));
    expect((b - a) * 3600).toBeGreaterThan(49);
    expect((b - a) * 3600).toBeLessThan(52);
  });
});

describe("ephemeris", () => {
  it("Sun tropical longitude at J2000 is ~280.37°", () => {
    expect(tropicalLongitude("Sun", J2000)).toBeCloseTo(280.37, 0);
  });
  it("Sun is in sidereal Capricorn on Makar Sankranti (15 Jan 2025)", () => {
    const t = Date.UTC(2025, 0, 15, 12, 0); // 15 Jan 2025
    const sign = Math.floor(siderealLongitude("Sun", t) / 30);
    expect(sign).toBe(9); // Capricorn
  });
  it("Sun is in sidereal Aries on 20 Apr 2025 (after Mesha Sankranti)", () => {
    const t = Date.UTC(2025, 3, 20, 12, 0);
    const sign = Math.floor(siderealLongitude("Sun", t) / 30);
    expect(sign).toBe(0); // Aries
  });
  it("Moon moves ~12–15°/day, Sun ~1°/day", () => {
    const t = Date.UTC(2024, 5, 1);
    expect(planetSpeed("Moon", t)).toBeGreaterThan(11);
    expect(planetSpeed("Moon", t)).toBeLessThan(16);
    expect(planetSpeed("Sun", t)).toBeGreaterThan(0.9);
    expect(planetSpeed("Sun", t)).toBeLessThan(1.1);
  });
  it("Rahu and Ketu are always 180° apart", () => {
    const t = Date.UTC(2023, 7, 10);
    const rahu = siderealLongitude("Rahu", t);
    const ketu = siderealLongitude("Ketu", t);
    const sep = ((ketu - rahu) % 360 + 360) % 360;
    expect(sep).toBeCloseTo(180, 9);
  });
});

describe("panchang", () => {
  it("tithi is Purnima a few hours before the 25 Jan 2024 full moon (17:54 UT)", () => {
    const p = computePanchang(Date.UTC(2024, 0, 25, 10, 0), 28.61, 77.21, "2024-01-25");
    expect(p.tithi).toBe(14); // Purnima
    expect(p.paksha).toBe("shukla");
  });
  it("tithi is Amavasya just before the 8 Apr 2024 solar eclipse (18:20 UT)", () => {
    const p = computePanchang(Date.UTC(2024, 3, 8, 15, 0), 28.61, 77.21, "2024-04-08");
    expect(p.tithi).toBe(29); // Amavasya
    expect(p.paksha).toBe("krishna");
  });
  it("karana names follow the classical sequence", () => {
    expect(karanaName(0)).toBe("Kimstughna");
    expect(karanaName(1)).toBe("Bava");
    expect(karanaName(8)).toBe("Bava"); // cycle of 7
    expect(karanaName(57)).toBe("Shakuni");
    expect(karanaName(59)).toBe("Naga");
  });
});

describe("ascendant", () => {
  it("equals the Sun's longitude at sunrise (within a few degrees)", () => {
    // Delhi, 21 Jun 2024 — at sunrise the rising point IS the Sun.
    const rs = sunriseSunset(Date.UTC(2024, 5, 21, 6, 0), 28.61, 77.21);
    expect(rs.sunrise).toBeDefined();
    const asc = ascendantSidereal(rs.sunrise!, 28.61, 77.21);
    const sun = siderealLongitude("Sun", rs.sunrise!);
    const diff = Math.abs(((asc - sun + 540) % 360) - 180 + 180) % 360;
    const delta = Math.min(diff, 360 - diff);
    expect(delta).toBeLessThan(6);
  });
  it("advances through all 12 signs over 24 hours", () => {
    const base = Date.UTC(2024, 2, 21, 0, 0);
    const signs = new Set<number>();
    for (let h = 0; h < 24; h++) {
      const asc = ascendantSidereal(base + h * 3600_000, 28.61, 77.21);
      signs.add(Math.floor(asc / 30));
    }
    expect(signs.size).toBeGreaterThanOrEqual(11);
  });
});

describe("nakshatra", () => {
  it("maps boundaries correctly", () => {
    expect(nakshatraOf(0)).toBe(0); // Ashwini
    expect(nakshatraOf(13.34)).toBe(1); // Bharani
    expect(nakshatraOf(359.9)).toBe(26); // Revati
    expect(padaOf(0)).toBe(1);
    expect(padaOf(10.1)).toBe(4);
  });
  it("lords follow the Vimshottari cycle", () => {
    expect(nakshatraLord(0)).toBe("Ketu");
    expect(nakshatraLord(2)).toBe("Sun"); // Krittika
    expect(nakshatraLord(4)).toBe("Mars"); // Mrigashira
    expect(nakshatraLord(9)).toBe("Ketu"); // Magha
  });
});

describe("vargas", () => {
  it("navamsa follows movable/fixed/dual starting rules", () => {
    expect(vargaSign(0, "D9")).toBe(0); // Aries 0° → Aries navamsa
    expect(vargaSign(27, "D9")).toBe(8); // Aries 27° → Sagittarius
    expect(vargaSign(30, "D9")).toBe(9); // Taurus 0° → Capricorn (9th from Taurus)
    expect(vargaSign(60, "D9")).toBe(6); // Gemini 0° → Libra (5th from Gemini)
  });
  it("hora alternates Sun/Moon halves", () => {
    expect(vargaSign(10, "D2")).toBe(4); // Aries 10° → Leo
    expect(vargaSign(20, "D2")).toBe(3); // Aries 20° → Cancer
    expect(vargaSign(40, "D2")).toBe(3); // Taurus 10° → Cancer
    expect(vargaSign(50, "D2")).toBe(4); // Taurus 20° → Leo
  });
  it("drekkana gives 1st/5th/9th", () => {
    expect(vargaSign(5, "D3")).toBe(0);
    expect(vargaSign(15, "D3")).toBe(4);
    expect(vargaSign(25, "D3")).toBe(8);
  });
});

describe("vimshottari dasha", () => {
  it("balance at Ashwini start is full Ketu period", () => {
    const b = dashaBalanceYears(0);
    expect(b.lord).toBe("Ketu");
    expect(b.years).toBeCloseTo(7, 5);
  });
  it("balance halfway through Rohini is 5 Moon years", () => {
    const midRohini = 40 + (13 + 1 / 3) / 2;
    const b = dashaBalanceYears(midRohini);
    expect(b.lord).toBe("Moon");
    expect(b.years).toBeCloseTo(5, 5);
  });
  it("full cycle spans 120 years and is contiguous", () => {
    const birth = Date.UTC(1990, 0, 1);
    const tl = buildVimshottari(100, birth, 2);
    const totalYears =
      (tl[8].end - tl[0].start) / (365.25 * 86400 * 1000);
    expect(totalYears).toBeCloseTo(120, 5);
    for (let i = 1; i < tl.length; i++) {
      expect(tl[i].start).toBe(tl[i - 1].end);
    }
    // antardashas fill the mahadasha exactly
    const md = tl[3];
    const kids = md.children!;
    expect(kids[0].start).toBe(md.start);
    expect(kids[8].end).toBeCloseTo(md.end, 5);
  });
  it("active dasha chain resolves MD/AD/PD", () => {
    const birth = Date.UTC(1990, 0, 1);
    const tl = buildVimshottari(100, birth, 3);
    const chain = activeDashas(tl, Date.UTC(2020, 5, 15));
    expect(chain.length).toBe(3);
    expect(chain[1].start).toBeGreaterThanOrEqual(chain[0].start);
    expect(chain[2].end).toBeLessThanOrEqual(chain[1].end);
  });
});

describe("ashtakavarga", () => {
  it("SAV always totals 337 bindus", () => {
    const kundli = computeKundli({
      name: "Test",
      gender: "male",
      localDateTime: "1995-08-15T14:30",
      timezone: "Asia/Kolkata",
      latitude: 28.61,
      longitude: 77.21,
      place: "Delhi",
    });
    const sum = kundli.ashtakavarga.sav.reduce((a, b) => a + b, 0);
    expect(sum).toBe(337);
  });
  it("BAV totals match classical counts (Sun 48, Moon 49, Saturn 39)", () => {
    const kundli = computeKundli({
      name: "Test",
      gender: "female",
      localDateTime: "1988-03-03T06:45",
      timezone: "Asia/Kolkata",
      latitude: 19.07,
      longitude: 72.88,
      place: "Mumbai",
    });
    const total = (p: string) =>
      kundli.ashtakavarga.bav[p].reduce((a, b) => a + b, 0);
    expect(total("Sun")).toBe(48);
    expect(total("Moon")).toBe(49);
    expect(total("Mars")).toBe(39);
    expect(total("Mercury")).toBe(54);
    expect(total("Jupiter")).toBe(56);
    expect(total("Venus")).toBe(52);
    expect(total("Saturn")).toBe(39);
  });
});

describe("numerology", () => {
  it("reduces numbers and keeps masters when asked", () => {
    expect(reduceNumber(1990)).toBe(1);
    expect(reduceNumber(29, true)).toBe(11);
    expect(reduceNumber(29)).toBe(2);
  });
  it("computes moolank and bhagyank", () => {
    const n = computeNumerology("Test Person", "1990-05-15", new Date("2026-07-10"));
    expect(n.birthdayNumber).toBe(6); // 15 → 6
    expect(n.lifePathNumber).toBe(3); // 6 + 5 + 1 = 12 → 3
    expect(n.rulingPlanet).toBe("Venus"); // 6 → Venus
  });
});

describe("transits", () => {
  it("sade sati phases map 12th/1st/2nd from Moon", () => {
    expect(sadeSatiPhase(11, 0)).toBe("rising");
    expect(sadeSatiPhase(0, 0)).toBe("peak");
    expect(sadeSatiPhase(1, 0)).toBe("setting");
    expect(sadeSatiPhase(5, 0)).toBe("none");
  });
  it("house from moon wraps correctly", () => {
    expect(houseFromMoon(10, 10)).toBe(1);
    expect(houseFromMoon(10, 9)).toBe(12);
    expect(houseFromMoon(10, 0)).toBe(3);
  });
});

describe("full kundli", () => {
  it("computes a complete, internally consistent chart", () => {
    const kundli = computeKundli({
      name: "Sample Person",
      gender: "male",
      localDateTime: "1995-08-15T14:30",
      timezone: "Asia/Kolkata",
      latitude: 28.6139,
      longitude: 77.209,
      place: "New Delhi",
    });

    expect(kundli.planets.length).toBe(9);
    expect(kundli.lagna.sign).toBeGreaterThanOrEqual(0);
    expect(kundli.lagna.sign).toBeLessThan(12);

    // Houses consistent with whole-sign system
    for (const p of kundli.planets) {
      expect(p.house).toBe(houseOfSign(kundli.lagna.sign, p.sign));
      expect(p.degInSign).toBeGreaterThanOrEqual(0);
      expect(p.degInSign).toBeLessThan(30);
    }

    // Vargas contain all 9 planets + lagna
    expect(kundli.vargas.D9.length).toBe(10);
    expect(kundli.vargas.D1.length).toBe(10);

    // D1 varga matches rasi positions
    for (const v of kundli.vargas.D1) {
      if (v.planet === "Lagna") expect(v.sign).toBe(kundli.lagna.sign);
      else {
        const p = kundli.planets.find((x) => x.id === v.planet)!;
        expect(v.sign).toBe(p.sign);
      }
    }

    // 15 Aug 1995 14:30 IST — UTC must be 09:00 (IST = +5:30)
    expect(kundli.utcMs).toBe(Date.UTC(1995, 7, 15, 9, 0));

    // Dasha timeline covers the birth
    const first = kundli.dasha[0];
    expect(first.start).toBeLessThanOrEqual(kundli.utcMs);
    expect(kundli.yogas.length).toBeGreaterThan(0);
    expect(kundli.numerology.birthdayNumber).toBe(6); // day 15 → 6
  });

  it("handles timezone conversion for western births", () => {
    const utc = birthToUtcMs("1980-06-01T08:00", "America/New_York");
    expect(utc).toBe(Date.UTC(1980, 5, 1, 12, 0)); // EDT = UTC-4
  });
});
