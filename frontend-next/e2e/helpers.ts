/**
 * Shared helpers for Playwright E2E tests.
 */
import { Page } from '@playwright/test';
import path from 'path';

export const BASE_URL = 'http://localhost:3000';
export const API_URL  = 'http://localhost:8000';

export const DEFAULT_ADMIN_EMAIL    = 'admin@manju.local';
export const DEFAULT_ADMIN_PASSWORD = 'ChangeMe123!';

/** Multitenancy test account credentials */
export const ACCOUNTS = {
  superadmin: { email: 'superadmin@manju.ai', password: 'SuperAdmin123!', file: path.join(__dirname, '.auth', 'superadmin.json') },
  manager001: { email: 'manager001@manju.ai', password: 'Manager123!',    file: path.join(__dirname, '.auth', 'manager001.json') },
  manager002: { email: 'manager002@manju.ai', password: 'Manager123!',    file: path.join(__dirname, '.auth', 'manager002.json') },
  employer001:{ email: 'employer001@manju.ai', password: 'Emp123!',       file: path.join(__dirname, '.auth', 'employer001.json') },
} as const;

/**
 * Login via the UI login form and wait for redirect to workspace.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  // Login form uses Chinese labels (邮箱/密码) — target by input id
  await page.locator('#email').fill(DEFAULT_ADMIN_EMAIL);
  await page.locator('#password').fill(DEFAULT_ADMIN_PASSWORD);
  // Wait for button to be enabled before clicking
  const btn = page.getByRole('button', { name: /login|sign in|登录/i });
  await btn.waitFor({ state: 'visible', timeout: 5_000 });
  await btn.click();
  // Wait for redirect away from /login (allow up to 20s for slow CI)
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

/**
 * Login via UI as any account.
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  const btn = page.getByRole('button', { name: /login|sign in|登录/i });
  await btn.waitFor({ state: 'visible', timeout: 5_000 });
  await btn.click();
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

/**
 * Assert no 4xx/5xx network responses occurred during a page interaction.
 * Usage: collect failed responses via page.on('response', ...) before the action.
 */
export function collectApiErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('response', resp => {
    if (resp.url().includes('/api/') && resp.status() >= 400) {
      errors.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
    }
  });
  return () => errors;
}
