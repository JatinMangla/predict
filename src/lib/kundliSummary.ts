// Builds the FULL anonymised kundli context sent to the AI endpoint —
// everything a professional astrologer would want on the table: D1 with
// house lords, D9/D10 divisional positions, ashtakavarga, the running and
// upcoming dashas, and today's transit sky including sade sati.

import type { Kundli, PlanetId } from "@/lib/astro/types";
import {
  SIGN_NAMES,
  PLANET_NAMES,
  NAKSHATRA_NAMES,
  SIGN_LORDS,
} from "@/lib/astro/constants";
import { activeDashas } from "@/lib/astro/dasha";
import { currentPositions, sadeSatiPhase } from "@/lib/astro/transits";
import { judgeTransit, dashaContext } from "@/lib/astro/chartJudgement";
import { YOGA_MEANINGS } from "@/lib/interpret/kb/yogaMeanings";
import { fmtDegInSign } from "@/lib/format";
import { activeYogini, buildYogini, YOGINIS, charaKarakas, KARAKA_NAMES, shaniTimeline } from "@/lib/astro/advanced";
import { chaldeanCompound } from "@/lib/astro/numerologyPlus";
import { reduceNumber } from "@/lib/astro/numerology";

function fmtPeriod(startMs: number, endMs: number): string {
  const s = new Date(startMs).toISOString().slice(0, 10);
  const e = new Date(endMs).toISOString().slice(0, 10);
  return `${s} to ${e}`;
}

export function buildKundliSummary(kundli: Kundli, currentPlace?: string) {
  const now = Date.now();
  const chain = activeDashas(kundli.dasha, now);
  const dashaStr = chain
    .map((p, i) => {
      const level = ["Mahadasha", "Antardasha", "Pratyantardasha"][i];
      return `${PLANET_NAMES[p.lord].en} ${level} (${fmtPeriod(p.start, p.end)})`;
    })
    .join(", ");

  // Upcoming antardashas over the next ~4 years — the timing backbone
  const horizon = now + 4 * 365.25 * 86400 * 1000;
  const upcoming: string[] = [];
  for (const md of kundli.dasha) {
    if (md.end < now || md.start > horizon || !md.children) continue;
    for (const ad of md.children) {
      if (ad.end < now || ad.start > horizon) continue;
      upcoming.push(
        `${PLANET_NAMES[md.lord].en}–${PLANET_NAMES[ad.lord].en} (${fmtPeriod(Math.max(ad.start, now), ad.end)})`
      );
      if (upcoming.length >= 8) break;
    }
    if (upcoming.length >= 8) break;
  }

  // House lords: house → lord → where that lord sits
  const houseLords = Array.from({ length: 12 }, (_, i) => {
    const house = i + 1;
    const sign = (kundli.lagna.sign + i) % 12;
    const lordId = SIGN_LORDS[sign];
    const lord = kundli.planets.find((p) => p.id === lordId)!;
    return `H${house} (${SIGN_NAMES[sign].en}) lord ${PLANET_NAMES[lordId].en} → in H${lord.house} (${SIGN_NAMES[lord.sign].en}, ${lord.dignity}${lord.combust ? ", combust" : ""})`;
  });

  const vargaLine = (key: "D9" | "D10") =>
    kundli.vargas[key]
      .map((v) =>
        v.planet === "Lagna"
          ? `Lagna:${SIGN_NAMES[v.sign].en}`
          : `${PLANET_NAMES[v.planet as PlanetId].en}:${SIGN_NAMES[v.sign].en}`
      )
      .join(", ");

  // Current sky (gochar) judged against THIS chart: house from the lagna,
  // the native's own ashtakavarga bindus, and functional rulership.
  const natalMoon = kundli.planets.find((p) => p.id === "Moon")!;
  const sky = currentPositions(now);
  const transits = sky.map((p) => {
    const j = judgeTransit(kundli, p.id, p.sign);
    const rules = j.rules.length ? `rules H${j.rules.join("/")}` : "no rulership";
    const bindus = j.bindus !== null ? `${j.bindus} bindus in own BAV` : "no BAV";
    return (
      `${PLANET_NAMES[p.id].en} in ${SIGN_NAMES[p.sign].en} — transiting YOUR ${j.houseFromLagna}th house from lagna; ` +
      `${rules} (functional ${j.nature}); ${bindus}` +
      `${p.retrograde && p.id !== "Rahu" && p.id !== "Ketu" ? "; retrograde" : ""}`
    );
  });
  const satNow = sky.find((p) => p.id === "Saturn")!;
  const ss = sadeSatiPhase(satNow.sign, natalMoon.sign);

  // Second-opinion systems
  const yog = activeYogini(buildYogini(natalMoon.longitude, kundli.utcMs), now);
  const yogini = yog.length
    ? yog.map((p) => `${YOGINIS[p.yogini].name} (${YOGINIS[p.yogini].lord})`).join(" > ") +
      (yog[1] ? ` until ${new Date(yog[1].end).toISOString().slice(0, 10)}` : "")
    : undefined;
  const ck = charaKarakas(kundli);
  const karakaLine =
    ck.karakas.map((k, i) => `${KARAKA_NAMES[i].key}=${k.planet}`).join(", ") +
    `; karakamsa ${SIGN_NAMES[ck.karakamsa].en}`;
  const shani = shaniTimeline(natalMoon.sign, now - 8 * 365.25 * 86400000, now + 12 * 365.25 * 86400000);
  const spanLine = (s: { phase: string; start: number; end: number }) =>
    `${s.phase} ${new Date(s.start).toISOString().slice(0, 10)} to ${new Date(s.end).toISOString().slice(0, 10)}`;
  const shaniLine = [
    ...shani.sadeSati.map((c) => `Sade Sati ${new Date(c.start).toISOString().slice(0, 7)} to ${new Date(c.end).toISOString().slice(0, 7)}`),
    ...shani.dhaiya.filter((d) => d.end > now).slice(0, 2).map(spanLine),
  ].join("; ");
  const n = kundli.numerology;
  const compound = chaldeanCompound(kundli.birth.name);
  const numerology = `Moolank ${n.birthdayNumber}, Bhagyank ${n.lifePathNumber}, Chaldean name number ${compound}/${reduceNumber(compound)}, personal year ${n.personalYear}`;

  const age = Math.floor(
    (now - kundli.utcMs) / (365.25 * 86400 * 1000)
  );

  return {
    lagna: `${SIGN_NAMES[kundli.lagna.sign].en} ${fmtDegInSign(kundli.lagna.degInSign)} (${NAKSHATRA_NAMES[kundli.lagna.nakshatra].en})`,
    planets: kundli.planets.map((p) => ({
      name: PLANET_NAMES[p.id].en,
      sign: SIGN_NAMES[p.sign].en,
      house: p.house,
      degree: fmtDegInSign(p.degInSign),
      dignity: p.dignity,
      retrograde: p.retrograde || undefined,
      combust: p.combust || undefined,
      nakshatra: NAKSHATRA_NAMES[p.nakshatra].en,
    })),
    houseLords,
    navamsa: vargaLine("D9"),
    dasamsa: vargaLine("D10"),
    sav: kundli.ashtakavarga.sav.map(
      (v, s) => `${SIGN_NAMES[s].en}:${v}`
    ).join(", "),
    currentDasha: dashaStr,
    dashaActivates: (() => {
      const dc = dashaContext(kundli, now);
      return dc
        ? `Running lords activate houses ${dc.activatesHouses.join(", ")} of this chart; deepest lord is functionally ${dc.nature} for this lagna`
        : undefined;
    })(),
    upcomingDashas: upcoming,
    transits,
    sadeSati: ss,
    yogas: kundli.yogas.map((y) => {
      const name = YOGA_MEANINGS[y.key]?.name.en ?? y.key;
      return y.cancelledBy?.length
        ? `${name} (${y.detail}) — CANCELLED by: ${y.cancelledBy.join("; ")}`
        : `${name} (${y.detail})`;
    }),
    moonNakshatra: `${NAKSHATRA_NAMES[natalMoon.nakshatra].en} pada ${natalMoon.pada}`,
    birthDate: kundli.birth.localDateTime.slice(0, 10),
    gender: kundli.birth.gender,
    ageYears: age,
    yogini,
    charaKarakas: karakaLine,
    shani: shaniLine || undefined,
    numerology,
    currentPlace: currentPlace || undefined,
  };
}
