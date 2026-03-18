import type { CapacitorConfig } from '@capacitor/cli';

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