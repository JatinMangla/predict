import { describe, it, expect } from "vitest";
import { ashtakoota, nadiOf, matchKundlis } from "./matching";
import { computeKundli } from "./kundli";

const moon = (nakshatra: number, pada = 1) => {
  const longitude = nakshatra * (360 / 27) + (pada - 0.5) * (360 / 108);
  return { nakshatra, pada, longitude, sign: Math.floor(longitude / 30) };
};
const total = (k: ReturnType<typeof ashtakoota>) => k.reduce((s, x) => s + x.score, 0);
const get = (k: ReturnType<typeof ashtakoota>, key: string) => k.find((x) => x.key === key)!;

describe("ashtakoota", () => {
  it("scores the textbook 28/36 for the same star and sign, with Nadi dosha", () => {
    const k = ashtakoota(moon(0), moon(0));
    expect(total(k)).toBe(28);
    expect(get(k, "nadi").score).toBe(0);
    expect(get(k, "nadi").cancelledBy).toBeUndefined();
  });

  it("cancels Nadi dosha for the same star in different padas", () => {
    const k = ashtakoota(moon(0, 1), moon(0, 3));
    expect(get(k, "nadi").score).toBe(0);
    expect(get(k, "nadi").cancelledBy).toBeDefined();
  });

  it("the maximum is 36", () => {
    const max = ashtakoota(moon(0), moon(0)).reduce((s, x) => s + x.max, 0);
    expect(max).toBe(36);
  });

  it("nadi follows the Adi-Madhya-Antya zigzag", () => {
    // Ashwini Adi, Bharani Madhya, Krittika Antya, Rohini Antya, Mrigashira Madhya, Ardra Adi
    expect([0, 1, 2, 3, 4, 5, 6].map(nadiOf)).toEqual([0, 1, 2, 2, 1, 0, 0]);
    expect(nadiOf(26)).toBe(2); // Revati Antya
  });

  it("gives Bhakoot 0 for Moons 6/8 apart (Aries–Virgo)", () => {
    const k = ashtakoota(moon(0), moon(12)); // Ashwini (Aries) × Hasta (Virgo)
    expect(get(k, "bhakoot").score).toBe(0);
  });

  it("sworn-enemy yonis score 0 (Horse × Buffalo)", () => {
    const k = ashtakoota(moon(0), moon(12)); // Ashwini horse × Hasta buffalo
    expect(get(k, "yoni").score).toBe(0);
  });

  it("every score stays within its koota's range", () => {
    for (let a = 0; a < 27; a += 2) {
      for (let b = 0; b < 27; b += 3) {
        for (const x of ashtakoota(moon(a, 2), moon(b, 4))) {
          expect(x.score).toBeGreaterThanOrEqual(0);
          expect(x.score).toBeLessThanOrEqual(x.max);
        }
      }
    }
  });
});

describe("matchKundlis", () => {
  it("returns a verdict band consistent with the total", () => {
    const a = computeKundli({ name: "A", gender: "male", localDateTime: "1992-04-10T08:15", timezone: "Asia/Kolkata", latitude: 28.61, longitude: 77.21, place: "Delhi" });
    const b = computeKundli({ name: "B", gender: "female", localDateTime: "1994-11-23T19:40", timezone: "Asia/Kolkata", latitude: 19.07, longitude: 72.88, place: "Mumbai" });
    const r = matchKundlis(a, b);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(36);
    const band = r.total >= 32 ? "excellent" : r.total >= 25 ? "good" : r.total >= 18 ? "average" : "poor";
    expect(r.verdict).toBe(band);
    expect(r.manglik.balanced).toBe(r.manglik.groom === r.manglik.bride);
  });
});
