# EcoPulse AI

A responsive environmental lifestyle dashboard built with Next.js, React, and Tailwind CSS.

## Features

- Current outdoor AQI, PM2.5, PM10, weather, humidity, and wind from Open-Meteo. Location uses browser geolocation when available; otherwise it defaults to San Francisco. Missing readings remain unavailable rather than being invented.
- Daily suggestions and context-aware indoor-air prevention guidance. Indoor measurements are never claimed; optional readings are user-entered.
- Gemini-powered environmental assistant through a server-only API route. The API key is never sent to the browser.
- Transparent, assumption-based carbon impact calculator.
- Habit check-ins stored in this browser using localStorage.
- Sustainable alternatives, accessible controls, responsive navigation, and loading/error states.

## Run locally

```bash
pnpm install
cp .env.example .env.local
# Set GEMINI_API_KEY in .env.local to enable Gemini responses
pnpm dev
```

Open http://localhost:3000. Open-Meteo endpoints are public and do not require an API key. Without `GEMINI_API_KEY`, the assistant explains that Gemini is not configured; the rest of the dashboard remains available.

## Environment

- `GEMINI_API_KEY` — optional server-only Google Gemini API key. Required for live AI assistant responses.

## Data and assumptions

Outdoor weather and air-quality values come from Open-Meteo and can be unavailable. The default coordinates are San Francisco until browser location is granted. Carbon factors are simplified illustrative estimates; the UI labels their limits. Habit entries are local to this browser and are not synced to a user account.

## Deployment

Deploy as a Next.js app on Vercel and configure `GEMINI_API_KEY` in the project environment settings. Browser location requires user permission. This prototype does not include account authentication or cross-device storage.
