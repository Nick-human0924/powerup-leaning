import { existsSync } from 'node:fs';
import { defineConfig, devices, chromium } from '@playwright/test';

const systemBrowsers = [
  process.env.PW_CHROMIUM_EXECUTABLE_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter((path): path is string => Boolean(path));
const executablePath = systemBrowsers.find(existsSync) ?? (existsSync(chromium.executablePath()) ? chromium.executablePath() : undefined);

export default defineConfig({
  testDir: './tests',
  testMatch: ['app.spec.ts', 'visual-v2.spec.ts'],
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --hostname 0.0.0.0 --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
