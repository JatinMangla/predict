import { describe, it, expect } from "vitest";
import { buildYogini, YOGINIS, choghadiya, horas, CHOGHADIYA, shaniTimeline, charaKarakas } from "./advanced";
import { computeKundli } from "./kundli";
import { vargaSign } from "./vargas";

describe("Yogini dasha", () => {
  it("starts from (nakshatra + 3) mod 8", () => {
    // Ashwini (1): 4 → Bhramari; Mrigashira (5): 8 ≡ 0 → Sankata
    expect(YOGINIS[buildYogini(1, 0)[0].yogini].name).toBe("Bhramari");
    expect(YOGINIS[buildYogini(4 * (360 / 27) + 1, 0)[0].yogini].name).toBe("Sankata");
  });
  it("runs the 36-year cycle with 8 proportional sub-periods", () => {
    const p = buildYogini(100, Date.UTC(1990, 0, 1));
    const cycle = p.slice(1, 9).reduce((s, x) => s + (x.end - x.start), 0);
    expect(cycle / (365.25 * 86400000)).toBeCloseTo(36, 6);
    const md = p[1];
    const subs = md.children!.reduce((s, x) => s + (x.end - x.start), 0);
    expect(subs).toBeCloseTo(md.end - md.start, -3);
    expect(md.children![0].yogini).toBe(md.yogini);
  });
});

describe("choghadiya", () => {
  const rise = Date.UTC(2024, 0, 7, 1, 45); // a Sunday
  const set = rise + 10.5 * 3600e3;
  const next = rise + 24 * 3600e3;
  it("Sunday day starts Udveg, night starts Shubh", () => {
    const c = choghadiya(rise, set, next, 0);
    expect(c).toHaveLength(16);
    expect(CHOGHADIYA[c[0].lord].en).toBe("Udveg");
    expect(CHOGHADIYA[c[7].lord].en).toBe("Udveg"); // 8th repeats the 1st
    expect(CHOGHADIYA[c[8].lord].en).toBe("Shubh");
  });
  it("Monday runs Amrit, Kaal, Shubh, Rog, Udveg, Char, Labh, Amrit", () => {
    const c = choghadiya(rise, set, next, 1).slice(0, 8).map((s) => CHOGHADIYA[s.lord].en);
    expect(c).toEqual(["Amrit", "Kaal", "Shubh", "Rog", "Udveg", "Char", "Labh", "Amrit"]);
  });
  it("first hora is the weekday lord; next day's first hora follows naturally", () => {
    const h = horas(rise, set, next, 0);
    expect(h[0].lord).toBe("Sun");
    expect(h).toHaveLength(24);
    // the 25th hora (Monday's first) would be the Moon: 24 steps ≡ 3 mod 7
    const order = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];
    expect(order[(order.indexOf("Sun") + 24) % 7]).toBe("Moon");
  });
});

describe("Sade Sati timeline", () => {
  it("Capricorn Moon: the cycle runs from Jan 2017 to Mar 2025", () => {
    const { sadeSati } = shaniTimeline(9, Date.UTC(2014, 0, 1), Date.UTC(2027, 0, 1));
    const c = sadeSati.find((x) => x.start < Date.UTC(2020, 0, 1) && x.end > Date.UTC(2020, 0, 1))!;
    expect(c).toBeDefined();
    expect(new Date(c.start).toISOString().slice(0, 7)).toBe("2017-01");
    expect(new Date(c.end).toISOString().slice(0, 7)).toBe("2025-03");
    expect(c.spans.map((s) => s.phase)).toContain("peak");
  });
});

describe("chara karakas", () => {
  it("ranks the seven grahas by degrees in sign", () => {
    const k = computeKundli({ name: "A", gender: "male", localDateTime: "1995-08-15T14:30", timezone: "Asia/Kolkata", latitude: 28.61, longitude: 77.21, place: "Delhi" });
    const { karakas, karakamsa } = charaKarakas(k);
    expect(karakas).toHaveLength(7);
    for (let i = 1; i < 7; i++) expect(karakas[i - 1].degInSign).toBeGreaterThanOrEqual(karakas[i].degInSign);
    const ak = k.planets.find((p) => p.id === karakas[0].planet)!;
    expect(karakamsa).toBe(vargaSign(ak.longitude, "D9"));
  });
});

describe("shodashavarga", () => {
  it("D16/D20/D24/D27/D40/D45 start from the classical signs", () => {
    expect(vargaSign(30.1, "D16")).toBe(4); // Taurus (fixed) → Leo
    expect(vargaSign(30.1, "D20")).toBe(8); // Taurus → Sagittarius
    expect(vargaSign(0.1, "D24")).toBe(4); // Aries (odd) → Leo
    expect(vargaSign(30.1, "D27")).toBe(3); // Taurus (earth) → Cancer
    expect(vargaSign(30.1, "D40")).toBe(6); // Taurus (even) → Libra
    expect(vargaSign(60.1, "D45")).toBe(8); // Gemini (dual) → Sagittarius
  });
});
