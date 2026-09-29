"use client";

// Cross-check systems: Yogini dasha beside Vimshottari, Jaimini chara
// karakas, the full Sade Sati / Dhaiya timeline with dates, and gemstone
// suitability judged from THIS lagna's functional benefics.

import { useMemo } from "react";
import type { Kundli, PlanetId } from "@/lib/astro/types";
import { useI18n } from "@/lib/i18n";
import {
  buildYogini,
  activeYogini,
  YOGINIS,
  charaKarakas,
  KARAKA_NAMES,
  shaniTimeline,
  type ShaniPhase,
} from "@/lib/astro/advanced";
import { activeDashas } from "@/lib/astro/dasha";
import { rulesHouses } from "@/lib/astro/chartJudgement";
import { fmtDate, planetName, signName, fmtDegInSign } from "@/lib/format";

const YEAR_MS = 365.25 * 86400000;

const GEMS: Record<PlanetId, { en: string; hi: string }> = {
  Sun: { en: "Ruby", hi: "माणिक्य" },
  Moon: { en: "Pearl", hi: "मोती" },
  Mars: { en: "Red coral", hi: "मूंगा" },
  Mercury: { en: "Emerald", hi: "पन्ना" },
  Jupiter: { en: "Yellow sapphire", hi: "पुखराज" },
  Venus: { en: "Diamond", hi: "हीरा" },
  Saturn: { en: "Blue sapphire", hi: "नीलम" },
  Rahu: { en: "Hessonite", hi: "गोमेद" },
  Ketu: { en: "Cat's eye", hi: "लहसुनिया" },
};

export function AdvancedPanel({ kundli }: { kundli: Kundli }) {
  const { lang } = useI18n();
  const L = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const now = Date.now();
  const moon = kundli.planets.find((p) => p.id === "Moon")!;

  const data = useMemo(() => {
    const yogini = buildYogini(moon.longitude, kundli.utcMs);
    const shani = shaniTimeline(moon.sign, kundli.utcMs, kundli.utcMs + 95 * YEAR_MS);
    return { yogini, shani, jaimini: charaKarakas(kundli) };
  }, [kundli, moon]);

  const yogNow = activeYogini(data.yogini, now);
  const vimNow = activeDashas(kundli.dasha, now);

  // Gem suitability from functional rulership for THIS lagna
  const gems = (["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as PlanetId[]).map((p) => {
    const houses = rulesHouses(kundli.lagna.sign, p);
    const trikona = houses.some((h) => [1, 5, 9].includes(h));
    const dusthana = houses.some((h) => [6, 8, 12].includes(h));
    const status: "wear" | "caution" | "avoid" =
      trikona && !houses.includes(8) ? "wear" : dusthana && !trikona ? "avoid" : "caution";
    return { planet: p, houses, status };
  });

  const phaseLabel = (p: ShaniPhase) =>
    ({
      rising: L("Rising (12th)", "आरोही (12वाँ)"),
      peak: L("Peak (over Moon)", "शिखर (चंद्र पर)"),
      setting: L("Setting (2nd)", "अवरोही (दूसरा)"),
      kantaka: L("Kantaka Shani (4th)", "कंटक शनि (चौथा)"),
      ashtama: L("Ashtama Shani (8th)", "अष्टम शनि (आठवाँ)"),
    })[p];

  const current = [...data.shani.sadeSati.flatMap((c) => c.spans), ...data.shani.dhaiya].find(
    (s) => now >= s.start && now < s.end
  );

  return (
    <div className="space-y-5">
      {/* Dasha cross-check */}
      <div className="card p-5">
        <h3 className="mb-1 text-sm font-medium text-(--color-gold-soft)">
          {L("Two-dasha cross-check", "दो-दशा पुष्टि")}
        </h3>
        <p className="mb-3 text-xs text-(--color-ink-soft)">
          {L(
            "An event promised by BOTH Vimshottari and Yogini dasha is far more reliable than one shown by a single system.",
            "जो घटना विंशोत्तरी और योगिनी दोनों दशाओं में दिखे, वह किसी एक प्रणाली की तुलना में कहीं अधिक विश्वसनीय होती है।"
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="rounded-lg border border-(--color-line) p-3">
            <p className="text-xs text-(--color-ink-soft)">{L("Vimshottari", "विंशोत्तरी")}</p>
            <p className="mt-1 font-medium">{vimNow.map((p) => planetName(p.lord, lang)).join(" › ")}</p>
          </div>
          <div className="rounded-lg border border-(--color-line) p-3">
            <p className="text-xs text-(--color-ink-soft)">{L("Yogini", "योगिनी")}</p>
            <p className="mt-1 font-medium">
              {yogNow
                .map((p) => `${lang === "hi" ? YOGINIS[p.yogini].hi : YOGINIS[p.yogini].name} (${planetName(YOGINIS[p.yogini].lord, lang)})`)
                .join(" › ")}
            </p>
            {yogNow[1] && (
              <p className="text-xs text-(--color-ink-soft)">
                {L("until", "तक")} {fmtDate(yogNow[1].end, lang)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {data.yogini
            .filter((p) => p.end > now - 10 * YEAR_MS && p.start < now + 25 * YEAR_MS)
            .map((p) => {
              const active = now >= p.start && now < p.end;
              return (
                <span
                  key={p.start}
                  className={`rounded-md border px-2 py-1 ${active ? "accent-bg border-(--accent)" : "border-(--color-line) text-(--color-ink-soft)"}`}
                >
                  {lang === "hi" ? YOGINIS[p.yogini].hi : YOGINIS[p.yogini].name} · {new Date(p.start).getFullYear()}–{new Date(p.end).getFullYear()}
                </span>
              );
            })}
        </div>
      </div>

      {/* Sade Sati */}
      <div className="card p-5">
        <h3 className="mb-1 text-sm font-medium text-(--color-gold-soft)">
          {L("Sade Sati & Dhaiya timeline", "साढ़े साती व ढैया समयरेखा")}
        </h3>
        <p className="mb-3 text-sm">
          {current ? (
            <span className="text-orange-300">
              {L("Now running:", "अभी चल रहा:")} {phaseLabel(current.phase)} — {L("until", "तक")} {fmtDate(current.end, lang)}
            </span>
          ) : (
            <span className="text-emerald-300">{L("Not under Sade Sati or Dhaiya now.", "अभी साढ़े साती या ढैया नहीं।")}</span>
          )}
        </p>
        <div className="space-y-2 text-sm">
          {data.shani.sadeSati.map((c) => {
            const past = c.end < now;
            return (
              <div key={c.start} className={`rounded-lg border border-(--color-line) p-3 ${past ? "opacity-60" : ""}`}>
                <p className="font-medium">
                  {L("Sade Sati", "साढ़े साती")}: {fmtDate(c.start, lang)} → {fmtDate(c.end, lang)}
                  {now >= c.start && now < c.end ? ` · ${L("current", "वर्तमान")}` : ""}
                </p>
                <p className="mt-1 text-xs text-(--color-ink-soft)">
                  {c.spans.map((s) => `${phaseLabel(s.phase)}: ${fmtDate(s.start, lang)} – ${fmtDate(s.end, lang)}`).join(" · ")}
                </p>
              </div>
            );
          })}
        </div>
        <details className="mt-3 text-xs text-(--color-ink-soft)">
          <summary className="cursor-pointer">{L("Dhaiya periods (4th / 8th from Moon)", "ढैया अवधि (चंद्र से 4/8)")}</summary>
          <ul className="mt-2 space-y-1">
            {data.shani.dhaiya.map((s) => (
              <li key={s.start}>
                {phaseLabel(s.phase)}: {fmtDate(s.start, lang)} – {fmtDate(s.end, lang)}
              </li>
            ))}
          </ul>
        </details>
        <p className="mt-3 text-xs text-(--color-ink-soft)">
          {L(
            "Sade Sati is not uniformly bad: its results depend on Saturn's rulership for your lagna and its bindus in your ashtakavarga (see the Ask and Timing pages).",
            "साढ़े साती सदैव अशुभ नहीं: इसका फल आपकी लग्न के लिए शनि के स्वामित्व और आपकी अष्टकवर्ग बिंदुओं पर निर्भर है।"
          )}
        </p>
      </div>

      {/* Jaimini */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-medium text-(--color-gold-soft)">
          {L("Jaimini chara karakas", "जैमिनी चर कारक")}
        </h3>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {data.jaimini.karakas.map((k, i) => (
            <p key={k.key}>
              <b className="accent-text">{lang === "hi" ? KARAKA_NAMES[i].hi : KARAKA_NAMES[i].en}</b>: {planetName(k.planet, lang)} ({fmtDegInSign(k.degInSign)})
              <span className="block text-xs text-(--color-ink-soft)">{KARAKA_NAMES[i].signifies}</span>
            </p>
          ))}
        </div>
        <p className="mt-3 text-sm">
          {L("Karakamsa (Atmakaraka's navamsa)", "कारकांश (आत्मकारक का नवांश)")}: <b>{signName(data.jaimini.karakamsa, lang)}</b>
        </p>
      </div>

      {/* Gems */}
      <div className="card p-5">
        <h3 className="mb-1 text-sm font-medium text-(--color-gold-soft)">
          {L("Gemstones for this lagna", "इस लग्न के लिए रत्न")}
        </h3>
        <p className="mb-3 text-xs text-(--color-ink-soft)">
          {L(
            "Judged from functional rulership for your lagna, not from the Moon sign or birthday. Lords of trikonas (1/5/9) are safe to strengthen; lords of only dusthanas (6/8/12) should not be strengthened.",
            "आपकी लग्न के कार्यात्मक स्वामित्व से — राशि या जन्मदिन से नहीं। त्रिकोण (1/5/9) स्वामी के रत्न सुरक्षित; केवल दुःस्थान (6/8/12) स्वामी के रत्न वर्जित।"
          )}
        </p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {gems.map((g) => (
            <p key={g.planet}>
              <span className={g.status === "wear" ? "text-emerald-300" : g.status === "avoid" ? "text-red-300" : "text-amber-300"}>
                {g.status === "wear" ? "✓" : g.status === "avoid" ? "✕" : "~"}
              </span>{" "}
              {lang === "hi" ? GEMS[g.planet].hi : GEMS[g.planet].en} ({planetName(g.planet, lang)}) —{" "}
              <span className="text-(--color-ink-soft)">
                {L("rules", "स्वामी")} H{g.houses.join(", H")} ·{" "}
                {g.status === "wear" ? L("suitable", "उपयुक्त") : g.status === "avoid" ? L("avoid", "वर्जित") : L("only with advice", "केवल परामर्श से")}
              </span>
            </p>
          ))}
        </div>
        <p className="mt-3 text-xs text-(--color-ink-soft)">
          {L(
            "Rahu/Ketu stones (hessonite, cat's eye) are never general-purpose — only on specific advice. No gemstone replaces medical or financial advice.",
            "राहु/केतु रत्न (गोमेद, लहसुनिया) सामान्य उपयोग के नहीं — केवल विशेष परामर्श पर। कोई रत्न चिकित्सा या वित्तीय सलाह का विकल्प नहीं।"
          )}
        </p>
      </div>
    </div>
  );
}
