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
  const f = runPrecisionFunnel(
    CHART,
    CAREER_HOUSES,
    [...CAREER_KARAKAS],
    { kind: "monthly", fromMs: NOW, days: 30 },
    TZ
  );

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

describe("scoped funnel (daily / weekly / monthly / yearly)", () => {
  const run = (kind: "daily" | "weekly" | "monthly" | "yearly", days: number) =>
    runPrecisionFunnel(
      CHART,
      CAREER_HOUSES,
      [...CAREER_KARAKAS],
      { kind, fromMs: NOW, days },
      TZ
    );

  it("daily returns exactly the chosen day", () => {
    const f = run("daily", 1);
    expect(f.scope.kind).toBe("daily");
    expect(f.step5.length).toBe(1);
    expect(f.step5[0].dayStartMs).toBeGreaterThanOrEqual(NOW - 86400000);
  });

  it("weekly returns the seven days of the week in order", () => {
    const f = run("weekly", 7);
    expect(f.step5.length).toBe(7);
    for (let i = 1; i < f.step5.length; i++) {
      expect(f.step5[i].dayStartMs).toBeGreaterThan(f.step5[i - 1].dayStartMs);
    }
  });

  it("short scopes expose the pratyantardasha level", () => {
    const f = run("weekly", 7);
    expect(f.step3.length).toBeGreaterThan(0);
    expect(f.step3.some((w) => w.pratyantarLord !== undefined)).toBe(true);
  });

  it("long scopes stay at the antardasha level", () => {
    const f = run("yearly", 365);
    expect(f.step3.every((w) => w.pratyantarLord === undefined)).toBe(true);
  });

  it("every scope keeps step 4 inside its own window", () => {
    for (const [kind, days] of [
      ["daily", 1],
      ["weekly", 7],
      ["monthly", 30],
    ] as const) {
      const f = run(kind, days);
      for (const w of f.step4) {
        expect(w.startMs).toBeGreaterThanOrEqual(NOW);
        expect(w.startMs).toBeLessThanOrEqual(NOW + days * 86400000 + 86400000);
      }
    }
  });
});
