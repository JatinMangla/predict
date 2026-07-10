"use client";

// Classic North Indian (diamond) chart. Houses are fixed positions;
// the sign number rotates with the lagna. Planets render inside houses.

import type { VargaChart } from "@/lib/astro/types";
import { planetAbbr } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const S = 400;

/** Centroid label positions for houses 1–12 (anti-clockwise from top diamond) */
const HOUSE_POS: [number, number][] = [
  [200, 105], // 1
  [100, 48],  // 2
  [46, 100],  // 3
  [95, 200],  // 4
  [46, 300],  // 5
  [100, 352], // 6
  [200, 295], // 7
  [300, 352], // 8
  [354, 300], // 9
  [305, 200], // 10
  [354, 100], // 11
  [300, 48],  // 12
];

/** Where the small sign-number sits within each house */
const SIGN_POS: [number, number][] = [
  [200, 175], [55, 18], [16, 55], [160, 200], [16, 345], [55, 382],
  [200, 225], [345, 382], [384, 345], [240, 200], [384, 55], [345, 18],
];

export function NorthIndianChart({
  chart,
  lagnaSign,
  title,
}: {
  chart: VargaChart;
  lagnaSign: number;
  title?: string;
}) {
  const { lang } = useI18n();

  // Group planets by house relative to lagna
  const byHouse: string[][] = Array.from({ length: 12 }, () => []);
  for (const pos of chart) {
    if (pos.planet === "Lagna") continue;
    const house = ((pos.sign - lagnaSign + 12) % 12) + 1;
    byHouse[house - 1].push(planetAbbr(pos.planet, lang));
  }

  return (
    <div className="card p-4">
      {title && (
        <div className="mb-2 text-center text-sm font-medium text-[--color-gold-soft]">
          {title}
        </div>
      )}
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-md">
        <rect x="1" y="1" width={S - 2} height={S - 2} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        {/* diagonals */}
        <line x1="1" y1="1" x2={S - 1} y2={S - 1} stroke="var(--accent)" strokeWidth="1" />
        <line x1={S - 1} y1="1" x2="1" y2={S - 1} stroke="var(--accent)" strokeWidth="1" />
        {/* midpoint diamond */}
        <line x1={S / 2} y1="1" x2="1" y2={S / 2} stroke="var(--accent)" strokeWidth="1" />
        <line x1="1" y1={S / 2} x2={S / 2} y2={S - 1} stroke="var(--accent)" strokeWidth="1" />
        <line x1={S / 2} y1={S - 1} x2={S - 1} y2={S / 2} stroke="var(--accent)" strokeWidth="1" />
        <line x1={S - 1} y1={S / 2} x2={S / 2} y2="1" stroke="var(--accent)" strokeWidth="1" />

        {HOUSE_POS.map(([x, y], i) => {
          const sign = ((lagnaSign + i) % 12) + 1; // 1-based sign number
          const planets = byHouse[i];
          return (
            <g key={i}>
              <text
                x={SIGN_POS[i][0]}
                y={SIGN_POS[i][1]}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-ink-soft)"
              >
                {sign}
              </text>
              {planets.map((p, j) => {
                const perRow = 3;
                const row = Math.floor(j / perRow);
                const col = j % perRow;
                const rowCount = Math.min(planets.length - row * perRow, perRow);
                const dx = (col - (rowCount - 1) / 2) * 26;
                const dy = row * 15 - ((Math.ceil(planets.length / perRow) - 1) * 15) / 2;
                return (
                  <text
                    key={j}
                    x={x + dx}
                    y={y + dy}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="600"
                    fill="var(--color-ink)"
                  >
                    {p}
                  </text>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
