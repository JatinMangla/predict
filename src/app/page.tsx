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
import { fmtDate } from "@/lib/format";
import type { PanchangInfo } from "@/lib/astro/types";

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const profiles = useLiveQuery(() => db.profiles.orderBy("createdAt").reverse().toArray(), []);
  const [panchang, setPanchang] = useState<PanchangInfo | null>(null);

  // Today's panchang for Delhi by default (or the first profile's place)
  const place = useMemo(() => {
    const p = profiles?.[0];
    return p
      ? { lat: p.latitude, lon: p.longitude }
      : { lat: 28.6139, lon: 77.209 };
  }, [profiles]);

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
            <h2 className="text-lg font-semibold text-[--color-gold-soft]">
              {t("savedProfiles")}
            </h2>
            <Link
              href="/new"
              className="rounded-lg bg-[--accent] px-4 py-2 text-sm font-medium text-[#14100a] transition hover:brightness-110"
            >
              + {t("createKundli")}
            </Link>
          </div>

          {!profiles || profiles.length === 0 ? (
            <div className="card p-10 text-center text-[--color-ink-soft]">
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
                      className="text-xs text-[--color-ink-soft] hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-[--color-ink-soft]">
                    {t("born")}{" "}
                    {fmtDate(new Date(p.localDateTime).getTime(), lang)}{" "}
                    {p.localDateTime.slice(11, 16)} · {p.place}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Link href={`/kundli/${p.id}`} className="accent-bg rounded-md px-3 py-1.5 transition hover:brightness-125">
                      {t("kundli")}
                    </Link>
                    <Link href={`/predictions/${p.id}`} className="rounded-md border border-[--color-line] px-3 py-1.5 text-[--color-ink-soft] transition hover:text-[--color-ink]">
                      {t("predictions")}
                    </Link>
                    <Link href={`/transits/${p.id}`} className="rounded-md border border-[--color-line] px-3 py-1.5 text-[--color-ink-soft] transition hover:text-[--color-ink]">
                      {t("transits")}
                    </Link>
                    <Link href={`/ask/${p.id}`} className="rounded-md border border-[--color-line] px-3 py-1.5 text-[--color-ink-soft] transition hover:text-[--color-ink]">
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
          <p className="mt-3 text-center text-xs text-[--color-ink-soft]">
            ✓ {t("offlineReady")} · {t("dataNote")}
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
