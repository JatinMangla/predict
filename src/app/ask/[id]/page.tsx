"use client";

// Q&A consultation: every question is answered by AI reading the full
// computed chart. Answers stream in as they are written, follow-up questions
// carry the earlier turns, and saved answers can be reopened without
// spending quota again. If AI is unreachable the page says so plainly.

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useKundli } from "@/lib/useKundli";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { ProfileTheme } from "@/components/ProfileTheme";
import { Markdown } from "@/components/Markdown";
import { callAi, aiAvailable, aiErrorKey, fmtCost } from "@/lib/aiClient";
import { useAiQuota } from "@/lib/useAiQuota";
import { useCurrentPlace } from "@/lib/place";
import { db, type QARecord } from "@/lib/db";

interface ChatItem {
  question: string;
  answer: string;
  provider?: string;
  costUsd?: number;
  /** reopened from history rather than asked now */
  saved?: boolean;
}

const SUGGESTIONS: { en: string; hi: string }[] = [
  { en: "When will I get a job change or promotion?", hi: "नौकरी में बदलाव या पदोन्नति कब होगी?" },
  { en: "When is marriage indicated, and what kind of partner?", hi: "विवाह का योग कब है और जीवनसाथी कैसा होगा?" },
  { en: "How will my finances be over the next two years?", hi: "अगले दो वर्षों में मेरी आर्थिक स्थिति कैसी रहेगी?" },
  { en: "Is business or a job better for me?", hi: "मेरे लिए व्यवसाय बेहतर है या नौकरी?" },
  { en: "What health areas should I be careful about?", hi: "स्वास्थ्य के किन क्षेत्रों में सावधानी रखूँ?" },
  { en: "Is there foreign travel or settlement in my chart?", hi: "क्या मेरी कुंडली में विदेश यात्रा या निवास का योग है?" },
  { en: "What does my current dasha bring?", hi: "मेरी वर्तमान दशा क्या फल देगी?" },
  { en: "Which remedies suit my chart?", hi: "मेरी कुंडली के लिए कौन से उपाय उचित हैं?" },
];

export default function AskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const profileId = Number(id);
  const { profile, kundli, loading, error } = useKundli(profileId);
  const { t, lang } = useI18n();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [question, setQuestion] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [live, setLive] = useState<{ question: string; text: string } | null>(null);
  const { cfg, usage } = useAiQuota();
  const here = useCurrentPlace();
  const [notice, setNotice] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const history = useLiveQuery(
    () =>
      db.qaHistory
        .where("profileId")
        .equals(profileId)
        .reverse()
        .limit(30)
        .toArray(),
    [profileId]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, live?.text.length]);

  const canUseAi = cfg !== null && aiAvailable(cfg);
  const quotaExhausted =
    cfg !== null && usage !== null && usage.geminiRemaining <= 0 && !cfg.serverClaude;

  const askAI = useCallback(
    async (q: string) => {
      if (!kundli || !cfg || aiBusy) return;
      setAiBusy(true);
      setNotice("");
      setLive({ question: q, text: "" });
      // Follow-ups: the model sees this conversation's earlier turns
      const turns = items.map((it) => ({ q: it.question, a: it.answer }));
      const result = await callAi(q, kundli, lang, cfg, "standard", {
        history: turns,
        currentPlace: here?.place,
        onDelta: (d) => setLive((s) => (s ? { ...s, text: s.text + d } : s)),
      });
      setAiBusy(false);
      setLive(null);
      if (typeof result === "string") {
        setNotice(t(aiErrorKey(result)));
        setQuestion(q); // give the question back so it can be retried
        return;
      }
      setItems((prev) => [
        ...prev,
        { question: q, answer: result.answer, provider: result.provider, costUsd: result.costUsd },
      ]);
      try {
        await db.qaHistory.add({
          profileId,
          question: q,
          answer: result.answer,
          source: "ai",
          createdAt: Date.now(),
        } satisfies Omit<QARecord, "id">);
      } catch {
        // history is best-effort
      }
    },
    [kundli, cfg, aiBusy, lang, t, profileId, items, here]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || aiBusy) return;
    setQuestion("");
    void askAI(q);
  };

  const reopen = (h: QARecord) => {
    setItems([{ question: h.question, answer: h.answer, saved: true }]);
    setNotice("");
  };

  const removeSaved = async (h: QARecord) => {
    if (h.id !== undefined) await db.qaHistory.delete(h.id);
  };

  if (loading) return <AppShell><p className="p-8 text-center text-(--color-ink-soft)">{t("loading")}</p></AppShell>;
  if (error || !kundli || !profile) {
    return (
      <AppShell>
        <div className="card mx-auto max-w-md p-8 text-center">
          <p className="text-red-300">{error ?? t("error")}</p>
          <Link href="/" className="accent-text mt-4 inline-block text-sm underline">← {t("dashboard")}</Link>
        </div>
      </AppShell>
    );
  }

  const L = (en: string, hi: string) => (lang === "hi" ? hi : en);

  return (
    <ProfileTheme birthdayNumber={kundli.numerology.birthdayNumber}>
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-(--color-gold-soft)">
              {t("askQuestion")} — {profile.name}
            </h1>
            <div className="flex items-center gap-2">
              {items.length > 0 && !aiBusy && (
                <button
                  onClick={() => {
                    setItems([]);
                    setNotice("");
                  }}
                  className="rounded-full border border-(--color-line) px-3 py-1 text-xs text-(--color-ink-soft) hover:text-(--color-ink)"
                >
                  + {L("New conversation", "नई बातचीत")}
                </button>
              )}
              {/* Real free-quota meter — costs never surprise */}
              {usage && (
                <Link
                  href="/settings"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    quotaExhausted
                      ? "border-red-500/50 text-red-300"
                      : "border-(--color-line) text-(--color-ink-soft)"
                  }`}
                  title={t("quotaNote")}
                >
                  ✨ {usage.geminiRemaining}/{usage.geminiLimit} {t("freeCallsLeft")}
                  {usage.costTodayUsd > 0 ? ` · ${fmtCost(usage.costTodayUsd)}` : ""}
                </Link>
              )}
            </div>
          </div>
          <p className="mb-5 text-xs text-(--color-ink-soft)">
            {canUseAi
              ? L(
                  "✨ Answers are written from your full chart — follow-up questions remember this conversation.",
                  "✨ उत्तर आपकी पूरी कुंडली से लिखे जाते हैं — आगे के प्रश्न इस बातचीत को याद रखते हैं।"
                )
              : t("aiNotConfigured")}
          </p>

          {notice && (
            <p className="mb-4 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-300">
              {notice}
            </p>
          )}

          <div className="space-y-4">
            {/* Empty state: suggestions + saved answers */}
            {items.length === 0 && !live && (
              <>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.en}
                      disabled={aiBusy || !canUseAi}
                      onClick={() => void askAI(lang === "hi" ? s.hi : s.en)}
                      className="rounded-full border border-(--color-line) px-3 py-1.5 text-xs text-(--color-ink-soft) transition hover:border-(--accent) hover:text-(--color-ink) disabled:opacity-50"
                    >
                      {lang === "hi" ? s.hi : s.en}
                    </button>
                  ))}
                </div>
                {history && history.length > 0 && (
                  <div className="card p-4">
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-(--color-ink-soft)">
                      {L("Saved answers", "सहेजे गए उत्तर")}
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {history.map((h) => (
                        <li key={h.id} className="flex items-start justify-between gap-2">
                          <button
                            className="text-left text-(--color-ink-soft) hover:text-(--color-ink)"
                            onClick={() => reopen(h)}
                            title={L("Open the saved answer (no AI call)", "सहेजा उत्तर खोलें (AI कॉल नहीं)")}
                          >
                            • {h.question}
                            <span className="ml-2 text-xs opacity-60">
                              {new Date(h.createdAt).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN")}
                            </span>
                          </button>
                          <button
                            onClick={() => void removeSaved(h)}
                            className="shrink-0 text-xs text-(--color-ink-soft) hover:text-red-300"
                            aria-label="delete"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {items.map((item, i) => (
              <div key={i}>
                <div className="mb-2 flex justify-end">
                  <div className="accent-bg max-w-[85%] rounded-xl rounded-br-sm px-4 py-2.5 text-sm">
                    {item.question}
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="card max-w-[92%] rounded-xl rounded-bl-sm px-4 py-3">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-violet-500/40 px-2 py-0.5 text-violet-300">
                        ✨ {t("aiAnswer")}
                        {item.provider ? ` · ${item.provider}` : ""}
                        {item.saved ? ` · ${L("saved", "सहेजा")}` : ""}
                      </span>
                      {item.costUsd !== undefined && (
                        <span className="text-(--color-ink-soft)">
                          {item.costUsd === 0 ? t("free") : fmtCost(item.costUsd)}
                        </span>
                      )}
                    </div>
                    <Markdown text={item.answer} />
                  </div>
                </div>
              </div>
            ))}

            {live && (
              <div>
                <div className="mb-2 flex justify-end">
                  <div className="accent-bg max-w-[85%] rounded-xl rounded-br-sm px-4 py-2.5 text-sm">
                    {live.question}
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="card max-w-[92%] rounded-xl rounded-bl-sm px-4 py-3 text-sm">
                    {live.text ? (
                      <Markdown text={live.text} />
                    ) : (
                      <span className="text-(--color-ink-soft)">✨ {t("aiThinking")}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={submit} className="sticky bottom-4 mt-6 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                items.length ? L("Ask a follow-up…", "आगे का प्रश्न पूछें…") : t("askPlaceholder")
              }
              maxLength={600}
              className="flex-1 rounded-xl border border-(--color-line) bg-(--color-surface-2) px-4 py-3 text-sm outline-none focus:border-(--accent)"
            />
            <button
              type="submit"
              disabled={aiBusy || !canUseAi}
              className="rounded-xl bg-(--accent) px-5 py-3 text-sm font-medium text-[#14100a] transition hover:brightness-110 disabled:opacity-50"
            >
              ✨ {t("ask")}
            </button>
          </form>
        </div>
      </AppShell>
    </ProfileTheme>
  );
}
