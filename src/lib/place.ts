"use client";

// "Where you are now" — the place used for everything that depends on the
// local sky TODAY: sunrise, Rahu Kaal, Abhijit, choghadiya, panchang and the
// personal day scores. The birth place only ever drives the natal chart;
// someone born in Delhi who lives in London needs London's sunrise.

import { useLiveQuery } from "dexie-react-hooks";
import { db, getSetting, setSetting } from "./db";

export interface Place {
  place: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const KEY = "currentPlace";

function parse(raw: string | undefined): Place | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Place;
    if (typeof p.latitude === "number" && typeof p.longitude === "number") return p;
  } catch {
    // corrupt setting — behave as unset
  }
  return null;
}

export async function getCurrentPlace(): Promise<Place | null> {
  return parse(await getSetting(KEY));
}

export async function setCurrentPlace(p: Place | null): Promise<void> {
  if (p === null) await db.settings.delete(KEY);
  else await setSetting(KEY, JSON.stringify(p));
}

/** The saved current place: undefined while loading, null when unset */
export function useCurrentPlace(): Place | null | undefined {
  return useLiveQuery(async () => parse((await db.settings.get(KEY))?.value), [], undefined);
}

/** The current place if set, else the given fallback (usually the birth place) */
export function placeOrFallback(
  current: Place | null | undefined,
  fallback: { latitude: number; longitude: number; place?: string; timezone?: string }
): Place {
  if (current) return current;
  return {
    place: fallback.place ?? "",
    latitude: fallback.latitude,
    longitude: fallback.longitude,
    timezone: fallback.timezone ?? "",
  };
}
