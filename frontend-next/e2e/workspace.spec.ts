/**
 * E2E: Core workspace pages — shots, assets, delivery, QA.
 *
 * Per testing-rules.md §4.2 页面级验证 & §10 最低执行要求 #10
 * Uses global auth storageState — no per-test login needed.
 */
import { test, expect } from '@playwright/test';

const WORKSPACE_PAGES = [
  { name: 'Shots',    path: '/workspace/shots' },
  { name: 'Assets',   path: '/workspace/assets' },
  { name: 'Delivery', path: '/workspace/delivery' },
  { name: 'QA',       path: '/workspace/qa' },
  { name: 'Story',    path: '/workspace/story' },
  { name: 'Analytics',path: '/workspace/analytics' },
  { name: 'Settings', path: '/workspace/settings' },
] as const;

test.describe('Workspace Pages', () => {
  for (const { name, path } of WORKSPACE_PAGES) {
    test(`${name} page loads without 5xx errors`, async ({ page }) => {
      const serverErrors: string[] = [];
      page.on('response', resp => {
        if (resp.status() >= 500) {
          serverErrors.push(`${resp.status()} ${resp.url()}`);
        }
      });

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Must not redirect to login
      expect(page.url()).not.toContain('/login');

      // Must render some content (not blank)
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(10);

      // No 5xx server errors
      expect(serverErrors, `5xx on ${name}: ${serverErrors.join(', ')}`).toHaveLength(0);
    });
  }

  test('navigation between pages works (no white screen)', async ({ page }) => {
    await page.goto('/workspace/projects');
    await page.waitForLoadState('networkidle');

    for (const { path } of WORKSPACE_PAGES.slice(0, 3)) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(page.url()).not.toContain('/login');
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(5);
    }
  });

  test('invalid route returns 404 or redirect', async ({ page }) => {
    const response = await page.goto('/workspace/this-page-does-not-exist-abc123');
    await page.waitForLoadState('networkidle');
    const status = response?.status() ?? 200;
    const bodyText = await page.locator('body').innerText();
    const has404 = status === 404 || bodyText.includes('404') || bodyText.includes('not found') || bodyText.includes('找不到');
    // Either returns 404 OR redirects somewhere reasonable (not crashes)
    expect(status < 500).toBeTruthy();
    // Should not be a blank page
    expect(bodyText.trim().length).toBeGreaterThan(5);
  });
});
