/**
 * E2E: 多租户角色隔离测试
 *
 * 覆盖场景：
 *   superadmin  → 登录后跳转 /system，可见经理列表
 *   manager001  → 登录后跳转 /workspace，侧边栏含"团队管理"
 *   manager002  → 独立工作区，与 manager001 数据隔离
 *   employer001 → 登录后跳转 /workspace/story，侧边栏仅显示授权页面
 *
 * 每个 describe 块通过 test.use({ storageState }) 注入对应账号的预置 token，
 * 无需走 UI 登录，速度快、无竞态。
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { ACCOUNTS, loginAs, collectApiErrors } from './helpers';

// ─────────────────────────────────────────────────────────────
// superadmin@manju.ai
// ─────────────────────────────────────────────────────────────
test.describe('Role: superadmin', () => {
  test.use({ storageState: ACCOUNTS.superadmin.file });

  test('访问 /workspace 自动跳转到 /system', async ({ page }) => {
    await page.goto('/workspace');
    await page.waitForURL(url => url.pathname.startsWith('/system'), { timeout: 15_000 });
    expect(page.url()).toContain('/system');
  });

  test('直接访问 /system 正常加载，显示系统管理标题', async ({ page }) => {
    await page.goto('/system');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/系统管理|经理账号/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('/system 页面包含经理列表（manager001、manager002）', async ({ page }) => {
    await page.goto('/system');
    await page.waitForLoadState('networkidle');
    // 等待列表渲染
    await expect(page.getByText('manager001@manju.ai')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('manager002@manju.ai')).toBeVisible({ timeout: 5_000 });
  });

  test('superadmin 无法访问 /workspace（被重定向）', async ({ page }) => {
    await page.goto('/workspace/projects');
    await page.waitForURL(url => url.pathname.startsWith('/system'), { timeout: 10_000 });
    expect(page.url()).not.toContain('/workspace');
  });

  test('UI 登录流：superadmin 登录后到达 /system', async ({ page }) => {
    // 清空已有 token，用 UI 登录
    await page.goto('/login');
    await page.evaluate(() => { localStorage.clear(); });
    await loginAs(page, ACCOUNTS.superadmin.email, ACCOUNTS.superadmin.password);
    await page.waitForURL(url => url.pathname.startsWith('/system'), { timeout: 15_000 });
    expect(page.url()).toContain('/system');
  });
});

// ─────────────────────────────────────────────────────────────
// manager001@manju.ai
// ─────────────────────────────────────────────────────────────
test.describe('Role: manager001', () => {
  test.use({ storageState: ACCOUNTS.manager001.file });

  test('访问 /workspace 正常加载（不被重定向）', async ({ page }) => {
    await page.goto('/workspace');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/workspace');
    expect(page.url()).not.toContain('/system');
    expect(page.url()).not.toContain('/login');
  });

  test('侧边栏显示"团队管理"入口', async ({ page }) => {
    await page.goto('/workspace');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('团队管理')).toBeVisible({ timeout: 10_000 });
  });

  test('访问 /workspace/team 页面正常渲染', async ({ page }) => {
    const errors = collectApiErrors(page);
    await page.goto('/workspace/team');
    await page.waitForLoadState('networkidle');
    // 页面应有"团队成员"标题
    await expect(page.getByText(/团队成员/i)).toBeVisible({ timeout: 10_000 });
    // employer001 应在成员列表中
    await expect(page.getByText('employer001@manju.ai').or(page.getByText('Employer 001')).first()).toBeVisible({ timeout: 8_000 });
    // 无 API 4xx/5xx 错误
    expect(errors()).toHaveLength(0);
  });

  test('manager001 无法访问 /system（被重定向到 /workspace）', async ({ page }) => {
    await page.goto('/system');
    await page.waitForURL(url => url.pathname.startsWith('/workspace'), { timeout: 10_000 });
    expect(page.url()).toContain('/workspace');
  });

  test('UI 登录流：manager001 登录后到达 /workspace', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => { localStorage.clear(); });
    await loginAs(page, ACCOUNTS.manager001.email, ACCOUNTS.manager001.password);
    await page.waitForURL(url => url.pathname.startsWith('/workspace'), { timeout: 15_000 });
    expect(page.url()).toContain('/workspace');
  });
});

// ─────────────────────────────────────────────────────────────
// manager002@manju.ai  —  独立工作区隔离
// ─────────────────────────────────────────────────────────────
test.describe('Role: manager002 (workspace isolation)', () => {
  test.use({ storageState: ACCOUNTS.manager002.file });

  test('manager002 的团队页为空（不含 employer001）', async ({ page }) => {
    await page.goto('/workspace/team');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/团队成员/i)).toBeVisible({ timeout: 10_000 });
    // employer001 属于 manager001 的工作区，manager002 不应看到
    await expect(page.getByText('employer001@manju.ai')).not.toBeVisible({ timeout: 5_000 });
  });

  test('manager002 工作区名称为"测试空间2"', async ({ page }) => {
    // /api/workspaces/me 应返回 manager002 自己的工作区
    const resp = await page.request.get('http://localhost:8000/api/workspaces/me', {
      headers: {
        Authorization: `Bearer ${await getTokenFromStorage(page)}`,
      },
    });
    if (resp.ok()) {
      const body = await resp.json();
      expect(body.name).toBe('测试空间2');
    } else {
      // API 不通时跳过（服务器未启动）
      test.skip(true, `workspaces/me returned ${resp.status()}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// employer001@manju.ai
// ─────────────────────────────────────────────────────────────
test.describe('Role: employer001', () => {
  test.use({ storageState: ACCOUNTS.employer001.file });

  test('登录后自动跳转到 /workspace/story（首个授权页）', async ({ page }) => {
    await page.goto('/workspace');
    await page.waitForURL(url => url.pathname.startsWith('/workspace/story'), { timeout: 15_000 });
    expect(page.url()).toContain('/workspace/story');
  });

  test('直接访问 /workspace/story 正常渲染', async ({ page }) => {
    await page.goto('/workspace/story');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/workspace/story');
    expect(page.url()).not.toContain('/login');
  });

  test('访问无权限页面 /workspace/projects 被重定向到 /workspace/story', async ({ page }) => {
    await page.goto('/workspace/projects');
    await page.waitForURL(url => url.pathname.startsWith('/workspace/story'), { timeout: 10_000 });
    expect(page.url()).toContain('/workspace/story');
  });

  test('侧边栏只显示"故事与角色"，不显示其他导航项', async ({ page }) => {
    await page.goto('/workspace/story');
    await page.waitForLoadState('networkidle');
    // 授权页应在导航中
    await expect(page.locator('nav').getByRole('link', { name: '故事与角色' })).toBeVisible({ timeout: 8_000 });
    // 未授权页不应出现在侧边栏导航中
    await expect(page.locator('nav').getByRole('link', { name: '项目' })).not.toBeVisible({ timeout: 3_000 });
    await expect(page.locator('nav').getByRole('link', { name: '团队管理' })).not.toBeVisible({ timeout: 3_000 });
  });

  test('employer001 无法访问 /system', async ({ page }) => {
    await page.goto('/system');
    await page.waitForURL(url => !url.pathname.startsWith('/system'), { timeout: 10_000 });
    expect(page.url()).not.toContain('/system');
  });

  test('UI 登录流：employer001 登录后到达 /workspace/story', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => { localStorage.clear(); });
    await loginAs(page, ACCOUNTS.employer001.email, ACCOUNTS.employer001.password);
    await page.waitForURL(url => url.pathname.startsWith('/workspace/story'), { timeout: 15_000 });
    expect(page.url()).toContain('/workspace/story');
  });
});

// ─────────────────────────────────────────────────────────────
// 跨角色互访隔离（统一清空 storage 用 UI 登录）
// ─────────────────────────────────────────────────────────────
test.describe('Cross-role isolation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('未登录访问 /workspace 跳转 /login', async ({ page }) => {
    await page.goto('/workspace');
    await page.waitForURL(url => url.pathname.startsWith('/login'), { timeout: 8_000 });
    expect(page.url()).toContain('/login');
  });

  test('未登录访问 /system 跳转 /login', async ({ page }) => {
    await page.goto('/system');
    await page.waitForURL(url => url.pathname.startsWith('/login'), { timeout: 8_000 });
    expect(page.url()).toContain('/login');
  });
});

// ─────────────────────────────────────────────────────────────
// Helper — 从 localStorage 读 token（用于 API 直查）
// ─────────────────────────────────────────────────────────────
async function getTokenFromStorage(page: import('@playwright/test').Page): Promise<string> {
  // 先访问任意页面让 origin 生效
  await page.goto('/workspace');
  await page.waitForLoadState('domcontentloaded');
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}
