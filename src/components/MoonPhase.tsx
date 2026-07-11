"use client";

// Astronomically correct moon rendering from the Sun–Moon elongation:
// 0° = new (dark), 90° = first quarter (right half lit), 180° = full,
// 270° = last quarter (left half lit). Waxing lights the right side,
// waning the left — as seen from the northern hemisphere.

export function MoonPhase({
  elongation,
  size = 28,
  title,
}: {
  elongation: number;
  size?: number;
  title?: string;
}) {
  const e = ((elongation % 360) + 360) % 360;
  const waxing = e <= 180;
  const ph = waxing ? e : 360 - e; // 0 (new) … 180 (full)
  const r = size / 2 - 1;
  const rx = Math.abs(Math.cos((ph * Math.PI) / 180)) * r;

  // Outer arc traces the lit limb (right when waxing, left when waning);
  // the terminator ellipse closes the lit region.
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = (ph < 90) === waxing ? 0 : 1;
  const litPath =
    ph < 1
      ? "" // new moon — nothing lit
      : `M 0 ${-r} A ${r} ${r} 0 0 ${sweepOuter} 0 ${r} A ${rx} ${r} 0 0 ${sweepInner} 0 ${-r} Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      role="img"
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {/* dark disk */}
      <circle r={r} fill="#151a33" stroke="#3a4270" strokeWidth="0.8" />
      {/* lit portion */}
      {litPath && <path d={litPath} fill="#f0d89a" />}
      {/* soft crater hints on the lit side for a fuller moon */}
      {ph > 150 && (
        <>
          <circle cx={-r * 0.3} cy={-r * 0.2} r={r * 0.14} fill="#e2c67e" />
          <circle cx={r * 0.25} cy={r * 0.3} r={r * 0.1} fill="#e2c67e" />
          <circle cx={r * 0.1} cy={-r * 0.35} r={r * 0.08} fill="#e2c67e" />
        </>
      )}
    </svg>
  );
}
