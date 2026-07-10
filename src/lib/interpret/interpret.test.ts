import { describe, it, expect } from "vitest";
import { computeKundli } from "@/lib/astro/kundli";
import { answerQuestion, detectIntent, ESCALATE_THRESHOLD } from "./qa";
import { dailyPrediction, weeklyPrediction, monthlyPrediction, yearlyPrediction } from "./predictions";
import { planetReading, currentDashaReading } from "./reading";

const kundli = computeKundli({
  name: "Test Person",
  gender: "male",
  localDateTime: "1995-08-15T14:30",
  timezone: "Asia/Kolkata",
  latitude: 28.6139,
  longitude: 77.209,
  place: "New Delhi",
});

const NOW = Date.UTC(2026, 6, 10);

describe("intent detection", () => {
  it("classifies bilingual questions", () => {
    expect(detectIntent("When will I get married?")).toBe("marriage");
    expect(detectIntent("मेरी शादी कब होगी")).toBe("marriage");
    expect(detectIntent("job promotion this year?")).toBe("career");
    expect(detectIntent("क्या मुझे विदेश जाने का योग है")).toBe("foreign");
    expect(detectIntent("will I be rich")).toBe("wealth");
    expect(detectIntent("random gibberish xyz")).toBeNull();
  });
});

describe("qa engine", () => {
  it("answers a career question with confidence and reasons in both languages", () => {
    const a = answerQuestion("How is my career?", kundli, NOW);
    expect(a.intent).toBe("career");
    expect(a.confidence).toBeGreaterThanOrEqual(55);
    expect(a.answer.en.length).toBeGreaterThan(50);
    expect(a.answer.hi.length).toBeGreaterThan(50);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
  });
  it("returns low confidence for unmappable questions (AI escalation path)", () => {
    const a = answerQuestion("what is the weather like", kundli, NOW);
    expect(a.intent).toBe("general");
    expect(a.confidence).toBeLessThan(ESCALATE_THRESHOLD);
  });
  it("always shows BOTH supportive factors and challenges (unbiased)", () => {
    for (const q of ["How is my career?", "When will I get married?", "Will I be rich?"]) {
      const a = answerQuestion(q, kundli, NOW);
      expect(a.answer.en).toContain("Supportive factors:");
      expect(a.answer.en).toContain("Challenges:");
      expect(a.answer.hi).toContain("अनुकूल पक्ष:");
      expect(a.answer.hi).toContain("चुनौतियाँ:");
    }
  });
});

describe("predictions", () => {
  it("daily includes tarabala and chandra bala sections", () => {
    const p = dailyPrediction(kundli, NOW);
    expect(p.period).toBe("daily");
    const titles = p.sections.map((s) => s.title.en).join(" | ");
    expect(titles).toContain("Tarabala");
    expect(titles).toContain("Chandra Bala");
    expect(p.summary.en.length).toBeGreaterThan(20);
    for (const v of Object.values(p.areas)) {
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(95);
    }
  });
  it("weekly has summary, sections, day lists", () => {
    const p = weeklyPrediction(kundli, NOW);
    expect(p.summary.en.length).toBeGreaterThan(20);
    expect(p.summary.hi.length).toBeGreaterThan(10);
    expect(p.sections.length).toBeGreaterThanOrEqual(3);
    expect((p.favourableDays?.length ?? 0) + (p.cautionDays?.length ?? 0)).toBeGreaterThan(0);
  });
  it("monthly includes transit events", () => {
    const p = monthlyPrediction(kundli, NOW);
    expect(p.sections.length).toBeGreaterThanOrEqual(4);
    expect(p.areas.career).toBeGreaterThan(0);
  });
  it("yearly includes dasha + numerology sections", () => {
    const p = yearlyPrediction(kundli, NOW);
    const titles = p.sections.map((s) => s.title.en).join(" | ");
    expect(titles).toContain("Personal Year");
    expect(p.sections.length).toBeGreaterThanOrEqual(5);
  }, 30000);
});

describe("readings", () => {
  it("produces bilingual planet readings for all 9 planets", () => {
    for (const p of kundli.planets) {
      const r = planetReading(p);
      expect(r.en.length).toBeGreaterThan(40);
      expect(r.hi.length).toBeGreaterThan(20);
    }
  });
  it("produces a dasha reading", () => {
    const r = currentDashaReading(kundli, NOW);
    expect(r.en).toContain("mahadasha");
  });
});
