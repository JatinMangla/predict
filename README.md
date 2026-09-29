# Kundli Predict 🪐

A private Vedic astrology web app. Enter birth details and get a complete, correctly computed kundli, then AI readings that interpret **your** chart: questions and answers, life-area forecasts with exact dates and clock times, precision timing, Kundli Milan, numerology and a personal panchang calendar.

All astronomy runs **in the browser, offline**. The AI (Claude, falling back to Gemini) is only ever given the computed chart to interpret; it never does the calculation.

## What it computes (offline)

| Area | Detail |
|---|---|
| **Chart** | Lahiri (true Chitrapaksha) sidereal positions from `astronomy-engine`, nutation-corrected; lagna; whole-sign houses; degree-aware dignities (BPHS); combustion; retrogression |
| **Vargas** | 16 divisional charts: D1 D2 D3 D4 D7 D9 D10 D12 D16 D20 D24 D27 D30 D40 D45 D60 |
| **Dashas** | Vimshottari (Maha / Antar / Pratyantar) **and** Yogini dasha for cross-checking |
| **Jaimini** | Chara karakas (AK…DK) and karakamsa |
| **Yogas & doshas** | 40+ with **classical cancellations** (Manglik from lagna/Moon/Venus with exceptions, Kemadruma bhanga, Nadi/Bhakoot exceptions…); cancelled doshas are shown as cancelled, not as threats |
| **Ashtakavarga** | Parashari BAV / SAV, used to weight every transit |
| **Transits** | Lagna-based gochar judgement (house from lagna + functional rulership + own bindus + running dasha), with Chandra-kundli as a second reference |
| **Shani** | Full Sade Sati and Dhaiya (Kantaka / Ashtama) timeline with exact dates |
| **Kundli Milan** | Ashtakoota 36 gunas, Nadi/Bhakoot/Gana cancellations, Manglik parity, Rajju and Vedha |
| **Numerology** | Pythagorean core numbers; **Chaldean (Cheiro)** name number with compound meanings and a name-compatibility check; **Lo Shu grid** with planes and missing numbers; **Kua**; pinnacles and challenges; personal year/month/day |
| **Panchang** | Tithi, vara, nakshatra, yoga, karana; Amanta month with **Adhika masa**; Vikram Samvat; 30+ festivals (nishita rule for night festivals); Rahu Kaal, Yamaganda, Gulika, Abhijit; **choghadiya and hora** |
| **Precision timing** | Classical five-step funnel: birth-time confidence → natal promise → dasha → gochara → muhurta |
| **Gemstones** | Suitability judged from functional rulership for **your lagna**, not the birthday |

## AI readings

- Answers **stream** as they are written, render as formatted text, and **follow-up questions remember the conversation**.
- Saved answers reopen without spending quota.
- The prompt carries the full chart: D1 with degrees and nakshatras, house lords, D9/D10, SAV, running and upcoming dashas, Yogini dasha, chara karakas, Sade Sati dates, transits judged from the lagna, and numerology.
- Modes: open question, life-area reading, date-and-time plan, "verify someone else's forecast against my chart", and match.
- Provider order: **Claude Opus 5.5** (adaptive thinking, server-side refusal fallback) → **Gemini Flash** free tier. There is a real quota meter for Gemini's free limit.

## Location

Timings depend on local sunrise. Set **Settings → Where you are now** so Rahu Kaal, choghadiya, panchang and day scores use the city you live in; the birth place drives only the natal chart.

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · astronomy-engine · luxon · Dexie (IndexedDB) · Auth.js v5 (Google) · Vitest · Vercel

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm test                     # engine test suite
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | ✅ | Session encryption (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | ✅ | Google OAuth credentials |
| `ALLOWED_EMAIL` | — | The only email allowed to sign in |
| `ANTHROPIC_API_KEY` | optional | Claude readings |
| `GEMINI_API_KEY` | optional | Gemini free-tier readings (a key can also be stored per browser in Settings) |

Google OAuth: create a Web OAuth client, add `http://localhost:3000/api/auth/callback/google` and `https://YOUR-APP.vercel.app/api/auth/callback/google` as redirect URIs, and keep the consent screen in *Testing* with only your account as a test user.

## Accuracy notes

- **Ayanamsa:** Lahiri per the ICRC definition (23°15′00.658″ at 1956-03-21.0 ET + IAU-2006 precession), with nutation removed from true-of-date positions (the Swiss Ephemeris / Drik Panchang convention).
- **Ascendant:** tested against the sunrise identity (the Sun is on the ascendant at sunrise and on the descendant at sunset) at two locations.
- **Vara:** the Vedic day runs from sunrise to sunrise; sunrise is searched for the civil date itself, so late-evening births keep their weekday.
- **Lunar months:** exact new-moon boundaries; an Amanta month without a sankranti is Adhika and holds no festivals (checked against Adhika Jyeshtha 2026).
- **Rahu/Ketu:** mean node. **Houses:** whole sign. **Dasha year:** 365.25 days.
- Validated by 140+ unit tests against known astronomical and panchang reference points (sankranti dates, documented full and new moons, Sade Sati dates, ashtakavarga totals, textbook guna scores, Kua tables).

Astrology is a traditional interpretive system, not a predictive science. Treat the readings as reflection and guidance, never as a substitute for medical, legal or financial advice.
