import { defineConfig, devices } from '@playwright/test';

/**
 * playwright.config.ts — web-bapp
 *
 * Cubre:
 *  - Desktop Chrome / Firefox / Safari
 *  - Mobile Chrome (Pixel 5 emulation)
 *  - Mobile Safari (iPhone 12 emulation)
 *
 * Prerequisito local: tener `ng serve` corriendo en el puerto 4200.
 * En CI: el workflow arranca el servidor antes de los tests.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }],
    ['json', { outputFile: 'e2e/playwright-report/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    // ── Desktop ────────────────────────────────────────────────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // ── Mobile ─────────────────────────────────────────────────────────────
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: 'npm run start',
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
