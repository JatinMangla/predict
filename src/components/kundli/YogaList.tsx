"use client";

import type { Kundli } from "@/lib/astro/types";
import { useI18n } from "@/lib/i18n";
import { YOGA_MEANINGS } from "@/lib/interpret/kb/yogaMeanings";

export function YogaList({ kundli }: { kundli: Kundli }) {
  const { t, lang } = useI18n();
  const yogas = kundli.yogas.filter((y) => y.kind === "yoga");
  const doshas = kundli.yogas.filter((y) => y.kind === "dosha");

  if (kundli.yogas.length === 0) {
    return <p className="text-sm text-(--color-ink-soft)">{t("noYogas")}</p>;
  }

  const strengthLabel = (s: number) =>
    s === 3 ? t("strong") : s === 2 ? t("moderate") : t("mild");

  const Card = ({ y }: { y: Kundli["yogas"][number] }) => {
    const kb = YOGA_MEANINGS[y.key];
    return (
      <div className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-(--color-gold-soft)">
            {kb ? (lang === "hi" ? kb.name.hi : kb.name.en) : y.key}
          </h4>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
              y.kind === "yoga"
                ? "border-emerald-500/30 text-emerald-300"
                : "border-orange-500/30 text-orange-300"
            }`}
          >
            {strengthLabel(y.strength)}
          </span>
        </div>
        <p className="mt-1 text-xs text-(--color-ink-soft)">{y.detail}</p>
        {kb && (
          <p className="mt-2 text-sm leading-relaxed">
            {lang === "hi" ? kb.meaning.hi : kb.meaning.en}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {yogas.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-emerald-300">
            {t("yogas")} ({yogas.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {yogas.map((y, i) => (
              <Card key={i} y={y} />
            ))}
          </div>
        </section>
      )}
      {doshas.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-orange-300">
            {t("doshas")} ({doshas.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {doshas.map((y, i) => (
              <Card key={i} y={y} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
