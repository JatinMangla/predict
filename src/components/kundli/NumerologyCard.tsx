"use client";

import type { NumerologyResult } from "@/lib/astro/types";
import { useI18n } from "@/lib/i18n";
import {
  NUMBER_PROFILES,
  MASTER_MEANINGS,
} from "@/lib/interpret/kb/numerologyMeanings";

export function NumerologyCard({ numerology }: { numerology: NumerologyResult }) {
  const { t, lang } = useI18n();
  const bd = NUMBER_PROFILES[numerology.birthdayNumber];
  const lp = NUMBER_PROFILES[numerology.lifePathNumber];
  const pick = (b: { en: string; hi: string }) => (lang === "hi" ? b.hi : b.en);

  const Num = ({ label, value, accent }: { label: string; value?: number; accent?: string }) =>
    value === undefined ? null : (
      <div className="card flex flex-col items-center p-4">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl font-bold"
          style={{ borderColor: accent ?? "var(--accent)", color: accent ?? "var(--accent)" }}
        >
          {value}
        </span>
        <span className="mt-2 text-center text-xs text-(--color-ink-soft)">{label}</span>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Num label={t("birthdayNumber")} value={numerology.birthdayNumber} accent={bd?.accent} />
        <Num label={t("lifePathNumber")} value={numerology.lifePathNumber} accent={lp?.accent} />
        <Num label={t("expressionNumber")} value={numerology.expressionNumber} />
        <Num label={t("soulUrgeNumber")} value={numerology.soulUrgeNumber} />
        <Num label={t("personalYear")} value={numerology.personalYear} />
        <Num label={t("personalMonth")} value={numerology.personalMonth} />
      </div>

      {bd && (
        <div className="card p-5">
          <h3 className="mb-1 text-sm font-medium text-(--color-gold-soft)">
            {t("birthdayNumber")} {numerology.birthdayNumber} · {t("rulingPlanet")}: {pick(bd.planet)}
          </h3>
          <p className="text-sm leading-relaxed">{pick(bd.traits)}</p>
          <div className="mt-3 grid gap-2 text-xs text-(--color-ink-soft) sm:grid-cols-2">
            <p>
              <span className="accent-text">{t("luckyColors")}:</span> {pick(bd.luckyColors)}
            </p>
            <p>
              <span className="accent-text">{t("luckyDays")}:</span> {pick(bd.luckyDays)}
            </p>
          </div>
        </div>
      )}

      {lp && numerology.lifePathNumber !== numerology.birthdayNumber && (
        <div className="card p-5">
          <h3 className="mb-1 text-sm font-medium text-(--color-gold-soft)">
            {t("lifePathNumber")} {numerology.lifePathNumber} · {t("rulingPlanet")}: {pick(lp.planet)}
          </h3>
          <p className="text-sm leading-relaxed">{pick(lp.traits)}</p>
        </div>
      )}

      {numerology.lifePathMaster && MASTER_MEANINGS[numerology.lifePathMaster] && (
        <div className="card accent-bg p-5">
          <p className="text-sm leading-relaxed">
            {pick(MASTER_MEANINGS[numerology.lifePathMaster])}
          </p>
        </div>
      )}
    </div>
  );
}
