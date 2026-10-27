import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  gotoNav,
  waitForHydration,
  apiDelete,
  apiPost,
  unwrap,
  field,
  waitForApiList,
  waitForApiListGone,
} from './helpers';

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

/**
 * Seg 7a — Facility & Utilities (electricity + maintenance).
 *
 * Covered:
 *  - admin electricity create (UI) → API verify → UI edit → API verify → UI delete → API gone
 *  - admin maintenance ticket create (UI) → API verify → UI complete → API verify → UI delete → API gone
 *  - all roles: Facility page opens
 *  - RBAC negatives (API): manager cannot DELETE electricity; front_desk cannot POST shifts/rfidtags/users
 *  - BUG-S7-1 (fixed): electricity Delete is admin-only in the UI now, matching
 *    DELETE /electricity/{id} = admin — managers no longer see the affordance.
 */
test.describe.configure({ mode: 'serial' });

const ELEC_PEAK = 1_000_000 + (Date.now() % 8_999_999); // 7 digits, unique per run
const ELEC_CONSUMPTION = 1_000 + (Date.now() % 9_000);
const ELEC_COST = 456.78;
const TICKET_TITLE = `E2E Facility Ticket ${ELEC_PEAK}`;
const TICKET_DESC = `E2E facility maintenance ${ELEC_PEAK}`;

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept());
});

test.describe('facility — admin happy paths', () => {
  test('electricity CRUD via UI, verified through the API', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Facility');

    // ---- create ----
    await page.getByRole('button', { name: 'Add Record', exact: true }).first().click();
    let modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByRole('heading', { name: 'Add Electricity Record' })).toBeVisible();

    await field(modal, /^Date/).fill('2031-02-14');
    await field(modal, /^Consumption/).fill(String(ELEC_CONSUMPTION));
    await field(modal, /^Cost/).fill(String(ELEC_COST));
    await field(modal, /^Peak Demand/).fill(String(ELEC_PEAK));

    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/electricity') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(createResp.status()).toBeLessThan(300);
    const created = unwrap(await createResp.json()) as { id: number; peakDemand: number; cost: number };
    const serverId = Number(created.id);
    expect(Number(created.peakDemand)).toBe(ELEC_PEAK);

    await expect(page.getByText('Electricity record added')).toBeVisible();
    await waitForApiList(request, '/electricity', 'admin', (rows) =>
      rows.some((r) => Number(r.id) === serverId),
    );

    // ---- edit ----
    const row = page.locator('tbody tr').filter({ hasText: String(ELEC_PEAK) }).first();
    await expect(row).toBeVisible();
    await row.locator('[title="Edit"]').click();
    modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByRole('heading', { name: 'Edit Electricity Record' })).toBeVisible();
    await field(modal, /^Cost/).fill('999.99');
    await modal.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.getByText('Electricity record updated')).toBeVisible();

    await waitForApiList(request, '/electricity', 'admin', (rows) =>
      rows.some((r) => Number(r.id) === serverId && Number(r.cost) === 999.99),
    );

    // ---- delete ----
    await row.locator('[title="Delete"]').click();
    await waitForApiListGone(request, '/electricity', 'admin', (rows) =>
      rows.some((r) => Number(r.id) === serverId),
    );
  });

  test('maintenance ticket CRUD via UI, verified through the API', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Facility');
    await page.getByRole('button', { name: 'Maintenance', exact: true }).first().click();

    // ---- create ----
    await page.getByRole('button', { name: 'New Ticket', exact: true }).first().click();
    let modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByRole('heading', { name: 'Create Maintenance Ticket' })).toBeVisible();

    await field(modal, /^Title/).fill(TICKET_TITLE);
    await field(modal, /^Description/).fill(TICKET_DESC);
    const propSel = field(modal, /^Property/);
    await propSel.selectOption({ index: 1 }).catch(() => undefined);
    const propertyId = Number(await propSel.inputValue());

    await modal.getByRole('button', { name: 'Create Ticket', exact: true }).click();
    await expect(page.getByText('Maintenance ticket created')).toBeVisible();
    // The toast covers the row actions, so let it clear before clicking them.
    await expect(page.getByText('Maintenance ticket created')).toBeHidden({ timeout: 10_000 });

    await waitForApiList(request, `/maintenanceRequests?propertyId=${propertyId}`, 'admin', (rows) =>
      rows.some((r) => r.description === TICKET_DESC),
    );

    // ---- complete (row action) ----
    const card = page.locator('div.flex.items-start.justify-between').filter({ hasText: TICKET_TITLE });
    await expect(card).toBeVisible();
    await card.locator('[title="Mark as completed"]').click();
    await expect(page.getByText('Ticket completed')).toBeVisible();
    await expect(page.getByText('Ticket completed')).toBeHidden({ timeout: 10_000 });
    await waitForApiList(request, `/maintenanceRequests?propertyId=${propertyId}`, 'admin', (rows) =>
      rows.some((r) => r.description === TICKET_DESC && r.status === 'completed'),
    );

    // ---- delete ----
    await card.locator('[title="Delete ticket"]').click();
    await expect(page.getByText('Ticket deleted')).toBeVisible();
    await waitForApiListGone(request, `/maintenanceRequests?propertyId=${propertyId}`, 'admin', (rows) =>
      rows.some((r) => r.description === TICKET_DESC),
    );
  });
});

test.describe('facility — role access + RBAC', () => {
  test('facility page opens for the signed-in role', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Facility');
    await expect(page.getByRole('button', { name: 'Add Record', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Maintenance', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'New Ticket', exact: true }).first()).toBeVisible();
  });

  test('manager: electricity DELETE is forbidden by the API and hidden in the UI (BUG-S7-1 fixed)', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'manager');

    // The backend restricts DELETE /electricity/{id} to admin.
    const del = await apiDelete(request, '/electricity/1', 'manager');
    expect(del.status, 'API restricts DELETE /electricity/{id} to admin').toBe(403);

    // Managers can create records — add one through the UI so the table has a manager-owned row.
    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Facility');
    await page.getByRole('button', { name: 'Add Record', exact: true }).first().click();
    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByRole('heading', { name: 'Add Electricity Record' })).toBeVisible();
    await field(modal, /^Date/).fill('2031-02-15');
    await field(modal, /^Consumption/).fill(String(ELEC_CONSUMPTION));
    await field(modal, /^Cost/).fill(String(ELEC_COST));
    await field(modal, /^Peak Demand/).fill(String(ELEC_PEAK));
    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/electricity') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(createResp.status()).toBeLessThan(300);
    const created = unwrap(await createResp.json()) as { id: number };
    const serverId = Number(created.id);

    // The row renders for the manager, but the delete affordance is gone (fixed).
    const row = page.locator('tbody tr').filter({ hasText: String(ELEC_PEAK) }).first();
    await expect(row).toBeVisible();
    await expect(row.locator('[title="Delete"]')).toHaveCount(0);

    // Cleanup with an admin token (managers cannot delete).
    expect(await deleteAsAdmin(request, `/electricity/${serverId}`)).toBeLessThan(300);
    await waitForApiListGone(request, '/electricity', 'manager', (rows) =>
      rows.some((r) => Number(r.id) === serverId),
    );
  });

  test('front_desk: shift/tag/user mutations are forbidden by the API and hidden in the UI (BUG-S7-2/3/4 fixed)', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');

    expect((await apiPost(request, '/shifts', 'front_desk', {})).status).toBe(403);
    expect((await apiPost(request, '/rfidtags', 'front_desk', {})).status).toBe(403);
    expect((await apiPost(request, '/users', 'front_desk', {})).status).toBe(403);
    expect((await apiDelete(request, '/electricity/1', 'front_desk')).status).toBe(403);

    // The UI no longer exposes the "Add Shift" affordance on the Staff Schedule page (fixed).
    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Staff Schedule');
    await expect(page.getByRole('button', { name: 'Add Shift', exact: true })).toHaveCount(0);
  });
});
