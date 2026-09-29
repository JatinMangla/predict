// The chart summary the browser sends must always pass the server's schema —
// a single over-long field rejects the whole AI request with a 400.

import { describe, it, expect } from "vitest";
import { ChartSchema, BodySchema } from "./aiSchema";
import { buildKundliSummary } from "./kundliSummary";
import { computeKundli } from "./astro/kundli";

const births = [
  { localDateTime: "1995-08-15T14:30", latitude: 28.61, longitude: 77.21, timezone: "Asia/Kolkata" },
  { localDateTime: "1988-03-03T06:45", latitude: 19.07, longitude: 72.88, timezone: "Asia/Kolkata" },
  { localDateTime: "1972-11-30T23:55", latitude: 51.5, longitude: -0.12, timezone: "Europe/London" },
  { localDateTime: "2003-06-21T03:10", latitude: 40.71, longitude: -74.0, timezone: "America/New_York" },
  { localDateTime: "1960-01-01T12:00", latitude: 13.08, longitude: 80.27, timezone: "Asia/Kolkata" },
  { localDateTime: "1999-12-31T18:20", latitude: -33.87, longitude: 151.2, timezone: "Australia/Sydney" },
];

describe("AI request contract", () => {
  for (const b of births) {
    it(`summary for ${b.localDateTime} ${b.timezone} passes the schema`, () => {
      const k = computeKundli({ name: "Shrimati Anjali Venkataraman", gender: "female", place: "X", ...b });
      const summary = buildKundliSummary(k, "Bengaluru, Karnataka, IN");
      const parsed = ChartSchema.safeParse(summary);
      if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues, null, 2));
      const body = BodySchema.safeParse({
        question: "When will I change jobs?",
        lang: "en",
        mode: "match",
        kundli: summary,
        partner: summary,
        history: [{ q: "a question", a: "an answer" }],
        stream: true,
      });
      expect(body.success).toBe(true);
    });
  }
});
