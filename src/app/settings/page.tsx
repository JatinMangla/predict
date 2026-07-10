"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { db, getSetting, setSetting } from "@/lib/db";
import {
  getAiConfig,
  getUsageSummary,
  setAiSetting,
  fmtCost,
  DEFAULT_DAILY_LIMIT,
  type AiConfig,
  type AiMode,
  type UsageSummary,
} from "@/lib/aiClient";

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const [chartStyle, setChartStyle] = useState<"north" | "south">("north");
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [limitInput, setLimitInput] = useState(String(DEFAULT_DAILY_LIMIT));
  const [keyInput, setKeyInput] = useState("");
  const [message, setMessage] = useState("");
  const [keyMessage, setKeyMessage] = useState("");

  useEffect(() => {
    getSetting("chartStyle").then((v) => {
      if (v === "south" || v === "north") setChartStyle(v);
    });
    getAiConfig().then((c) => {
      setCfg(c);
      setLimitInput(String(c.dailyLimit));
      setKeyInput(c.geminiKey);
    });
    getUsageSummary().then(setUsage);
  }, []);

  const saveChartStyle = (s: "north" | "south") => {
    setChartStyle(s);
    void setSetting("chartStyle", s);
  };

  const saveMode = async (m: AiMode) => {
    await setAiSetting("aiMode", m);
    setCfg((c) => (c ? { ...c, mode: m } : c));
  };

  const saveLimit = async (v: string) => {
    setLimitInput(v);
    const n = Math.max(0, Math.min(500, Number(v) || 0));
    await setAiSetting("aiDailyLimit", String(n));
    setCfg((c) => (c ? { ...c, dailyLimit: n } : c));
  };

  const saveKey = async () => {
    const trimmed = keyInput.trim();
    await setAiSetting("geminiKey", trimmed);
    setCfg((c) => (c ? { ...c, geminiKey: trimmed } : c));
    setKeyMessage(trimmed ? `✓ ${t("keySaved")}` : `✓ ${t("keyRemoved")}`);
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
  const inputCls =
    "rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--accent)";

  const aiConfigured =
    cfg !== null && (cfg.serverClaude || cfg.serverGemini || cfg.geminiKey.length > 0);

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

        {/* ── AI control panel ─────────────────────────────────── */}
        <div className="card space-y-5 p-5">
          <div>
            <h2 className="font-medium text-(--color-gold-soft)">✨ {t("aiStatus")}</h2>
            <p className="mt-1 text-xs text-(--color-ink-soft)">
              {cfg === null
                ? "…"
                : aiConfigured
                  ? `✓ ${t("aiConfigured")} (${[
                      cfg.serverClaude && "Claude",
                      (cfg.serverGemini || cfg.geminiKey) && "Gemini",
                    ]
                      .filter(Boolean)
                      .join(" + ")})`
                  : t("aiNotConfigured")}
            </p>
          </div>

          {/* Usage meter — the anti-surprise-bill display */}
          {usage && cfg && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-(--color-line) p-3">
                <p className="text-xs text-(--color-ink-soft)">{t("aiUsageToday")}</p>
                <p className="mt-1 text-lg font-semibold accent-text">
                  {usage.callsToday}/{cfg.dailyLimit}{" "}
                  <span className="text-xs font-normal">{t("calls")}</span>
                </p>
                <p className="text-xs text-(--color-ink-soft)">{fmtCost(usage.costTodayUsd)}</p>
              </div>
              <div className="rounded-lg border border-(--color-line) p-3">
                <p className="text-xs text-(--color-ink-soft)">{t("aiCost30d")}</p>
                <p className="mt-1 text-lg font-semibold accent-text">{fmtCost(usage.cost30dUsd)}</p>
                <p className="text-xs text-(--color-ink-soft)">Gemini = {t("free")}</p>
              </div>
            </div>
          )}

          {/* Mode */}
          <div>
            <p className="mb-2 text-sm">{t("aiMode")}</p>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["always", t("aiModeAlways")],
                  ["fallback", t("aiModeFallback")],
                  ["never", t("aiModeNever")],
                ] as [AiMode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => saveMode(m)}
                  className={`rounded-md border px-4 py-2 text-left text-sm ${
                    cfg?.mode === m
                      ? "accent-bg border-(--accent)"
                      : "border-(--color-line) text-(--color-ink-soft)"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Daily cap */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{t("aiDailyLimit")}</span>
            <input
              type="number"
              min={0}
              max={500}
              value={limitInput}
              onChange={(e) => saveLimit(e.target.value)}
              className={`${inputCls} w-24 text-center`}
            />
          </div>

          {/* Free Gemini key, stored locally */}
          <div>
            <p className="mb-1 text-sm">{t("geminiKeyLocal")}</p>
            <p className="mb-2 text-xs text-(--color-ink-soft)">{t("geminiKeyNote")}</p>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIza…"
                autoComplete="off"
                className={`${inputCls} flex-1`}
              />
              <button
                onClick={saveKey}
                className="rounded-lg bg-(--accent) px-4 py-2 text-sm font-medium text-[#14100a] transition hover:brightness-110"
              >
                ✓
              </button>
            </div>
            {keyMessage && <p className="mt-1 text-xs accent-text">{keyMessage}</p>}
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
