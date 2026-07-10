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
import {
  currentPositions,
  houseFromMoon,
  sadeSatiPhase,
} from "@/lib/astro/transits";
import { YOGA_MEANINGS } from "@/lib/interpret/kb/yogaMeanings";
import { fmtDegInSign } from "@/lib/format";

function fmtPeriod(startMs: number, endMs: number): string {
  const s = new Date(startMs).toISOString().slice(0, 10);
  const e = new Date(endMs).toISOString().slice(0, 10);
  return `${s} to ${e}`;
}

export function buildKundliSummary(kundli: Kundli) {
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

  // Current sky (gochar) relative to natal Moon
  const natalMoon = kundli.planets.find((p) => p.id === "Moon")!;
  const sky = currentPositions(now);
  const transits = sky.map((p) => {
    const h = houseFromMoon(natalMoon.sign, p.sign);
    return `${PLANET_NAMES[p.id].en} in ${SIGN_NAMES[p.sign].en} (${h}th from natal Moon${p.retrograde && p.id !== "Rahu" && p.id !== "Ketu" ? ", retrograde" : ""})`;
  });
  const satNow = sky.find((p) => p.id === "Saturn")!;
  const ss = sadeSatiPhase(satNow.sign, natalMoon.sign);

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
    upcomingDashas: upcoming,
    transits,
    sadeSati: ss,
    yogas: kundli.yogas.map((y) => {
      const name = YOGA_MEANINGS[y.key]?.name.en ?? y.key;
      return `${name} (${y.detail})`;
    }),
    moonNakshatra: `${NAKSHATRA_NAMES[natalMoon.nakshatra].en} pada ${natalMoon.pada}`,
    birthDate: kundli.birth.localDateTime.slice(0, 10),
    gender: kundli.birth.gender,
    ageYears: age,
  };
}
