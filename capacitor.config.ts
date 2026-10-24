import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.akuolo.mochisnumbergame',
  appName: "Mochi's Secret Number",
  webDir: 'dist',
  bundledWebRuntime: false,
  android: { allowMixedContent: false },
};
export default config;
