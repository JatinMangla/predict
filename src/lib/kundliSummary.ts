// Builds the compact, anonymised kundli summary sent to the AI endpoint.

import type { Kundli } from "@/lib/astro/types";
import { SIGN_NAMES, PLANET_NAMES, NAKSHATRA_NAMES } from "@/lib/astro/constants";
import { activeDashas } from "@/lib/astro/dasha";
import { YOGA_MEANINGS } from "@/lib/interpret/kb/yogaMeanings";
import { fmtDegInSign } from "@/lib/format";

export function buildKundliSummary(kundli: Kundli) {
  const chain = activeDashas(kundli.dasha, Date.now());
  const dashaStr = chain
    .map((p, i) => {
      const level = ["Mahadasha", "Antardasha", "Pratyantardasha"][i];
      const until = new Date(p.end).toISOString().slice(0, 10);
      return `${PLANET_NAMES[p.lord].en} ${level} (until ${until})`;
    })
    .join(", ");

  const moon = kundli.planets.find((p) => p.id === "Moon")!;

  return {
    lagna: `${SIGN_NAMES[kundli.lagna.sign].en} ${fmtDegInSign(kundli.lagna.degInSign)}`,
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
    currentDasha: dashaStr,
    yogas: kundli.yogas.map((y) => {
      const name = YOGA_MEANINGS[y.key]?.name.en ?? y.key;
      return `${name} (${y.detail})`;
    }),
    moonNakshatra: `${NAKSHATRA_NAMES[moon.nakshatra].en} pada ${moon.pada}`,
    birthDate: kundli.birth.localDateTime.slice(0, 10),
  };
}
