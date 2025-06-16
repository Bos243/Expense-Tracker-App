import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.obsa.easyexpensetrackerapp',
  appName: 'Easy Expense Tracker App',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  }
};

export default config;
