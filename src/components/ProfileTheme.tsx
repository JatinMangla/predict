"use client";

// Numerology-driven theming: sets the CSS accent variables for the active
// profile based on their birthday number (each number has a ruling planet
// and colour). Wrap profile-scoped pages with this component.

import { useEffect, type ReactNode } from "react";
import { NUMBER_PROFILES } from "@/lib/interpret/kb/numerologyMeanings";

export function ProfileTheme({
  birthdayNumber,
  children,
}: {
  birthdayNumber?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const profile = birthdayNumber ? NUMBER_PROFILES[birthdayNumber] : null;
    if (profile) {
      root.style.setProperty("--accent", profile.accent);
      root.style.setProperty("--accent-soft", `${profile.accent}24`);
    } else {
      root.style.setProperty("--accent", "#d4a94e");
      root.style.setProperty("--accent-soft", "rgba(212, 169, 78, 0.14)");
    }
    return () => {
      root.style.setProperty("--accent", "#d4a94e");
      root.style.setProperty("--accent-soft", "rgba(212, 169, 78, 0.14)");
    };
  }, [birthdayNumber]);

  return <>{children}</>;
}
