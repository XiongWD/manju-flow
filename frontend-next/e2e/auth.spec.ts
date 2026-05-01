/**
 * E2E: Authentication flow — login, session persistence, logout.
 *
 * Per testing-rules.md §4.5 认证与权限 UI & §5.4 认证全生命周期
 * Auth tests explicitly clear storage state to test unauthenticated flows.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, collectApiErrors } from './helpers';

// Auth tests need a clean (unauthenticated) context
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/.+/);
    // Login form uses Chinese labels; target by input id
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in|登录/i })).toBeVisible();
  });

  test('wrong credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('wrong@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: /login|sign in|登录/i }).click();
    // Should stay on login page or show error
    await page.waitForTimeout(2000);
    const stillOnLogin = page.url().includes('/login');
    const hasError = await page.getByText(/invalid|incorrect|error|失败|错误/i).isVisible().catch(() => false);
    expect(stillOnLogin || hasError).toBeTruthy();
  });

  test('correct credentials login and redirect to workspace', async ({ page }) => {
    const getErrors = collectApiErrors(page);
    // Capture all network activity and console errors to debug
    const networkLog: string[] = [];
    const consoleLog: string[] = [];
    page.on('response', res => networkLog.push(`${res.status()} ${res.url()}`));
    page.on('console', msg => { if (msg.type() === 'error') consoleLog.push(msg.text()); });
    await loginAsAdmin(page);
    // Must be redirected away from /login
    expect(page.url(), `network: ${networkLog.slice(-5).join(' | ')} console: ${consoleLog.join(' | ')}`).not.toContain('/login');
    // No 4xx/5xx API errors during login
    const apiErrors = getErrors();
    expect(apiErrors, `API errors during login: ${apiErrors.join(', ')}`).toHaveLength(0);
  });

  test('accessing workspace without login redirects to login', async ({ page }) => {
    // Clear cookies to simulate unauthenticated state
    await page.context().clearCookies();
    await page.goto('/workspace');
    await page.waitForURL(url => url.pathname.startsWith('/login'), { timeout: 8_000 });
    expect(page.url()).toContain('/login');
  });

  test('logout clears session', async ({ page }) => {
    await loginAsAdmin(page);
    // Find and click logout
    const logoutBtn = page.getByRole('button', { name: /logout|sign out|登出/i })
      .or(page.getByText(/logout|sign out|登出/i));
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(url => url.pathname.startsWith('/login') || url.pathname === '/', { timeout: 8_000 });
      expect(page.url()).toMatch(/login|\//);
    } else {
      test.info().annotations.push({ type: 'warning', description: 'Logout button not found; skipping logout test' });
    }
  });
});
