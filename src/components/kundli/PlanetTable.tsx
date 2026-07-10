"use client";

import type { Kundli } from "@/lib/astro/types";
import { useI18n } from "@/lib/i18n";
import {
  fmtDegInSign,
  nakshatraName,
  planetName,
  signName,
} from "@/lib/format";

export function PlanetTable({ kundli }: { kundli: Kundli }) {
  const { t, lang } = useI18n();

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-(--color-line) text-left text-(--color-ink-soft)">
            <th className="px-4 py-3">{t("planet")}</th>
            <th className="px-4 py-3">{t("sign")}</th>
            <th className="px-4 py-3">{t("degree")}</th>
            <th className="px-4 py-3">{t("house")}</th>
            <th className="px-4 py-3">{t("nakshatra")}</th>
            <th className="px-4 py-3">{t("pada")}</th>
            <th className="px-4 py-3">{t("dignity")}</th>
            <th className="px-4 py-3">{t("state")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-(--color-line)/50">
            <td className="px-4 py-2.5 font-medium accent-text">{t("ascendant")}</td>
            <td className="px-4 py-2.5">{signName(kundli.lagna.sign, lang)}</td>
            <td className="px-4 py-2.5">{fmtDegInSign(kundli.lagna.degInSign)}</td>
            <td className="px-4 py-2.5">1</td>
            <td className="px-4 py-2.5">{nakshatraName(kundli.lagna.nakshatra, lang)}</td>
            <td className="px-4 py-2.5">{kundli.lagna.pada}</td>
            <td className="px-4 py-2.5">—</td>
            <td className="px-4 py-2.5">—</td>
          </tr>
          {kundli.planets.map((p) => (
            <tr key={p.id} className="border-b border-(--color-line)/50 last:border-0">
              <td className="px-4 py-2.5 font-medium">{planetName(p.id, lang)}</td>
              <td className="px-4 py-2.5">{signName(p.sign, lang)}</td>
              <td className="px-4 py-2.5">{fmtDegInSign(p.degInSign)}</td>
              <td className="px-4 py-2.5">{p.house}</td>
              <td className="px-4 py-2.5">{nakshatraName(p.nakshatra, lang)}</td>
              <td className="px-4 py-2.5">{p.pada}</td>
              <td className="px-4 py-2.5">
                <DignityBadge dignity={p.dignity} />
              </td>
              <td className="px-4 py-2.5 text-xs text-(--color-ink-soft)">
                {[
                  p.retrograde && p.id !== "Rahu" && p.id !== "Ketu" ? t("retrograde") : null,
                  p.combust ? t("combust") : null,
                ]
                  .filter(Boolean)
                  .join(", ") || t("direct")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DignityBadge({ dignity }: { dignity: string }) {
  const { t } = useI18n();
  const colors: Record<string, string> = {
    exalted: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    moolatrikona: "text-emerald-200 bg-emerald-500/10 border-emerald-500/20",
    own: "text-sky-300 bg-sky-500/10 border-sky-500/30",
    friend: "text-sky-200 bg-sky-500/5 border-sky-500/20",
    neutral: "text-(--color-ink-soft) bg-transparent border-(--color-line)",
    enemy: "text-orange-300 bg-orange-500/10 border-orange-500/30",
    debilitated: "text-red-300 bg-red-500/10 border-red-500/30",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${colors[dignity]}`}>
      {t(dignity as never)}
    </span>
  );
}
