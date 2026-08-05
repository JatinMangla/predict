// Judgement must come from the lagna chart: two natives with the SAME Moon
// sign but different lagnas must get different verdicts for the same transit.

import { describe, it, expect } from "vitest";
import { computeKundli } from "./kundli";
import {
  rulesHouses,
  functionalNature,
  binduFor,
  judgeTransit,
  dashaContext,
} from "./chartJudgement";

const chart = computeKundli({
  name: "T",
  gender: "male",
  localDateTime: "1995-08-15T14:30",
  timezone: "Asia/Kolkata",
  latitude: 28.6139,
  longitude: 77.209,
  place: "New Delhi",
});

describe("rulership and functional nature (from the lagna)", () => {
  it("Aries lagna: Mars rules 1 and 8, Jupiter rules 9 and 12", () => {
    expect(rulesHouses(0, "Mars")).toEqual([1, 8]);
    expect(rulesHouses(0, "Jupiter")).toEqual([9, 12]);
    // Sun rules only the 5th → pure trikona lord → functional benefic
    expect(rulesHouses(0, "Sun")).toEqual([5]);
    expect(functionalNature(0, "Sun")).toBe("benefic");
  });

  it("Aries lagna: Mercury rules 3 and 6 → functional malefic", () => {
    expect(rulesHouses(0, "Mercury")).toEqual([3, 6]);
    expect(functionalNature(0, "Mercury")).toBe("malefic");
  });

  it("nodes rule no sign and are neutral", () => {
    expect(rulesHouses(0, "Rahu")).toEqual([]);
    expect(functionalNature(0, "Rahu")).toBe("neutral");
    expect(binduFor(chart, "Rahu", 3)).toBeNull();
  });

  it("the same planet has a different functional nature per lagna", () => {
    // Cancer lagna: Jupiter rules the 6th AND the 9th → mixed, so neutral
    expect(rulesHouses(3, "Jupiter")).toEqual([6, 9]);
    expect(functionalNature(3, "Jupiter")).toBe("neutral");
    // Sagittarius lagna: Sun rules only the 9th → pure trikona lord
    expect(rulesHouses(8, "Sun")).toEqual([9]);
    expect(functionalNature(8, "Sun")).toBe("benefic");
    // Sagittarius lagna: Venus rules the 6th and 11th → malefic-leaning
    expect(functionalNature(8, "Venus")).toBe("malefic");
  });
});

describe("transit judgement uses this chart, not the Moon sign", () => {
  it("bindus come from the native's own ashtakavarga", () => {
    for (let sign = 0; sign < 12; sign++) {
      const j = judgeTransit(chart, "Saturn", sign);
      expect(j.bindus).toBe(chart.ashtakavarga.bav.Saturn[sign]);
    }
  });

  it("house is counted from the lagna", () => {
    const j = judgeTransit(chart, "Jupiter", chart.lagna.sign);
    expect(j.houseFromLagna).toBe(1);
    const j7 = judgeTransit(chart, "Jupiter", (chart.lagna.sign + 6) % 12);
    expect(j7.houseFromLagna).toBe(7);
  });

  it("the same transit sign is judged differently for a different lagna", () => {
    const other = computeKundli({
      name: "O",
      gender: "female",
      localDateTime: "1995-08-15T02:30", // same day, very different lagna
      timezone: "Asia/Kolkata",
      latitude: 28.6139,
      longitude: 77.209,
      place: "New Delhi",
    });
    expect(other.lagna.sign).not.toBe(chart.lagna.sign);
    const a = judgeTransit(chart, "Saturn", 5);
    const b = judgeTransit(other, "Saturn", 5);
    expect(a.houseFromLagna).not.toBe(b.houseFromLagna);
  });

  it("scores stay in range and favourability follows the score", () => {
    for (let sign = 0; sign < 12; sign++) {
      const j = judgeTransit(chart, "Venus", sign);
      expect(j.score).toBeGreaterThanOrEqual(-100);
      expect(j.score).toBeLessThanOrEqual(100);
      expect(j.favourable).toBe(j.score >= 10);
    }
  });
});

describe("dasha context", () => {
  it("reports the running lords and the houses they activate", () => {
    const dc = dashaContext(chart, Date.UTC(2026, 6, 15));
    expect(dc).not.toBeNull();
    expect(dc!.activatesHouses.length).toBeGreaterThan(0);
    for (const h of dc!.activatesHouses) {
      expect(h).toBeGreaterThanOrEqual(1);
      expect(h).toBeLessThanOrEqual(12);
    }
    expect(["benefic", "malefic", "neutral"]).toContain(dc!.nature);
  });
});
