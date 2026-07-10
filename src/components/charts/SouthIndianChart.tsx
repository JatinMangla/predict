"use client";

// South Indian chart: fixed 4×4 grid of signs; the lagna cell is marked
// with a diagonal stroke. Planets render inside their sign cells.

import type { VargaChart } from "@/lib/astro/types";
import { planetAbbr, signName } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

/** Grid cells (col,row) for signs 0–11 (Aries..Pisces), classic layout */
const SIGN_CELL: [number, number][] = [
  [1, 0], // Aries
  [2, 0], // Taurus
  [3, 0], // Gemini
  [3, 1], // Cancer
  [3, 2], // Leo
  [3, 3], // Virgo
  [2, 3], // Libra
  [1, 3], // Scorpio
  [0, 3], // Sagittarius
  [0, 2], // Capricorn
  [0, 1], // Aquarius
  [0, 0], // Pisces
];

const CELL = 100;

export function SouthIndianChart({
  chart,
  lagnaSign,
  title,
}: {
  chart: VargaChart;
  lagnaSign: number;
  title?: string;
}) {
  const { lang } = useI18n();

  const bySign: string[][] = Array.from({ length: 12 }, () => []);
  for (const pos of chart) {
    if (pos.planet === "Lagna") continue;
    bySign[pos.sign].push(planetAbbr(pos.planet, lang));
  }

  return (
    <div className="card p-4">
      {title && (
        <div className="mb-2 text-center text-sm font-medium text-[--color-gold-soft]">
          {title}
        </div>
      )}
      <svg viewBox="0 0 400 400" className="mx-auto w-full max-w-md">
        <rect x="1" y="1" width="398" height="398" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        {SIGN_CELL.map(([cx, cy], sign) => {
          const x = cx * CELL;
          const y = cy * CELL;
          const isLagna = sign === lagnaSign;
          const planets = bySign[sign];
          return (
            <g key={sign}>
              <rect
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                fill={isLagna ? "var(--accent-soft)" : "none"}
                stroke="var(--accent)"
                strokeWidth="1"
              />
              {isLagna && (
                <line
                  x1={x}
                  y1={y + 22}
                  x2={x + 22}
                  y2={y}
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                />
              )}
              <text x={x + 5} y={y + 13} fontSize="9" fill="var(--color-ink-soft)">
                {signName(sign, lang).slice(0, lang === "hi" ? 4 : 3)}
              </text>
              {planets.map((p, j) => {
                const perRow = 3;
                const row = Math.floor(j / perRow);
                const col = j % perRow;
                return (
                  <text
                    key={j}
                    x={x + 20 + col * 28}
                    y={y + 42 + row * 18}
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
        {/* center title block */}
        <text x="200" y="195" textAnchor="middle" fontSize="14" fill="var(--color-gold-soft)">
          {title ?? ""}
        </text>
        <text x="200" y="215" textAnchor="middle" fontSize="20" fill="var(--accent)">
          ॐ
        </text>
      </svg>
    </div>
  );
}
