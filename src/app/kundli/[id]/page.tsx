"use client";

// Full kundli view: charts (N/S toggle), planets, divisional charts,
// dashas, yogas/doshas, ashtakavarga, numerology.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useKundli } from "@/lib/useKundli";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ProfileTheme } from "@/components/ProfileTheme";
import { NorthIndianChart } from "@/components/charts/NorthIndianChart";
import { SouthIndianChart } from "@/components/charts/SouthIndianChart";
import { PlanetTable } from "@/components/kundli/PlanetTable";
import { DashaTimeline } from "@/components/kundli/DashaTimeline";
import { YogaList } from "@/components/kundli/YogaList";
import { AshtakavargaGrid } from "@/components/kundli/AshtakavargaGrid";
import { PanchangCard } from "@/components/kundli/PanchangCard";
import { NumerologyCard } from "@/components/kundli/NumerologyCard";
import { planetReading } from "@/lib/interpret/reading";
import { VARGA_LIST } from "@/lib/astro/vargas";
import { getSetting, setSetting } from "@/lib/db";
import {
  fmtDegInSign,
  nakshatraName,
  planetName,
  signName,
} from "@/lib/format";

type Tab = "charts" | "planets" | "vargas" | "dashas" | "yogas" | "av" | "num";

export default function KundliPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, kundli, loading, error } = useKundli(Number(id));
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("charts");
  const [style, setStyle] = useState<"north" | "south">("north");

  useEffect(() => {
    getSetting("chartStyle").then((v) => {
      if (v === "south" || v === "north") setStyle(v);
    });
  }, []);

  const switchStyle = (s: "north" | "south") => {
    setStyle(s);
    void setSetting("chartStyle", s);
  };

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

  const Chart = style === "north" ? NorthIndianChart : SouthIndianChart;
  const moon = kundli.planets.find((p) => p.id === "Moon")!;
  const sun = kundli.planets.find((p) => p.id === "Sun")!;

  const tabs: { key: Tab; label: string }[] = [
    { key: "charts", label: t("charts") },
    { key: "planets", label: t("planetsTab") },
    { key: "vargas", label: t("vargasTab") },
    { key: "dashas", label: t("dashasTab") },
    { key: "yogas", label: t("yogasTab") },
    { key: "av", label: t("ashtakavargaTab") },
    { key: "num", label: t("numerologyTab") },
  ];

  return (
    <ProfileTheme birthdayNumber={kundli.numerology.birthdayNumber}>
      <AppShell>
        {/* Header */}
        <div className="card mb-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-[--color-gold-soft]">{profile.name}</h1>
              <p className="mt-0.5 text-xs text-[--color-ink-soft]">
                {t("born")} {profile.localDateTime.replace("T", " · ")} · {profile.place}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span><span className="text-[--color-ink-soft]">{t("ascendant")}:</span> {signName(kundli.lagna.sign, lang)} {fmtDegInSign(kundli.lagna.degInSign)}</span>
              <span><span className="text-[--color-ink-soft]">{t("moonSign")}:</span> {signName(moon.sign, lang)}</span>
              <span><span className="text-[--color-ink-soft]">{t("sunSign")}:</span> {signName(sun.sign, lang)}</span>
              <span><span className="text-[--color-ink-soft]">{t("birthNakshatra")}:</span> {nakshatraName(moon.nakshatra, lang)} ({moon.pada})</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link href={`/predictions/${id}`} className="accent-bg rounded-md px-3 py-1.5">{t("predictions")}</Link>
            <Link href={`/transits/${id}`} className="accent-bg rounded-md px-3 py-1.5">{t("transits")}</Link>
            <Link href={`/ask/${id}`} className="accent-bg rounded-md px-3 py-1.5">{t("askQuestion")}</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex flex-wrap gap-1 border-b border-[--color-line]">
          {tabs.map((x) => (
            <button
              key={x.key}
              onClick={() => setTab(x.key)}
              className={`rounded-t-md px-4 py-2 text-sm transition ${
                tab === x.key
                  ? "accent-bg accent-text border-b-2 border-[--accent] font-medium"
                  : "text-[--color-ink-soft] hover:text-[--color-ink]"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        {tab === "charts" && (
          <div className="space-y-5">
            <div className="flex justify-end gap-2 text-xs">
              {(["north", "south"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => switchStyle(s)}
                  className={`rounded-md border px-3 py-1.5 transition ${
                    style === s
                      ? "accent-bg border-[--accent]"
                      : "border-[--color-line] text-[--color-ink-soft]"
                  }`}
                >
                  {s === "north" ? t("northIndian") : t("southIndian")}
                </button>
              ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Chart chart={kundli.vargas.D1} lagnaSign={kundli.lagna.sign} title={t("lagnaChart")} />
              <Chart
                chart={kundli.vargas.D9}
                lagnaSign={kundli.vargas.D9.find((v) => v.planet === "Lagna")!.sign}
                title={t("navamsaChart")}
              />
            </div>
            <PanchangCard panchang={kundli.panchang} title={`${t("tithi")} · ${t("vara")} · ${t("nakshatra")}`} />
          </div>
        )}

        {tab === "planets" && (
          <div className="space-y-5">
            <PlanetTable kundli={kundli} />
            <div className="grid gap-3 md:grid-cols-2">
              {kundli.planets.map((p) => {
                const r = planetReading(p);
                return (
                  <div key={p.id} className="card p-4">
                    <h4 className="mb-1 text-sm font-medium accent-text">
                      {planetName(p.id, lang)} · {signName(p.sign, lang)} · {t("house")} {p.house}
                    </h4>
                    <p className="text-sm leading-relaxed">{lang === "hi" ? r.hi : r.en}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "vargas" && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {VARGA_LIST.filter((v) => v.key !== "D1").map((v) => {
              const chart = kundli.vargas[v.key];
              const lagna = chart.find((x) => x.planet === "Lagna")!.sign;
              return (
                <Chart
                  key={v.key}
                  chart={chart}
                  lagnaSign={lagna}
                  title={`${v.key} · ${v.name} — ${v.signifies}`}
                />
              );
            })}
          </div>
        )}

        {tab === "dashas" && <DashaTimeline kundli={kundli} />}
        {tab === "yogas" && <YogaList kundli={kundli} />}
        {tab === "av" && <AshtakavargaGrid kundli={kundli} />}
        {tab === "num" && <NumerologyCard numerology={kundli.numerology} />}
      </AppShell>
    </ProfileTheme>
  );
}
