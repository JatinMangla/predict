"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { db, getSetting, setSetting } from "@/lib/db";
import { setAiSetting, fmtCost, fmtDuration, fmtUntil } from "@/lib/aiClient";
import { useAiQuota } from "@/lib/useAiQuota";

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const [chartStyle, setChartStyle] = useState<"north" | "south">("north");
  const { cfg, usage, refresh } = useAiQuota();
  const [keyInput, setKeyInput] = useState("");
  const [message, setMessage] = useState("");
  const [keyMessage, setKeyMessage] = useState("");

  useEffect(() => {
    getSetting("chartStyle").then((v) => {
      if (v === "south" || v === "north") setChartStyle(v);
    });
  }, []);

  // Prefill the key box once the stored config arrives
  useEffect(() => {
    if (cfg) setKeyInput(cfg.geminiKey);
  }, [cfg]);

  const saveChartStyle = (s: "north" | "south") => {
    setChartStyle(s);
    void setSetting("chartStyle", s);
  };

  const saveKey = async () => {
    const trimmed = keyInput.trim();
    await setAiSetting("geminiKey", trimmed);
    // A different key means a different quota — re-read the figures
    await refresh();
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

  // Only shown once Claude has actually answered once and reported its headers
  const claudeRemaining = usage?.claude?.requestsRemaining ?? null;

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

          {/* Real Gemini free-quota meter — the anti-surprise-bill display */}
          {usage && (
            <div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-(--color-line) p-3">
                  <p className="text-xs text-(--color-ink-soft)">{t("aiUsageToday")}</p>
                  <p
                    className={`mt-1 text-lg font-semibold ${
                      usage.geminiRemaining <= 0 ? "text-red-300" : "accent-text"
                    }`}
                  >
                    {usage.geminiRemaining}/{usage.geminiLimit}{" "}
                    <span className="text-xs font-normal">{t("freeCallsLeft")}</span>
                  </p>
                  <p className="text-xs text-(--color-ink-soft)">{fmtCost(usage.costTodayUsd)}</p>
                  {usage.resetAt !== null && (
                    <p className="text-xs text-(--color-ink-soft)">
                      {t("quotaResetsIn")} {fmtUntil(usage.resetAt)}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-(--color-line) p-3">
                  <p className="text-xs text-(--color-ink-soft)">{t("aiCost30d")}</p>
                  <p className="mt-1 text-lg font-semibold accent-text">{fmtCost(usage.cost30dUsd)}</p>
                  <p className="text-xs text-(--color-ink-soft)">Gemini = {t("free")}</p>
                </div>
              </div>

              {/* Anthropic reports its real remaining limits on every response */}
              {claudeRemaining !== null && (
                <p className="mt-1.5 text-xs text-(--color-ink-soft)">
                  Claude: {claudeRemaining}
                  {usage.claude?.requestsLimit != null
                    ? `/${usage.claude.requestsLimit}`
                    : ""}{" "}
                  {t("requestsRemaining")}
                </p>
              )}

              <p className="mt-1.5 text-xs text-(--color-ink-soft)">{t("quotaNote")}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <p className="text-xs text-(--color-ink-soft)">
                  {usage.syncedAt === 0
                    ? t("quotaNeverSynced")
                    : `${t("quotaSynced")} ${fmtDuration(
                        Date.now() - usage.syncedAt
                      )} ${t("ago")}`}
                </p>
                <button
                  onClick={() => void refresh()}
                  className="rounded-md border border-(--color-line) px-2 py-0.5 text-xs text-(--color-ink-soft) transition hover:border-(--accent)"
                >
                  ↻ {t("refresh")}
                </button>
              </div>
            </div>
          )}

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
