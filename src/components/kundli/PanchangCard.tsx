"use client";

import type { PanchangInfo } from "@/lib/astro/types";
import { YOGA_NAMES } from "@/lib/astro/constants";
import { karanaName } from "@/lib/astro/panchang";
import { useI18n } from "@/lib/i18n";
import { nakshatraName, tithiName, varaName } from "@/lib/format";

export function PanchangCard({
  panchang,
  title,
}: {
  panchang: PanchangInfo;
  title?: string;
}) {
  const { t, lang } = useI18n();

  const rows: [string, string][] = [
    [t("tithi"), `${tithiName(panchang.tithi, lang)} (${panchang.paksha === "shukla" ? t("shukla") : t("krishna")})`],
    [t("vara"), varaName(panchang.vara, lang)],
    [t("nakshatra"), nakshatraName(panchang.nakshatra, lang)],
    [t("yogaP"), YOGA_NAMES[panchang.yoga]],
    [t("karana"), karanaName(panchang.karana)],
  ];
  if (panchang.sunrise) {
    rows.push([
      t("sunrise"),
      new Date(panchang.sunrise).toLocaleTimeString(lang === "hi" ? "hi-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" }),
    ]);
  }
  if (panchang.sunset) {
    rows.push([
      t("sunset"),
      new Date(panchang.sunset).toLocaleTimeString(lang === "hi" ? "hi-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" }),
    ]);
  }

  return (
    <div className="card p-5">
      {title && (
        <h3 className="mb-3 text-sm font-medium text-[--color-gold-soft]">{title}</h3>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[--color-ink-soft]">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
