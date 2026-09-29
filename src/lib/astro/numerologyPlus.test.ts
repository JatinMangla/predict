import { describe, it, expect } from "vitest";
import {
  chaldeanCompound,
  compoundMeaningFor,
  loShu,
  kuaNumber,
  pinnacles,
  numberRelation,
  checkName,
} from "./numerologyPlus";

describe("Chaldean", () => {
  it("uses Cheiro's values (no letter is 9)", () => {
    // J1 O7 H5 N5 = 18
    expect(chaldeanCompound("John")).toBe(18);
    expect(chaldeanCompound("a-b c")).toBe(1 + 2 + 3);
  });
  it("folds compounds above 52 and fills the 33–50 gaps", () => {
    expect(compoundMeaningFor(19)?.tone).toBe("fortunate");
    expect(compoundMeaningFor(33)?.number).toBe(24);
    expect(compoundMeaningFor(61)?.number).toBe(43); // 61 − 9 = 52 → 43
    expect(compoundMeaningFor(7)).toBeNull();
  });
});

describe("Lo Shu", () => {
  it("counts DOB digits plus driver and conductor, ignoring zeros", () => {
    // 1990-01-15 → 1,9,9,0,0,1,1,5 ; driver 6, conductor 8 (1+1+5+1+9+9+0 = 26 → 8)
    const g = loShu("1990-01-15", 6, 8);
    expect(g.counts[1]).toBe(3);
    expect(g.counts[9]).toBe(2);
    expect(g.counts[5]).toBe(1);
    expect(g.missing).toEqual([2, 3, 4, 7]);
    expect(g.completePlanes).toContain("will"); // 9, 5, 1
  });
});

describe("Kua", () => {
  it("matches published values", () => {
    expect(kuaNumber("1985-06-01", "male").kua).toBe(6);
    expect(kuaNumber("1985-06-01", "female").kua).toBe(9);
    expect(kuaNumber("2000-06-01", "male").kua).toBe(9);
    expect(kuaNumber("2000-06-01", "female").kua).toBe(6);
    // 5 is never a Kua: male → 2, female → 8
    expect(kuaNumber("1995-06-01", "male").kua).toBe(2);
  });
  it("uses the previous year before Lichun (4 Feb)", () => {
    expect(kuaNumber("1986-01-20", "male").kua).toBe(kuaNumber("1985-06-01", "male").kua);
  });
});

describe("pinnacles", () => {
  it("first pinnacle ends at 36 minus the life path", () => {
    const p = pinnacles("1990-01-15", 8);
    expect(p[0].toAge).toBe(28);
    expect(p[1].fromAge).toBe(29);
    expect(p[3].toAge).toBeNull();
    expect(p[0].pinnacle).toBe(7); // 1 + 6
  });
});

describe("name compatibility", () => {
  it("relates numbers through their ruling planets", () => {
    expect(numberRelation(1, 9)).toBe("friendly"); // Sun–Mars
    expect(numberRelation(1, 8)).toBe("hostile"); // Sun–Saturn
    expect(numberRelation(3, 3)).toBe("friendly");
  });
  it("suggests only numbers that clash with neither birth number", () => {
    const c = checkName("Test", 1, 8);
    for (const n of c.suggestedNumbers) {
      expect(numberRelation(n, 1)).not.toBe("hostile");
      expect(numberRelation(n, 8)).not.toBe("hostile");
    }
  });
});
