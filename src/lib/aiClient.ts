"use client";

// Single client-side gateway for all AI calls. There is NO artificial app
// limit — the meter tracks Google's REAL Gemini free-tier quota
// (gemini-2.5-flash: 250 requests/day, resetting at midnight US-Pacific),
// and Google's own 429 "quota exhausted" signal is surfaced directly.

import { db, getSetting, setSetting } from "./db";
import type { Kundli } from "./astro/types";
import { buildKundliSummary } from "./kundliSummary";

export type AiMode = "always" | "fallback" | "never";

/** Gemini 2.5 Flash free tier: requests per day (Google-documented) */
export const GEMINI_FREE_RPD = 250;

export interface AiConfig {
  mode: AiMode;
  geminiKey: string;
  /** server-side keys present? */
  serverClaude: boolean;
  serverGemini: boolean;
}

export interface AiCallResult {
  answer: string;
  provider: string;
  costUsd: number;
}

export async function getAiConfig(): Promise<AiConfig> {
  const [mode, key] = await Promise.all([
    getSetting("aiMode"),
    getSetting("geminiKey"),
  ]);
  let serverClaude = false;
  let serverGemini = false;
  try {
    const res = await fetch("/api/ask-ai");
    if (res.ok) {
      const d = await res.json();
      serverClaude = Boolean(d.claude);
      serverGemini = Boolean(d.gemini);
    }
  } catch {
    // offline — server availability unknown
  }
  return {
    // AI-first by default: unset → "always"
    mode: mode === "fallback" || mode === "never" ? mode : "always",
    geminiKey: key ?? "",
    serverClaude,
    serverGemini,
  };
}

export async function setAiSetting(
  key: "aiMode" | "geminiKey",
  value: string
): Promise<void> {
  await setSetting(key, value);
}

/** Is any AI provider reachable (server keys or a local Gemini key)? */
export function aiAvailable(cfg: AiConfig): boolean {
  return cfg.serverClaude || cfg.serverGemini || cfg.geminiKey.length > 0;
}

/** yyyy-mm-dd in US-Pacific time — Google's quota-reset boundary */
function ptDateStr(ms = Date.now()): string {
  return new Date(ms).toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

/** UTC ms of the current Pacific day's start */
function ptDayStartMs(): number {
  // walk back until the PT date changes (max 24h+1)
  const today = ptDateStr();
  let ms = Date.now();
  let step = 6 * 3600 * 1000;
  while (step >= 60 * 1000) {
    while (ptDateStr(ms - step) === today) ms -= step;
    step = Math.floor(step / 4);
  }
  return ms;
}

export interface UsageSummary {
  /** Gemini calls made this Pacific day (Google's real quota window) */
  geminiCallsToday: number;
  /** Actual remaining free Gemini calls today */
  geminiRemaining: number;
  costTodayUsd: number;
  cost30dUsd: number;
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const ptStart = ptDayStartMs();
  const cutoff30 = Date.now() - 30 * 86400 * 1000;
  const ptRows = await db.aiUsage.where("createdAt").above(ptStart).toArray();
  const monthRows = await db.aiUsage.where("createdAt").above(cutoff30).toArray();
  const geminiCallsToday = ptRows.filter((r) => r.provider === "gemini").length;
  return {
    geminiCallsToday,
    geminiRemaining: Math.max(0, GEMINI_FREE_RPD - geminiCallsToday),
    costTodayUsd: ptRows.reduce((s, r) => s + r.costUsd, 0),
    cost30dUsd: monthRows.reduce((s, r) => s + r.costUsd, 0),
  };
}

export type AiCallError = "quota-exhausted" | "unavailable" | "failed";

/** Make one AI call; usage recorded for the real-quota meter. */
export async function callAi(
  question: string,
  kundli: Kundli,
  lang: "en" | "hi",
  cfg: AiConfig
): Promise<AiCallResult | AiCallError> {
  if (cfg.mode === "never") return "unavailable";

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (cfg.geminiKey) headers["x-gemini-key"] = cfg.geminiKey;

    const res = await fetch("/api/ask-ai", {
      method: "POST",
      headers,
      body: JSON.stringify({
        question,
        lang,
        kundli: buildKundliSummary(kundli),
      }),
    });
    if (!res.ok) {
      if (res.status === 429) return "quota-exhausted"; // Google's real quota
      return res.status === 503 ? "unavailable" : "failed";
    }
    const data = await res.json();
    const costUsd = Number(data?.usage?.costUsd ?? 0);
    await db.aiUsage.add({
      date: ptDateStr(),
      provider: data.provider ?? "unknown",
      inputTokens: Number(data?.usage?.inputTokens ?? 0),
      outputTokens: Number(data?.usage?.outputTokens ?? 0),
      costUsd,
      createdAt: Date.now(),
    });
    return { answer: data.answer, provider: data.provider, costUsd };
  } catch {
    return "failed";
  }
}

export function fmtCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(2)}`;
}
