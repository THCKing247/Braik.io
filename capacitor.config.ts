import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.braik.app',
  appName: 'Braik',
  server: {
    url: 'https://braik.io',
    cleartext: false,
    allowNavigation: ['braik.io'],
  } as CapacitorConfig['server'],
};

export default config;
