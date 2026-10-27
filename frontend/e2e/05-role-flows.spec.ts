import { test, expect, type Browser, type APIRequestContext, type Page } from '@playwright/test';
import {
  gotoNav, waitForHydration, field, uniqueSuffix,
  apiGet, apiPost, apiDelete,
  waitForApiList, waitForApiListGone,
  type Role,
} from './helpers';

/**
 * S5 — Role flows (manager + front_desk).
 * 01-nav-audit already proves sidebar visibility per role, so here we prove the
 * *behavioural* contract: allowed endpoints 200, admin-only endpoints 403, and a
 * real UI CRUD round-trip (create + edit a guest) that the API confirms.
 */

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ForbiddenCall {
  label: string;
  method: Method;
  path: string;
  data?: unknown;
}

// Admin-only (or admin+manager) endpoints the given role must never reach.
const MANAGER_FORBIDDEN: ForbiddenCall[] = [
  { label: 'create user', method: 'POST', path: '/users', data: {} },
  { label: 'delete property', method: 'DELETE', path: '/properties/999999' },
  { label: 'delete room', method: 'DELETE', path: '/rooms/999999' },
];

const FRONT_DESK_FORBIDDEN: ForbiddenCall[] = [
  { label: 'create property', method: 'POST', path: '/properties', data: {} },
  { label: 'delete room', method: 'DELETE', path: '/rooms/999999' },
  { label: 'create tax config', method: 'POST', path: '/taxconfigs', data: {} },
];

async function callForbidden(request: APIRequestContext, role: Role, c: ForbiddenCall): Promise<number> {
  switch (c.method) {
    case 'GET': return (await apiGet(request, c.path, role)).status;
    case 'POST': return (await apiPost(request, c.path, role, c.data)).status;
    case 'PUT': return (await apiPost(request, c.path, role, c.data)).status;
    case 'DELETE': return (await apiDelete(request, c.path, role)).status;
  }
}

/** A throwaway admin context so we can tear down entities a role cannot delete itself. */
async function withAdminCtx(browser: Browser, fn: (req: APIRequestContext) => Promise<void>): Promise<void> {
  const ctx = await browser.newContext({ storageState: '.auth/admin.json' });
  try {
    await fn(ctx.request);
  } finally {
    await ctx.close();
  }
}

/**
 * Guest create + edit through the real UI, verified against the API.
 * Delete is only exercised when the role is permitted (`canDelete`), otherwise
 * the caller cleans up via an admin context.
 */
async function guestCrud(page: Page, request: APIRequestContext, role: Role, canDelete: boolean): Promise<number> {
  const suffix = uniqueSuffix();
  const name = `QA Role Guest ${suffix}`;
  const email = `qa.role.${suffix}@example.com`;

  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Guests');

  // Create
  await page.getByRole('button', { name: 'Add Guest', exact: true }).first().click();
  const addModal = page.locator('div.fixed.inset-0').last();
  await expect(addModal).toBeVisible();
  await field(addModal, /^Full Name/).fill(name);
  await field(addModal, /^Email/).fill(email);
  await field(addModal, /^Phone/).fill('+27 82 111 2222');
  await field(addModal, /^ID Number/).fill('QA0000000000');
  await field(addModal, /^Nationality/).fill('South Africa');
  await addModal.locator('form').getByRole('button', { name: 'Add Guest', exact: true }).click();
  await expect(addModal).toBeHidden({ timeout: 15_000 });

  const created = await waitForApiList(
    request,
    `/guests?search=${encodeURIComponent(email)}`,
    role,
    (items) => items.some((r) => r.email === email),
  );
  const guestId = Number(created.find((r) => r.email === email)!.id);
  expect(guestId).toBeGreaterThan(0);

  // Edit — scope to this guest's own card (search is exercised, but the card
  // filter makes the click deterministic regardless of list ordering/timing).
  await page.getByPlaceholder('Search guests...').fill(email);
  const card = page.locator('div.group').filter({ hasText: email });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  const editModal = page.locator('div.fixed.inset-0').last();
  await expect(editModal).toBeVisible();
  const renamed = `${name} Edited`;
  await field(editModal, /^Full Name/).fill(renamed);
  await editModal.locator('form').getByRole('button', { name: 'Update Guest', exact: true }).click();
  await expect(editModal).toBeHidden({ timeout: 15_000 });

  await waitForApiList(
    request,
    `/guests?search=${encodeURIComponent(email)}`,
    role,
    (items) => items.some((r) => Number(r.id) === guestId && r.name === renamed),
  );

  if (canDelete) {
    await page.getByPlaceholder('Search guests...').fill(email);
    const cardToDelete = page.locator('div.group').filter({ hasText: email });
    await expect(cardToDelete).toHaveCount(1);
    await cardToDelete.locator('button:has(svg[class*="trash"])').click();
    await waitForApiListGone(
      request,
      `/guests?search=${encodeURIComponent(email)}`,
      role,
      (items) => items.some((r) => Number(r.id) === guestId),
    );
    return -1;
  }

  return guestId;
}

test.describe('manager role flows', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (d) => d.accept());
  });

  test('manager: allowed endpoints return 200', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'manager');
    expect((await apiGet(request, '/users', 'manager')).status).toBe(200);
    expect((await apiGet(request, '/guests', 'manager')).status).toBe(200);
    expect((await apiGet(request, '/properties', 'manager')).status).toBe(200);
  });

  test('manager: admin-only endpoints return 403', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'manager');
    for (const c of MANAGER_FORBIDDEN) {
      const status = await callForbidden(request, 'manager', c);
      expect(status, `manager should be forbidden from ${c.method} ${c.path}`).toBe(403);
    }
  });

  test('manager: guest create + edit + delete via UI, API-verified', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'manager');
    await guestCrud(page, request, 'manager', true);
  });
});

test.describe('front_desk role flows', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (d) => d.accept());
  });

  test('front_desk: allowed endpoints return 200', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');
    expect((await apiGet(request, '/users', 'front_desk')).status).toBe(200);
    expect((await apiGet(request, '/guests', 'front_desk')).status).toBe(200);
    expect((await apiGet(request, '/properties', 'front_desk')).status).toBe(200);
  });

  test('front_desk: manager/admin-only endpoints return 403', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');
    for (const c of FRONT_DESK_FORBIDDEN) {
      const status = await callForbidden(request, 'front_desk', c);
      expect(status, `front_desk should be forbidden from ${c.method} ${c.path}`).toBe(403);
    }
  });

  test('front_desk: guest create + edit via UI, API-verified (cleanup via admin)', async ({ page, request, browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'front_desk');
    const guestId = await guestCrud(page, request, 'front_desk', false);
    await withAdminCtx(browser, async (req) => {
      await apiDelete(req, `/guests/${guestId}`, 'admin');
    });
  });
});
