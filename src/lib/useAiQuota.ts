"use client";

// Shared AI availability + quota meter for every screen that shows one.
//
// Refresh policy (see aiClient.ts for the reconciliation itself):
//   • landing on the screen — and again when the tab is brought back
//   • after every AI call, and forcibly once 10 have gone by unanswered
//   • hourly, so a long-lived tab never shows yesterday's number

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAiConfig,
  getUsageSummary,
  refreshQuota,
  subscribeQuota,
  QUOTA_MAX_AGE_MS,
  type AiConfig,
  type UsageSummary,
} from "./aiClient";

export interface AiQuotaState {
  cfg: AiConfig | null;
  usage: UsageSummary | null;
  /** Force an immediate re-fetch (e.g. after saving a new API key) */
  refresh: () => Promise<void>;
}

export function useAiQuota(): AiQuotaState {
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const alive = useRef(true);

  const sync = useCallback(async (force: boolean) => {
    await refreshQuota(force);
    // getAiConfig shares the in-flight request above, so this is one round trip
    const [c, u] = await Promise.all([getAiConfig(), getUsageSummary()]);
    if (!alive.current) return;
    setCfg(c);
    setUsage(u);
  }, []);

  useEffect(() => {
    alive.current = true;

    // Landing on the UI.
    void sync(false);

    // Hourly, for a tab left open all day.
    const timer = setInterval(() => void sync(true), QUOTA_MAX_AGE_MS);

    // Coming back to the tab is landing on the UI again.
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync(false);
    };
    document.addEventListener("visibilitychange", onVisible);

    // Every AI call moves the figures; the 10-call trigger lives in aiClient.
    const unsubscribe = subscribeQuota(() => {
      void getUsageSummary().then((u) => {
        if (alive.current) setUsage(u);
      });
    });

    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, [sync]);

  return { cfg, usage, refresh: () => sync(true) };
}
