// Server-side quota tracker for the AI providers.
//
// There is no Google endpoint that reports "free-tier calls remaining", so the
// Gemini figure is a count the server keeps of the calls it has actually
// proxied, corrected whenever Google tells us the truth: a real 429 carries a
// QuotaFailure with the enforced quotaValue and a RetryInfo delay.
//
// Anthropic is different — every response carries anthropic-ratelimit-* headers
// with the real remaining requests and tokens, so those are recorded verbatim.
//
// State is per server instance and resets on cold start; the browser keeps its
// own durable count in IndexedDB and the two are reconciled on the client.

import { createHash } from "crypto";
import { ptDateStr, ptDayEndMs } from "./ptDay";

/** Gemini Flash free tier: requests per day (Google-documented default) */
export const GEMINI_FREE_RPD = 250;

/** Real remaining limits, straight from Anthropic's response headers */
export interface ClaudeLimits {
  requestsLimit: number | null;
  requestsRemaining: number | null;
  requestsResetAt: string | null;
  inputTokensRemaining: number | null;
  outputTokensRemaining: number | null;
  tokensResetAt: string | null;
  /** when these headers were last seen */
  observedAt: number;
}

export interface GeminiQuota {
  /** enforced daily limit — Google's own number once a 429 has told us */
  limit: number;
  /** calls this server instance has proxied today */
  used: number;
  remaining: number;
  /** Google itself said the daily quota is gone — not our estimate */
  exhausted: boolean;
  /** a per-minute burst limit that clears on its own (ms epoch), if any */
  throttledUntil: number | null;
  /** whether `limit` is Google-confirmed or still the documented default */
  limitConfirmed: boolean;
  /** last time Google's own quota signal was seen */
  observedAt: number | null;
}

export interface QuotaSnapshot {
  fetchedAt: number;
  pacificDate: string;
  /** next Pacific midnight — when the Gemini free quota resets */
  resetAt: number;
  gemini: GeminiQuota;
  claude: ClaudeLimits | null;
}

interface QuotaStore {
  pacificDate: string;
  geminiUsed: number;
  geminiLimit: number;
  geminiLimitConfirmed: boolean;
  geminiExhausted: boolean;
  geminiThrottledUntil: number | null;
  geminiObservedAt: number | null;
  /** which key the counter belongs to; a different key means a different quota */
  geminiKeyId: string | null;
  claude: ClaudeLimits | null;
}

function freshStore(): QuotaStore {
  return {
    pacificDate: ptDateStr(),
    geminiUsed: 0,
    geminiLimit: GEMINI_FREE_RPD,
    geminiLimitConfirmed: false,
    geminiExhausted: false,
    geminiThrottledUntil: null,
    geminiObservedAt: null,
    geminiKeyId: null,
    claude: null,
  };
}

// Survive Next's dev-mode module reloads so the counter doesn't reset on edit.
const GLOBAL_KEY = Symbol.for("kundli-predict.quotaStore");
const globalStore = globalThis as unknown as { [GLOBAL_KEY]?: QuotaStore };
const store: QuotaStore = (globalStore[GLOBAL_KEY] ??= freshStore());

/** Identifies the quota a call is drawn from without retaining the key */
export function geminiKeyId(key: string, fromServerEnv: boolean): string {
  if (fromServerEnv) return "server";
  return `client:${createHash("sha256").update(key).digest("hex").slice(0, 8)}`;
}

/** Zero the day's counters when the Pacific date rolls over */
function rollDay(): void {
  const today = ptDateStr();
  if (store.pacificDate === today) return;
  store.pacificDate = today;
  store.geminiUsed = 0;
  store.geminiExhausted = false;
  store.geminiThrottledUntil = null;
  store.geminiObservedAt = null;
}

/** A different key draws on a different quota — start its count from scratch */
function switchKey(keyId: string): void {
  if (store.geminiKeyId === keyId) return;
  store.geminiKeyId = keyId;
  store.geminiUsed = 0;
  store.geminiExhausted = false;
  store.geminiThrottledUntil = null;
  store.geminiLimit = GEMINI_FREE_RPD;
  store.geminiLimitConfirmed = false;
}

export function recordGeminiCall(keyId: string): void {
  rollDay();
  switchKey(keyId);
  store.geminiUsed += 1;
}

/** "27s" / "1.5s" → milliseconds */
function parseRetryDelay(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = /^([\d.]+)s$/.exec(raw.trim());
  if (!m) return null;
  const seconds = Number(m[1]);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
}

interface QuotaViolation {
  quotaId?: string;
  quotaMetric?: string;
  quotaValue?: string;
}

/**
 * Fold Google's real 429 into the tracker. The error body carries the enforced
 * quota — a per-day violation means the free tier is genuinely spent, while a
 * per-minute one is a burst limit that clears by itself.
 */
export function recordGeminiQuotaError(
  keyId: string,
  body: unknown
): { scope: "day" | "minute" | "unknown"; retryAfterMs: number | null } {
  rollDay();
  switchKey(keyId);

  const details: unknown[] =
    (body as { error?: { details?: unknown[] } })?.error?.details ?? [];

  let violations: QuotaViolation[] = [];
  let retryAfterMs: number | null = null;
  for (const d of details) {
    const type = (d as { "@type"?: string })?.["@type"] ?? "";
    if (type.endsWith("QuotaFailure")) {
      violations = ((d as { violations?: QuotaViolation[] }).violations ?? []).filter(
        Boolean
      );
    } else if (type.endsWith("RetryInfo")) {
      retryAfterMs = parseRetryDelay((d as { retryDelay?: unknown }).retryDelay);
    }
  }

  const idOf = (v: QuotaViolation) => `${v.quotaId ?? ""}${v.quotaMetric ?? ""}`;
  const daily = violations.find((v) => /per\s*day/i.test(idOf(v)));
  const perMinute = violations.find((v) => /per\s*minute/i.test(idOf(v)));

  store.geminiObservedAt = Date.now();

  if (daily) {
    const value = Number(daily.quotaValue);
    if (Number.isFinite(value) && value > 0) {
      store.geminiLimit = value;
      store.geminiLimitConfirmed = true;
    }
    store.geminiExhausted = true;
    // Google's own count is authoritative: we are at (or past) the limit.
    store.geminiUsed = Math.max(store.geminiUsed, store.geminiLimit);
    return { scope: "day", retryAfterMs };
  }

  if (perMinute) {
    store.geminiThrottledUntil = Date.now() + (retryAfterMs ?? 60_000);
    return { scope: "minute", retryAfterMs };
  }

  // 429 with no parseable detail — assume the worst about today's quota,
  // it is the only reading that can't leave the user over-spending.
  store.geminiExhausted = true;
  return { scope: "unknown", retryAfterMs };
}

const num = (h: Headers, name: string): number | null => {
  const raw = h.get(name);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** Anthropic reports real remaining limits on every response — keep the latest */
export function recordClaudeHeaders(h: Headers): void {
  store.claude = {
    requestsLimit: num(h, "anthropic-ratelimit-requests-limit"),
    requestsRemaining: num(h, "anthropic-ratelimit-requests-remaining"),
    requestsResetAt: h.get("anthropic-ratelimit-requests-reset"),
    inputTokensRemaining: num(h, "anthropic-ratelimit-input-tokens-remaining"),
    outputTokensRemaining: num(h, "anthropic-ratelimit-output-tokens-remaining"),
    tokensResetAt:
      h.get("anthropic-ratelimit-tokens-reset") ??
      h.get("anthropic-ratelimit-input-tokens-reset"),
    observedAt: Date.now(),
  };
}

export function quotaSnapshot(): QuotaSnapshot {
  rollDay();
  const now = Date.now();
  const throttledUntil =
    store.geminiThrottledUntil && store.geminiThrottledUntil > now
      ? store.geminiThrottledUntil
      : null;
  return {
    fetchedAt: now,
    pacificDate: store.pacificDate,
    resetAt: ptDayEndMs(now),
    gemini: {
      limit: store.geminiLimit,
      used: store.geminiUsed,
      remaining: store.geminiExhausted
        ? 0
        : Math.max(0, store.geminiLimit - store.geminiUsed),
      exhausted: store.geminiExhausted,
      throttledUntil,
      limitConfirmed: store.geminiLimitConfirmed,
      observedAt: store.geminiObservedAt,
    },
    claude: store.claude,
  };
}
