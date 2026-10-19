import { test, expect } from '@playwright/test';
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
} from './helpers';

/**
 * Seg 7b — Staff Schedule, Staff & RFID, Employee Profiles.
 *
 * Covered:
 *  - admin shift create (UI) → POST captured → API verify → API cleanup
 *  - admin RFID tag issue (UI) → POST captured → API verify → API revoke
 *  - admin employee create (UI) → API verify → API cleanup
 *  - all roles: Staff Schedule + RFID pages open
 *  - front_desk cannot see Employee Profiles (route/nav gated)
 *  - BUG-S7-2 (fixed): "Add Shift" is hidden for front_desk now, matching POST /shifts =
 *    admin,manager — the API 403 probe is retained.
 *  - BUG-S7-3 (fixed): manager manage actions are gated by PermissionGate (manageUsers).
 *  - BUG-S7-4 (fixed): "Create Tag" is hidden for front_desk now, matching POST /rfidtags =
 *    admin,manager — the API 403 probe is retained.
 */
test.describe.configure({ mode: 'serial' });

const SUFFIX = uniqueSuffix();
const TODAY = new Date().toISOString().slice(0, 10);
const RFID_TAG = `RFID-E2E-${SUFFIX}`;
const EMP_NAME = `E2E Emp ${SUFFIX}`;
const EMP_EMAIL = `e2e.emp.${SUFFIX}@nexus.com`;

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept());
});

test.describe('staff schedule — admin happy path', () => {
  test('admin creates a shift via UI, verified through the API', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Staff Schedule');

    await page.getByRole('button', { name: 'Add Shift', exact: true }).first().click();
    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByRole('button', { name: 'Add Shift', exact: true })).toBeVisible();

    const empSel = field(modal, /^Employee/);
    await empSel.selectOption({ index: 1 });
    const empName = (await empSel.locator('option:checked').textContent())!.split(' - ')[0].trim();

    await field(modal, /^Date/).fill(TODAY);
    await field(modal, /^Start/).fill('08:00');
    await field(modal, /^End/).fill('16:00');

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/shifts') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: 'Add Shift', exact: true }).click(),
    ]);
    await expect(page.getByText('Shift created')).toBeVisible();
    expect(resp.status()).toBeLessThan(300);

    const dto = unwrap(await resp.json()) as { id: number; userName: string; date: string };
    const shiftId = Number(dto.id);
    expect(dto.userName).toBe(empName);

    const one = await apiGet(request, `/shifts/${shiftId}`, 'admin');
    expect(one.status).toBe(200);

    expect((await apiDelete(request, `/shifts/${shiftId}`, 'admin')).status).toBeLessThan(300);
  });
});

test.describe('rfid — admin happy path', () => {
  test('admin issues a tag via UI, verified through the API', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Staff & RFID');

    await page.getByRole('button', { name: 'Create Tag', exact: true }).first().click();
    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByRole('heading', { name: 'Create RFID Tag' })).toBeVisible();

    await modal.locator('#autoGenerate').uncheck();
    await modal.getByPlaceholder('RFID-XXX').fill(RFID_TAG);
    await field(modal, /^Assign To/).selectOption({ index: 1 });

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/rfidtags') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      modal.getByRole('button', { name: 'Create Tag', exact: true }).click(),
    ]);
    await expect(page.getByText(`RFID tag ${RFID_TAG} created`)).toBeVisible();
    expect(resp.status()).toBeLessThan(300);

    const dto = unwrap(await resp.json()) as { id: number; propertyId: number; tagNumber: string };
    const tagId = Number(dto.id);
    const propertyId = Number(dto.propertyId);
    expect(dto.tagNumber).toBe(RFID_TAG);

    await waitForApiList(request, `/rfidtags?propertyId=${propertyId}`, 'admin', (rows) =>
      rows.some((r) => r.tagNumber === RFID_TAG),
    );

    const revoke = await apiPost(request, `/rfidtags/${tagId}/revoke`, 'admin', {});
    expect(revoke.status).toBeLessThan(300);
  });
});

test.describe('employee profiles — admin happy path', () => {
  test('admin adds an employee via UI, verified through the API', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'admin');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Employee Profiles');

    await page.getByRole('button', { name: 'Add Employee', exact: true }).first().click();
    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

    await field(modal, /^Name/).fill(EMP_NAME);
    await field(modal, /^Email/).fill(EMP_EMAIL);
    await field(modal, /^Role/).fill('E2E Tester');
    await field(modal, /^Department/).fill('QA');
    await modal.getByRole('button', { name: 'Add Employee', exact: true }).click();

    const list = await waitForApiList(request, `/users?search=${EMP_EMAIL}`, 'admin', (rows) =>
      rows.some((r) => r.email === EMP_EMAIL),
    );
    const created = list.find((r) => r.email === EMP_EMAIL) as { id: number };
    expect(created).toBeTruthy();

    expect((await apiDelete(request, `/users/${Number(created.id)}`, 'admin')).status).toBeLessThan(300);
  });
});

test.describe('staff/rfid/profiles — role access + RBAC', () => {
  test('staff schedule + rfid pages open for the signed-in role', async ({ page }, testInfo) => {
    const canManage = testInfo.project.name !== 'front_desk';

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Staff Schedule');
    if (canManage) {
      await expect(page.getByRole('button', { name: 'Add Shift', exact: true }).first()).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Add Shift', exact: true })).toHaveCount(0);
    }

    await gotoNav(page, 'Staff & RFID');
    if (canManage) {
      await expect(page.getByRole('button', { name: 'Create Tag', exact: true }).first()).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Create Tag', exact: true })).toHaveCount(0);
    }
  });

  test('front_desk cannot reach Employee Profiles', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');

    await page.goto('/');
    await waitForHydration(page);
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav.getByRole('button', { name: 'Employee Profiles', exact: true })).toHaveCount(0);
  });

  test('front_desk: shift create is forbidden by the API and hidden in the UI (BUG-S7-2 fixed)', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Staff Schedule');

    // The "Add Shift" affordance is gone for front_desk (fixed)…
    await expect(page.getByRole('button', { name: 'Add Shift', exact: true })).toHaveCount(0);
    // …and the backend still rejects the write (POST /shifts is admin,manager only).
    expect((await apiPost(request, '/shifts', 'front_desk', {})).status).toBe(403);
  });

  test('manager sees Employee Profiles but manage actions are gated (manageUsers)', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'manager');

    await page.goto('/');
    await waitForHydration(page);
    // manager has viewUsers (page opens) but not manageUsers.
    await gotoNav(page, 'Employee Profiles');
    await expect(page.getByRole('button', { name: 'Add Employee', exact: true })).toHaveCount(0);
    await expect(page.getByTitle('Edit employee')).toHaveCount(0);
    await expect(page.getByTitle('Delete employee')).toHaveCount(0);
    // Backend agrees the write is forbidden.
    expect((await apiPost(request, '/users', 'manager', {})).status).toBe(403);
  });

  test('front_desk: rfid issue is forbidden by the API and hidden in the UI (BUG-S7-4 fixed)', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');

    await page.goto('/');
    await waitForHydration(page);
    await gotoNav(page, 'Staff & RFID');

    // The "Create Tag" affordance is gone for front_desk (fixed)…
    await expect(page.getByRole('button', { name: 'Create Tag', exact: true })).toHaveCount(0);
    // …and the backend still rejects the write (POST /rfidtags is admin,manager only).
    expect((await apiPost(request, '/rfidtags', 'front_desk', {})).status).toBe(403);
  });
});
