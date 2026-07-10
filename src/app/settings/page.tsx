"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { db, getSetting, setSetting } from "@/lib/db";

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const [chartStyle, setChartStyle] = useState<"north" | "south">("north");
  const [ai, setAi] = useState<{ claude: boolean; gemini: boolean } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getSetting("chartStyle").then((v) => {
      if (v === "south" || v === "north") setChartStyle(v);
    });
    fetch("/api/ask-ai")
      .then((r) => (r.ok ? r.json() : null))
      .then(setAi)
      .catch(() => setAi({ claude: false, gemini: false }));
  }, []);

  const saveChartStyle = (s: "north" | "south") => {
    setChartStyle(s);
    void setSetting("chartStyle", s);
  };

  const exportData = async () => {
    const profiles = await db.profiles.toArray();
    const qaHistory = await db.qaHistory.toArray();
    const blob = new Blob(
      [JSON.stringify({ version: 1, profiles, qaHistory }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kundli-predict-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.profiles)) throw new Error("bad file");
      for (const p of data.profiles) {
        const { id: _id, ...rest } = p;
        await db.profiles.add(rest);
      }
      setMessage(`✓ Imported ${data.profiles.length} profiles`);
    } catch {
      setMessage("✕ Invalid backup file");
    }
    e.target.value = "";
  };

  const row = "card flex flex-wrap items-center justify-between gap-3 p-5";

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold text-(--color-gold-soft)">{t("settings")}</h1>

        <div className={row}>
          <span>{t("language")}</span>
          <div className="flex gap-2">
            {(["en", "hi"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-md border px-4 py-1.5 text-sm ${
                  lang === l ? "accent-bg border-(--accent)" : "border-(--color-line) text-(--color-ink-soft)"
                }`}
              >
                {l === "en" ? "English" : "हिंदी"}
              </button>
            ))}
          </div>
        </div>

        <div className={row}>
          <span>{t("chartStyle")}</span>
          <div className="flex gap-2">
            {(["north", "south"] as const).map((s) => (
              <button
                key={s}
                onClick={() => saveChartStyle(s)}
                className={`rounded-md border px-4 py-1.5 text-sm ${
                  chartStyle === s ? "accent-bg border-(--accent)" : "border-(--color-line) text-(--color-ink-soft)"
                }`}
              >
                {s === "north" ? t("northIndian") : t("southIndian")}
              </button>
            ))}
          </div>
        </div>

        <div className={row}>
          <div>
            <span>{t("aiStatus")}</span>
            <p className="mt-1 text-xs text-(--color-ink-soft)">
              {ai === null
                ? "…"
                : ai.claude || ai.gemini
                  ? `✓ ${t("aiConfigured")} (${[ai.claude && "Claude", ai.gemini && "Gemini"].filter(Boolean).join(" + ")})`
                  : t("aiNotConfigured")}
            </p>
          </div>
        </div>

        <div className={row}>
          <div>
            <span>{t("exportData")} / {t("importData")}</span>
            <p className="mt-1 text-xs text-(--color-ink-soft)">{t("dataNote")}</p>
            {message && <p className="mt-1 text-xs accent-text">{message}</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportData}
              className="rounded-md border border-(--color-line) px-4 py-1.5 text-sm text-(--color-ink-soft) hover:text-(--color-ink)"
            >
              ⬇ Export
            </button>
            <label className="cursor-pointer rounded-md border border-(--color-line) px-4 py-1.5 text-sm text-(--color-ink-soft) hover:text-(--color-ink)">
              ⬆ Import
              <input type="file" accept=".json" className="hidden" onChange={importData} />
            </label>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
