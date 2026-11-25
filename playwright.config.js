import { defineConfig } from '@playwright/test';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve('.artifacts/browsers');
export default defineConfig({
  testDir: './tests/browser',
  globalSetup: './tests/browser/setup.js',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:8000',
    headless: true,
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader']
    }
  },
  webServer: {
    command: 'node tools/static-server.mjs',
    url: 'http://127.0.0.1:8000',
    reuseExistingServer: true
  }
});
