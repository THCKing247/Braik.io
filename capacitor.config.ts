import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.braik.app',
  appName: 'BRAIK',
  server: {
    url: 'https://braik.io',
    cleartext: true,
    allowNavigation: ['braik.io'],
  },
};

export default config;
