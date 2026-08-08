import { describe, it, expect } from "vitest";
import {
  GEMINI_FREE_RPD,
  geminiKeyId,
  quotaSnapshot,
  recordClaudeHeaders,
  recordGeminiCall,
  recordGeminiQuotaError,
} from "./quotaState";
import { ptDateStr, ptDayEndMs, ptDayStartMs } from "./ptDay";

/**
 * The tracker is a module singleton. Each test uses its own key id, which
 * resets the per-key counters — that keeps the cases independent without
 * exposing a reset hatch just for tests.
 */

const dailyExhausted = {
  error: {
    code: 429,
    status: "RESOURCE_EXHAUSTED",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [
          {
            quotaMetric: "generativelanguage.googleapis.com/generate_requests",
            quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
            quotaValue: "200",
          },
        ],
      },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "34s" },
    ],
  },
};

const perMinuteThrottle = {
  error: {
    code: 429,
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [
          {
            quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
            quotaValue: "10",
          },
        ],
      },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "27s" },
    ],
  },
};

describe("Pacific day boundaries", () => {
  it("brackets the current Pacific day", () => {
    const now = Date.now();
    const start = ptDayStartMs(now);
    const end = ptDayEndMs(now);
    expect(start).toBeLessThanOrEqual(now);
    expect(end).toBeGreaterThan(now);
    // The boundaries are exact: one second either side flips the date.
    expect(ptDateStr(start)).toBe(ptDateStr(now));
    expect(ptDateStr(start - 1000)).not.toBe(ptDateStr(now));
    expect(ptDateStr(end - 1000)).toBe(ptDateStr(now));
    expect(ptDateStr(end)).not.toBe(ptDateStr(now));
  });

  it("handles the 23-hour spring-forward day", () => {
    // 2026-03-08 12:00 PDT — the day PT jumps 02:00 → 03:00
    const noon = Date.parse("2026-03-08T20:00:00Z");
    expect(ptDayStartMs(noon)).toBe(Date.parse("2026-03-08T08:00:00Z"));
    expect(ptDayEndMs(noon)).toBe(Date.parse("2026-03-09T08:00:00Z") - 3600_000);
  });

  it("handles the 25-hour fall-back day", () => {
    // 2026-11-01 12:00 PST — the day PT repeats 01:00
    const noon = Date.parse("2026-11-01T20:00:00Z");
    expect(ptDayStartMs(noon)).toBe(Date.parse("2026-11-01T07:00:00Z"));
    expect(ptDayEndMs(noon)).toBe(Date.parse("2026-11-02T08:00:00Z"));
  });
});

describe("gemini quota tracking", () => {
  it("counts proxied calls against the documented default limit", () => {
    const key = geminiKeyId("counts-calls", false);
    recordGeminiCall(key);
    recordGeminiCall(key);
    const q = quotaSnapshot().gemini;
    expect(q.used).toBe(2);
    expect(q.limit).toBe(GEMINI_FREE_RPD);
    expect(q.remaining).toBe(GEMINI_FREE_RPD - 2);
    expect(q.exhausted).toBe(false);
    expect(q.limitConfirmed).toBe(false);
  });

  it("takes Google's real per-day limit over the documented default", () => {
    const key = geminiKeyId("daily-429", false);
    recordGeminiCall(key);
    const hit = recordGeminiQuotaError(key, dailyExhausted);
    expect(hit.scope).toBe("day");
    expect(hit.retryAfterMs).toBe(34_000);

    const q = quotaSnapshot().gemini;
    expect(q.limit).toBe(200); // Google's number, not our 250
    expect(q.limitConfirmed).toBe(true);
    expect(q.exhausted).toBe(true);
    expect(q.remaining).toBe(0);
  });

  it("treats a per-minute 429 as a burst throttle, not a spent day", () => {
    const key = geminiKeyId("minute-429", false);
    recordGeminiCall(key);
    const hit = recordGeminiQuotaError(key, perMinuteThrottle);
    expect(hit.scope).toBe("minute");
    expect(hit.retryAfterMs).toBe(27_000);

    const q = quotaSnapshot().gemini;
    expect(q.exhausted).toBe(false);
    expect(q.remaining).toBeGreaterThan(0);
    expect(q.throttledUntil).not.toBeNull();
  });

  it("assumes the day is spent when a 429 carries no parseable detail", () => {
    const key = geminiKeyId("opaque-429", false);
    const hit = recordGeminiQuotaError(key, { error: { code: 429 } });
    expect(hit.scope).toBe("unknown");
    expect(quotaSnapshot().gemini.exhausted).toBe(true);
  });

  it("starts a fresh count when the key changes", () => {
    const first = geminiKeyId("key-switch-a", false);
    recordGeminiCall(first);
    recordGeminiQuotaError(first, dailyExhausted);
    expect(quotaSnapshot().gemini.exhausted).toBe(true);

    const second = geminiKeyId("key-switch-b", false);
    recordGeminiCall(second);
    const q = quotaSnapshot().gemini;
    expect(q.used).toBe(1);
    expect(q.exhausted).toBe(false);
    expect(q.limit).toBe(GEMINI_FREE_RPD);
  });

  it("distinguishes the server key from a browser-supplied one", () => {
    expect(geminiKeyId("AIzaSomeKey", true)).toBe("server");
    expect(geminiKeyId("AIzaSomeKey", false)).toMatch(/^client:[0-9a-f]{8}$/);
  });
});

describe("claude rate-limit headers", () => {
  it("records the provider's own remaining counts", () => {
    recordClaudeHeaders(
      new Headers({
        "anthropic-ratelimit-requests-limit": "50",
        "anthropic-ratelimit-requests-remaining": "47",
        "anthropic-ratelimit-requests-reset": "2026-08-07T12:00:00Z",
        "anthropic-ratelimit-input-tokens-remaining": "38000",
        "anthropic-ratelimit-output-tokens-remaining": "7800",
      })
    );
    const c = quotaSnapshot().claude;
    expect(c).not.toBeNull();
    expect(c?.requestsLimit).toBe(50);
    expect(c?.requestsRemaining).toBe(47);
    expect(c?.requestsResetAt).toBe("2026-08-07T12:00:00Z");
    expect(c?.inputTokensRemaining).toBe(38000);
    expect(c?.outputTokensRemaining).toBe(7800);
  });

  it("leaves absent headers null rather than guessing zero", () => {
    recordClaudeHeaders(new Headers({}));
    const c = quotaSnapshot().claude;
    expect(c?.requestsRemaining).toBeNull();
    expect(c?.requestsLimit).toBeNull();
  });
});
