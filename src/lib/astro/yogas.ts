// Detection of classical yogas and doshas from the D1 chart.
// Each detector is a pure function over planet positions + lagna.

import type { LagnaInfo, PlanetPosition, YogaResult, PlanetId } from "./types";
import {
  SIGN_LORDS,
  OWN_SIGNS,
  EXALTATION,
  NATURAL_BENEFICS,
  norm360,
} from "./constants";

type Ctx = {
  planets: PlanetPosition[];
  lagna: LagnaInfo;
  get: (id: PlanetId) => PlanetPosition;
  /** house counted from a reference sign (1–12) */
  houseFrom: (fromSign: number, toSign: number) => number;
};

function makeCtx(planets: PlanetPosition[], lagna: LagnaInfo): Ctx {
  const map = new Map(planets.map((p) => [p.id, p]));
  return {
    planets,
    lagna,
    get: (id) => map.get(id)!,
    houseFrom: (fromSign, toSign) => ((toSign - fromSign + 12) % 12) + 1,
  };
}

const KENDRA = [1, 4, 7, 10];
const TRIKONA = [1, 5, 9];
const DUSTHANA = [6, 8, 12];

/** Lord of the nth house (whole sign) from lagna */
function houseLord(lagnaSign: number, house: number): PlanetId {
  return SIGN_LORDS[(lagnaSign + house - 1) % 12];
}

export function detectYogas(
  planets: PlanetPosition[],
  lagna: LagnaInfo
): YogaResult[] {
  const ctx = makeCtx(planets, lagna);
  const out: YogaResult[] = [];
  const push = (r: YogaResult | null) => r && out.push(r);

  push(gajakesari(ctx));
  push(budhaditya(ctx));
  push(chandraMangal(ctx));
  out.push(...panchMahapurusha(ctx));
  out.push(...rajaYogas(ctx));
  out.push(...dhanaYogas(ctx));
  out.push(...vipreetRaja(ctx));
  out.push(...neechaBhanga(ctx));
  push(kemadruma(ctx));
  out.push(...chandraAdjacent(ctx));
  out.push(...suryaAdjacent(ctx));
  push(amala(ctx));
  push(adhiYoga(ctx));
  push(saraswati(ctx));
  push(lakshmi(ctx));
  out.push(...parivartana(ctx));
  push(manglik(ctx));
  push(kaalSarp(ctx));
  push(guruChandal(ctx));
  out.push(...grahanDosha(ctx));
  push(shakata(ctx));
  push(lagnaLordStrong(ctx));
  return out;
}

function gajakesari(c: Ctx): YogaResult | null {
  const moon = c.get("Moon");
  const jup = c.get("Jupiter");
  const rel = c.houseFrom(moon.sign, jup.sign);
  if (!KENDRA.includes(rel)) return null;
  const strong = ["exalted", "own", "moolatrikona"].includes(jup.dignity);
  return {
    key: "gajakesari",
    kind: "yoga",
    detail: "Jupiter in kendra from Moon",
    strength: strong ? 3 : 2,
  };
}

function budhaditya(c: Ctx): YogaResult | null {
  const sun = c.get("Sun");
  const mer = c.get("Mercury");
  if (sun.sign !== mer.sign) return null;
  return {
    key: "budhaditya",
    kind: "yoga",
    detail: `Sun + Mercury in house ${sun.house}`,
    strength: mer.combust ? 1 : 2,
  };
}

function chandraMangal(c: Ctx): YogaResult | null {
  const moon = c.get("Moon");
  const mars = c.get("Mars");
  if (moon.sign !== mars.sign && c.houseFrom(moon.sign, mars.sign) !== 7) return null;
  return {
    key: "chandra-mangal",
    kind: "yoga",
    detail: "Moon and Mars in association",
    strength: 2,
  };
}

const MAHAPURUSHA: { planet: PlanetId; key: string }[] = [
  { planet: "Mars", key: "ruchaka" },
  { planet: "Mercury", key: "bhadra" },
  { planet: "Jupiter", key: "hamsa" },
  { planet: "Venus", key: "malavya" },
  { planet: "Saturn", key: "sasa" },
];

function panchMahapurusha(c: Ctx): YogaResult[] {
  const out: YogaResult[] = [];
  for (const { planet, key } of MAHAPURUSHA) {
    const p = c.get(planet);
    const strongSign =
      p.dignity === "exalted" ||
      p.dignity === "own" ||
      p.dignity === "moolatrikona";
    if (strongSign && KENDRA.includes(p.house)) {
      out.push({
        key,
        kind: "yoga",
        detail: `${planet} ${p.dignity} in house ${p.house}`,
        strength: p.dignity === "exalted" ? 3 : 2,
      });
    }
  }
  return out;
}

function rajaYogas(c: Ctx): YogaResult[] {
  const out: YogaResult[] = [];
  const kendraLords = new Set(KENDRA.map((h) => houseLord(c.lagna.sign, h)));
  const trikonaLords = new Set(TRIKONA.map((h) => houseLord(c.lagna.sign, h)));
  const seen = new Set<string>();
  for (const kl of kendraLords) {
    for (const tl of trikonaLords) {
      if (kl === tl) continue;
      const pk = c.get(kl);
      const pt = c.get(tl);
      if (pk.sign === pt.sign) {
        const pair = [kl, tl].sort().join("+");
        if (seen.has(pair)) continue;
        seen.add(pair);
        out.push({
          key: "raja-yoga",
          kind: "yoga",
          detail: `${kl} (kendra lord) with ${tl} (trikona lord) in house ${pk.house}`,
          strength: DUSTHANA.includes(pk.house) ? 1 : 3,
        });
      }
    }
  }
  return out;
}

function dhanaYogas(c: Ctx): YogaResult[] {
  const out: YogaResult[] = [];
  const l2 = houseLord(c.lagna.sign, 2);
  const l11 = houseLord(c.lagna.sign, 11);
  const wealthLords = new Set([l2, l11]);
  const gainLords = new Set([
    houseLord(c.lagna.sign, 5),
    houseLord(c.lagna.sign, 9),
    houseLord(c.lagna.sign, 1),
  ]);
  const seen = new Set<string>();
  for (const wl of wealthLords) {
    for (const gl of gainLords) {
      if (wl === gl) continue;
      const pw = c.get(wl);
      const pg = c.get(gl);
      if (pw.sign === pg.sign) {
        const pair = [wl, gl].sort().join("+");
        if (seen.has(pair)) continue;
        seen.add(pair);
        out.push({
          key: "dhana-yoga",
          kind: "yoga",
          detail: `${wl} with ${gl} in house ${pw.house}`,
          strength: DUSTHANA.includes(pw.house) ? 1 : 2,
        });
      }
    }
  }
  return out;
}

function vipreetRaja(c: Ctx): YogaResult[] {
  const out: YogaResult[] = [];
  const names: Record<number, string> = { 6: "harsha", 8: "sarala", 12: "vimala" };
  for (const h of DUSTHANA) {
    const lord = houseLord(c.lagna.sign, h);
    const p = c.get(lord);
    if (DUSTHANA.includes(p.house)) {
      out.push({
        key: `vipreet-${names[h]}`,
        kind: "yoga",
        detail: `Lord of house ${h} (${lord}) in house ${p.house}`,
        strength: 2,
      });
    }
  }
  return out;
}

function neechaBhanga(c: Ctx): YogaResult[] {
  const out: YogaResult[] = [];
  const moon = c.get("Moon");
  for (const p of c.planets) {
    if (p.dignity !== "debilitated") continue;
    const signLord = SIGN_LORDS[p.sign];
    const lordPos = c.get(signLord);
    const exLordSign = EXALTATION[p.id]
      ? SIGN_LORDS[EXALTATION[p.id]!.sign]
      : null;
    const cancelByLord =
      KENDRA.includes(lordPos.house) ||
      KENDRA.includes(c.houseFrom(moon.sign, lordPos.sign));
    const cancelByExLord =
      exLordSign !== null &&
      KENDRA.includes(c.get(exLordSign).house);
    if (cancelByLord || cancelByExLord) {
      out.push({
        key: "neecha-bhanga",
        kind: "yoga",
        detail: `${p.id} debilitation cancelled (Neecha Bhanga Raja Yoga)`,
        strength: 2,
      });
    }
  }
  return out;
}

function kemadruma(c: Ctx): YogaResult | null {
  const moon = c.get("Moon");
  const others = c.planets.filter(
    (p) => !["Moon", "Sun", "Rahu", "Ketu"].includes(p.id)
  );
  const occupied = others.some((p) => {
    const rel = c.houseFrom(moon.sign, p.sign);
    return rel === 1 || rel === 2 || rel === 12;
  });
  if (occupied) return null;
  return {
    key: "kemadruma",
    kind: "dosha",
    detail: "No planets around the Moon",
    strength: 2,
  };
}

function chandraAdjacent(c: Ctx): YogaResult[] {
  const moon = c.get("Moon");
  const others = c.planets.filter(
    (p) => !["Moon", "Sun", "Rahu", "Ketu"].includes(p.id)
  );
  const second = others.some((p) => c.houseFrom(moon.sign, p.sign) === 2);
  const twelfth = others.some((p) => c.houseFrom(moon.sign, p.sign) === 12);
  const out: YogaResult[] = [];
  if (second && twelfth)
    out.push({ key: "durudhara", kind: "yoga", detail: "Planets on both sides of Moon", strength: 2 });
  else if (second)
    out.push({ key: "sunapha", kind: "yoga", detail: "Planet in 2nd from Moon", strength: 2 });
  else if (twelfth)
    out.push({ key: "anapha", kind: "yoga", detail: "Planet in 12th from Moon", strength: 2 });
  return out;
}

function suryaAdjacent(c: Ctx): YogaResult[] {
  const sun = c.get("Sun");
  const others = c.planets.filter(
    (p) => !["Sun", "Moon", "Rahu", "Ketu"].includes(p.id)
  );
  const second = others.some((p) => c.houseFrom(sun.sign, p.sign) === 2);
  const twelfth = others.some((p) => c.houseFrom(sun.sign, p.sign) === 12);
  const out: YogaResult[] = [];
  if (second && twelfth)
    out.push({ key: "ubhayachari", kind: "yoga", detail: "Planets on both sides of Sun", strength: 2 });
  else if (second)
    out.push({ key: "vesi", kind: "yoga", detail: "Planet in 2nd from Sun", strength: 1 });
  else if (twelfth)
    out.push({ key: "vasi", kind: "yoga", detail: "Planet in 12th from Sun", strength: 1 });
  return out;
}

function amala(c: Ctx): YogaResult | null {
  const moon = c.get("Moon");
  const benefics = c.planets.filter(
    (p) => NATURAL_BENEFICS.includes(p.id) && p.id !== "Moon"
  );
  const found = benefics.find(
    (p) => p.house === 10 || c.houseFrom(moon.sign, p.sign) === 10
  );
  if (!found) return null;
  return {
    key: "amala",
    kind: "yoga",
    detail: `${found.id} in 10th from lagna/Moon`,
    strength: 2,
  };
}

function adhiYoga(c: Ctx): YogaResult | null {
  const moon = c.get("Moon");
  const benefics: PlanetId[] = ["Jupiter", "Venus", "Mercury"];
  const placed = benefics.filter((id) => {
    const rel = c.houseFrom(moon.sign, c.get(id).sign);
    return [6, 7, 8].includes(rel);
  });
  if (placed.length < 2) return null;
  return {
    key: "adhi",
    kind: "yoga",
    detail: `${placed.join(", ")} in 6th/7th/8th from Moon`,
    strength: placed.length === 3 ? 3 : 2,
  };
}

function saraswati(c: Ctx): YogaResult | null {
  const trio: PlanetId[] = ["Jupiter", "Venus", "Mercury"];
  const good = trio.every((id) => {
    const h = c.get(id).house;
    return [...KENDRA, ...TRIKONA, 2].includes(h);
  });
  const jupStrong = ["exalted", "own", "moolatrikona", "friend"].includes(
    c.get("Jupiter").dignity
  );
  if (!good || !jupStrong) return null;
  return {
    key: "saraswati",
    kind: "yoga",
    detail: "Jupiter, Venus, Mercury in kendra/trikona/2nd",
    strength: 3,
  };
}

function lakshmi(c: Ctx): YogaResult | null {
  const l9 = houseLord(c.lagna.sign, 9);
  const p9 = c.get(l9);
  const venus = c.get("Venus");
  const l9Strong =
    [...KENDRA, ...TRIKONA].includes(p9.house) &&
    ["exalted", "own", "moolatrikona"].includes(p9.dignity);
  const venusStrong = ["exalted", "own", "moolatrikona"].includes(venus.dignity);
  if (!l9Strong || !venusStrong) return null;
  return {
    key: "lakshmi",
    kind: "yoga",
    detail: "Strong 9th lord and Venus",
    strength: 3,
  };
}

function parivartana(c: Ctx): YogaResult[] {
  const out: YogaResult[] = [];
  const seen = new Set<string>();
  for (const a of c.planets) {
    if (a.id === "Rahu" || a.id === "Ketu") continue;
    for (const b of c.planets) {
      if (b.id === "Rahu" || b.id === "Ketu" || a.id === b.id) continue;
      if (
        OWN_SIGNS[a.id].includes(b.sign) &&
        OWN_SIGNS[b.id].includes(a.sign)
      ) {
        const pair = [a.id, b.id].sort().join("+");
        if (seen.has(pair)) continue;
        seen.add(pair);
        out.push({
          key: "parivartana",
          kind: "yoga",
          detail: `${a.id} and ${b.id} exchange signs`,
          strength: 2,
        });
      }
    }
  }
  return out;
}

function manglik(c: Ctx): YogaResult | null {
  const mars = c.get("Mars");
  const moon = c.get("Moon");
  const MANGLIK_HOUSES = [1, 2, 4, 7, 8, 12];
  const fromLagna = MANGLIK_HOUSES.includes(mars.house);
  const fromMoon = MANGLIK_HOUSES.includes(c.houseFrom(moon.sign, mars.sign));
  if (!fromLagna && !fromMoon) return null;
  return {
    key: "manglik",
    kind: "dosha",
    detail: fromLagna
      ? `Mars in house ${mars.house} from lagna`
      : "Mars in manglik position from Moon",
    strength: fromLagna && fromMoon ? 3 : fromLagna ? 2 : 1,
  };
}

function kaalSarp(c: Ctx): YogaResult | null {
  const rahu = c.get("Rahu").longitude;
  const ketu = c.get("Ketu").longitude;
  const others = c.planets.filter((p) => p.id !== "Rahu" && p.id !== "Ketu");
  // All planets within the arc from Rahu to Ketu (one direction) → dosha
  const arcRK = norm360(ketu - rahu); // 180°
  const inRahuToKetu = others.every((p) => norm360(p.longitude - rahu) < arcRK);
  const inKetuToRahu = others.every((p) => norm360(p.longitude - ketu) < norm360(rahu - ketu));
  if (!inRahuToKetu && !inKetuToRahu) return null;
  return {
    key: "kaal-sarp",
    kind: "dosha",
    detail: "All planets between Rahu and Ketu",
    strength: 2,
  };
}

function guruChandal(c: Ctx): YogaResult | null {
  const jup = c.get("Jupiter");
  const rahu = c.get("Rahu");
  const ketu = c.get("Ketu");
  if (jup.sign !== rahu.sign && jup.sign !== ketu.sign) return null;
  return {
    key: "guru-chandal",
    kind: "dosha",
    detail: `Jupiter with ${jup.sign === rahu.sign ? "Rahu" : "Ketu"}`,
    strength: 2,
  };
}

function grahanDosha(c: Ctx): YogaResult[] {
  const out: YogaResult[] = [];
  for (const lum of ["Sun", "Moon"] as PlanetId[]) {
    const p = c.get(lum);
    for (const node of ["Rahu", "Ketu"] as PlanetId[]) {
      if (p.sign === c.get(node).sign) {
        out.push({
          key: "grahan",
          kind: "dosha",
          detail: `${lum} with ${node}`,
          strength: 2,
        });
      }
    }
  }
  return out;
}

function shakata(c: Ctx): YogaResult | null {
  const moon = c.get("Moon");
  const jup = c.get("Jupiter");
  const rel = c.houseFrom(jup.sign, moon.sign);
  if (![6, 8, 12].includes(rel)) return null;
  return {
    key: "shakata",
    kind: "dosha",
    detail: "Moon in 6/8/12 from Jupiter",
    strength: 1,
  };
}

function lagnaLordStrong(c: Ctx): YogaResult | null {
  const lord = houseLord(c.lagna.sign, 1);
  const p = c.get(lord);
  const strong =
    [...KENDRA, ...TRIKONA].includes(p.house) &&
    ["exalted", "own", "moolatrikona", "friend"].includes(p.dignity);
  if (!strong) return null;
  return {
    key: "lagna-lord-strong",
    kind: "yoga",
    detail: `Lagna lord ${lord} well placed in house ${p.house}`,
    strength: 2,
  };
}
