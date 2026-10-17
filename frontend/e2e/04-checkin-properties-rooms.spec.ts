import { test, expect } from '@playwright/test';
import {
  gotoNav,
  waitForHydration,
  field,
  uniqueSuffix,
  waitForApiList,
  waitForApiListGone,
  seedBaselineUI,
  cleanupBaseline,
  type Baseline,
} from './helpers';

/**
 * Seg 4 — Check-In/Out + Properties CRUD + Rooms edit/delete, project admin only.
 * Properties create→edit→delete, Rooms edit→delete, and the full UI
 * check-in/out flow (pending→confirmed→checked-in→checked-out), all
 * verified via API reads. Seeding is UI-only (per constraints).
 */
test.describe.configure({ mode: 'serial' });

const SUFFIX = uniqueSuffix();
const PROP_A = `S4 Prop A ${SUFFIX}`;
const PROP_B = `S4 Prop B ${SUFFIX}`;
const ROOM_EDIT = `S4-${SUFFIX.toUpperCase().slice(-5)}`;

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
  // Rooms delete + property delete use native confirm dialogs
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await waitForHydration(page);
});

test('properties: create → edit rename → delete (UI, API-verified)', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await gotoNav(page, 'Properties');

  // ── create ──
  await page.getByRole('button', { name: 'Add Property', exact: true }).first().click();
  let modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();
  await field(modal, /^Property Name/).fill(PROP_A);
  await field(modal, /^Address/).fill('2 S4 Road, Durban');
  await modal.getByRole('button', { name: 'Create Property', exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  const created = await waitForApiList(
    request,
    `/properties?search=${encodeURIComponent(PROP_A)}`,
    'admin',
    (rows) => rows.some((r) => r.name === PROP_A),
  );
  const propId = Number(created.find((r) => r.name === PROP_A)!.id);

  // ── edit (rename via card Edit button) ──
  const card = page
    .locator('div.rounded-xl')
    .filter({ has: page.getByRole('heading', { name: PROP_A, exact: true }) })
    .first();
  await card.getByTitle('Edit Property').click();
  modal = page.locator('div.fixed.inset-0').last();
  await expect(modal.getByRole('heading', { name: 'Edit Property', exact: true })).toBeVisible();
  await field(modal, /^Property Name/).fill(PROP_B);
  await modal.getByRole('button', { name: 'Update Property', exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  const edited = await waitForApiList(
    request,
    `/properties?search=${encodeURIComponent(PROP_B)}`,
    'admin',
    (rows) => rows.some((r) => Number(r.id) === propId && r.name === PROP_B),
  );
  expect(edited.find((r) => Number(r.id) === propId)!.name).toBe(PROP_B);

  // ── delete (edit modal → Delete Property → confirm modal Delete) ──
  const card2 = page
    .locator('div.rounded-xl')
    .filter({ has: page.getByRole('heading', { name: PROP_B, exact: true }) })
    .first();
  await card2.getByTitle('Edit Property').click();
  modal = page.locator('div.fixed.inset-0').last();
  await modal.getByRole('button', { name: 'Delete Property', exact: true }).click();
  const confirm = page.locator('div.fixed.inset-0').last();
  await expect(confirm.getByRole('heading', { name: /Delete Property/ })).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click();

  await waitForApiListGone(
    request,
    `/properties?search=${encodeURIComponent(PROP_B)}`,
    'admin',
    (rows) => rows.some((r) => Number(r.id) === propId),
  );
});

test('rooms: edit (price/status) → delete (UI, API-verified)', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await gotoNav(page, 'Rooms');

  // Rooms defaults to grid view; the table + row edit/delete actions live in list view.
  await page.locator('button:has(svg.lucide-list)').first().click();
  await expect(page.getByRole('table')).toBeVisible();

  // ── create a throwaway room ──
  await page.getByRole('button', { name: 'Add Room', exact: true }).first().click();
  let modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();
  await field(modal, /^Property/).selectOption({ label: b.propertyName });
  await field(modal, /^Room Number/).fill(ROOM_EDIT);
  await field(modal, /^Price/).fill('1200');
  await modal.getByRole('button', { name: 'Add Room', exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  let rooms = await waitForApiList(
    request,
    `/rooms/property/${b.propertyId}`,
    'admin',
    (rows) => rows.some((r) => r.number === ROOM_EDIT),
  );
  const roomId = Number(rooms.find((r) => r.number === ROOM_EDIT)!.id);

  // ── edit via row Edit button (buttons: eye, edit, trash) ──
  const row = page.getByRole('row').filter({ hasText: ROOM_EDIT }).first();
  await row.getByRole('button').nth(1).click();
  modal = page.locator('div.fixed.inset-0').last();
  await expect(modal.getByRole('heading', { name: 'Edit Room', exact: true })).toBeVisible();
  await field(modal, /^Status/).selectOption('maintenance');
  await field(modal, /^Price/).fill('9999');
  await modal.getByRole('button', { name: 'Update Room', exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  rooms = await waitForApiList(
    request,
    `/rooms/property/${b.propertyId}`,
    'admin',
    (rows) => rows.some((r) => Number(r.id) === roomId && Number(r.price) === 9999 && r.status === 'maintenance'),
  );
  const edited = rooms.find((r) => Number(r.id) === roomId)!;
  expect(Number(edited.price)).toBe(9999);
  expect(edited.status).toBe('maintenance');

  // ── delete via row Trash button (native confirm auto-accepted) ──
  const row2 = page.getByRole('row').filter({ hasText: ROOM_EDIT }).first();
  await row2.getByRole('button').nth(2).click();
  await waitForApiListGone(
    request,
    `/rooms/property/${b.propertyId}`,
    'admin',
    (rows) => rows.some((r) => Number(r.id) === roomId),
  );
});

test('check-in/out: full UI flow pending→confirmed→checked-in→checked-out', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  // ── 1) create a same-day booking via UI ──
  await gotoNav(page, 'Bookings');
  await page.getByRole('button', { name: 'New Booking', exact: true }).first().click();
  let modal = page.locator('div.fixed.inset-0').last();
  await expect(modal.getByRole('heading', { name: 'New Booking', exact: true })).toBeVisible();
  await field(modal, /^Guest/).selectOption({ value: String(b.guestId) });
  await field(modal, /^Property/).selectOption({ value: String(b.propertyId) });
  await field(modal, /^Check-in Date/).fill(today);
  await field(modal, /^Check-out Date/).fill(tomorrow);
  const roomSelect = field(modal, /^Room\b/);
  await expect(roomSelect).toBeEnabled({ timeout: 10_000 });
  await roomSelect.selectOption({ value: String(b.roomIds[0]) });
  await modal.getByRole('button', { name: 'Create Booking', exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  const created = await waitForApiList(
    request,
    `/bookings?propertyId=${b.propertyId}`,
    'admin',
    (rows) => rows.some((r) => Number(r.roomId) === b.roomIds[0] && String(r.checkIn ?? '').startsWith(today)),
  );
  const bookingId = Number(
    created.find((r) => Number(r.roomId) === b.roomIds[0] && String(r.checkIn ?? '').startsWith(today))!.id,
  );

  // ── 2) confirm via UI (grid/table row Confirm button) ──
  await page.getByPlaceholder(/search by/i).first().fill(b.guestName);
  await page.locator('button[title="Confirm"]').first().click();
  await waitForApiList(
    request,
    `/bookings?propertyId=${b.propertyId}`,
    'admin',
    (rows) => rows.some((r) => Number(r.id) === bookingId && r.status === 'confirmed'),
  );

  // ── 3) check in via UI (arrivals) ──
  await gotoNav(page, 'Check-In/Out');
  const inCard = page.locator('div.rounded-xl.overflow-hidden').filter({ hasText: b.guestName }).first();
  await expect(inCard).toBeVisible({ timeout: 15_000 });
  await inCard.getByRole('button', { name: 'Check In', exact: true }).click();
  modal = page.locator('div.fixed.inset-0').last();
  await expect(modal.getByRole('heading', { name: 'Verify & Check In', exact: true })).toBeVisible();
  await modal.getByRole('button', { name: /ID Verification/ }).click();
  await modal.getByRole('button', { name: /Record Payment/ }).click();
  await modal.getByRole('button', { name: /RFID Key Card/ }).click();
  const complete = modal.getByRole('button', { name: 'Complete Check-In', exact: true });
  await expect(complete).toBeEnabled({ timeout: 10_000 });
  await complete.click();

  await waitForApiList(
    request,
    `/bookings?propertyId=${b.propertyId}`,
    'admin',
    (rows) => rows.some((r) => Number(r.id) === bookingId && r.status === 'checked-in'),
  );

  // ── 4) check out via UI (In-House card → detail modal → Check Out) ──
  await page.getByRole('button', { name: /^In-House/ }).click();
  const houseCard = page.locator('div.rounded-xl.overflow-hidden').filter({ hasText: b.guestName }).first();
  await expect(houseCard).toBeVisible({ timeout: 15_000 });
  await houseCard.getByRole('button', { name: 'View Details', exact: true }).first().click();
  const detail = page.locator('div.fixed.inset-0').last();
  await detail.getByRole('button', { name: 'Check Out', exact: true }).click();
  const confirm = page.locator('div.fixed.inset-0').last();
  await confirm.getByRole('button', { name: 'Confirm Check-Out', exact: true }).click();

  await waitForApiList(
    request,
    `/bookings?propertyId=${b.propertyId}`,
    'admin',
    (rows) => rows.some((r) => Number(r.id) === bookingId && r.status === 'checked-out'),
  );
});
