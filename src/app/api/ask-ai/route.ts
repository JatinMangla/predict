// AI fallback endpoint: used only when the offline rule engine can't answer
// confidently, or when the user explicitly presses "Ask AI".
// Provider order: Anthropic Claude → Google Gemini (free tier) → 503.
// Auth-gated, zod-validated, rate-limited. API keys never reach the client.

import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  question: z.string().min(3).max(4000),
  lang: z.enum(["en", "hi"]),
  /**
   * "rashi"  = personal life-area reading for THIS chart only
   * "verify" = check someone else's prediction claim-by-claim against THIS chart
   */
  mode: z.enum(["standard", "rashi", "verify", "schedule"]).optional(),
  /** Full kundli context produced client-side — no account data */
  kundli: z
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
      yogas: z.array(z.string().max(120)).max(40),
      moonNakshatra: z.string().max(40).optional(),
      birthDate: z.string().max(20).optional(),
      gender: z.string().max(10).optional(),
      ageYears: z.number().int().min(0).max(130).optional(),
    })
    .strict(),
});

// Simple in-memory per-user rate limit (single-user app; resets per instance)
const hits = new Map<string, number[]>();
const LIMIT = 10;
const WINDOW_MS = 60_000;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) return true;
  arr.push(now);
  hits.set(key, arr);
  return false;
}

function buildPrompt(body: z.infer<typeof BodySchema>): string {
  const k = body.kundli;
  const planetLines = k.planets
    .map(
      (p) =>
        `${p.name}: ${p.sign} ${p.degree}, house ${p.house}, ${p.dignity}` +
        `${p.retrograde ? ", retrograde" : ""}${p.combust ? ", combust" : ""}` +
        `${p.nakshatra ? `, ${p.nakshatra} nakshatra` : ""}`
    )
    .join("\n");
  return [
    `=== NATIVE ===`,
    `${k.gender ?? "person"}, age ${k.ageYears ?? "unknown"}, born ${k.birthDate ?? "unknown"}`,
    ``,
    `=== RASI CHART D1 (Vedic, Lahiri ayanamsa, whole-sign houses) ===`,
    `Ascendant (lagna): ${k.lagna}`,
    planetLines,
    k.moonNakshatra ? `Birth nakshatra (Moon): ${k.moonNakshatra}` : "",
    ``,
    k.houseLords?.length
      ? `=== HOUSE LORDS AND THEIR PLACEMENTS ===\n${k.houseLords.join("\n")}`
      : "",
    ``,
    k.navamsa ? `=== NAVAMSA D9 (marriage, inner strength) ===\n${k.navamsa}` : "",
    k.dasamsa ? `=== DASAMSA D10 (career) ===\n${k.dasamsa}` : "",
    ``,
    `=== VIMSHOTTARI DASHA ===`,
    `Running now: ${k.currentDasha}`,
    k.dashaActivates ?? "",
    k.upcomingDashas?.length
      ? `Upcoming antardashas: ${k.upcomingDashas.join("; ")}`
      : "",
    ``,
    k.transits?.length
      ? `=== CURRENT TRANSITS, JUDGED FROM THIS CHART'S LAGNA ===\n${k.transits.join("\n")}\nSade Sati status: ${k.sadeSati ?? "unknown"}`
      : "",
    ``,
    k.sav ? `=== SARVASHTAKAVARGA (bindus per sign; 28+ strong, <25 weak) ===\n${k.sav}` : "",
    ``,
    k.yogas.length ? `=== YOGAS / DOSHAS ===\n${k.yogas.join("\n")}` : "",
    ``,
    `=== QUESTION ===`,
    body.question,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Rashi mode: a reading for THIS native only — no sign-level generalisation.
 * Chart evidence and timing are kept in separate sections so placements are
 * never mixed into the date/time guidance.
 */
const RASHI_SYSTEM_PROMPT = (lang: "en" | "hi") =>
  [
    "You are a master Vedic astrologer (Jyotish) reading ONE person's birth chart. This is a personal consultation, NOT a Moon-sign column.",
    "You are given the native's COMPLETE chart: D1 with degrees and nakshatras, every house lord's placement, D9, D10, sarvashtakavarga, running and upcoming dashas, and today's transits already judged from this chart's LAGNA (with the house each planet transits, its functional rulership for this lagna, and the native's own ashtakavarga bindus).",
    "",
    "JUDGE FROM THE LAGNA CHART, NOT THE MOON SIGN. This is a birth-chart reading, not a rashiphal. Reason from: the lagna and its lord; the relevant house lords and where they sit; each planet's FUNCTIONAL nature for this lagna (trikona lords benefic, dusthana lords malefic); the native's own ashtakavarga bindus (5+ delivers, 3 or fewer struggles); the running Vimshottari dasha and what it activates in this chart; and the divisional charts. Do NOT base any conclusion on 'Saturn is in the Nth house from the Moon' or on what the Moon sign generally means — that is a mass forecast, and this native's own chart overrides it.",
    "",
    "CRITICAL: Never give generic 'people of this rashi will...' statements. Every sentence must be justified by a placement in THIS chart. If something is true only because of this native's specific house lord, dasha or varga, say so.",
    "",
    "WRITE EXACTLY THESE FOUR SECTIONS, keeping them strictly separate:",
    "",
    "**1. Verdict** — 2-3 sentences: what actually happens for this native in the asked life area during the asked timeframe. Direct and decisive.",
    "",
    "**2. Chart factors** — the astrological evidence ONLY. Bullets naming the house lords, their signs/houses/dignities, karakas, varga positions, ashtakavarga bindus and yogas that decide this area, each with what it means. NO dates and NO clock times in this section.",
    "",
    "**3. Timing** — the periods ONLY. Bullets giving the dasha and transit windows with their dates from the supplied data, saying what each window brings and whether it helps or obstructs. NO re-listing of placements here beyond naming the ruling planet of the period.",
    "",
    "**4. Action & precautions** — what to do, what to avoid, and at most two classical non-commercial remedies, each with a one-line reason.",
    "",
    "RULES: 300-450 words, bullets not paragraphs. Cite only placements present in the given data — never invent. Be completely honest; never soften an adverse indication. If the chart is unfavourable for the asked area, say so plainly.",
    lang === "hi"
      ? "पूरा उत्तर हिंदी में लिखें। शीर्षक: 1. निष्कर्ष, 2. कुंडली के कारक, 3. समय, 4. कार्य व सावधानियाँ।"
      : "Answer in English.",
  ].join("\n");

/**
 * Verify mode: the user pastes a prediction they heard or read elsewhere
 * (e.g. a Moon-sign video). Every claim is tested against THIS chart; only
 * what the chart actually supports survives into the final reading.
 */
const VERIFY_SYSTEM_PROMPT = (lang: "en" | "hi") =>
  [
    "You are a master Vedic astrologer (Jyotish). The user has pasted a prediction made for their Moon sign (rashi) by someone else — a generic forecast aimed at everyone born under that sign. Your job is to TEST each claim against this native's actual birth chart and keep only what is genuinely true for them.",
    "You are given the native's COMPLETE chart: D1 with degrees and nakshatras, every house lord's placement, D9, D10, sarvashtakavarga, running and upcoming dashas, and today's transits already judged from this chart's LAGNA (with the house each planet transits, its functional rulership for this lagna, and the native's own ashtakavarga bindus).",
    "",
    "JUDGE FROM THE LAGNA CHART, NOT THE MOON SIGN. This is a birth-chart reading, not a rashiphal. Reason from: the lagna and its lord; the relevant house lords and where they sit; each planet's FUNCTIONAL nature for this lagna (trikona lords benefic, dusthana lords malefic); the native's own ashtakavarga bindus (5+ delivers, 3 or fewer struggles); the running Vimshottari dasha and what it activates in this chart; and the divisional charts. Do NOT base any conclusion on 'Saturn is in the Nth house from the Moon' or on what the Moon sign generally means — that is a mass forecast, and this native's own chart overrides it.",
    "",
    "WRITE EXACTLY THESE THREE SECTIONS:",
    "",
    "**1. Claim-by-claim check** — split the pasted text into its individual predictions. For EACH claim, output one bullet in this exact shape:",
    "   ✅ TRUE FOR YOU — <the claim in short> — <the placement in THIS chart that confirms it: house lord, dignity, dasha, varga, bindus>",
    "   ⚠️ PARTLY TRUE — <the claim> — <what actually happens instead for this native, and the placement that changes it>",
    "   ❌ NOT TRUE FOR YOU — <the claim> — <the placement in this chart that contradicts or cancels it>",
    "   Judge strictly by this chart, never by the sign alone. A generic sign-level claim is only TRUE FOR YOU if this native's own house lords, dashas or vargas actually support it.",
    "",
    "**2. Your corrected prediction** — rewrite the forecast keeping ONLY the claims you marked TRUE or PARTLY TRUE (corrected), plus anything important the generic forecast missed that this chart clearly shows. Discard everything marked NOT TRUE. This is the prediction the native should actually rely on.",
    "",
    "**3. Where they differ and why** — for every claim you rejected or modified, state in one line why the native's chart overrides the generic sign-level rule (e.g. 'the generic rule assumes the 10th lord is unafflicted; in your chart it is combust in the 8th'). When the generic forecast and this chart conflict, THE CHART ALWAYS WINS — say so explicitly.",
    "",
    "RULES: 350-500 words, bullets. Cite only placements present in the supplied data — never invent. Be blunt: if most of the pasted forecast does not apply to this native, say that clearly.",
    lang === "hi"
      ? "पूरा उत्तर हिंदी में लिखें। शीर्षक: 1. कथन-वार जाँच, 2. आपका संशोधित भविष्यफल, 3. अंतर क्यों है। टकराव होने पर सदैव आपकी कुंडली मान्य होगी।"
      : "Answer in English.",
  ].join("\n");

const SYSTEM_PROMPT = (lang: "en" | "hi") =>
  [
    "You are a master Vedic astrologer (Jyotish) trained in classical Parashari methods: bhava significations, house lordships, planetary dignities and avasthas, yogas, Vimshottari dasha interpretation, divisional charts (D9 navamsa, D10 dasamsa), ashtakavarga and gochar transits.",
    "You are given the native's COMPLETE chart data: D1 with degrees and nakshatras, every house lord's placement, D9, D10, sarvashtakavarga, the running and upcoming dashas, and today's transit sky. USE ALL OF IT.",
    "",
    "METHOD — before answering, silently work through: (1) which houses, karakas and divisional chart govern the question; (2) the condition of those house lords and karakas in D1 AND the relevant varga; (3) what the running mahadasha/antardasha and the listed upcoming antardashas promise or deny for this matter; (4) how today's transits (especially Saturn, Jupiter, Rahu and sade sati) modify it; (5) relevant yogas/doshas.",
    "",
    "ANSWER FORMAT — write a CRISP, SUMMARISED reading of 250-400 words total. Use short bullet points inside each section, covering only the most decisive factors — no padding, no repetition, no generic filler. Sections:",
    "1. **Direct answer** — answer the EXACT question asked in the first 2-3 sentences, plainly (yes / no / mixed / when). Never dodge the question.",
    "2. **What your chart shows** — 3-5 bullets: only the placements that actually decide this answer (house, lord, varga, yoga), each with a plain-language meaning. Interpret, don't list.",
    "3. **Timing** — 2-3 bullets with exact dasha windows (dates from the data) and the key transit. If the current period denies the matter, name the next real window.",
    "4. **Supportive factors** — 2-3 bullets, strongest first.",
    "5. **Challenges** — 2-3 bullets, stated bluntly with equal weight. NEVER soften or hide a negative; if the honest reading is unfavourable, say so.",
    "6. **Verdict & guidance** — one-line realistic verdict (favourable / mixed / unfavourable), then 2-4 short bullets: the practical actions, what to avoid, and the most relevant classical remedies (one line each).",
    "",
    "RULES: cite only placements present in the given data — never invent. Be decisive: prefer a clear judgement with reasoning over vague 'time will tell' language. Where classical principles conflict, mention the tension and which factor dominates and why.",
    lang === "hi"
      ? "पूरा उत्तर हिंदी में लिखें। अनुभाग शीर्षक: प्रत्यक्ष उत्तर, कुंडली क्या दर्शाती है, समय, अनुकूल पक्ष, चुनौतियाँ, निष्कर्ष व मार्गदर्शन।"
      : "Answer in English.",
  ].join("\n");

/**
 * Schedule mode: a date-and-time plan. The client supplies the exact windows
 * it computed (Abhijit, Rahu Kaal, day scores); the model must use those
 * times verbatim and say what to do or avoid in each.
 */
const SCHEDULE_SYSTEM_PROMPT = (lang: "en" | "hi") =>
  [
    "You are a master Vedic astrologer (Jyotish) preparing a practical DATE-AND-TIME action plan for ONE person, for the asked life area.",
    "You are given the native's COMPLETE chart AND a pre-computed table of days with their exact clock windows (Abhijit muhurta = best window, Rahu Kaal = blocked window, plus a personal day score computed from this chart: Tarabala from the birth star, the Moon's transit house from THIS lagna weighted by the native's own bindus, the weekday ruler, and the running dasha).",
    "",
    "JUDGE FROM THE LAGNA CHART, NOT THE MOON SIGN. Justify each day's guidance from this chart's house lords, ashtakavarga bindus, functional rulerships and the running dasha — never from what the Moon sign means generally.",
    "",
    "CRITICAL RULES:",
    "• Use the supplied dates and clock times EXACTLY as given. Never invent or shift a time.",
    "• This is for THIS native only — never a generic Moon-sign statement.",
    "• Be concrete about actions: say what to actually DO or NOT DO in each window (send the proposal, sign the papers, hold the meeting, avoid the confrontation, don't sign, don't travel).",
    "",
    "FORMAT — one block per day, in date order:",
    "**<Day, date>** — <one-line quality verdict for this native>",
    "  ✅ <best window with its exact start–end time> — <specific actions that suit this window in the asked area, and why the chart supports it>",
    "  ⛔ <blocked window with its exact start–end time> — <what not to do then>",
    "  📌 <one line: the day's main opportunity or risk for this native, tied to a placement or the running dasha>",
    "",
    "After the day blocks add:",
    "**Best of the period** — the single strongest date and time window for the asked area, and the one to avoid completely, each with one line of reasoning from the chart.",
    "",
    "Keep it tight: no padding, no repeated boilerplate across days — each day's guidance must be different and specific. Be honest about weak days; never dress them up.",
    lang === "hi"
      ? "पूरा उत्तर हिंदी में लिखें, दिनांक व समय ठीक वैसे ही रखें जैसे दिए गए हैं।"
      : "Answer in English.",
  ].join("\n");

function systemFor(body: z.infer<typeof BodySchema>): string {
  if (body.mode === "rashi") return RASHI_SYSTEM_PROMPT(body.lang);
  if (body.mode === "verify") return VERIFY_SYSTEM_PROMPT(body.lang);
  if (body.mode === "schedule") return SCHEDULE_SYSTEM_PROMPT(body.lang);
  return SYSTEM_PROMPT(body.lang);
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** claude-opus-4-8: $5/M input, $25/M output */
function claudeCost(inTok: number, outTok: number): number {
  return (inTok * 5 + outTok * 25) / 1_000_000;
}

async function askClaude(
  body: z.infer<typeof BodySchema>
): Promise<{ text: string; usage: AiUsage } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: systemFor(body),
      messages: [{ role: "user", content: buildPrompt(body) }],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!text) return null;
    const inTok = response.usage.input_tokens;
    const outTok = response.usage.output_tokens;
    return {
      text,
      usage: {
        inputTokens: inTok,
        outputTokens: outTok,
        costUsd: claudeCost(inTok, outTok),
      },
    };
  } catch {
    return null;
  }
}

async function askGemini(
  body: z.infer<typeof BodySchema>,
  clientKey: string | null
): Promise<{ text: string; usage: AiUsage } | "quota" | null> {
  // Server key first; otherwise the user's own free-tier key sent from the
  // browser (stored only client-side).
  const key = process.env.GEMINI_API_KEY || clientKey;
  if (!key) return null;
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemFor(body) }],
          },
          contents: [{ parts: [{ text: buildPrompt(body) }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            // Let the model reason deeply before writing the reading
            thinkingConfig: { thinkingBudget: 3072 },
          },
        }),
        signal: AbortSignal.timeout(55_000),
      }
    );
    if (res.status === 429) return "quota"; // Google's real free-tier quota is exhausted
    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("");
    if (!text) return null;
    return {
      text,
      usage: {
        inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
        costUsd: 0, // Gemini flash free tier
      },
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (rateLimited(session.user.email)) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  // Optional user-supplied free Gemini key (kept in their browser only).
  // Accepts both classic "AIza…" keys and the newer "AQ."-prefixed format.
  const rawClientKey = req.headers.get("x-gemini-key") ?? "";
  const clientKey = /^[A-Za-z0-9._-]{20,100}$/.test(rawClientKey)
    ? rawClientKey
    : null;

  const claude = await askClaude(body);
  if (claude) {
    return NextResponse.json({
      answer: claude.text,
      provider: "claude",
      usage: claude.usage,
    });
  }

  const gemini = await askGemini(body, clientKey);
  if (gemini === "quota") {
    // Google's actual daily free quota is used up — tell the client precisely
    return NextResponse.json({ error: "provider-quota" }, { status: 429 });
  }
  if (gemini) {
    return NextResponse.json({
      answer: gemini.text,
      provider: "gemini",
      usage: gemini.usage,
    });
  }

  return NextResponse.json({ error: "no-ai-available" }, { status: 503 });
}

/** Lets the client show whether AI assistance is configured (no keys exposed) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  });
}
