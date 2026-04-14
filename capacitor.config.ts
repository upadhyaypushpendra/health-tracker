import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bodysync.app',
  appName: 'Body Sync',
  webDir: 'dist',
  server: {
    url: 'https://health-tracker-5n9f.onrender.com',
    cleartext: false,
  },
};

export default config;
