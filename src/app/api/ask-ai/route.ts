// AI reading endpoint. Every reading is written from the chart the client
// computed offline; the model interprets, it never calculates.
// Provider order: Anthropic Claude → Google Gemini (free tier) → 503.
// Streams NDJSON when asked ({"type":"delta"} … {"type":"done"}) so a long
// reading appears as it is written instead of after a 30-second spinner.
// Auth-gated, zod-validated, rate-limited. API keys never reach the client.

import { NextResponse } from "next/server";
import { z } from "zod";
import { BodySchema, ChartSchema } from "@/lib/aiSchema";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import {
  geminiKeyId,
  quotaSnapshot,
  recordClaudeHeaders,
  recordGeminiCall,
  recordGeminiQuotaError,
} from "@/lib/quotaState";

export const runtime = "nodejs";
export const maxDuration = 120;

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

type Chart = z.infer<typeof ChartSchema>;

function chartBlock(k: Chart, title = "NATIVE"): string {
  const planetLines = k.planets
    .map(
      (p) =>
        `${p.name}: ${p.sign} ${p.degree}, house ${p.house}, ${p.dignity}` +
        `${p.retrograde ? ", retrograde" : ""}${p.combust ? ", combust" : ""}` +
        `${p.nakshatra ? `, ${p.nakshatra} nakshatra` : ""}`
    )
    .join("\n");
  return [
    `=== ${title} ===`,
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
    k.yogini || k.charaKarakas || k.shani
      ? `=== CROSS-CHECK SYSTEMS ===\n${[
          k.yogini && `Yogini dasha now: ${k.yogini}`,
          k.charaKarakas && `Jaimini chara karakas: ${k.charaKarakas}`,
          k.shani && `Saturn cycles (Sade Sati / Dhaiya): ${k.shani}`,
        ]
          .filter(Boolean)
          .join("\n")}`
      : "",
    k.numerology ? `=== NUMEROLOGY ===\n${k.numerology}` : "",
    k.currentPlace ? `Lives now in: ${k.currentPlace}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrompt(body: z.infer<typeof BodySchema>): string {
  const parts = [chartBlock(body.kundli, body.mode === "match" ? "PERSON A (the user)" : "NATIVE")];
  if (body.partner) parts.push("", chartBlock(body.partner, "PERSON B (the partner)"));
  if (body.history?.length) {
    parts.push(
      "",
      "=== EARLIER IN THIS CONSULTATION (for context; do not repeat it) ===",
      ...body.history.map((h, i) => `Q${i + 1}: ${h.q}\nA${i + 1}: ${h.a}`)
    );
  }
  parts.push("", body.history?.length ? "=== FOLLOW-UP QUESTION ===" : "=== QUESTION ===", body.question);
  return parts.join("\n");
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

/** Match mode: two charts, Ashtakoota already computed client-side */
const MATCH_SYSTEM_PROMPT = (lang: "en" | "hi") =>
  [
    "You are a master Vedic astrologer (Jyotish) doing a marriage-compatibility consultation for TWO people. You are given both complete charts and the Ashtakoota (36-guna) table already computed, with any classical dosha cancellations.",
    "",
    "Guna Milan alone is a Moon-sign screen. A real match reading goes further: judge each person's 7th house, 7th lord, Venus (and Jupiter for a woman's chart), the D9 navamsa lagna and its lord, Manglik status after cancellations, the running dashas of BOTH people over the next few years, and whether their charts support each other (e.g. one's lagna lord friendly to the other's; one's Moon in the other's 7th).",
    "",
    "WRITE THESE SECTIONS:",
    "**1. Verdict** — 2-3 sentences: is this a supportive match, a workable one with effort, or a difficult one? Decisive.",
    "**2. Guna Milan in plain words** — what the score and any active doshas mean, and which doshas are cancelled and why.",
    "**3. Beyond the gunas** — 3-5 bullets from the two charts themselves (7th houses, Venus, D9, Manglik, mutual placements).",
    "**4. Timing** — the dasha periods of both people that favour marriage or bring strain, with dates from the data.",
    "**5. Guidance** — practical advice for the couple and at most two classical, non-commercial remedies.",
    "",
    "RULES: 350-500 words, bullets. Cite only placements present in the data. Never frighten: an active dosha is a factor to work with, not a verdict of doom — but never hide a real difficulty either.",
    lang === "hi" ? "पूरा उत्तर हिंदी में लिखें।" : "Answer in English.",
  ].join("\n");

function systemFor(body: z.infer<typeof BodySchema>): string {
  if (body.mode === "match") return MATCH_SYSTEM_PROMPT(body.lang);
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

const CLAUDE_MODEL = "claude-opus-5-5";

/** claude-opus-5-5: $4/M input, $20/M output */
function claudeCost(inTok: number, outTok: number): number {
  return (inTok * 4 + outTok * 20) / 1_000_000;
}

type Emit = (text: string) => void;

/**
 * Claude reading, streamed through `emit`. Returns null when Claude is not
 * configured or failed BEFORE writing anything (so Gemini can take over);
 * throws if it failed mid-answer (the partial text is already on screen).
 */
async function askClaude(
  body: z.infer<typeof BodySchema>,
  emit: Emit
): Promise<{ text: string; usage: AiUsage } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  let text = "";
  try {
    const client = new Anthropic();
    const stream = client.beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      // a considered reading, not a chat reply — Opus 5.5 defaults to medium
      output_config: { effort: "high" },
      // on a safety decline the API re-runs the request on the fallback model
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      system: systemFor(body),
      messages: [{ role: "user", content: buildPrompt(body) }],
    });
    // the anthropic-ratelimit-* headers feed the quota meter
    stream
      .withResponse()
      .then(({ response }) => recordClaudeHeaders(response.headers))
      .catch(() => {});
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        text += event.delta.text;
        emit(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal" && !text) return null;
    if (!text) return null;
    const inTok = final.usage.input_tokens;
    const outTok = final.usage.output_tokens;
    return { text, usage: { inputTokens: inTok, outputTokens: outTok, costUsd: claudeCost(inTok, outTok) } };
  } catch (err) {
    if (text) throw err;
    if (err instanceof Anthropic.APIError) {
      console.error(`Claude ${err.status}: ${err.message}`);
    } else {
      console.error("Claude call failed", err);
    }
    return null;
  }
}

/** Google's 429 tells us which quota was hit; the two need different handling */
type GeminiQuotaHit = {
  kind: "quota";
  scope: "day" | "minute" | "unknown";
  retryAfterMs: number | null;
};

async function askGemini(
  body: z.infer<typeof BodySchema>,
  clientKey: string | null,
  emit: Emit
): Promise<{ text: string; usage: AiUsage } | GeminiQuotaHit | null> {
  // Server key first; otherwise the user's own free-tier key sent from the
  // browser (stored only client-side).
  const serverKey = process.env.GEMINI_API_KEY;
  const key = serverKey || clientKey;
  if (!key) return null;
  const keyId = geminiKeyId(key, Boolean(serverKey));
  let text = "";
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse",
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
        signal: AbortSignal.timeout(110_000),
      }
    );
    // The request reached Google, so it counts against the free tier whatever
    // the status turns out to be.
    recordGeminiCall(keyId);
    if (res.status === 429) {
      // Google's real quota signal — the body names the enforced limit
      const errBody = await res.json().catch(() => null);
      const { scope, retryAfterMs } = recordGeminiQuotaError(keyId, errBody);
      return { kind: "quota", scope, retryAfterMs };
    }
    if (!res.ok || !res.body) {
      console.error(`Gemini ${res.status}`);
      return null;
    }

    // Server-sent events: one JSON chunk per "data:" line
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let usageMeta: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const chunk = JSON.parse(line.slice(5));
          const parts: { text?: string; thought?: boolean }[] =
            chunk?.candidates?.[0]?.content?.parts ?? [];
          for (const p of parts) {
            if (p.thought || !p.text) continue; // never surface the model's reasoning
            text += p.text;
            emit(p.text);
          }
          if (chunk?.usageMetadata) usageMeta = chunk.usageMetadata;
        } catch {
          // a malformed chunk — skip it, the next one carries on
        }
      }
    }
    if (!text) return null;
    return {
      text,
      usage: {
        inputTokens: usageMeta?.promptTokenCount ?? 0,
        outputTokens: usageMeta?.candidatesTokenCount ?? 0,
        costUsd: 0, // Gemini flash free tier
      },
    };
  } catch (err) {
    if (text) throw err;
    console.error("Gemini call failed", err);
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

  // One pipeline for both response styles: `emit` streams deltas when the
  // client asked for a stream and is a no-op otherwise.
  const run = async (emit: Emit): Promise<{ status: number; payload: Record<string, unknown> }> => {
    const claude = await askClaude(body, emit);
    if (claude) {
      return { status: 200, payload: { answer: claude.text, provider: "claude", usage: claude.usage, quota: quotaSnapshot() } };
    }
    const gemini = await askGemini(body, clientKey, emit);
    if (gemini && "kind" in gemini) {
      // Google's own quota signal — a per-minute burst clears by itself, a
      // per-day exhaustion lasts until midnight US-Pacific.
      return {
        status: 429,
        payload: {
          error: gemini.scope === "minute" ? "provider-throttled" : "provider-quota",
          retryAfterMs: gemini.retryAfterMs,
          quota: quotaSnapshot(),
        },
      };
    }
    if (gemini) {
      return { status: 200, payload: { answer: gemini.text, provider: "gemini", usage: gemini.usage, quota: quotaSnapshot() } };
    }
    return { status: 503, payload: { error: "no-ai-available" } };
  };

  if (!body.stream) {
    try {
      const r = await run(() => {});
      return NextResponse.json(r.payload, { status: r.status });
    } catch {
      return NextResponse.json({ error: "failed" }, { status: 502 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const r = await run((text) => send({ type: "delta", text }));
        send(r.status === 200 ? { type: "done", ...r.payload } : { type: "error", status: r.status, ...r.payload });
      } catch {
        send({ type: "error", status: 502, error: "interrupted" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

/**
 * Quota + availability probe (no keys exposed). Returns whether AI assistance
 * is configured, plus the freshest limit figures the server knows: Anthropic's
 * own remaining-requests headers, and the Gemini day count corrected by
 * Google's real 429s. The client polls this on landing, after every 10 AI
 * calls, and hourly.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      claude: Boolean(process.env.ANTHROPIC_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      quota: quotaSnapshot(),
    },
    // Freshness is the whole point — never let a CDN or the browser cache it.
    { headers: { "cache-control": "no-store" } }
  );
}
