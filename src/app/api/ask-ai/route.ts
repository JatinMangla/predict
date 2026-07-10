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
  /** Compact kundli summary produced client-side — no account data */
  kundli: z
    .object({
      lagna: z.string().max(60),
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
      currentDasha: z.string().max(200),
      yogas: z.array(z.string().max(120)).max(40),
      moonNakshatra: z.string().max(40).optional(),
      birthDate: z.string().max(20).optional(),
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
    `Birth chart (Vedic, Lahiri ayanamsa, whole-sign houses):`,
    `Ascendant (lagna): ${k.lagna}`,
    planetLines,
    `Current Vimshottari dasha: ${k.currentDasha}`,
    k.yogas.length ? `Yogas/doshas present: ${k.yogas.join("; ")}` : "",
    k.moonNakshatra ? `Birth nakshatra: ${k.moonNakshatra}` : "",
    ``,
    `Question: ${body.question}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const SYSTEM_PROMPT = (lang: "en" | "hi") =>
  [
    "You are an expert Vedic astrologer (Jyotish) with deep knowledge of Parashari principles: house significations, planetary dignities, yogas, Vimshottari dashas and gochar transits.",
    "Read the provided birth chart carefully and answer the question specifically from THIS chart — cite the exact placements, lords, dashas or yogas that support each point.",
    "Be honest and balanced: mention both supportive and challenging factors. Offer at most one simple, non-commercial remedy if relevant.",
    "Never invent placements not present in the data. Keep the answer to 150-250 words.",
    lang === "hi"
      ? "उत्तर हिंदी में दें।"
      : "Answer in English.",
  ].join(" ");

async function askClaude(
  body: z.infer<typeof BodySchema>
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: SYSTEM_PROMPT(body.lang),
      messages: [{ role: "user", content: buildPrompt(body) }],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    return text || null;
  } catch {
    return null;
  }
}

async function askGemini(
  body: z.infer<typeof BodySchema>
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
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
          generationConfig: { maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(45_000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("");
    return text || null;
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

  const claudeAnswer = await askClaude(body);
  if (claudeAnswer) {
    return NextResponse.json({ answer: claudeAnswer, provider: "claude" });
  }

  const geminiAnswer = await askGemini(body);
  if (geminiAnswer) {
    return NextResponse.json({ answer: geminiAnswer, provider: "gemini" });
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
