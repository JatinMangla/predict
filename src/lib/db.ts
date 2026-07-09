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

const db = new Dexie("kundli-predict") as Dexie & {
  profiles: EntityTable<StoredProfile, "id">;
  qaHistory: EntityTable<QARecord, "id">;
  settings: EntityTable<SettingRecord, "key">;
};

db.version(1).stores({
  profiles: "++id, name, createdAt",
  qaHistory: "++id, profileId, createdAt",
  settings: "key",
});

export { db };

export async function getSetting(key: string): Promise<string | undefined> {
  const rec = await db.settings.get(key);
  return rec?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}
