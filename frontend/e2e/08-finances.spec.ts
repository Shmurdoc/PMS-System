import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  gotoNav,
  waitForHydration,
  apiGet,
  apiDelete,
  apiPost,
  unwrap,
  field,
  uniqueSuffix,
  waitForApiList,
  waitForApiListGone,
} from './helpers';

/**
 * Seg 8 — Finances (FinancialManagement page).
 *
 * Covered:
 *  - [admin,manager] page loads with tabs
 *  - [front_desk] Finances hidden from nav (viewFinances false / route-gated)
 *  - [admin] expense add → approve → delete round-trip (UI seed, API verify, API teardown)
 *  - [admin] tax config add → delete round-trip (rate stored as a fraction, 12.5% → 0.125)
 *  - [manager] BUG-S8-1 (fixed): the row Delete affordance is admin-only in the UI now,
 *    matching DELETE /expenses/{id} = admin; the API 403 probe is retained for managers.
 *  - RBAC probes: manager cannot DELETE an expense (403); front_desk can read expenses but
 *    cannot write tax configs (403).
 *
 * Expense sync note (verified in the store): addExpense/addTaxConfig POST then reconcile the
 * local `EXP-…`/`TAX-…` id with the server id, so edit/approve/reject/delete DO reach the API.
 * Only a brief race window exists between add and reconcile.
 */
const SUFFIX = uniqueSuffix();
const TODAY = new Date().toISOString().slice(0, 10);
const EXP_DESC = `E2E expense ${SUFFIX}`;
const EXP_DESC_MGR = `E2E mgr expense ${SUFFIX}`;
const EXP_AMOUNT = '4321.55';
const TAX_NAME = `E2E Tax ${SUFFIX}`;
const TAX_RATE_PCT = '12.5';

/** Read the admin token straight from the saved storage state (helpers.getToken uses the *project* role). */
const ADMIN_STATE = join(dirname(fileURLToPath(import.meta.url)), '..', '.auth', 'admin.json');

function adminToken(): string {
  const state = JSON.parse(readFileSync(ADMIN_STATE, 'utf-8')) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  const found = (state.origins ?? [])
    .flatMap((o) => o.localStorage ?? [])
    .find((i) => i.name === 'aquri_token');
  return found?.value ?? '';
}

/** DELETE with an explicit admin token — used to clean up rows a lower-privileged role cannot. */
async function deleteAsAdmin(request: APIRequestContext, path: string): Promise<number> {
  const base = process.env['AQURI_API_URL'] ?? 'http://localhost:5080';
  const res = await request.delete(`${base}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}` },
  });
  return res.status();
}

test.describe('finances — page access', () => {
  test('admin/manager see the Finances page and its tabs', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin' && testInfo.project.name !== 'manager');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Finances');

    await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tax Config', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Expenses \(/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Expense', exact: true }).first()).toBeVisible();
  });

  test('front_desk cannot reach Finances', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');

    await page.goto('/');
    await waitForHydration(page);
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav.getByRole('button', { name: 'Finances', exact: true })).toHaveCount(0);
  });
});

test.describe('finances — admin happy paths', () => {
  test('admin adds, approves, and deletes an expense via the UI (verified through the API)', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Finances');
    await page.getByRole('button', { name: /^Expenses \(/ }).click();

    await page.getByRole('button', { name: 'Add Expense', exact: true }).first().click();
    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByRole('heading', { name: 'Add New Expense' })).toBeVisible();
    await field(modal, /^Amount \(R\)/).fill(EXP_AMOUNT);
    await field(modal, /^Description/).fill(EXP_DESC);
    await field(modal, /^Submitted By/).fill('QA Tester');
    await field(modal, /^Property/).selectOption({ index: 1 });
    await modal.getByRole('button', { name: 'Save Expense', exact: true }).click();
    await expect(page.getByText('Expense added successfully')).toBeVisible();
    await expect(modal).toBeHidden({ timeout: 15_000 });

    const list = await waitForApiList(request, '/expenses', 'admin', (rows) =>
      rows.some((r) => r.description === EXP_DESC),
    );
    const created = list.find((r) => r.description === EXP_DESC) as { id: number; status: string; amount: number };
    const expenseId = Number(created.id);
    expect(expenseId).toBeGreaterThan(0);
    expect(created.status).toBe('pending');
    expect(Number(created.amount)).toBeCloseTo(4321.55, 2);

    // Approve via the row action, then confirm server-side state.
    await page.locator('tr', { hasText: EXP_DESC }).getByTitle('Approve').click();
    await expect(page.getByText('Expense approved')).toBeVisible();
    await waitForApiList(request, '/expenses', 'admin', (rows) =>
      rows.some((r) => Number(r.id) === expenseId && r.status === 'approved'),
    );

    // Delete via the row action → confirm modal.
    await page.locator('tr', { hasText: EXP_DESC }).getByTitle('Delete').click();
    const confirm = page.locator('div.fixed.inset-0').last();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Expense deleted')).toBeVisible();

    await waitForApiListGone(request, '/expenses', 'admin', (rows) =>
      rows.some((r) => Number(r.id) === expenseId),
    );
  });

  test('admin adds and deletes a tax config via the UI (rate stored as a fraction)', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Finances');
    await page.getByRole('button', { name: 'Tax Config', exact: true }).click();

    await page.getByRole('button', { name: 'Add Tax', exact: true }).click();
    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByRole('heading', { name: 'Add Tax Config' })).toBeVisible();
    await field(modal, /^Tax Name/).fill(TAX_NAME);
    await field(modal, /^Rate \(%\)/).fill(TAX_RATE_PCT);
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Tax config added')).toBeVisible();
    // The toast covers the card actions, so let it clear before clicking them.
    await expect(page.getByText('Tax config added')).toBeHidden({ timeout: 10_000 });

    const list = await waitForApiList(request, '/taxconfigs', 'admin', (rows) =>
      rows.some((r) => r.name === TAX_NAME),
    );
    const created = list.find((r) => r.name === TAX_NAME) as { id: number; rate: number };
    // Frontend sends rate/100; the API persists 0.125 for a 12.5% config.
    expect(Math.abs(Number(created.rate) - 0.125)).toBeLessThan(1e-9);

    // Let addTaxConfig reconcile `TAX-<ts>` → server id before deleting.
    await page.waitForTimeout(1500);
    const card = page.locator('div.rounded-xl', { hasText: TAX_NAME }).first();
    await card.locator('button').last().click();
    await expect(page.getByText('Tax config deleted')).toBeVisible();

    await waitForApiListGone(request, '/taxconfigs', 'admin', (rows) =>
      rows.some((r) => r.name === TAX_NAME),
    );
  });

  // NOTE (S11 gap): invoices and payments are READ-ONLY on this page. There is no UI to create
  // an invoice (it is generated elsewhere), and the store's completePayment/refundPayment hooks
  // have no buttons wired to them — so invoice items / payment completion / refunds are not
  // reachable via the UI and cannot be UI-seeded. These tests just prove the read surfaces render.
  test('admin: invoices and payments tabs render (read-only surfaces)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Finances');

    await page.getByRole('button', { name: /^Invoices \(/ }).click();
    await expect(page.getByRole('columnheader', { name: 'Invoice', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /^Payments \(/ }).click();
    await expect(page.getByRole('columnheader', { name: 'Method', exact: true })).toBeVisible();
  });
});

test.describe('finances — RBAC', () => {
  test('BUG-S8-1 (fixed): manager expense delete affordance is hidden in the UI', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'manager');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Finances');
    await page.getByRole('button', { name: /^Expenses \(/ }).click();

    await page.getByRole('button', { name: 'Add Expense', exact: true }).first().click();
    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByRole('heading', { name: 'Add New Expense' })).toBeVisible();
    await field(modal, /^Amount \(R\)/).fill('99.99');
    await field(modal, /^Description/).fill(EXP_DESC_MGR);
    await field(modal, /^Submitted By/).fill('QA Manager');
    await field(modal, /^Property/).selectOption({ index: 1 });
    await modal.getByRole('button', { name: 'Save Expense', exact: true }).click();
    await expect(page.getByText('Expense added successfully')).toBeVisible();

    const list = await waitForApiList(request, '/expenses', 'manager', (rows) =>
      rows.some((r) => r.description === EXP_DESC_MGR),
    );
    const expenseId = Number((list.find((r) => r.description === EXP_DESC_MGR) as { id: number }).id);
    expect(expenseId).toBeGreaterThan(0);

    // The row renders, but the delete affordance is gone for managers (fixed).
    const row = page.locator('tr', { hasText: EXP_DESC_MGR });
    await expect(row).toBeVisible();
    await expect(row.getByTitle('Delete')).toHaveCount(0);

    // The backend still restricts DELETE /expenses/{id} to admin.
    expect((await apiDelete(request, `/expenses/${expenseId}`, 'manager')).status).toBe(403);

    // Cleanup with an admin token.
    expect(await deleteAsAdmin(request, `/expenses/${expenseId}`)).toBeLessThan(300);
    await waitForApiListGone(request, '/expenses', 'manager', (rows2) =>
      rows2.some((r) => Number(r.id) === expenseId),
    );
  });

  test('RBAC probes: expense delete is admin-only; tax config write is manager+', async ({ request }, testInfo) => {
    const role = testInfo.project.name;
    test.skip(role !== 'manager' && role !== 'front_desk', 'probes target manager/front_desk');

    if (role === 'manager') {
      expect((await apiDelete(request, '/expenses/1', 'manager')).status).toBe(403);
    } else {
      // front_desk can READ expenses (any authenticated) but cannot reach the Finances page…
      expect((await apiGet(request, '/expenses', 'front_desk')).status).toBe(200);
      // …and cannot write tax configs (POST /taxconfigs is admin,manager).
      const post = await apiPost(request, '/taxconfigs', 'front_desk', {
        propertyId: 1,
        name: `probe-${SUFFIX}`,
        rate: 0.1,
        type: 'vat',
        included: false,
        applicableTo: ['room'],
        validFrom: TODAY,
      });
      expect(post.status).toBe(403);
    }
  });
});
