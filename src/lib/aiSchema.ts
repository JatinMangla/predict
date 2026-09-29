// Request contract for /api/ask-ai, shared with tests so the client-built
// chart summary can never drift out of what the server accepts.

import { z } from "zod";

/** Full kundli context produced client-side — no account data */
export const ChartSchema = z
    .object({
      lagna: z.string().max(100),
      planets: z
        .array(
          z.object({
            name: z.string().max(20),
            sign: z.string().max(20),
            house: z.number().int().min(1).max(12),
            degree: z.string().max(16),
            dignity: z.string().max(20),
            retrograde: z.boolean().optional(),
            combust: z.boolean().optional(),
            nakshatra: z.string().max(30).optional(),
          })
        )
        .max(10),
      houseLords: z.array(z.string().max(160)).max(12).optional(),
      navamsa: z.string().max(500).optional(),
      dasamsa: z.string().max(500).optional(),
      sav: z.string().max(300).optional(),
      currentDasha: z.string().max(300),
      dashaActivates: z.string().max(300).optional(),
      upcomingDashas: z.array(z.string().max(120)).max(10).optional(),
      transits: z.array(z.string().max(300)).max(10).optional(),
      sadeSati: z.string().max(20).optional(),
      yogas: z.array(z.string().max(400)).max(60),
      moonNakshatra: z.string().max(40).optional(),
      birthDate: z.string().max(20).optional(),
      gender: z.string().max(10).optional(),
      ageYears: z.number().int().min(0).max(130).optional(),
      /** second-opinion systems: Yogini dasha, Jaimini karakas, Shani cycles */
      yogini: z.string().max(200).optional(),
      charaKarakas: z.string().max(300).optional(),
      shani: z.string().max(400).optional(),
      numerology: z.string().max(300).optional(),
      /** where the native lives now (drives local timings) */
      currentPlace: z.string().max(120).optional(),
    })
    .strict();

export const BodySchema = z.object({
  question: z.string().min(3).max(8000),
  lang: z.enum(["en", "hi"]),
  /**
   * "rashi"  = personal life-area reading for THIS chart only
   * "verify" = check someone else's prediction claim-by-claim against THIS chart
   * "match"  = compatibility of THIS chart with `partner`
   */
  mode: z.enum(["standard", "rashi", "verify", "schedule", "match"]).optional(),
  kundli: ChartSchema,
  /** the other chart for "match" mode */
  partner: ChartSchema.optional(),
  /** earlier turns of this consultation, oldest first, for follow-ups */
  history: z
    .array(z.object({ q: z.string().max(4000), a: z.string().max(8000) }))
    .max(4)
    .optional(),
  /** stream the answer as NDJSON */
  stream: z.boolean().optional(),
});

