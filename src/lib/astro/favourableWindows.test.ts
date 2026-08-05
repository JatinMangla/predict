// Personal date-window scoring must be driven by THIS chart, not the sign:
// two natives with different birth stars get different favourable days.

import { describe, it, expect } from "vitest";
import { computeKundli } from "./kundli";
import {
  personalDayWindows,
  bestDays,
  cautionDays,
  VARA_LORDS,
} from "./favourableWindows";

const NOW = Date.UTC(2026, 6, 15);
const TZ = -330; // IST

const kundliA = computeKundli({
  name: "A",
  gender: "male",
  localDateTime: "1995-08-15T14:30",
  timezone: "Asia/Kolkata",
  latitude: 28.6139,
  longitude: 77.209,
  place: "New Delhi",
});

const kundliB = computeKundli({
  name: "B",
  gender: "female",
  localDateTime: "1988-03-03T06:45",
  timezone: "Asia/Kolkata",
  latitude: 19.07,
  longitude: 72.88,
  place: "Mumbai",
});

describe("personal favourable windows", () => {
  const winA = personalDayWindows(kundliA, [10, 6, 2], ["Saturn", "Sun", "Mercury"], NOW, 30, TZ);

  it("covers the requested range with scored days", () => {
    expect(winA.length).toBeGreaterThanOrEqual(28);
    for (const w of winA) {
      expect(w.score).toBeGreaterThanOrEqual(0);
      expect(w.score).toBeLessThanOrEqual(100);
      expect(["excellent", "good", "mixed", "avoid"]).toContain(w.rating);
    }
  });

  it("gives favourable days an Abhijit window with start before end", () => {
    for (const w of bestDays(winA, 6)) {
      if (w.bestFrom !== undefined) {
        expect(w.bestTo!).toBeGreaterThan(w.bestFrom);
        // Abhijit is roughly midday, never longer than an hour
        expect(w.bestTo! - w.bestFrom).toBeLessThan(60 * 60 * 1000);
      }
    }
  });

  it("caution days carry a Rahu Kaal window", () => {
    for (const w of cautionDays(winA, 5)) {
      if (w.avoidFrom !== undefined) {
        expect(w.avoidTo!).toBeGreaterThan(w.avoidFrom);
      }
    }
  });

  it("is personal: two different charts get different best days", () => {
    const winB = personalDayWindows(kundliB, [10, 6, 2], ["Saturn", "Sun", "Mercury"], NOW, 30, TZ);
    const daysA = bestDays(winA, 6).map((w) => w.dayStartMs).join(",");
    const daysB = bestDays(winB, 6).map((w) => w.dayStartMs).join(",");
    expect(daysA).not.toBe(daysB);
  });

  it("weekday lord matching lifts the score for that area", () => {
    const careerWin = personalDayWindows(kundliA, [10], ["Saturn"], NOW, 30, TZ);
    const saturdays = careerWin.filter((w) => w.varaLord === "Saturn");
    expect(saturdays.length).toBeGreaterThan(0);
    expect(saturdays.every((w) => w.varaMatch)).toBe(true);
  });

  it("vara lords follow the classical weekday order", () => {
    expect(VARA_LORDS[0]).toBe("Sun");
    expect(VARA_LORDS[1]).toBe("Moon");
    expect(VARA_LORDS[6]).toBe("Saturn");
  });
});
