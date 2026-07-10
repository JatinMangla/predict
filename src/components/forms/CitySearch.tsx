"use client";

// Offline city autocomplete over the bundled GeoNames dataset.
// Rows: [name, state, countryCode, lat, lon, timezone, population]

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type CityRow = [string, string, string, number, number, string, number];

export interface CityPick {
  place: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

let citiesCache: CityRow[] | null = null;

async function loadCities(): Promise<CityRow[]> {
  if (!citiesCache) {
    const mod = await import("@/data/cities.json");
    citiesCache = mod.default as CityRow[];
  }
  return citiesCache;
}

export function CitySearch({
  value,
  onPick,
}: {
  value: string;
  onPick: (c: CityPick) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CityRow[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    loadCities().then((cities) => {
      if (cancelled) return;
      const starts: CityRow[] = [];
      const contains: CityRow[] = [];
      for (const c of cities) {
        const name = c[0].toLowerCase();
        if (name.startsWith(q)) starts.push(c);
        else if (name.includes(q)) contains.push(c);
        if (starts.length >= 30) break;
      }
      setResults([...starts, ...contains].slice(0, 12));
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("searchCity")}
        className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2.5 text-(--color-ink) outline-none focus:border-(--accent)"
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-(--color-line) bg-(--color-surface-2) shadow-xl">
          {results.map((c, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-(--color-surface-3)"
                onClick={() => {
                  const label = `${c[0]}${c[1] ? ", " + c[1] : ""}, ${c[2]}`;
                  setQuery(label);
                  setOpen(false);
                  onPick({
                    place: label,
                    latitude: c[3],
                    longitude: c[4],
                    timezone: c[5],
                  });
                }}
              >
                <span className="text-(--color-ink)">{c[0]}</span>
                <span className="text-(--color-ink-soft)">
                  {c[1] ? `, ${c[1]}` : ""} · {c[2]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
