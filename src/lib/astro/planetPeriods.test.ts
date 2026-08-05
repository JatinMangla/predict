// Transit periods must bracket "now" and match known ingress dates.

import { describe, it, expect } from "vitest";
import { currentTransitPeriod } from "./planetPeriods";
import { siderealLongitude } from "./ephemeris";
import { computeKundli } from "./kundli";

const AT = Date.UTC(2026, 6, 15, 12); // 15 Jul 2026
const CHART = computeKundli({
  name: "T",
  gender: "male",
  localDateTime: "1995-08-15T14:30",
  timezone: "Asia/Kolkata",
  latitude: 28.6139,
  longitude: 77.209,
  place: "New Delhi",
});

describe("current transit periods", () => {
  it("entry and exit bracket the observed moment", () => {
    for (const p of ["Sun", "Moon", "Mars", "Jupiter", "Saturn"] as const) {
      const tp = currentTransitPeriod(p, CHART, AT);
      if (tp.enteredMs !== null) expect(tp.enteredMs).toBeLessThanOrEqual(AT);
      if (tp.leavesMs !== null) expect(tp.leavesMs).toBeGreaterThan(AT);
    }
  });

  it("the sign really changes at the reported boundaries", () => {
    const tp = currentTransitPeriod("Sun", CHART, AT);
    expect(tp.enteredMs).not.toBeNull();
    expect(tp.leavesMs).not.toBeNull();
    const justBefore = Math.floor(siderealLongitude("Sun", tp.enteredMs! - 120000) / 30) % 12;
    const justAfterEntry = Math.floor(siderealLongitude("Sun", tp.enteredMs! + 120000) / 30) % 12;
    expect(justBefore).not.toBe(tp.sign);
    expect(justAfterEntry).toBe(tp.sign);
    const justBeforeExit = Math.floor(siderealLongitude("Sun", tp.leavesMs! - 120000) / 30) % 12;
    const justAfterExit = Math.floor(siderealLongitude("Sun", tp.leavesMs! + 120000) / 30) % 12;
    expect(justBeforeExit).toBe(tp.sign);
    expect(justAfterExit).not.toBe(tp.sign);
  });

  it("the Sun stays in a sign about a month", () => {
    const tp = currentTransitPeriod("Sun", CHART, AT);
    const days = (tp.leavesMs! - tp.enteredMs!) / 86400000;
    expect(days).toBeGreaterThan(28);
    expect(days).toBeLessThan(33);
  });

  it("the Moon stays in a sign about 2.2 days", () => {
    const tp = currentTransitPeriod("Moon", CHART, AT);
    const days = (tp.leavesMs! - tp.enteredMs!) / 86400000;
    expect(days).toBeGreaterThan(1.8);
    expect(days).toBeLessThan(2.8);
  });

  it("judges from the lagna chart, not the Moon sign", () => {
    const tp = currentTransitPeriod("Jupiter", CHART, AT);
    const j = tp.judgement;
    expect(j.houseFromLagna).toBe(((tp.sign - CHART.lagna.sign + 12) % 12) + 1);
    expect(j.bindus).toBe(CHART.ashtakavarga.bav.Jupiter[tp.sign]);
    expect(["benefic", "malefic", "neutral"]).toContain(j.nature);
  });

  it("nodes are always retrograde and carry no ashtakavarga row", () => {
    expect(currentTransitPeriod("Rahu", CHART, AT).retrograde).toBe(true);
    expect(currentTransitPeriod("Ketu", CHART, AT).retrograde).toBe(true);
    expect(currentTransitPeriod("Rahu", CHART, AT).judgement.bindus).toBeNull();
  });
});
