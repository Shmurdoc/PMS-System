import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const AUTH_DIR = '.auth';

const accounts = [
  { role: 'admin', email: 'admin@nexus.com', password: 'admin123' },
  { role: 'manager', email: 'manager@nexus.com', password: 'manager123' },
  { role: 'front_desk', email: 'front@nexus.com', password: 'front123' },
] as const;

setup('authenticate all roles', async ({ browser, baseURL }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  for (const account of accounts) {
    const context = await browser.newContext();
    const page = await context.newPage();

    const failures: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 400 && res.url().includes('/api/v1')) {
        failures.push(`${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`);
      }
    });

    await page.goto(baseURL ?? 'http://localhost:5173');
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible();

    await page.getByPlaceholder('Enter your email').fill(account.email);
    await page.getByPlaceholder('Enter your password').fill(account.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for auth flag + hydration kick-off
    await page.waitForFunction(() => localStorage.getItem('nexus_logged_in') === 'true', null, { timeout: 20_000 });
    await page.waitForFunction(() => (localStorage.getItem('aquri_token') ?? '').length > 100, null, { timeout: 10_000 });

    // Sidebar nav is the post-login landmark
    await expect(page.getByRole('navigation').or(page.getByRole('button', { name: 'Dashboard' })).first()).toBeVisible({ timeout: 20_000 });

    // Give hydration a moment to settle (fire-and-forget after login)
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => undefined);

    const token = await page.evaluate(() => localStorage.getItem('aquri_token'));
    if (!token) throw new Error(`No token stored for ${account.role}`);

    await context.storageState({ path: path.join(AUTH_DIR, `${account.role}.json`) });
    await context.close();

    console.log(`[auth] ${account.role} ok — api failures during login: ${failures.length ? failures.join(', ') : 'none'}`);
  }
});
