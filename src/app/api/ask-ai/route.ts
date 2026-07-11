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
  question: z.string().min(3).max(600),
  lang: z.enum(["en", "hi"]),
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
      upcomingDashas: z.array(z.string().max(120)).max(10).optional(),
      transits: z.array(z.string().max(120)).max(10).optional(),
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
    k.upcomingDashas?.length
      ? `Upcoming antardashas: ${k.upcomingDashas.join("; ")}`
      : "",
    ``,
    k.transits?.length
      ? `=== CURRENT TRANSITS (GOCHAR, today) ===\n${k.transits.join("\n")}\nSade Sati status: ${k.sadeSati ?? "unknown"}`
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
      system: SYSTEM_PROMPT(body.lang),
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
            parts: [{ text: SYSTEM_PROMPT(body.lang) }],
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
