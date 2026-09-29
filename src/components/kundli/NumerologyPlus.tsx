"use client";

// The numerology systems beyond Pythagorean basics: Chaldean name number
// with its compound meaning and a compatibility check against the birth
// numbers, the Lo Shu grid with planes, Kua, pinnacles and personal day.

import { useMemo } from "react";
import type { NumerologyResult, StoredProfile } from "@/lib/astro/types";
import { useI18n } from "@/lib/i18n";
import {
  checkName,
  compoundMeaningFor,
  loShu,
  kuaNumber,
  pinnacles,
  personalDay,
  maturityNumber,
  LO_SHU_LAYOUT,
  LO_SHU_PLANES,
  MISSING_NUMBER_NOTES,
  NUMBER_GEMS,
} from "@/lib/astro/numerologyPlus";

export function NumerologyPlus({
  numerology,
  profile,
}: {
  numerology: NumerologyResult;
  profile: StoredProfile;
}) {
  const { lang } = useI18n();
  const L = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const pick = (b: { en: string; hi: string }) => (lang === "hi" ? b.hi : b.en);
  const dateISO = profile.localDateTime.slice(0, 10);
  const driver = numerology.birthdayNumber;
  const conductor = numerology.lifePathNumber;

  const data = useMemo(() => {
    const name = checkName(profile.name, driver, conductor);
    return {
      name,
      compound: compoundMeaningFor(name.compound),
      grid: loShu(dateISO, driver, conductor),
      kua: kuaNumber(dateISO, profile.gender),
      cycles: pinnacles(dateISO, conductor),
      today: personalDay(numerology.personalMonth),
      maturity: maturityNumber(conductor, numerology.expressionNumber),
    };
  }, [profile.name, profile.gender, dateISO, driver, conductor, numerology]);

  const age = Math.floor((Date.now() - new Date(dateISO).getTime()) / (365.25 * 86400000));
  const relLabel = (r: string) =>
    r === "friendly" ? L("friendly", "मित्र") : r === "hostile" ? L("clashing", "शत्रु") : L("neutral", "सम");
  const verdictColor =
    data.name.verdict === "supportive" ? "text-emerald-300" : data.name.verdict === "conflicting" ? "text-red-300" : "text-amber-300";

  return (
    <div className="space-y-5">
      {/* Quick row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: L("Chaldean name no.", "कैल्डियन नामांक"), value: `${data.name.compound}/${data.name.nameNumber}` },
          { label: L("Personal day (today)", "व्यक्तिगत दिन (आज)"), value: String(data.today) },
          { label: L("Maturity number", "परिपक्वता अंक"), value: data.maturity !== undefined ? String(data.maturity) : "—" },
          { label: L("Kua number", "कुआ अंक"), value: String(data.kua.kua) },
        ].map((x) => (
          <div key={x.label} className="card p-4 text-center">
            <p className="text-2xl font-bold accent-text">{x.value}</p>
            <p className="mt-1 text-xs text-(--color-ink-soft)">{x.label}</p>
          </div>
        ))}
      </div>

      {/* Name number */}
      <div className="card p-5">
        <h3 className="mb-2 text-sm font-medium text-(--color-gold-soft)">
          {L("Name number (Chaldean / Cheiro)", "नामांक (कैल्डियन / कीरो)")} — “{profile.name}”
        </h3>
        <p className="text-sm">
          {L("Compound", "संयुक्त अंक")} <b>{data.name.compound}</b> → {L("name number", "नामांक")} <b>{data.name.nameNumber}</b>
          {data.compound && (
            <>
              {" "}· <span className={data.compound.tone === "fortunate" ? "text-emerald-300" : data.compound.tone === "caution" ? "text-red-300" : "text-amber-300"}>
                {pick(data.compound.title)}
              </span>
            </>
          )}
        </p>
        {data.compound && <p className="mt-1 text-sm text-(--color-ink-soft)">{pick(data.compound.meaning)}</p>}
        <p className="mt-3 text-sm">
          {L("With birthday number", "मूलांक से")} {driver}: <b>{relLabel(data.name.withDriver)}</b> ·{" "}
          {L("with life path", "भाग्यांक से")} {conductor}: <b>{relLabel(data.name.withConductor)}</b> →{" "}
          <b className={verdictColor}>
            {data.name.verdict === "supportive"
              ? L("name supports you", "नाम अनुकूल है")
              : data.name.verdict === "conflicting"
                ? L("name works against you", "नाम प्रतिकूल है")
                : L("workable", "सामान्य")}
          </b>
        </p>
        {data.name.verdict !== "supportive" && data.name.suggestedNumbers.length > 0 && (
          <p className="mt-1 text-xs text-(--color-ink-soft)">
            {L(
              "If you ever adjust the spelling, aim for a name number of",
              "यदि वर्तनी बदलें, तो इनमें से कोई नामांक रखें:"
            )}{" "}
            <b className="accent-text">{data.name.suggestedNumbers.join(", ")}</b>
            {L(" — and avoid caution compounds (11, 12, 16, 18, 22, 26, 28, 29, 43).", " — और सावधानी वाले संयुक्त अंक (11, 12, 16, 18, 22, 26, 28, 29, 43) से बचें।")}
          </p>
        )}
      </div>

      {/* Lo Shu grid */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-medium text-(--color-gold-soft)">
            {L("Lo Shu grid", "लो शू ग्रिड")}
          </h3>
          <div className="mx-auto grid w-56 grid-cols-3 gap-1">
            {LO_SHU_LAYOUT.flat().map((n) => {
              const c = data.grid.counts[n];
              return (
                <div
                  key={n}
                  className={`flex h-16 items-center justify-center rounded-md border text-lg font-semibold ${
                    c ? "accent-bg border-(--accent)" : "border-dashed border-(--color-line) text-(--color-ink-soft) opacity-50"
                  }`}
                  title={c ? `${n} × ${c}` : L("missing", "अनुपस्थित")}
                >
                  {c ? String(n).repeat(c) : n}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-(--color-ink-soft)">
            {L("DOB digits + birthday number + life path", "जन्मतिथि के अंक + मूलांक + भाग्यांक")}
          </p>
        </div>
        <div className="card space-y-2 p-5 text-sm">
          {data.grid.completePlanes.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-300">{L("Complete planes", "पूर्ण तल")}</p>
              {LO_SHU_PLANES.filter((p) => data.grid.completePlanes.includes(p.key)).map((p) => (
                <p key={p.key}>✓ {pick(p.name)} ({p.numbers.join("-")}) — {pick(p.meaning)}</p>
              ))}
            </div>
          )}
          {data.grid.emptyPlanes.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-orange-300">{L("Empty planes", "रिक्त तल")}</p>
              {LO_SHU_PLANES.filter((p) => data.grid.emptyPlanes.includes(p.key)).map((p) => (
                <p key={p.key}>○ {pick(p.name)} ({p.numbers.join("-")}) — {pick(p.meaning)}</p>
              ))}
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wider text-(--color-ink-soft)">{L("Missing numbers", "अनुपस्थित अंक")}</p>
            {data.grid.missing.length === 0 ? (
              <p>{L("None — every number is present.", "कोई नहीं — सभी अंक उपस्थित।")}</p>
            ) : (
              data.grid.missing.map((n) => (
                <p key={n}>
                  <b>{n}</b> — {pick(MISSING_NUMBER_NOTES[n])}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Pinnacles & challenges */}
      <div className="card overflow-x-auto p-5">
        <h3 className="mb-3 text-sm font-medium text-(--color-gold-soft)">
          {L("Life cycles — pinnacles & challenges", "जीवन चक्र — शिखर व चुनौतियाँ")}
        </h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-(--color-ink-soft)">
            <tr>
              <th className="py-1">{L("Ages", "आयु")}</th>
              <th>{L("Pinnacle", "शिखर")}</th>
              <th>{L("Challenge", "चुनौती")}</th>
            </tr>
          </thead>
          <tbody>
            {data.cycles.map((c, i) => {
              const now = age >= c.fromAge && (c.toAge === null || age <= c.toAge);
              return (
                <tr key={i} className={`border-t border-(--color-line) ${now ? "accent-text font-medium" : ""}`}>
                  <td className="py-1.5">
                    {c.fromAge}–{c.toAge ?? "∞"} {now ? L("(now)", "(वर्तमान)") : ""}
                  </td>
                  <td>{c.pinnacle}</td>
                  <td>{c.challenge}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Kua & gem */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4 text-sm">
          <p className="text-xs uppercase tracking-wider text-(--color-ink-soft)">{L("Kua (Eight Mansions)", "कुआ (अष्ट भवन)")}</p>
          <p className="mt-1">
            {L("Kua", "कुआ")} <b>{data.kua.kua}</b> · {data.kua.group === "East" ? L("East group", "पूर्व समूह") : L("West group", "पश्चिम समूह")}
            {data.kua.bestDirection && <> · {L("best direction", "श्रेष्ठ दिशा")}: <b>{pick(data.kua.bestDirection)}</b></>}
          </p>
        </div>
        <div className="card p-4 text-sm">
          <p className="text-xs uppercase tracking-wider text-(--color-ink-soft)">{L("Birthday-number gem (traditional)", "मूलांक रत्न (पारंपरिक)")}</p>
          <p className="mt-1">
            <b>{pick(NUMBER_GEMS[driver])}</b>
          </p>
          <p className="mt-1 text-xs text-(--color-ink-soft)">
            {L(
              "A numerology association only — for a gemstone, the kundli's functional benefics matter more. Consult before wearing.",
              "यह केवल अंक-आधारित संबंध है — रत्न हेतु कुंडली के कार्यात्मक शुभ ग्रह अधिक महत्वपूर्ण हैं। धारण से पहले परामर्श लें।"
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
