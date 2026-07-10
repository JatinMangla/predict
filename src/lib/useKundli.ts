"use client";

// Loads a stored profile by id and computes its kundli client-side.

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { computeKundli } from "@/lib/astro/kundli";
import type { Kundli, StoredProfile } from "@/lib/astro/types";

export function useKundli(id: number | null): {
  profile: StoredProfile | null;
  kundli: Kundli | null;
  loading: boolean;
  error: string | null;
} {
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null || Number.isNaN(id)) {
      setError("Profile not found");
      setLoading(false);
      return;
    }
    let cancelled = false;
    db.profiles.get(id).then((p) => {
      if (cancelled) return;
      if (!p) setError("Profile not found");
      else setProfile(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const [kundli, kundliError] = useMemo((): [Kundli | null, string | null] => {
    if (!profile) return [null, null];
    try {
      return [computeKundli(profile), null];
    } catch (e) {
      return [null, e instanceof Error ? e.message : "Calculation failed"];
    }
  }, [profile]);

  return { profile, kundli, loading, error: error ?? kundliError };
}
