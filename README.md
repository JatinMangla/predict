# Kundli Predict 🪐

An **offline-first Vedic astrology web application**. Feed in birth details and get a complete kundli — charts, dashas, yogas, ashtakavarga, panchang, numerology — plus rule-based answers to life questions, weekly/monthly/yearly predictions, and personalised transit (gochar) analysis. Everything is computed **on your device with no internet or AI required**; AI (Claude → Gemini) is used only as an optional fallback.

## Features

- **Complete Kundli** — Lahiri (Chitrapaksha) sidereal positions from the `astronomy-engine` ephemeris (arc-minute accuracy), lagna, whole-sign houses, 10 divisional charts (D1–D60), nakshatras & padas, dignities, combustion, retrogression.
- **North & South Indian chart styles** (toggle).
- **Vimshottari Dasha** — full Maha/Antar/Pratyantar timeline with an expandable UI.
- **Panchang** — tithi, vara, nakshatra, yoga, karana, sunrise/sunset.
- **30+ Yogas & Doshas** — Gajakesari, Panch Mahapurusha, Raja/Dhana yogas, Vipreet Raja, Neecha Bhanga, Manglik, Kaal Sarp, Sade Sati and more, each with bilingual meaning.
- **Ashtakavarga** — full Parashari BAV/SAV bindu tables used for transit scoring.
- **Q&A engine** — ask about career, marriage, wealth, health, education, children, property, foreign travel… answered *from the chart itself* (house lords, karakas, active dashas, timing windows) with a confidence score. Works fully offline.
- **Predictions** — weekly / monthly / yearly, generated from active dashas + live transits + chandra bala + Sade Sati + ashtakavarga + numerology personal year.
- **Transits (Gochar)** — current sky positions relative to your Moon, plus a 12-month timeline of sign ingresses and retrograde stations with personal effects.
- **Numerology** — Moolank, Bhagyank, name numbers, personal year/month; the UI **theme adapts to the profile's birthday number** (each number's ruling planet has its own colour).
- **Bilingual** — full English / हिंदी toggle.
- **Offline city database** — 36,000+ cities (every Indian town ≥ 5k population) with coordinates and timezone; no geocoding API.
- **AI fallback (optional)** — when the rule engine's confidence is low, or on demand via "Ask AI": Anthropic Claude first, Google Gemini (free tier) as fallback. The app never *requires* AI.
- **Private by design** — profiles live in your browser (IndexedDB); login restricted to a single Google account; strict CSP and security headers; API keys server-side only.
- **PWA** — installable, works offline after first load.

## Tech Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · astronomy-engine · luxon · Dexie (IndexedDB) · Auth.js v5 (Google) · Vitest (38 engine tests) · Vercel

## Local Development

```bash
npm install
cp .env.example .env.local   # fill in the values (see below)
npm run dev                  # http://localhost:3000
npm test                     # engine test suite
```

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | ✅ | Session encryption — generate with `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | ✅ | Google OAuth credentials (steps below) |
| `ALLOWED_EMAIL` | — | The only email allowed to sign in (default `jatinmangla123@gmail.com`) |
| `ANTHROPIC_API_KEY` | optional | Claude AI fallback ([console.anthropic.com](https://console.anthropic.com)) |
| `GEMINI_API_KEY` | optional | Gemini free-tier fallback ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) |

### Google OAuth setup (one-time, ~5 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project (e.g. "Kundli Predict").
2. **APIs & Services → OAuth consent screen** → External → fill app name & your email → add `jatinmangla123@gmail.com` as a **test user** (keeping the app in "Testing" mode means *only* test users can ever sign in — a second security layer).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Web application.
4. Add **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-APP.vercel.app/api/auth/callback/google` (add after the first deploy)
5. Copy the Client ID / Client Secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

## Deploy to Vercel

1. Push this repo to GitHub (`https://github.com/JatinMangla`).
2. In [vercel.com](https://vercel.com/jatinmanglas-projects) → **Add New → Project** → import the repo (defaults are fine — Next.js is auto-detected).
3. In **Project → Settings → Environment Variables**, add all the variables above.
4. Deploy, note the production URL, and add its callback URL to the Google OAuth client (step 4 above).

## Accuracy Notes

- Ayanamsa: Lahiri per the official ICRC definition (23°15′00.658″ at 1956-03-21.0 ET + IAU-2006 precession) — matches Swiss-Ephemeris/Drik-Panchang values to arcseconds.
- Rahu/Ketu: mean node (classical Lahiri-ephemeris convention).
- Houses: whole-sign (Vedic standard). Dasha year: 365.25 days.
- The engine is validated by unit tests against known astronomical reference points (J2000 solar longitude, sankranti dates, documented full/new moons, ascendant-at-sunrise identity, classical ashtakavarga totals).

---

Built with ❤️ and the stars. Jai Shri Ganesha 🙏
