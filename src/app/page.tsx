"use client";

// Dashboard: saved profiles + today's panchang.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { PanchangCard } from "@/components/kundli/PanchangCard";
import { computePanchang } from "@/lib/astro/panchang";
import { useCurrentPlace } from "@/lib/place";
import { fmtDate } from "@/lib/format";
import type { PanchangInfo, StoredProfile } from "@/lib/astro/types";
import { computeKundli } from "@/lib/astro/kundli";
import { siderealLongitude } from "@/lib/astro/ephemeris";
import { nakshatraOf } from "@/lib/astro/nakshatra";
import { activeDashas } from "@/lib/astro/dasha";
import { TARABALA9 } from "@/lib/astro/hinduCalendar";
import { planetName } from "@/lib/format";
import type { Lang } from "@/lib/i18n";

/** Today's personal pulse: tara from the birth star, Chandra bala, running dasha */
function TodayLine({ p, lang }: { p: StoredProfile; lang: Lang }) {
  const info = useMemo(() => {
    try {
      const k = computeKundli(p);
      const now = Date.now();
      const moon = k.planets.find((x) => x.id === "Moon")!;
      const moonNow = siderealLongitude("Moon", now);
      const tara = ((nakshatraOf(moonNow) - moon.nakshatra + 27) % 27) % 9;
      const chandraHouse = ((Math.floor(moonNow / 30) - moon.sign + 12) % 12) + 1;
      const chandraGood = [1, 3, 6, 7, 10, 11].includes(chandraHouse);
      const tg = TARABALA9[tara].good;
      const score = (tg === true ? 1 : tg === null ? 0.5 : 0) + (chandraGood ? 1 : 0);
      const dasha = activeDashas(k.dasha, now).slice(0, 2).map((d) => d.lord);
      return { tara, score, dasha };
    } catch {
      return null;
    }
  }, [p]);
  if (!info) return null;
  const tone = info.score >= 1.5 ? "text-emerald-300" : info.score >= 1 ? "text-amber-300" : "text-red-300";
  const label =
    info.score >= 1.5
      ? lang === "hi" ? "अनुकूल दिन" : "favourable day"
      : info.score >= 1
        ? lang === "hi" ? "मिश्रित दिन" : "mixed day"
        : lang === "hi" ? "सावधानी का दिन" : "day for caution";
  return (
    <p className="mt-2 text-xs">
      <span className={tone}>● {label}</span>
      <span className="text-(--color-ink-soft)">
        {" "}· {lang === "hi" ? "तारा" : "tara"} {lang === "hi" ? TARABALA9[info.tara].name.hi : TARABALA9[info.tara].name.en}
        {info.dasha.length > 0 && ` · ${lang === "hi" ? "दशा" : "dasha"} ${info.dasha.map((d) => planetName(d, lang)).join("–")}`}
      </span>
    </p>
  );
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const profiles = useLiveQuery(() => db.profiles.orderBy("createdAt").reverse().toArray(), []);
  const [panchang, setPanchang] = useState<PanchangInfo | null>(null);

  // Today's panchang where you are (Settings), else the first profile's
  // birthplace, else Delhi
  const here = useCurrentPlace();
  const place = useMemo(() => {
    if (here) return { lat: here.latitude, lon: here.longitude };
    const p = profiles?.[0];
    return p
      ? { lat: p.latitude, lon: p.longitude }
      : { lat: 28.6139, lon: 77.209 };
  }, [profiles, here]);

  useEffect(() => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    setPanchang(computePanchang(now.getTime(), place.lat, place.lon, localDate));
  }, [place]);

  const remove = async (id: number) => {
    if (!confirm(t("confirmDelete"))) return;
    await db.qaHistory.where("profileId").equals(id).delete();
    await db.profiles.delete(id);
  };

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-(--color-gold-soft)">
              {t("savedProfiles")}
            </h2>
            <Link
              href="/new"
              className="rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-[#14100a] transition hover:brightness-110"
            >
              + {t("createKundli")}
            </Link>
          </div>

          {!profiles || profiles.length === 0 ? (
            <div className="card p-10 text-center text-(--color-ink-soft)">
              <p className="mb-4 text-4xl">🪐</p>
              <p>{t("noProfiles")}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {profiles.map((p) => (
                <div key={p.id} className="card p-5">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold">{p.name}</h3>
                    <button
                      onClick={() => remove(p.id!)}
                      className="text-xs text-(--color-ink-soft) hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-(--color-ink-soft)">
                    {t("born")}{" "}
                    {fmtDate(new Date(p.localDateTime).getTime(), lang)}{" "}
                    {p.localDateTime.slice(11, 16)} · {p.place}
                  </p>
                  <TodayLine p={p} lang={lang} />
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Link href={`/kundli/${p.id}`} className="accent-bg rounded-md px-3 py-1.5 transition hover:brightness-125">
                      {t("kundli")}
                    </Link>
                    <Link href={`/rashi/${p.id}`} className="rounded-md border border-(--color-line) px-3 py-1.5 text-(--color-ink-soft) transition hover:text-(--color-ink)">
                      {t("rashiNav")}
                    </Link>
                    <Link href={`/timing/${p.id}`} className="rounded-md border border-(--color-line) px-3 py-1.5 text-(--color-ink-soft) transition hover:text-(--color-ink)">
                      🎯 {t("timingNav")}
                    </Link>
                    <Link href={`/transits/${p.id}`} className="rounded-md border border-(--color-line) px-3 py-1.5 text-(--color-ink-soft) transition hover:text-(--color-ink)">
                      {t("transits")}
                    </Link>
                    <Link href={`/ask/${p.id}`} className="rounded-md border border-(--color-line) px-3 py-1.5 text-(--color-ink-soft) transition hover:text-(--color-ink)">
                      {t("askQuestion")}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside>
          {panchang && <PanchangCard panchang={panchang} title={t("todayPanchang")} />}
          <p className="mt-3 text-center text-xs text-(--color-ink-soft)">
            ✓ {t("offlineReady")} · {t("dataNote")}
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
