// Google's Gemini free tier resets at midnight US-Pacific. The browser meter
// and the server-side quota tracker both need to agree on which day a call
// belongs to, so the day maths lives here and is imported by both.

/** yyyy-mm-dd in US-Pacific time — Google's quota-reset boundary */
export function ptDateStr(ms = Date.now()): string {
  return new Date(ms).toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

const PT_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Seconds elapsed since midnight on the Pacific wall clock */
function ptSecondsIntoDay(ms: number): number {
  const parts = PT_CLOCK.formatToParts(new Date(ms));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Some engines render midnight as hour "24" under hour12: false.
  const hour = get("hour") % 24;
  return hour * 3600 + get("minute") * 60 + get("second");
}

/** UTC ms of the current Pacific day's start (exact, DST included) */
export function ptDayStartMs(now = Date.now()): number {
  const today = ptDateStr(now);
  const naive = now - ptSecondsIntoDay(now) * 1000 - (now % 1000);
  // Subtracting wall-clock elapsed is off by an hour when a DST transition
  // falls inside the span, so pick the candidate that really is midnight:
  // the first instant of today.
  for (const adjust of [0, 3600_000, -3600_000]) {
    const t = naive + adjust;
    if (ptDateStr(t) === today && ptDateStr(t - 1000) !== today) return t;
  }
  return naive;
}

/** UTC ms of the next Pacific midnight — when the free quota resets */
export function ptDayEndMs(now = Date.now()): number {
  // 25 hours past this day's start lands inside the next PT day on every
  // day length (23h spring-forward, 24h, 25h fall-back).
  return ptDayStartMs(ptDayStartMs(now) + 25 * 3600_000);
}
