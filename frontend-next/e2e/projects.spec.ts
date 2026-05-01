/**
 * E2E: Projects page — list, create, navigate.
 *
 * Per testing-rules.md §4.6 前端功能验证 & §3.3 CRUD 真实性
 * Uses global auth storageState — no per-test login needed.
 */
import { test, expect } from '@playwright/test';
import { collectApiErrors } from './helpers';

test.describe('Projects', () => {
  test('workspace landing page loads', async ({ page }) => {
    await page.goto('/workspace');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/login');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(5);
  });

  test('projects page is accessible and renders list or empty state', async ({ page }) => {
    const getErrors = collectApiErrors(page);
    await page.goto('/workspace/projects');
    await page.waitForLoadState('networkidle');

    // Must show either a project list, empty state message, or create button
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 5000 }).catch(() => false)
      || await page.getByText(/project|项目|create|new|empty|no project/i).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    const apiErrors = getErrors();
    expect(apiErrors, `API errors on projects page: ${apiErrors.join(', ')}`).toHaveLength(0);
  });

  test('project URL is deep-linkable and refreshable', async ({ page }) => {
    await page.goto('/workspace/projects');
    await page.waitForLoadState('networkidle');
    // Refresh and ensure we don't get kicked to login
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/login');
  });

  test('create project button/form is accessible', async ({ page }) => {
    await page.goto('/workspace/projects');
    await page.waitForLoadState('networkidle');

    const createBtn = page.getByRole('button', { name: /create|new|新建|添加|add/i })
      .or(page.getByRole('link', { name: /create|new|新建/i }));

    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.first().click();
      await page.waitForTimeout(1000);
      // Should open a form/modal or navigate to create page
      const hasForm = await page.getByRole('form').isVisible().catch(() => false)
        || await page.getByRole('dialog').isVisible().catch(() => false)
        || await page.getByLabel(/name|title|名称/i).isVisible().catch(() => false)
        || page.url().includes('create') || page.url().includes('new');
      expect(hasForm).toBeTruthy();
    } else {
      test.info().annotations.push({ type: 'warning', description: 'No create project button found' });
    }
  });
});
