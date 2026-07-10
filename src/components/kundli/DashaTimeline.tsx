"use client";

// Expandable Vimshottari timeline: mahadasha → antardasha → pratyantardasha.

import { useState } from "react";
import type { DashaPeriod, Kundli } from "@/lib/astro/types";
import { useI18n } from "@/lib/i18n";
import { fmtDate, planetName } from "@/lib/format";
import { activeDashas } from "@/lib/astro/dasha";
import { currentDashaReading } from "@/lib/interpret/reading";

export function DashaTimeline({ kundli }: { kundli: Kundli }) {
  const { t, lang } = useI18n();
  const now = Date.now();
  const chain = activeDashas(kundli.dasha, now);
  const reading = currentDashaReading(kundli, now);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="mb-2 text-sm font-medium text-(--color-ink-soft)">{t("currentDasha")}</h3>
        <div className="flex flex-wrap gap-2">
          {chain.map((p, i) => (
            <span key={i} className="accent-bg rounded-lg px-3 py-1.5 text-sm">
              <span className="font-semibold">{planetName(p.lord, lang)}</span>{" "}
              <span className="text-xs text-(--color-ink-soft)">
                {[t("mahadasha"), t("antardasha"), t("pratyantardasha")][i]}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-(--color-ink)">
          {lang === "hi" ? reading.hi : reading.en}
        </p>
      </div>

      <div className="card divide-y divide-(--color-line)/50">
        {kundli.dasha.map((md, i) => (
          <MdRow key={i} md={md} now={now} birthMs={kundli.utcMs} />
        ))}
      </div>
    </div>
  );
}

function MdRow({ md, now, birthMs }: { md: DashaPeriod; now: number; birthMs: number }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const active = now >= md.start && now < md.end;
  if (md.end < birthMs) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-(--color-surface-3) ${
          active ? "accent-bg" : ""
        }`}
      >
        <span className="font-medium">
          {planetName(md.lord, lang)} {t("mahadasha")}
          {active && <span className="accent-text ml-2 text-xs">●</span>}
        </span>
        <span className="text-xs text-(--color-ink-soft)">
          {fmtDate(Math.max(md.start, birthMs), lang)} — {fmtDate(md.end, lang)}
        </span>
      </button>
      {open && md.children && (
        <div className="bg-(--color-surface) px-4 py-2">
          {md.children
            .filter((ad) => ad.end >= birthMs)
            .map((ad, j) => (
              <AdRow key={j} ad={ad} now={now} birthMs={birthMs} />
            ))}
        </div>
      )}
    </div>
  );
}

function AdRow({ ad, now, birthMs }: { ad: DashaPeriod; now: number; birthMs: number }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const active = now >= ad.start && now < ad.end;
  return (
    <div className="border-l border-(--color-line) pl-3">
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between py-1.5 text-left text-xs transition hover:text-(--color-gold-soft) ${
          active ? "accent-text font-semibold" : "text-(--color-ink-soft)"
        }`}
      >
        <span>
          {planetName(ad.lord, lang)} {t("antardasha")}
        </span>
        <span>
          {fmtDate(Math.max(ad.start, birthMs), lang)} — {fmtDate(ad.end, lang)}
        </span>
      </button>
      {open && ad.children && (
        <div className="pb-1 pl-3">
          {ad.children
            .filter((pd) => pd.end >= birthMs)
            .map((pd, k) => {
              const pdActive = now >= pd.start && now < pd.end;
              return (
                <div
                  key={k}
                  className={`flex justify-between py-0.5 text-[11px] ${
                    pdActive ? "accent-text" : "text-(--color-ink-soft)/70"
                  }`}
                >
                  <span>{planetName(pd.lord, lang)}</span>
                  <span>
                    {fmtDate(Math.max(pd.start, birthMs), lang)} — {fmtDate(pd.end, lang)}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
