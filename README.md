# Pulse — Offline Workout Tracker

Offline-first daily workout app. Accounts, preferences, goals, and logs live in **IndexedDB** on your device. Optional Excel export and Google Drive sync when you're online.

## Features

- Local sign-up / sign-in (hashed passwords, session in `localStorage`)
- Onboarding for units, weekly goals, preferred muscle groups
- Dashboard with streak, weekly progress, and today's session
- Log workouts: exercises, sets, reps, weight, rest timer
- Exercise library with muscle-colored illustrations (works offline)
- History with session detail
- Goals & preferences editing
- PWA install + offline caching
- Download Excel (`.xlsx`) or sync spreadsheet to Google Drive

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Install as a PWA (Add to Home Screen)

Pulse is already set up as a Progressive Web App. Browsers only offer install when the app is served over **HTTPS** or **localhost**.

### Best local setup (recommended)

```bash
npm run build
npm run preview -- --host
```

Then open the preview URL on your phone (same Wi‑Fi) or on this computer.

### iPhone / iPad (Safari)

1. Open Pulse in **Safari** (Chrome on iOS won’t show Add to Home Screen the same way)
2. Tap the **Share** button
3. Tap **Add to Home Screen**
4. Name it **Pulse** → **Add**

### Android (Chrome)

1. Open Pulse in Chrome
2. Tap the **⋮** menu
3. Tap **Install app** or **Add to Home Screen**

### Desktop (Chrome / Edge)

1. Open Pulse
2. Look for the install icon in the address bar, or
3. Menu → **Install Pulse…**

### Notes

- Use `localhost` or HTTPS — plain `http://192.168.x.x` may not allow install on all browsers
- After install, Pulse opens full-screen like a native app and works offline for logging
- For a real phone install from your LAN, deploy to any HTTPS host (Vercel, Netlify, Cloudflare Pages, etc.)

## Google Drive sync (optional)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Google Drive API**
3. Create an **OAuth 2.0 Client ID** (Web application)
4. Add your app origin (e.g. `http://localhost:5173`) to Authorized JavaScript origins
5. Paste the Client ID in **Settings → Google OAuth Client ID**
6. Tap **Sync to Google Drive** — uploads/updates `pulse-workouts.xlsx` in your Drive
