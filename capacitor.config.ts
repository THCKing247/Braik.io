import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor loads the hosted Next app (`server.url`). Client-side:
 * - `NativeAppBootstrap` (in `app/providers.tsx`) sets `window.__BRAIK_IS_NATIVE_APP__`, routes away
 *   from marketing, and calls `installCapacitorBiometricBridge()` for Android/iOS biometrics.
 * - Preferences + biometric prefs live under `lib/native/`. Run `npx cap sync android` after
 *   dependency changes.
 */
const config: CapacitorConfig = {
  appId: 'com.apextsgroup.braik',
  appName: 'Braik',
  webDir: 'out',
  server: {
    url: 'https://braik.io',
    cleartext: false
  }
};

export default config;