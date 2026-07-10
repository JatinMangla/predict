"use client";

// Birth details entry — everything the engine needs for an accurate kundli:
// name, gender, date, exact time, and place (offline autocomplete with a
// manual-coordinates fallback for villages not in the database).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { CitySearch, type CityPick } from "./CitySearch";
import type { StoredProfile } from "@/lib/astro/types";

const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Kathmandu", "Asia/Dhaka", "Asia/Karachi",
  "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Europe/London",
  "Europe/Berlin", "Europe/Paris", "America/New_York", "America/Chicago",
  "America/Denver", "America/Los_Angeles", "America/Toronto", "UTC",
];

export function BirthDetailsForm({ existing }: { existing?: StoredProfile }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [gender, setGender] = useState<StoredProfile["gender"]>(existing?.gender ?? "male");
  const [date, setDate] = useState(existing?.localDateTime.slice(0, 10) ?? "");
  const [time, setTime] = useState(existing?.localDateTime.slice(11, 16) ?? "");
  const [place, setPlace] = useState(existing?.place ?? "");
  const [lat, setLat] = useState<string>(existing ? String(existing.latitude) : "");
  const [lon, setLon] = useState<string>(existing ? String(existing.longitude) : "");
  const [tz, setTz] = useState(existing?.timezone ?? "Asia/Kolkata");
  const [manual, setManual] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onPick = (c: CityPick) => {
    setPlace(c.place);
    setLat(String(c.latitude));
    setLon(String(c.longitude));
    setTz(c.timezone);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const latN = Number(lat);
    const lonN = Number(lon);
    if (!name.trim()) return setError("Name is required / नाम आवश्यक है");
    if (!date || !time) return setError("Date and time are required / तिथि व समय आवश्यक हैं");
    if (!place.trim() || Number.isNaN(latN) || Number.isNaN(lonN) || (latN === 0 && lonN === 0)) {
      return setError("Pick a birth place from the list (or enter coordinates) / जन्म स्थान चुनें");
    }
    if (latN < -90 || latN > 90 || lonN < -180 || lonN > 180) {
      return setError("Invalid coordinates / अमान्य निर्देशांक");
    }
    setBusy(true);
    try {
      const now = Date.now();
      const profile: StoredProfile = {
        ...(existing?.id ? { id: existing.id } : {}),
        name: name.trim(),
        gender,
        localDateTime: `${date}T${time}`,
        timezone: tz,
        latitude: latN,
        longitude: lonN,
        place: place.trim(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const id = await db.profiles.put(profile);
      router.push(`/kundli/${id}`);
    } catch {
      setError(t("error"));
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2.5 text-(--color-ink) outline-none focus:border-(--accent)";

  return (
    <form onSubmit={submit} className="card mx-auto max-w-xl space-y-5 p-6">
      <h1 className="text-xl font-semibold text-(--color-gold-soft)">{t("birthDetails")}</h1>

      <div>
        <label className="mb-1 block text-sm text-(--color-ink-soft)">{t("fullName")}</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>

      <div>
        <label className="mb-1 block text-sm text-(--color-ink-soft)">{t("gender")}</label>
        <div className="flex gap-2">
          {(["male", "female", "other"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`rounded-lg border px-4 py-2 text-sm transition ${
                gender === g
                  ? "accent-bg border-(--accent) text-(--color-ink)"
                  : "border-(--color-line) text-(--color-ink-soft)"
              }`}
            >
              {t(g)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-(--color-ink-soft)">{t("birthDate")}</label>
          <input type="date" className={inputCls} value={date} min="1900-01-01" max="2099-12-31" onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-(--color-ink-soft)">{t("birthTime")}</label>
          <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-(--color-ink-soft)">{t("timeAccuracyNote")}</p>

      <div>
        <label className="mb-1 block text-sm text-(--color-ink-soft)">{t("birthPlace")}</label>
        <CitySearch value={place} onPick={onPick} />
        <button
          type="button"
          onClick={() => setManual(!manual)}
          className="mt-2 text-xs text-(--color-ink-soft) underline"
        >
          {t("manualCoords")}
        </button>
      </div>

      {manual && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-(--color-ink-soft)">{t("latitude")}</label>
            <input className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="28.61" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-(--color-ink-soft)">{t("longitude")}</label>
            <input className={inputCls} value={lon} onChange={(e) => setLon(e.target.value)} placeholder="77.21" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-(--color-ink-soft)">{t("timezone")}</label>
            <select className={inputCls} value={tz} onChange={(e) => setTz(e.target.value)}>
              {TIMEZONES.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {lat && lon && !manual && (
        <p className="text-xs text-(--color-ink-soft)">
          {place} · {Number(lat).toFixed(2)}°, {Number(lon).toFixed(2)}° · {tz}
        </p>
      )}

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-(--accent) px-4 py-3 font-medium text-[#14100a] transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? t("loading") : t("save")}
      </button>
    </form>
  );
}
