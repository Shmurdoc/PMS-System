import { test, expect } from '@playwright/test';
import {
  gotoNav,
  waitForHydration,
  apiGet,
  apiDelete,
  unwrap,
  uniqueSuffix,
  field,
  waitForApiList,
  seedBaselineUI,
  cleanupBaseline,
  type Baseline,
} from './helpers';

/**
 * Seg 4 — admin CRUD part 2.
 * Inventory, Expenses, Tax configs, Users, Tickets + G1 gap assertion.
 */
test.describe.configure({ mode: 'serial' });

const SUFFIX = uniqueSuffix();
const INV_NAME = `E2E Widget ${SUFFIX}`;
const EXP_DESC = `E2E expense ${SUFFIX}`;
const TAX_NAME = `E2E Tax ${SUFFIX}`;
const USER_EMAIL = `e2e.user.${SUFFIX}@nexus.com`;
const TICKET_TITLE = `E2E ticket ${SUFFIX}`;

let b: Baseline;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: '.auth/admin.json' });
  try {
    b = await seedBaselineUI(await context.newPage());
  } finally {
    await context.close();
  }
});

test.afterAll(async ({ request }) => {
  if (b) await cleanupBaseline(request, b, 'admin');
});

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept());
});

test('inventory: create via UI → API verify → API delete', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Inventory & POS');

  await page.getByRole('button', { name: 'Add Item', exact: true }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Add New Item' })).toBeVisible();

  await field(modal, /^Name/).fill(INV_NAME);
  await field(modal, /^Category/).selectOption({ label: 'Linens' }).catch(() => undefined);
  await field(modal, /^Quantity/).fill('5');
  await field(modal, /^Unit/).fill('pieces');
  await field(modal, /^Reorder Level/).fill('2');
  await field(modal, /^Price/).fill('25.50');
  await field(modal, /^Supplier/).fill('E2E Supplier');
  await field(modal, /^SKU/).fill(`E2E-${SUFFIX}`.slice(0, 20));
  await field(modal, /^Location/).fill('QA shelf');
  await field(modal, /^Notes/).fill('Created by Playwright');
  await modal.getByRole('button', { name: 'Add Item', exact: true }).click();

  const items = await waitForApiList(request, `/inventoryItems?search=${encodeURIComponent(INV_NAME)}`, 'admin',
    (rows) => rows.some((r) => r.name === INV_NAME));
  const created = items.find((r) => r.name === INV_NAME)!;
  expect(Number(created.quantity)).toBe(5);
  expect(Number(created.price)).toBe(25.5);
  expect(created.supplier).toBe('E2E Supplier');

  // cleanup via API
  await apiDelete(request, `/inventoryItems/${created.id}`, 'admin');
  await waitForApiList(request, `/inventoryItems?search=${encodeURIComponent(INV_NAME)}`, 'admin',
    (rows) => !rows.some((r) => r.name === INV_NAME)).catch(() => undefined);
});

test('expenses: create via UI → API verify → API delete', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Finances');

  await page.getByRole('button', { name: /^Add Expense$/ }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Add New Expense' })).toBeVisible();

  await field(modal, /^Category/).selectOption({ label: 'Supplies' }).catch(() => undefined);
  await field(modal, /^Amount/).fill('150.75');
  await field(modal, /^Description/).fill(EXP_DESC);
  // Date prefilled (today) — leave
  await field(modal, /^Submitted By/).fill('E2E Tester');
  await field(modal, /^Property/).selectOption({ value: String(b.propertyId) });
  await modal.getByRole('button', { name: 'Save Expense', exact: true }).click();

  const items = await waitForApiList(request, `/expenses?propertyId=${b.propertyId}`, 'admin',
    (rows) => rows.some((r) => r.description === EXP_DESC));
  const created = items.find((r) => r.description === EXP_DESC)!;
  expect(Number(created.amount)).toBe(150.75);
  expect(created.status).toBe('pending');

  await apiDelete(request, `/expenses/${created.id}`, 'admin');
});

test('tax configs: create via UI → API verify → API delete', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Finances');

  await page.getByRole('button', { name: 'Tax Config', exact: true }).click();
  await page.getByRole('button', { name: /^Add Tax$/ }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Add Tax Config' })).toBeVisible();

  await field(modal, /^Tax Name/).fill(TAX_NAME);
  await field(modal, /^Rate/).fill('15');
  await field(modal, /^Type/).selectOption({ label: 'VAT' }).catch(() => undefined);
  await modal.getByRole('button', { name: 'Save', exact: true }).click();

  // tax form has no property select; store falls back to properties[0] — search globally by name
  const items = await waitForApiList(request, `/taxConfigs`, 'admin',
    (rows) => rows.some((r) => r.name === TAX_NAME));
  const created = items.find((r) => r.name === TAX_NAME)!;
  // Raw API stores tax as a fraction by design (15% → 0.15); the UI maps back to a percent on read.
  expect(Number(created.rate)).toBeCloseTo(0.15, 6);

  await apiDelete(request, `/taxConfigs/${created.id}`, 'admin');
});

test('users: create via UI → API verify → API delete', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Admin');

  await page.getByRole('button', { name: 'Add User', exact: true }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Add New User' })).toBeVisible();

  await field(modal, /^Full Name/).fill('E2E Staff');
  await field(modal, /^Email/).fill(USER_EMAIL);
  await field(modal, /^Phone/).fill('+27 82 555 6666');
  await field(modal, /^Role/).selectOption('housekeeping');
  await field(modal, /^Department/).selectOption({ label: 'Housekeeping' }).catch(() => undefined);
  await modal.getByRole('button', { name: 'Create User', exact: true }).click();

  const items = await waitForApiList(request, `/users?search=${encodeURIComponent(USER_EMAIL)}`, 'admin',
    (rows) => rows.some((r) => r.email === USER_EMAIL));
  const created = items.find((r) => r.email === USER_EMAIL)!;
  expect(created.name).toBe('E2E Staff');
  expect(created.role).toBe('housekeeping');

  await apiDelete(request, `/users/${created.id}`, 'admin');
});

test('tickets: create via UI → API verify → API delete', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Tickets');

  await page.getByRole('button', { name: 'Create Ticket', exact: true }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Create New Ticket' })).toBeVisible();

  await field(modal, /^Title/).fill(TICKET_TITLE);
  await field(modal, /^Description/).fill('Playwright smoke ticket — HVAC noise in room.');
  await field(modal, /^Property/).selectOption({ value: String(b.propertyId) });
  // leave Room N/A, Assignee Unassigned
  await modal.getByRole('button', { name: 'Create Ticket', exact: true }).click();

  const items = await waitForApiList(request, `/tickets?propertyId=${b.propertyId}`, 'admin',
    (rows) => rows.some((r) => r.title === TICKET_TITLE));
  const created = items.find((r) => r.title === TICKET_TITLE)!;
  expect(created.status).toBe('open');

  await apiDelete(request, `/tickets/${created.id}`, 'admin');
});

test('G1 gap: RateManagement is mock-only (UI shows plans, API has none)', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Rates');

  // UI shows mock plans (6 default)
  await expect(page.getByText(/rate plan/i).first()).toBeVisible();
  // API rate plans for our property (and globally) — expect empty because UI never syncs
  const apiRes = await apiGet(request, `/ratePlans?propertyId=${b.propertyId}`, 'admin');
  expect(apiRes.status).toBe(200);
  const apiPlans = unwrap(apiRes.body) as unknown[];
  expect(apiPlans.length, 'G1: RateManagement writes never reach the API').toBe(0);
});
