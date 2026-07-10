"use client";

// Gochar: current sky, personal effects from the natal Moon, sade sati,
// and the timeline of upcoming ingresses & stations for the next 12 months.

import { use, useMemo } from "react";
import Link from "next/link";
import { useKundli } from "@/lib/useKundli";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ProfileTheme } from "@/components/ProfileTheme";
import {
  currentPositions,
  findTransitEvents,
  houseFromMoon,
  sadeSatiPhase,
  FAVOURABLE_FROM_MOON,
} from "@/lib/astro/transits";
import { TRANSIT_TONE } from "@/lib/interpret/kb/dashaEffects";
import { HOUSE_DOMAINS } from "@/lib/interpret/kb/core";
import { fmtDate, fmtDegInSign, planetName, signName } from "@/lib/format";

const DAY_MS = 86400 * 1000;

export default function TransitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, kundli, loading, error } = useKundli(Number(id));
  const { t, lang } = useI18n();

  const now = useMemo(() => Date.now(), []);
  const positions = useMemo(() => currentPositions(now), [now]);
  const events = useMemo(() => findTransitEvents(now, now + 365 * DAY_MS), [now]);

  if (loading) return <AppShell><p className="p-8 text-center text-[--color-ink-soft]">{t("loading")}</p></AppShell>;
  if (error || !kundli || !profile) {
    return (
      <AppShell>
        <div className="card mx-auto max-w-md p-8 text-center">
          <p className="text-red-300">{error ?? t("error")}</p>
          <Link href="/" className="accent-text mt-4 inline-block text-sm underline">← {t("dashboard")}</Link>
        </div>
      </AppShell>
    );
  }

  const moonSign = kundli.planets.find((p) => p.id === "Moon")!.sign;
  const saturn = positions.find((p) => p.id === "Saturn")!;
  const phase = sadeSatiPhase(saturn.sign, moonSign);
  const phaseText = {
    none: t("sadeSatiNone"),
    rising: t("sadeSatiRising"),
    peak: t("sadeSatiPeak"),
    setting: t("sadeSatiSetting"),
  }[phase];

  return (
    <ProfileTheme birthdayNumber={kundli.numerology.birthdayNumber}>
      <AppShell>
        <h1 className="mb-5 text-xl font-semibold text-[--color-gold-soft]">
          {t("transits")} — {profile.name}
        </h1>

        {/* Sade Sati banner */}
        <div
          className={`card mb-5 border-l-4 p-4 ${
            phase === "none" ? "border-[--color-line]" : phase === "peak" ? "border-red-500/50" : "border-orange-500/40"
          }`}
        >
          <span className="text-sm font-medium text-[--color-gold-soft]">{t("sadeSati")}: </span>
          <span className="text-sm">{phaseText}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Current sky, personalised */}
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[--color-ink-soft]">
              {t("currentSky")} · {t("personalEffects")}
            </h2>
            <div className="card divide-y divide-[--color-line]/50">
              {positions.map((p) => {
                const h = houseFromMoon(moonSign, p.sign);
                const good = FAVOURABLE_FROM_MOON[p.id].includes(h);
                const tone = TRANSIT_TONE[p.id][good ? "good" : "bad"];
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <span className="font-medium">{planetName(p.id, lang)}</span>{" "}
                      <span className="text-sm text-[--color-ink-soft]">
                        {signName(p.sign, lang)} {fmtDegInSign(p.degInSign)}
                        {p.retrograde && p.id !== "Rahu" && p.id !== "Ketu" ? ` · ${t("retrograde")}` : ""}
                      </span>
                      <p className="mt-0.5 text-xs text-[--color-ink-soft]">
                        {h} {t("fromYourMoon")} — {lang === "hi" ? tone.hi : tone.en}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                        good
                          ? "border-emerald-500/30 text-emerald-300"
                          : "border-orange-500/30 text-orange-300"
                      }`}
                    >
                      {good ? t("favourable") : t("unfavourable")}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Upcoming movements */}
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[--color-ink-soft]">
              {t("upcomingMovements")}
            </h2>
            <div className="card divide-y divide-[--color-line]/50">
              {events.slice(0, 24).map((ev, i) => {
                const name = planetName(ev.planet, lang);
                if (ev.type === "ingress" && ev.toSign !== undefined) {
                  const h = houseFromMoon(moonSign, ev.toSign);
                  const good = FAVOURABLE_FROM_MOON[ev.planet].includes(h);
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div>
                        <span className="font-medium">{name}</span>{" "}
                        {t("entersSign")} <span className="accent-text">{signName(ev.toSign, lang)}</span>
                        <p className="text-xs text-[--color-ink-soft]">
                          {h} {t("fromYourMoon")} · {HOUSE_DOMAINS[h - 1][lang === "hi" ? "hi" : "en"]}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs text-[--color-ink-soft]">{fmtDate(ev.timeMs, lang)}</div>
                        <span className={`text-xs ${good ? "text-emerald-300" : "text-orange-300"}`}>
                          {good ? t("favourable") : t("unfavourable")}
                        </span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>
                      <span className="font-medium">{name}</span>{" "}
                      {ev.type === "retrograde" ? t("goesRetrograde") : t("goesDirect")}
                    </span>
                    <span className="text-xs text-[--color-ink-soft]">{fmtDate(ev.timeMs, lang)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </AppShell>
    </ProfileTheme>
  );
}
