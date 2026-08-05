// Transit periods must bracket "now" and match known ingress dates.

import { describe, it, expect } from "vitest";
import { currentTransitPeriod } from "./planetPeriods";
import { siderealLongitude } from "./ephemeris";

const AT = Date.UTC(2026, 6, 15, 12); // 15 Jul 2026
const NATAL_MOON_SIGN = 9; // Capricorn
const LAGNA = 0;

describe("current transit periods", () => {
  it("entry and exit bracket the observed moment", () => {
    for (const p of ["Sun", "Moon", "Mars", "Jupiter", "Saturn"] as const) {
      const tp = currentTransitPeriod(p, NATAL_MOON_SIGN, LAGNA, AT);
      if (tp.enteredMs !== null) expect(tp.enteredMs).toBeLessThanOrEqual(AT);
      if (tp.leavesMs !== null) expect(tp.leavesMs).toBeGreaterThan(AT);
    }
  });

  it("the sign really changes at the reported boundaries", () => {
    const tp = currentTransitPeriod("Sun", NATAL_MOON_SIGN, LAGNA, AT);
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
    const tp = currentTransitPeriod("Sun", NATAL_MOON_SIGN, LAGNA, AT);
    const days = (tp.leavesMs! - tp.enteredMs!) / 86400000;
    expect(days).toBeGreaterThan(28);
    expect(days).toBeLessThan(33);
  });

  it("the Moon stays in a sign about 2.2 days", () => {
    const tp = currentTransitPeriod("Moon", NATAL_MOON_SIGN, LAGNA, AT);
    const days = (tp.leavesMs! - tp.enteredMs!) / 86400000;
    expect(days).toBeGreaterThan(1.8);
    expect(days).toBeLessThan(2.8);
  });

  it("houses from Moon and lagna are in range", () => {
    const tp = currentTransitPeriod("Jupiter", NATAL_MOON_SIGN, LAGNA, AT);
    expect(tp.houseFromMoon).toBeGreaterThanOrEqual(1);
    expect(tp.houseFromMoon).toBeLessThanOrEqual(12);
    expect(tp.houseFromLagna).toBeGreaterThanOrEqual(1);
    expect(tp.houseFromLagna).toBeLessThanOrEqual(12);
  });

  it("nodes are always retrograde", () => {
    expect(currentTransitPeriod("Rahu", NATAL_MOON_SIGN, LAGNA, AT).retrograde).toBe(true);
    expect(currentTransitPeriod("Ketu", NATAL_MOON_SIGN, LAGNA, AT).retrograde).toBe(true);
  });
});
