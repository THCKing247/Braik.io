# Capacitor (iOS & Android)

Braik is a **Next.js** app. Capacitor wraps it in a native shell. Because the app uses server features (API routes, SSR), the WebView usually loads your **deployed site** or a **local dev server**, not a static export.

## Quick start

1. **Point the app at your URL** (production example):

   ```bash
   set CAPACITOR_SERVER_URL=https://your-production-domain.com
   npm run cap:sync
   ```

   On macOS/Linux: `export CAPACITOR_SERVER_URL=...`

2. **Open in Android Studio / Xcode**

   ```bash
   npm run cap:open:android
   npm run cap:open:ios
   ```

3. **Run on a device/emulator**

   ```bash
   npm run cap:run:android
   npm run cap:run:ios
   ```

## Local dev on a physical device

1. Start Next bound to all interfaces:

   ```bash
   npx next dev -H 0.0.0.0
   ```

2. Use your PC’s LAN IP (e.g. `http://192.168.1.10:3000`):

   ```bash
   set CAPACITOR_DEV_SERVER_URL=http://192.168.1.10:3000
   npm run cap:sync
   ```

   `cleartext` is enabled automatically for `http://` URLs.

## If you see the dark “configure CAPACITOR_SERVER_URL” screen

No remote URL is set. Set one of the env vars above, run `npm run cap:sync`, then rebuild/run the native app.

## Optional: static export later

If you ever fully static-export Next (`output: 'export'`), you could set `webDir` to `out` and drop `server.url` for fully offline-first bundles. That only works if the app has no required server/API usage in the shell.
