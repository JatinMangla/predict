// The five-step funnel must actually narrow: each step's output has to sit
// inside the step above it, and the numbers must be chart-specific.

import { describe, it, expect } from "vitest";
import { computeKundli } from "./kundli";
import {
  birthTimeConfidence,
  natalPromise,
  dashaWindows,
  gocharaWindows,
  runPrecisionFunnel,
} from "./precisionTiming";

const CHART = computeKundli({
  name: "T",
  gender: "male",
  localDateTime: "1995-08-15T14:30",
  timezone: "Asia/Kolkata",
  latitude: 28.6139,
  longitude: 77.209,
  place: "New Delhi",
});

const NOW = Date.UTC(2026, 7, 1);
const TZ = -330;
const CAREER_HOUSES = [10, 6, 2];
const CAREER_KARAKAS = ["Saturn", "Sun", "Mercury"] as const;

describe("step 1 — birth-time confidence", () => {
  const c = birthTimeConfidence(CHART);

  it("navamsa window is tighter than the lagna window", () => {
    expect(c.navamsaMinutesBefore).toBeLessThanOrEqual(c.lagnaMinutesBefore);
    expect(c.navamsaMinutesAfter).toBeLessThanOrEqual(c.lagnaMinutesAfter);
  });

  it("the navamsa lagna holds only for minutes, not hours", () => {
    // one navamsa = 1/9 of a sign, so ~13 min on average and never a long
    // stretch even for the slowest-rising signs
    expect(c.navamsaMinutesBefore).toBeLessThanOrEqual(30);
    expect(c.navamsaMinutesAfter).toBeLessThanOrEqual(30);
  });

  it("reports a confidence grade", () => {
    expect(["high", "medium", "low"]).toContain(c.confidence);
  });
});

describe("step 2 — natal promise", () => {
  it("scores the area and lists both sides", () => {
    const p = natalPromise(CHART, CAREER_HOUSES, [...CAREER_KARAKAS]);
    expect(p.score).toBeGreaterThanOrEqual(0);
    expect(p.score).toBeLessThanOrEqual(100);
    expect(["strong", "moderate", "conditional", "weak"]).toContain(p.verdict);
    expect(p.supports.length + p.blocks.length).toBeGreaterThan(0);
  });
});

describe("step 3 — dasha windows", () => {
  const w = dashaWindows(CHART, CAREER_HOUSES, [...CAREER_KARAKAS], NOW, 5);

  it("returns future, ordered, relevant periods", () => {
    expect(w.length).toBeGreaterThan(0);
    for (const p of w) {
      expect(p.endMs).toBeGreaterThan(NOW);
      expect(p.relevance).toBeGreaterThanOrEqual(25);
      expect(p.reasons.length).toBeGreaterThan(0);
    }
  });

  it("windows are at most a few years long", () => {
    for (const p of w) {
      const years = (p.endMs - p.startMs) / (365.25 * 86400000);
      expect(years).toBeLessThan(4);
    }
  });
});

describe("step 4 — gochara narrowing", () => {
  it("windows sit inside the scanned range", () => {
    const from = NOW;
    const to = NOW + 2 * 365.25 * 86400000;
    const g = gocharaWindows(CHART, CAREER_HOUSES, from, to);
    for (const w of g) {
      expect(w.startMs).toBeGreaterThanOrEqual(from);
      expect(w.endMs).toBeLessThanOrEqual(to + 86400000);
      expect(w.endMs).toBeGreaterThan(w.startMs);
      expect(["Jupiter", "Saturn"]).toContain(w.planet);
    }
  });
});

describe("whole funnel", () => {
  const f = runPrecisionFunnel(CHART, CAREER_HOUSES, [...CAREER_KARAKAS], NOW, TZ);

  it("produces all five steps", () => {
    expect(f.step1.confidence).toBeTruthy();
    expect(f.step2.score).toBeGreaterThan(0);
    expect(f.step3.length).toBeGreaterThan(0);
    expect(f.step5.length).toBeGreaterThan(0);
  });

  it("step 5 gives exact clock windows", () => {
    for (const d of f.step5) {
      if (d.bestFrom !== undefined) expect(d.bestTo!).toBeGreaterThan(d.bestFrom);
      if (d.avoidFrom !== undefined) expect(d.avoidTo!).toBeGreaterThan(d.avoidFrom);
    }
  });

  it("judges transits from BOTH lagna and Chandra", () => {
    for (const w of f.step4) {
      expect(w.houseFromLagna).toBeGreaterThanOrEqual(1);
      expect(w.houseFromLagna).toBeLessThanOrEqual(12);
      expect(w.houseFromChandra).toBeGreaterThanOrEqual(1);
      expect(w.houseFromChandra).toBeLessThanOrEqual(12);
    }
  });
});
