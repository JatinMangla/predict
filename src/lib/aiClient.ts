"use client";

// Single client-side gateway for all AI calls: enforces the user's AI mode
// and daily call limit BEFORE spending money, attaches the browser-stored
// free Gemini key, and records every call's tokens + cost for the UI meter.

import { db, getSetting, setSetting } from "./db";
import type { Kundli } from "./astro/types";
import { buildKundliSummary } from "./kundliSummary";

export type AiMode = "always" | "fallback" | "never";

export interface AiConfig {
  mode: AiMode;
  dailyLimit: number;
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

export const DEFAULT_DAILY_LIMIT = 20;

export async function getAiConfig(): Promise<AiConfig> {
  const [mode, limit, key] = await Promise.all([
    getSetting("aiMode"),
    getSetting("aiDailyLimit"),
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
    mode: mode === "always" || mode === "never" ? mode : "fallback",
    dailyLimit: Math.max(0, Number(limit) || DEFAULT_DAILY_LIMIT),
    geminiKey: key ?? "",
    serverClaude,
    serverGemini,
  };
}

export async function setAiSetting(
  key: "aiMode" | "aiDailyLimit" | "geminiKey",
  value: string
): Promise<void> {
  await setSetting(key, value);
}

/** Is any AI provider reachable (server keys or a local Gemini key)? */
export function aiAvailable(cfg: AiConfig): boolean {
  return cfg.serverClaude || cfg.serverGemini || cfg.geminiKey.length > 0;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface UsageSummary {
  callsToday: number;
  costTodayUsd: number;
  cost30dUsd: number;
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const today = todayStr();
  const cutoff = Date.now() - 30 * 86400 * 1000;
  const todayRows = await db.aiUsage.where("date").equals(today).toArray();
  const monthRows = await db.aiUsage.where("createdAt").above(cutoff).toArray();
  return {
    callsToday: todayRows.length,
    costTodayUsd: todayRows.reduce((s, r) => s + r.costUsd, 0),
    cost30dUsd: monthRows.reduce((s, r) => s + r.costUsd, 0),
  };
}

export type AiCallError = "limit-reached" | "unavailable" | "failed";

/**
 * Make one AI call, limit-gated and usage-tracked.
 * Returns the answer or a typed error string.
 */
export async function callAi(
  question: string,
  kundli: Kundli,
  lang: "en" | "hi",
  cfg: AiConfig
): Promise<AiCallResult | AiCallError> {
  if (cfg.mode === "never") return "unavailable";

  const { callsToday } = await getUsageSummary();
  if (callsToday >= cfg.dailyLimit) return "limit-reached";

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
      return res.status === 503 ? "unavailable" : "failed";
    }
    const data = await res.json();
    const costUsd = Number(data?.usage?.costUsd ?? 0);
    await db.aiUsage.add({
      date: todayStr(),
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
