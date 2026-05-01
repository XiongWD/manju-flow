/**
 * Playwright global setup: obtain auth tokens via API and save storageState files.
 * Also triggers the multitenancy seed endpoint to ensure test accounts exist.
 */
import { request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export const AUTH_STATE_FILE = path.join(__dirname, '.auth', 'admin.json');

const API_URL  = 'http://localhost:8000';
const BASE_URL = 'http://localhost:3000';

/** Legacy admin account (existing tests) */
const LEGACY_EMAIL    = 'admin@manju.local';
const LEGACY_PASSWORD = 'ChangeMe123!';

/** Multitenancy test accounts */
const MT_ACCOUNTS = [
  { email: 'superadmin@manju.ai', password: 'SuperAdmin123!', file: path.join(__dirname, '.auth', 'superadmin.json') },
  { email: 'manager001@manju.ai', password: 'Manager123!',    file: path.join(__dirname, '.auth', 'manager001.json') },
  { email: 'manager002@manju.ai', password: 'Manager123!',    file: path.join(__dirname, '.auth', 'manager002.json') },
  { email: 'employer001@manju.ai', password: 'Emp123!',       file: path.join(__dirname, '.auth', 'employer001.json') },
];

function writeStorageState(file: string, token: string) {
  const storageState = {
    cookies: [] as object[],
    origins: token
      ? [{ origin: BASE_URL, localStorage: [
            { name: 'access_token',  value: token },
            { name: 'refresh_token', value: token },
          ] }]
      : [],
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(storageState, null, 2));
}

async function getToken(ctx: Awaited<ReturnType<typeof request.newContext>>, email: string, password: string): Promise<string> {
  try {
    const resp = await ctx.post(`${API_URL}/api/auth/login`, {
      data: { email, password },
      timeout: 8_000,
    });
    if (resp.ok()) {
      const body = await resp.json();
      return body.access_token ?? '';
    }
    console.warn(`[global-setup] Login failed for ${email}: ${resp.status()}`);
  } catch (e) {
    console.warn(`[global-setup] Login error for ${email}:`, e);
  }
  return '';
}

async function globalSetup() {
  const ctx = await request.newContext();

  try {
    // ── Step 1: seed multitenancy accounts ──────────────────
    console.log('[global-setup] Seeding multitenancy accounts…');
    try {
      const seedResp = await ctx.post(`${API_URL}/api/seed-multitenancy`, { timeout: 10_000 });
      if (seedResp.ok()) {
        const body = await seedResp.json();
        console.log('[global-setup] Seed result:', JSON.stringify(body.results));
      } else {
        console.warn(`[global-setup] Seed returned ${seedResp.status()} — accounts may already exist`);
      }
    } catch (e) {
      console.warn('[global-setup] Seed request failed (non-fatal):', e);
    }

    // ── Step 2: legacy admin token ───────────────────────────
    const adminToken = await getToken(ctx, LEGACY_EMAIL, LEGACY_PASSWORD);
    writeStorageState(AUTH_STATE_FILE, adminToken);
    console.log('[global-setup] admin.json written');

    // ── Step 3: multitenancy account tokens ─────────────────
    for (const acct of MT_ACCOUNTS) {
      const token = await getToken(ctx, acct.email, acct.password);
      writeStorageState(acct.file, token);
      console.log(`[global-setup] ${path.basename(acct.file)} written (token=${token ? 'ok' : 'EMPTY'})`);
    }
  } finally {
    await ctx.dispose();
  }
}

export default globalSetup;
