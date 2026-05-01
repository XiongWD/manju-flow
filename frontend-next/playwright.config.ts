import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export const AUTH_STATE_FILE         = path.join(__dirname, 'e2e', '.auth', 'admin.json');
export const AUTH_SUPERADMIN_FILE    = path.join(__dirname, 'e2e', '.auth', 'superadmin.json');
export const AUTH_MANAGER001_FILE    = path.join(__dirname, 'e2e', '.auth', 'manager001.json');
export const AUTH_MANAGER002_FILE    = path.join(__dirname, 'e2e', '.auth', 'manager002.json');
export const AUTH_EMPLOYER001_FILE   = path.join(__dirname, 'e2e', '.auth', 'employer001.json');

/**
 * Playwright E2E configuration for manju-flow frontend.
 * Requires both backend (:8000) and frontend (:3000) to be running.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,              // no retries — fail fast
  workers: 1,
  timeout: 30_000,         // per-test timeout: 30s
  globalTimeout: 180_000,  // entire suite: 3 minutes max
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../logs/playwright-report' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_FILE,
      },
    },
    {
      name: 'multitenancy',
      use: {
        ...devices['Desktop Chrome'],
        // each test in multitenancy.spec.ts sets its own storageState
      },
      testMatch: '**/multitenancy.spec.ts',
    },
  ],
});
