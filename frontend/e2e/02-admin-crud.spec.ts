import { test, expect } from '@playwright/test';
import {
  gotoNav,
  waitForHydration,
  apiGet,
  apiPostText,
  apiPatch,
  unwrap,
  uniqueSuffix,
  field,
  waitForApiList,
  waitForApiListGone,
  seedBaselineUI,
  cleanupBaseline,
  type Baseline,
  type Row,
} from './helpers';

/**
 * Seg 4 — admin CRUD, project admin only.
 * Guests / Rooms / Bookings with API-verified invariants
 * (create, edit, delete, status lifecycle, double-booking overlap).
 */
test.describe.configure({ mode: 'serial' });

const SUFFIX = uniqueSuffix();
const NEW_GUEST_NAME = `E2E Guest ${SUFFIX}`;
const NEW_GUEST_EMAIL = `e2e.guest.${SUFFIX}@example.com`;
const NEW_GUEST_PHONE = '+27 82 111 2222';
const EDITED_PHONE = '+27 82 333 4444';
const NEW_ROOM_NUMBER = `E2E-${SUFFIX.toUpperCase().slice(-6)}`;

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
  // Guests delete uses native window.confirm
  page.on('dialog', (d) => d.accept());
});

test('guests: create via UI → API verify', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Guests');

  await page.getByRole('button', { name: 'Add Guest', exact: true }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();

  await field(modal, /^Full Name/).fill(NEW_GUEST_NAME);
  await field(modal, /^Email/).fill(NEW_GUEST_EMAIL);
  await field(modal, /^Phone/).fill(NEW_GUEST_PHONE);
  await field(modal, /^ID Number/).fill(`E2E${SUFFIX}`.slice(0, 13));
  await field(modal, /^Nationality/).fill('South Africa');
  await modal.getByRole('button', { name: 'Add Guest', exact: true }).click();

  const items = await waitForApiList(request, `/guests?search=${encodeURIComponent(NEW_GUEST_EMAIL)}`, 'admin',
    (rows) => rows.some((g) => g.email === NEW_GUEST_EMAIL));
  const created = items.find((g) => g.email === NEW_GUEST_EMAIL)!;
  expect(created.name).toBe(NEW_GUEST_NAME);
});

test('guests: edit via UI → API verify', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Guests');

  await page.getByPlaceholder(/search/i).first().fill(NEW_GUEST_EMAIL);
  const card = page.locator('div.group').filter({ hasText: NEW_GUEST_EMAIL });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  const modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();

  await field(modal, /^Phone/).fill(EDITED_PHONE);
  await modal.getByRole('button', { name: 'Update Guest', exact: true }).click();

  await waitForApiList(request, `/guests?search=${encodeURIComponent(NEW_GUEST_EMAIL)}`, 'admin',
    (rows) => rows.some((g) => g.email === NEW_GUEST_EMAIL && g.phone === EDITED_PHONE));
});

test('guests: delete via UI (confirm dialog) → API gone', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Guests');

  await page.getByPlaceholder(/search/i).first().fill(NEW_GUEST_EMAIL);
  const card = page.locator('div.group').filter({ hasText: NEW_GUEST_EMAIL });
  await expect(card).toBeVisible();
  await card.locator('button:has(svg.lucide-trash-2)').click();
  // dialog auto-accepted in beforeEach

  await waitForApiListGone(request, `/guests?search=${encodeURIComponent(NEW_GUEST_EMAIL)}`, 'admin',
    (rows) => rows.some((g) => g.email === NEW_GUEST_EMAIL));
});

test('rooms: create via UI → API verify', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Rooms');

  await page.getByRole('button', { name: 'Add Room', exact: true }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();

  await field(modal, /^Property/).selectOption({ label: b.propertyName });
  await field(modal, /^Room Number/).fill(NEW_ROOM_NUMBER);
  await field(modal, /^Room Type/).selectOption({ label: 'Standard' }).catch(async () => {
    await field(modal, /^Room Type/).fill('Standard');
  });
  await field(modal, /^Status/).selectOption({ label: 'Available' }).catch(() => undefined);
  await field(modal, /^Price/).fill('1500');
  await modal.getByRole('button', { name: 'Add Room', exact: true }).click();

  const rooms = await waitForApiList(request, `/rooms/property/${b.tenantPropertyId}`, 'admin',
    (rows) => rows.some((r) => r.number === NEW_ROOM_NUMBER));
  const created = rooms.find((r) => r.number === NEW_ROOM_NUMBER)!;
  b.roomIds.push(Number(created.id));
  b.roomNumbers.push(NEW_ROOM_NUMBER);
  expect(Number(created.propertyId)).toBe(b.tenantPropertyId);
});

test('bookings: create via UI → API verify', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  await page.goto('/');
  await waitForHydration(page);
  await gotoNav(page, 'Bookings');

  await page.getByRole('button', { name: 'New Booking', exact: true }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'New Booking' })).toBeVisible();

  await field(modal, /^Guest/).selectOption({ value: String(b.guestId) });
  await field(modal, /^Property/).selectOption({ value: String(b.tenantPropertyId) });

  const checkIn = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const checkOut = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  await field(modal, /^Check-in Date/).fill(checkIn);
  await field(modal, /^Check-out Date/).fill(checkOut);

  const roomSelect = field(modal, /^Room\b/);
  await expect(roomSelect).toBeEnabled({ timeout: 10_000 });
  await roomSelect.selectOption({ value: String(b.roomIds[0]) });
  await field(modal, /^Adults/).fill('2');

  await modal.getByRole('button', { name: 'Create Booking', exact: true }).click();

  const bookings = await waitForApiList(request, `/bookings?propertyId=${b.tenantPropertyId}`, 'admin',
    (rows) => rows.some((r) => Number(r.roomId) === b.roomIds[0] && String(r.checkIn ?? '').startsWith(checkIn)));
  const created = bookings.find(
    (r) => Number(r.roomId) === b.roomIds[0] && String(r.checkIn ?? '').startsWith(checkIn))!;
  expect(Number(created.guestId)).toBe(b.guestId);
});

test('bookings: double-booking overlap rejected (invariant)', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  const checkIn = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const checkOut = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  const { status, text } = await apiPostText(request, '/bookings', 'admin', {
    propertyId: b.tenantPropertyId,
    guestId: b.guestId,
    roomId: b.roomIds[0],
    checkIn,
    checkOut,
    guests: 1,
    ratePerNight: 1200,
    source: 'Direct',
  });
  expect(status).toBeGreaterThanOrEqual(400);
  expect(status).toBeLessThan(500);
  expect(text).toContain('Room is not available for the selected dates.');
});

test('bookings: lifecycle pending → confirmed → checked-in → checked-out (API)', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  const checkIn = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const bookings = await waitForApiList(request, `/bookings?propertyId=${b.tenantPropertyId}`, 'admin',
    (rows) => rows.some((r) => Number(r.roomId) === b.roomIds[0] && String(r.checkIn ?? '').startsWith(checkIn)));
  const booking = bookings.find(
    (r) => Number(r.roomId) === b.roomIds[0] && String(r.checkIn ?? '').startsWith(checkIn))!;
  const id = Number(booking.id);

  for (const next of ['confirmed', 'checked-in', 'checked-out'] as const) {
    const res = await apiPatch(request, `/bookings/${id}/status`, 'admin', next);
    expect(res.status, `PATCH status=${next} → ${JSON.stringify(res.body)}`).toBe(200);
    const updated = unwrap(res.body) as { status?: string };
    expect(updated.status).toBe(next);
  }
});
