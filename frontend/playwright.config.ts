import { defineConfig } from '@playwright/test';

const FRONTEND_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'admin', dependencies: ['setup'], use: { storageState: '.auth/admin.json' }, testIgnore: /auth\.setup\.ts/ },
    { name: 'manager', dependencies: ['setup'], use: { storageState: '.auth/manager.json' }, testIgnore: /auth\.setup\.ts/ },
    { name: 'front_desk', dependencies: ['setup'], use: { storageState: '.auth/front_desk.json' }, testIgnore: /auth\.setup\.ts/ },
  ],
});
