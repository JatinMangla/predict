// Local-first storage: profiles, Q&A history, and app settings live in
// IndexedDB on the device. No personal data leaves the browser.

import Dexie, { type EntityTable } from "dexie";
import type { StoredProfile } from "./astro/types";

export interface QARecord {
  id?: number;
  profileId: number;
  question: string;
  answer: string;
  source: "engine" | "ai";
  confidence?: number;
  createdAt: number;
}

export interface SettingRecord {
  key: string;
  value: string;
}

/** One row per AI call — powers the visible usage/cost meter and daily cap */
export interface AiUsageRecord {
  id?: number;
  /** local calendar date yyyy-mm-dd */
  date: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: number;
}

const db = new Dexie("kundli-predict") as Dexie & {
  profiles: EntityTable<StoredProfile, "id">;
  qaHistory: EntityTable<QARecord, "id">;
  settings: EntityTable<SettingRecord, "key">;
  aiUsage: EntityTable<AiUsageRecord, "id">;
};

db.version(1).stores({
  profiles: "++id, name, createdAt",
  qaHistory: "++id, profileId, createdAt",
  settings: "key",
});

db.version(2).stores({
  profiles: "++id, name, createdAt",
  qaHistory: "++id, profileId, createdAt",
  settings: "key",
  aiUsage: "++id, date, createdAt",
});

export { db };

export async function getSetting(key: string): Promise<string | undefined> {
  const rec = await db.settings.get(key);
  return rec?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}
