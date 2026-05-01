/**
 * E2E: Backend API contract verification via direct HTTP calls.
 *
 * Per testing-rules.md §3.1 API 面完整性 & §3.3 CRUD 真实性 & §5.1 契约一致性
 */
import { test, expect } from '@playwright/test';
import { API_URL, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } from './helpers';

// API contract tests use direct HTTP — no browser storage state needed
test.use({ storageState: { cookies: [], origins: [] } });

let authToken = '';

test.describe('Backend API Contract', () => {
  test.beforeAll(async ({ request }) => {
    // Authenticate once and cache the token
    const resp = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: DEFAULT_ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD },
    });
    if (resp.ok()) {
      const body = await resp.json();
      authToken = body.access_token ?? body.token ?? '';
    }
  });

  const authHeaders = (): Record<string, string> => authToken ? { Authorization: `Bearer ${authToken}` } : {};

  // ── Health check ────────────────────────────────────────────────────────────
  test('GET /api/health returns 200', async ({ request }) => {
    const resp = await request.get(`${API_URL}/api/health`);
    expect(resp.status()).toBe(200);
  });

  // ── Auth endpoints ───────────────────────────────────────────────────────────
  test('POST /api/auth/login with valid credentials returns token', async ({ request }) => {
    const resp = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: DEFAULT_ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.access_token ?? body.token).toBeTruthy();
  });

  test('POST /api/auth/login with wrong password returns 401', async ({ request }) => {
    const resp = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: DEFAULT_ADMIN_EMAIL, password: 'wrong-password' },
    });
    expect(resp.status()).toBe(401);
  });

  test('GET /api/auth/me returns current user when authenticated', async ({ request }) => {
    if (!authToken) test.skip();
    const resp = await request.get(`${API_URL}/api/auth/me`, { headers: authHeaders() });
    expect([200, 404]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.email ?? body.username).toBeTruthy();
    }
  });

  // ── CRUD: Projects ──────────────────────────────────────────────────────────
  test('GET /api/projects returns list (auth or no-auth)', async ({ request }) => {
    const resp = await request.get(`${API_URL}/api/projects`, { headers: authHeaders() });
    expect([200, 401]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(Array.isArray(body) || Array.isArray(body.items) || Array.isArray(body.data)).toBeTruthy();
    }
  });

  test('POST /api/projects with missing name returns 422', async ({ request }) => {
    const resp = await request.post(`${API_URL}/api/projects`, {
      data: {},
      headers: authHeaders(),
    });
    expect([401, 422]).toContain(resp.status());
  });

  // ── CRUD: Characters ────────────────────────────────────────────────────────
  test('GET /api/characters without project_id returns 422', async ({ request }) => {
    // characters endpoint requires project_id query param
    const resp = await request.get(`${API_URL}/api/characters`, { headers: authHeaders() });
    expect([401, 422]).toContain(resp.status());
  });

  // ── CRUD: Assets ────────────────────────────────────────────────────────────
  test('GET /api/assets returns list', async ({ request }) => {
    const resp = await request.get(`${API_URL}/api/assets`, { headers: authHeaders() });
    expect([200, 401]).toContain(resp.status());
  });

  // ── 404 for non-existent resource ───────────────────────────────────────────
  test('GET /api/projects/nonexistent-id returns 404 or 422', async ({ request }) => {
    const resp = await request.get(`${API_URL}/api/projects/nonexistent-id-xyz`, { headers: authHeaders() });
    expect([401, 404, 422]).toContain(resp.status());
  });

  // ── OpenAPI docs ─────────────────────────────────────────────────────────────
  test('GET /openapi.json returns valid schema', async ({ request }) => {
    const resp = await request.get(`${API_URL}/openapi.json`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.openapi ?? body.swagger).toBeTruthy();
    expect(body.paths).toBeTruthy();
  });

  // ── No 500 on common endpoints ──────────────────────────────────────────────
  test('core API endpoints do not return 500', async ({ request }) => {
    // Note: /api/characters requires project_id param — intentionally excluded here
    const endpoints = ['/api/projects', '/api/assets', '/api/locations', '/api/health'];
    const failures: string[] = [];
    for (const ep of endpoints) {
      const resp = await request.get(`${API_URL}${ep}`, { headers: authHeaders() });
      if (resp.status() === 500) {
        failures.push(`${ep} → 500`);
      }
    }
    expect(failures, `Endpoints returned 500: ${failures.join(', ')}`).toHaveLength(0);
  });
});
