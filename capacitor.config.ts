import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Next.js uses SSR/API routes, so the native shell usually loads your deployed URL
 * (or a dev machine URL) instead of bundled static files.
 *
 * - Production: set CAPACITOR_SERVER_URL=https://your-domain.com before `cap sync`
 * - Device on LAN: CAPACITOR_SERVER_URL=http://192.168.x.x:3000 (run `next dev -H 0.0.0.0`)
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL || process.env.CAPACITOR_DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'io.braik.app',
  appName: 'Braik',
  webDir: 'www',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith('http://'),
      }
    : undefined,
};

export default config;
