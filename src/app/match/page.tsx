"use client";

// Kundli Milan: pick two saved profiles, get the 36-guna Ashtakoota table
// with dosha cancellations, Manglik parity, Rajju/Vedha, and an AI reading
// that goes beyond the gunas into both full charts.

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppShell } from "@/components/AppShell";
import { Markdown } from "@/components/Markdown";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { computeKundli } from "@/lib/astro/kundli";
import { matchKundlis, KOOTA_INFO, moonInput } from "@/lib/astro/matching";
import type { Kundli, StoredProfile } from "@/lib/astro/types";
import { callAi, aiAvailable, aiErrorKey, fmtCost } from "@/lib/aiClient";
import { useAiQuota } from "@/lib/useAiQuota";
import { nakshatraName, signName } from "@/lib/format";

export default function MatchPage() {
  return (
    <Suspense fallback={null}>
      <MatchInner />
    </Suspense>
  );
}

function safeKundli(p: StoredProfile | undefined): Kundli | null {
  if (!p) return null;
  try {
    return computeKundli(p);
  } catch {
    return null;
  }
}

function MatchInner() {
  const params = useSearchParams();
  const { t, lang } = useI18n();
  const L = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const profiles = useLiveQuery(() => db.profiles.orderBy("name").toArray(), []);
  const [groomId, setGroomId] = useState<number | null>(() => Number(params.get("groom")) || null);
  const [brideId, setBrideId] = useState<number | null>(() => Number(params.get("bride")) || null);
  const { cfg } = useAiQuota();
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const [reading, setReading] = useState<{ text: string; provider: string; costUsd: number } | null>(null);
  const [notice, setNotice] = useState("");

  const groom = useMemo(() => safeKundli(profiles?.find((p) => p.id === groomId)), [profiles, groomId]);
  const bride = useMemo(() => safeKundli(profiles?.find((p) => p.id === brideId)), [profiles, brideId]);
  const result = useMemo(() => (groom && bride ? matchKundlis(groom, bride) : null), [groom, bride]);

  const canUseAi = cfg !== null && aiAvailable(cfg);

  const askAi = async () => {
    if (!groom || !bride || !result || !cfg || busy) return;
    setBusy(true);
    setLive("");
    setReading(null);
    setNotice("");
    const table = result.kootas
      .map((k) => `${KOOTA_INFO[k.key].name.en}: ${k.score}/${k.max} (${k.detail})${k.cancelledBy ? ` — dosha cancelled: ${k.cancelledBy}` : ""}`)
      .join("\n");
    const question =
      `Assess marriage compatibility of Person A (groom, ${groom.birth.name}) and Person B (bride, ${bride.birth.name}).\n\n` +
      `ASHTAKOOTA (computed): total ${result.total}/36 (${result.verdict})\n${table}\n` +
      `Manglik (active, after cancellations): groom ${result.manglik.groom ? "yes" : "no"}, bride ${result.manglik.bride ? "yes" : "no"}.\n` +
      `Rajju: ${result.rajju.same ? `SAME (${result.rajju.part}) — rajju dosha` : "different — fine"}. Vedha: ${result.vedha ? "present" : "none"}.\n` +
      `Active doshas: ${result.activeDoshas.join(", ") || "none"}.`;
    const r = await callAi(question, groom, lang, cfg, "match", {
      partner: bride,
      onDelta: (d) => setLive((s) => s + d),
    });
    setBusy(false);
    if (typeof r === "string") {
      setNotice(t(aiErrorKey(r)));
      return;
    }
    setReading({ text: r.answer, provider: r.provider, costUsd: r.costUsd });
  };

  const select = (value: number | null, set: (n: number | null) => void, label: string) => (
    <label className="flex-1">
      <span className="mb-1 block text-xs text-(--color-ink-soft)">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          set(e.target.value ? Number(e.target.value) : null);
          setReading(null);
        }}
        className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2.5 text-sm outline-none focus:border-(--accent)"
      >
        <option value="">{L("Choose a profile", "प्रोफ़ाइल चुनें")}</option>
        {profiles?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.localDateTime.slice(0, 10)}
          </option>
        ))}
      </select>
    </label>
  );

  const moonLine = (k: Kundli) => {
    const m = moonInput(k);
    return `${signName(m.sign, lang)} · ${nakshatraName(m.nakshatra, lang)} ${m.pada}`;
  };

  const verdictText = result
    ? {
        excellent: L("Excellent match", "उत्तम मिलान"),
        good: L("Good match", "अच्छा मिलान"),
        average: L("Acceptable — check the doshas", "सामान्य — दोष देखें"),
        poor: L("Weak match by gunas", "गुणों से कमजोर मिलान"),
      }[result.verdict]
    : "";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-(--color-gold-soft)">💞 {L("Kundli Milan", "कुंडली मिलान")}</h1>
          <p className="mt-1 text-xs text-(--color-ink-soft)">
            {L(
              "Ashtakoota (36 gunas) with classical dosha cancellations, Manglik parity and the South-Indian Rajju/Vedha checks.",
              "अष्टकूट (36 गुण) शास्त्रीय दोष-भंग सहित, मांगलिक मिलान और दक्षिण भारतीय रज्जु/वेध जाँच।"
            )}
          </p>
        </div>

        {profiles && profiles.length < 2 ? (
          <div className="card p-6 text-center text-sm text-(--color-ink-soft)">
            {L("Save at least two profiles to match them.", "मिलान के लिए कम से कम दो प्रोफ़ाइल सहेजें।")}{" "}
            <Link href="/new" className="accent-text underline">{t("createKundli")}</Link>
          </div>
        ) : (
          <div className="card flex flex-col gap-3 p-5 sm:flex-row">
            {select(groomId, setGroomId, L("Groom", "वर"))}
            {select(brideId, setBrideId, L("Bride", "वधू"))}
          </div>
        )}

        {groom && bride && result && (
          <>
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm">
                  <p><b>{groom.birth.name}</b>: {moonLine(groom)}</p>
                  <p><b>{bride.birth.name}</b>: {moonLine(bride)}</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold accent-text">
                    {result.total}
                    <span className="text-lg text-(--color-ink-soft)">/36</span>
                  </p>
                  <p className={`text-sm ${result.verdict === "poor" ? "text-red-300" : result.verdict === "average" ? "text-amber-300" : "text-emerald-300"}`}>
                    {verdictText}
                  </p>
                </div>
              </div>
            </div>

            <div className="card overflow-x-auto p-5">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-(--color-ink-soft)">
                  <tr>
                    <th className="py-1">{L("Koota", "कूट")}</th>
                    <th>{L("Points", "अंक")}</th>
                    <th>{L("Details", "विवरण")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.kootas.map((k) => {
                    const info = KOOTA_INFO[k.key];
                    return (
                      <tr key={k.key} className="border-t border-(--color-line) align-top">
                        <td className="py-2 pr-3">
                          <p className="font-medium">{lang === "hi" ? info.name.hi : info.name.en}</p>
                          <p className="text-xs text-(--color-ink-soft)">{lang === "hi" ? info.about.hi : info.about.en}</p>
                        </td>
                        <td className={`pr-3 tabular-nums ${k.score === 0 ? "text-red-300" : k.score === k.max ? "text-emerald-300" : ""}`}>
                          {k.score}/{k.max}
                        </td>
                        <td className="text-xs">
                          {k.detail}
                          {k.cancelledBy && (
                            <p className="mt-0.5 text-emerald-300">✓ {L("dosha cancelled", "दोष निरस्त")}: {k.cancelledBy}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card p-4 text-sm">
                <p className="text-xs uppercase tracking-wider text-(--color-ink-soft)">{L("Manglik", "मांगलिक")}</p>
                <p className="mt-1">
                  {L("Groom", "वर")}: {result.manglik.groom ? L("yes", "हाँ") : L("no", "नहीं")} · {L("Bride", "वधू")}:{" "}
                  {result.manglik.bride ? L("yes", "हाँ") : L("no", "नहीं")}
                </p>
                <p className={result.manglik.balanced ? "text-emerald-300" : "text-orange-300"}>
                  {result.manglik.balanced ? L("Balanced", "संतुलित") : L("Mismatch — needs a closer look", "असंतुलित — विस्तृत जाँच आवश्यक")}
                </p>
              </div>
              <div className="card p-4 text-sm">
                <p className="text-xs uppercase tracking-wider text-(--color-ink-soft)">{L("Rajju", "रज्जु")}</p>
                <p className={`mt-1 ${result.rajju.same ? "text-orange-300" : "text-emerald-300"}`}>
                  {result.rajju.same ? `${L("Same rajju", "समान रज्जु")} — ${result.rajju.part}` : L("Different — fine", "भिन्न — ठीक")}
                </p>
              </div>
              <div className="card p-4 text-sm">
                <p className="text-xs uppercase tracking-wider text-(--color-ink-soft)">{L("Vedha", "वेध")}</p>
                <p className={`mt-1 ${result.vedha ? "text-orange-300" : "text-emerald-300"}`}>
                  {result.vedha ? L("Mutual vedha stars", "परस्पर वेध नक्षत्र") : L("None", "कोई नहीं")}
                </p>
              </div>
            </div>

            <p className="text-xs text-(--color-ink-soft)">
              {L(
                "Gunas compare only the two Moons. A sound decision also weighs each person's 7th house, Venus, navamsa and dashas — the AI reading below does that.",
                "गुण केवल दोनों चंद्रमाओं की तुलना करते हैं। सही निर्णय हेतु दोनों के सप्तम भाव, शुक्र, नवांश और दशा भी देखें — नीचे का AI विश्लेषण यही करता है।"
              )}
            </p>

            <section className="card border-l-4 border-violet-500/40 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-violet-300">✨ {L("Full compatibility reading", "संपूर्ण अनुकूलता विश्लेषण")}</h2>
                <button
                  onClick={askAi}
                  disabled={busy || !canUseAi}
                  className="rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs text-violet-300 transition hover:bg-violet-500/10 disabled:opacity-50"
                >
                  {reading ? "↻" : t("getAiInsight")}
                </button>
              </div>
              {busy && !live && <p className="text-sm text-(--color-ink-soft)">✨ {t("aiThinking")}</p>}
              {busy && live && <Markdown text={live} />}
              {notice && <p className="text-sm text-orange-300">{notice}</p>}
              {!canUseAi && (
                <p className="text-sm text-(--color-ink-soft)">
                  {t("aiNotConfigured")} — <Link href="/settings" className="underline">{t("settings")}</Link>
                </p>
              )}
              {reading && (
                <>
                  <Markdown text={reading.text} />
                  <p className="mt-3 text-xs text-(--color-ink-soft)">
                    ✨ {reading.provider} · {reading.costUsd === 0 ? t("free") : fmtCost(reading.costUsd)}
                  </p>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
