"use client";

import type { Kundli } from "@/lib/astro/types";
import { SAPTA_GRAHAS } from "@/lib/astro/constants";
import { useI18n } from "@/lib/i18n";
import { planetName, signName } from "@/lib/format";

export function AshtakavargaGrid({ kundli }: { kundli: Kundli }) {
  const { lang } = useI18n();
  const { bav, sav } = kundli.ashtakavarga;

  const cellColor = (v: number, isSav: boolean) => {
    const hi = isSav ? 30 : 5;
    const lo = isSav ? 25 : 3;
    if (v >= hi) return "text-emerald-300 font-semibold";
    if (v < lo) return "text-red-300";
    return "text-[--color-ink]";
  };

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-center text-sm">
        <thead>
          <tr className="border-b border-[--color-line] text-[--color-ink-soft]">
            <th className="px-3 py-2 text-left"> </th>
            {Array.from({ length: 12 }, (_, s) => (
              <th key={s} className="px-2 py-2 font-normal">
                {signName(s, lang).slice(0, lang === "hi" ? 4 : 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAPTA_GRAHAS.map((p) => (
            <tr key={p} className="border-b border-[--color-line]/40">
              <td className="px-3 py-2 text-left font-medium">{planetName(p, lang)}</td>
              {bav[p].map((v, s) => (
                <td key={s} className={`px-2 py-2 ${cellColor(v, false)}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
          <tr className="accent-bg">
            <td className="px-3 py-2 text-left font-semibold accent-text">SAV</td>
            {sav.map((v, s) => (
              <td key={s} className={`px-2 py-2 ${cellColor(v, true)}`}>
                {v}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-[--color-ink-soft]">
        {lang === "hi"
          ? "28+ बिंदु वाली राशियाँ गोचर में शुभ फल देती हैं; 25 से कम वाली राशियों में गोचर कष्टकारी रहता है।"
          : "Signs with 28+ bindus give good transit results; transits through signs under 25 bindus are testing."}
      </p>
    </div>
  );
}
