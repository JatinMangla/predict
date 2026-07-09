// Composed readings for planets, dashas and yogas — pure functions over the
// kundli, fully offline.

import type { Kundli, PlanetPosition } from "@/lib/astro/types";
import { PLANET_NAMES, SIGN_NAMES } from "@/lib/astro/constants";
import {
  HOUSE_DOMAINS,
  PLANET_NATURE,
  DIGNITY_TONE,
  COMBUST_NOTE,
  RETRO_NOTE,
  ordinal,
  type Bi,
} from "./kb/core";
import { PLANET_HOUSE_SPECIAL } from "./kb/special";
import { DASHA_THEMES } from "./kb/dashaEffects";
import { activeDashas } from "@/lib/astro/dasha";

/** Full reading for one planet placement */
export function planetReading(p: PlanetPosition): Bi {
  const name = PLANET_NAMES[p.id];
  const sign = SIGN_NAMES[p.sign];
  const domain = HOUSE_DOMAINS[p.house - 1];
  const nature = PLANET_NATURE[p.id];
  const dignity = DIGNITY_TONE[p.dignity];
  const special = PLANET_HOUSE_SPECIAL[`${p.id}-${p.house}`];

  let en = `${name.en} in ${sign.en} in your ${ordinal(p.house)} house brings its ${nature.en} to matters of ${domain.en}. ${dignity.en}`;
  let hi = `आपके ${ordinal(p.house) === "1st" ? "लग्न" : `${p.house}वें भाव`} में ${sign.hi} राशि के ${name.hi} अपनी ${nature.hi} को ${domain.hi} के क्षेत्र में लगाते हैं। ${dignity.hi}`;

  if (special) {
    en += ` ${special.en}`;
    hi += ` ${special.hi}`;
  }
  if (p.combust) {
    en += ` ${COMBUST_NOTE.en}`;
    hi += ` ${COMBUST_NOTE.hi}`;
  }
  if (p.retrograde && p.id !== "Rahu" && p.id !== "Ketu") {
    en += ` ${RETRO_NOTE.en}`;
    hi += ` ${RETRO_NOTE.hi}`;
  }
  return { en, hi };
}

/** Reading for the currently running dasha chain */
export function currentDashaReading(kundli: Kundli, atMs: number): Bi {
  const chain = activeDashas(kundli.dasha, atMs);
  if (chain.length === 0) return { en: "", hi: "" };
  const md = chain[0];
  const ad = chain[1];

  const mdTheme = DASHA_THEMES[md.lord];
  const mdName = PLANET_NAMES[md.lord];
  const mdPlanet = kundli.planets.find((p) => p.id === md.lord)!;

  let en = `You are running the ${mdName.en} mahadasha — ${mdTheme.en}. In your chart ${mdName.en} occupies the ${ordinal(mdPlanet.house)} house, so these results flow especially through ${HOUSE_DOMAINS[mdPlanet.house - 1].en}.`;
  let hi = `आप ${mdName.hi} की महादशा में हैं — ${mdTheme.hi}। आपकी कुंडली में ${mdName.hi} ${mdPlanet.house}वें भाव में हैं, अतः ये फल विशेषतः ${HOUSE_DOMAINS[mdPlanet.house - 1].hi} के माध्यम से मिलेंगे।`;

  if (ad) {
    const adName = PLANET_NAMES[ad.lord];
    const adTheme = DASHA_THEMES[ad.lord];
    en += ` The current ${adName.en} antardasha adds its flavour: ${adTheme.en}.`;
    hi += ` वर्तमान ${adName.hi} अंतर्दशा अपना रंग जोड़ती है: ${adTheme.hi}।`;
  }
  return { en, hi };
}
