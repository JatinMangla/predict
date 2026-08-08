"use client";

// Single client-side gateway for all AI calls. There is NO artificial app
// limit — the meter tracks Google's REAL Gemini free-tier quota
// (gemini-2.5-flash: 250 requests/day, resetting at midnight US-Pacific),
// and Google's own 429 "quota exhausted" signal is surfaced directly.
//
// Google publishes no "calls remaining" endpoint, so the figure is reconciled
// from two sources: this device's durable IndexedDB log, and the server's
// count of the calls it proxied (which also folds in Google's real 429s and
// Anthropic's anthropic-ratelimit-* headers). Whichever has seen more calls
// wins, so the meter never flatters itself.
//
// The server figure is re-fetched on three triggers: landing on a screen that
// shows it, after every 10 AI calls, and once an hour.

import { db, getSetting, setSetting } from "./db";
import { ptDateStr, ptDayStartMs } from "./ptDay";
import type { Kundli } from "./astro/types";
import { buildKundliSummary } from "./kundliSummary";

/** Gemini 2.5 Flash free tier: requests per day (Google-documented) */
export const GEMINI_FREE_RPD = 250;

/** Re-fetch the server's quota figures at least this often */
export const QUOTA_MAX_AGE_MS = 60 * 60 * 1000;
/** …and always after this many AI calls, whatever the clock says */
export const QUOTA_REFRESH_EVERY_CALLS = 10;

export interface AiConfig {
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

/** Anthropic's own remaining limits, read from its response headers */
export interface ClaudeLimits {
  requestsLimit: number | null;
  requestsRemaining: number | null;
  requestsResetAt: string | null;
  inputTokensRemaining: number | null;
  outputTokensRemaining: number | null;
  tokensResetAt: string | null;
  observedAt: number;
}

/** The server's view of the providers' quotas */
export interface RemoteQuota {
  fetchedAt: number;
  pacificDate: string;
  resetAt: number;
  gemini: {
    limit: number;
    used: number;
    remaining: number;
    exhausted: boolean;
    throttledUntil: number | null;
    limitConfirmed: boolean;
    observedAt: number | null;
  };
  claude: ClaudeLimits | null;
}

export async function getAiConfig(): Promise<AiConfig> {
  const key = await getSetting("geminiKey");
  const remote = await refreshQuota();
  return {
    geminiKey: key ?? "",
    serverClaude: remote.serverClaude,
    serverGemini: remote.serverGemini,
  };
}

export async function setAiSetting(
  key: "geminiKey",
  value: string
): Promise<void> {
  await setSetting(key, value);
}

/** Is any AI provider reachable (server keys or a local Gemini key)? */
export function aiAvailable(cfg: AiConfig): boolean {
  return cfg.serverClaude || cfg.serverGemini || cfg.geminiKey.length > 0;
}

// ── Quota cache and its refresh policy ──────────────────────────────

interface QuotaCache {
  serverClaude: boolean;
  serverGemini: boolean;
  quota: RemoteQuota | null;
  /** when the server was last successfully reached (0 = never) */
  syncedAt: number;
  /** AI calls made since that sync — forces a re-fetch at 10 */
  callsSinceSync: number;
}

let cache: QuotaCache = {
  serverClaude: false,
  serverGemini: false,
  quota: null,
  syncedAt: 0,
  callsSinceSync: 0,
};

let inFlight: Promise<QuotaCache> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Notified whenever the quota figures change, so every meter stays in sync */
export function subscribeQuota(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}

/** Has the cached figure aged out, run past 10 calls, or crossed into a new PT day? */
export function quotaIsStale(now = Date.now()): boolean {
  if (cache.syncedAt === 0) return true;
  if (cache.callsSinceSync >= QUOTA_REFRESH_EVERY_CALLS) return true;
  if (now - cache.syncedAt >= QUOTA_MAX_AGE_MS) return true;
  // A day boundary invalidates the count even if the sync is minutes old.
  return cache.quota !== null && cache.quota.pacificDate !== ptDateStr(now);
}

/** Adopt a snapshot that rode along on an AI call response — free freshness */
function adoptQuota(quota: RemoteQuota | undefined | null): void {
  if (!quota) return;
  cache = { ...cache, quota, syncedAt: Date.now(), callsSinceSync: 0 };
  notify();
}

/**
 * Fetch the server's quota figures. Skipped when the cache is still fresh
 * unless `force` is set; concurrent callers share one request.
 */
export async function refreshQuota(force = false): Promise<QuotaCache> {
  if (!force && !quotaIsStale()) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/ask-ai", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        cache = {
          serverClaude: Boolean(d.claude),
          serverGemini: Boolean(d.gemini),
          quota: (d.quota as RemoteQuota) ?? null,
          syncedAt: Date.now(),
          callsSinceSync: 0,
        };
        notify();
      }
    } catch {
      // offline — keep the last known figures and stay marked stale
    } finally {
      inFlight = null;
    }
    return cache;
  })();

  return inFlight;
}

export interface UsageSummary {
  /** Gemini calls made this Pacific day (Google's real quota window) */
  geminiCallsToday: number;
  /** Actual remaining free Gemini calls today */
  geminiRemaining: number;
  /** The enforced daily limit — Google's own number once a 429 confirmed it */
  geminiLimit: number;
  /** Google itself said the daily quota is gone */
  exhausted: boolean;
  /** A per-minute burst limit is in force until this time */
  throttledUntil: number | null;
  /** Next Pacific midnight, when the free quota resets */
  resetAt: number | null;
  /** When the server figures were last fetched (0 = never reached) */
  syncedAt: number;
  /** True when those figures are past their refresh triggers */
  stale: boolean;
  /** Anthropic's own reported remaining limits, if Claude has been used */
  claude: ClaudeLimits | null;
  costTodayUsd: number;
  cost30dUsd: number;
}

/**
 * The meter. Reconciles this device's durable call log with the server's
 * count; the higher of the two wins, and Google's own 429 overrides both.
 */
export async function getUsageSummary(): Promise<UsageSummary> {
  const ptStart = ptDayStartMs();
  const cutoff30 = Date.now() - 30 * 86400 * 1000;
  const ptRows = await db.aiUsage.where("createdAt").above(ptStart).toArray();
  const monthRows = await db.aiUsage.where("createdAt").above(cutoff30).toArray();
  const localGemini = ptRows.filter((r) => r.provider === "gemini").length;

  const remote = cache.quota;
  const limit = remote?.gemini.limit ?? GEMINI_FREE_RPD;
  // The server restarts and loses its count; this device only sees its own
  // calls. Trusting the larger figure keeps the meter honest either way.
  const used = Math.max(localGemini, remote?.gemini.used ?? 0);
  const exhausted = remote?.gemini.exhausted ?? false;

  return {
    geminiCallsToday: used,
    geminiRemaining: exhausted ? 0 : Math.max(0, limit - used),
    geminiLimit: limit,
    exhausted,
    throttledUntil: remote?.gemini.throttledUntil ?? null,
    resetAt: remote?.resetAt ?? null,
    syncedAt: cache.syncedAt,
    stale: quotaIsStale(),
    claude: remote?.claude ?? null,
    costTodayUsd: ptRows.reduce((s, r) => s + r.costUsd, 0),
    cost30dUsd: monthRows.reduce((s, r) => s + r.costUsd, 0),
  };
}

export type AiCallError = "quota-exhausted" | "throttled" | "unavailable" | "failed";

/** Translation key explaining a failed AI call */
export function aiErrorKey(
  err: AiCallError
): "aiQuotaExhausted" | "aiThrottled" | "aiUnavailable" {
  if (err === "quota-exhausted") return "aiQuotaExhausted";
  if (err === "throttled") return "aiThrottled";
  return "aiUnavailable";
}

/** Make one AI call; usage recorded for the real-quota meter. */
export async function callAi(
  question: string,
  kundli: Kundli,
  lang: "en" | "hi",
  cfg: AiConfig,
  /** "rashi" = personal life-area reading; "verify" = test a pasted forecast */
  mode: "standard" | "rashi" | "verify" | "schedule" = "standard"
): Promise<AiCallResult | AiCallError> {
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
        mode,
        kundli: buildKundliSummary(kundli),
      }),
    });
    cache.callsSinceSync += 1;

    if (!res.ok) {
      if (res.status === 429) {
        // Google's real quota signal — the response carries fresh figures
        const data = await res.json().catch(() => null);
        adoptQuota(data?.quota);
        return data?.error === "provider-throttled"
          ? "throttled"
          : "quota-exhausted";
      }
      void refreshQuota();
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
    // Every answer carries the server's fresh figures; the 10-call and hourly
    // triggers below only have to cover calls that failed to return one.
    adoptQuota(data?.quota);
    void refreshQuota();
    notify();
    return { answer: data.answer, provider: data.provider, costUsd };
  } catch {
    cache.callsSinceSync += 1;
    notify();
    return "failed";
  }
}

export function fmtCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(2)}`;
}

/** "3h 12m" — a coarse duration label for quota reset / last-sync lines */
export function fmtDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** How long until the free quota resets */
export function fmtUntil(target: number, now = Date.now()): string {
  return fmtDuration(target - now);
}
