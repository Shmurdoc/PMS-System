import { type Page, type Locator, type APIRequestContext, expect } from '@playwright/test';

export type Role = 'admin' | 'manager' | 'front_desk';

export const CREDENTIALS: Record<Role, { email: string; password: string }> = {
  admin: { email: 'admin@nexus.com', password: 'admin123' },
  manager: { email: 'manager@nexus.com', password: 'manager123' },
  front_desk: { email: 'front@nexus.com', password: 'front123' },
};

/** Sidebar nav labels visible per role (from recon of App.tsx nav filter). */
export const NAV_PER_ROLE: Record<Role, string[]> = {
  admin: [
    'Dashboard', 'Bookings', 'Guests', 'Check-In/Out', 'Rooms', 'Rates',
    'Properties', 'Facility', 'Inventory & POS',
    'Finances', 'Analytics', 'Reports', 'Forecasting',
    'Staff & RFID', 'Employee Profiles', 'Staff Schedule', 'RFID System',
    'Tickets', 'Messaging', 'AI Enhancements',
    'Admin', 'Integrations', 'Settings',
  ],
  manager: [
    'Dashboard', 'Bookings', 'Guests', 'Check-In/Out', 'Rooms', 'Rates',
    'Properties', 'Facility', 'Inventory & POS',
    'Finances', 'Analytics', 'Reports', 'Forecasting',
    'Staff & RFID', 'Employee Profiles', 'Staff Schedule', 'RFID System',
    'Tickets', 'Messaging', 'AI Enhancements',
    'Integrations',
  ],
  front_desk: [
    'Dashboard', 'Bookings', 'Guests', 'Check-In/Out', 'Rooms', 'Rates',
    'Properties', 'Facility',
    'Staff & RFID', 'Staff Schedule', 'RFID System',
    'Tickets', 'Messaging',
  ],
};

/** Labels that must NOT be visible for a role (negative nav assertions). */
export const NAV_FORBIDDEN: Record<Role, string[]> = {
  admin: [],
  manager: ['Admin', 'Settings'],
  front_desk: [
    'Inventory & POS', 'Finances', 'Analytics', 'Reports', 'Forecasting',
    'Employee Profiles', 'AI Enhancements', 'Integrations', 'Admin', 'Settings',
  ],
};

/** activePage id → sidebar label (navigation happens by aria-label click). */
export const PAGE_TO_NAV: Record<string, string> = {
  dashboard: 'Dashboard',
  bookings: 'Bookings',
  guests: 'Guests',
  checkin: 'Check-In/Out',
  rooms: 'Rooms',
  rates: 'Rates',
  properties: 'Properties',
  facility: 'Facility',
  inventory: 'Inventory & POS',
  finances: 'Finances',
  analytics: 'Analytics',
  reports: 'Reports',
  forecast: 'Forecasting',
  staff: 'Staff & RFID',
  'rfid-management': 'RFID System',
  'employee-profiles': 'Employee Profiles',
  'staff-schedule': 'Staff Schedule',
  tickets: 'Tickets',
  messaging: 'Messaging',
  'ai-enhancements': 'AI Enhancements',
  admin: 'Admin',
  integrations: 'Integrations',
  settings: 'Settings',
};

/** Navigate via sidebar click. App is state-based (no URL routing). Scoped to the nav landmark to avoid strict-mode collisions with in-page tabs (e.g. AdminPanel "Integrations"). */
export async function gotoNav(page: Page, label: string): Promise<void> {
  const scope = page.getByRole('navigation', { name: /main navigation/i });
  const navBtn = scope.getByRole('button', { name: label, exact: true });
  await expect(navBtn).toBeVisible({ timeout: 15_000 });
  await navBtn.click();
  // Active item gets aria-current="page"
  await expect(scope.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'page', { timeout: 10_000 });
}

/** Wait for post-login hydration network chatter to settle. */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
}

/** Collect console errors + page exceptions for a navigation segment. */
export function trackErrors(page: Page): { consoleErrors: string[]; pageErrors: string[] } {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Vite/HMR noise is irrelevant to app health
      if (!text.includes('[vite]') && !text.includes('Download the React DevTools')) {
        consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  return { consoleErrors, pageErrors };
}

/** Direct API GET returning parsed JSON body (envelope `{success,data,...}`). */
export async function apiGet(
  request: APIRequestContext,
  path: string,
  role: Role,
): Promise<{ status: number; body: unknown }> {
  const token = await getToken(request);
  const res = await request.get(`http://localhost:5080/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}

export async function apiPost(
  request: APIRequestContext,
  path: string,
  role: Role,
  data: unknown,
): Promise<{ status: number; body: unknown }> {
  const token = await getToken(request);
  const res = await request.post(`http://localhost:5080/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}

export async function apiPut(
  request: APIRequestContext,
  path: string,
  role: Role,
  data: unknown,
): Promise<{ status: number; body: unknown }> {
  const token = await getToken(request);
  const res = await request.put(`http://localhost:5080/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}

export async function apiDelete(
  request: APIRequestContext,
  path: string,
  role: Role,
): Promise<{ status: number }> {
  const token = await getToken(request);
  const res = await request.delete(`http://localhost:5080/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status() };
}

async function getToken(request: APIRequestContext): Promise<string> {
  const state = await request.storageState();
  const found = state.origins
    .flatMap((o) => o.localStorage)
    .find((item) => item.name === 'aquri_token');
  return found?.value ?? '';
}

export async function apiPatch(
  request: APIRequestContext,
  path: string,
  role: Role,
  data: unknown,
): Promise<{ status: number; body: unknown }> {
  const token = await getToken(request);
  const res = await request.patch(`http://localhost:5080/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify(data),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}

/** POST that returns raw text — some failures (booking overlap) are plain-body 400s, not envelopes. */
export async function apiPostText(
  request: APIRequestContext,
  path: string,
  role: Role,
  data: unknown,
): Promise<{ status: number; text: string }> {
  const token = await getToken(request);
  const res = await request.post(`http://localhost:5080/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  return { status: res.status(), text: await res.text() };
}

/** Extract `data` from the backend envelope, tolerant of shape. */
export function unwrap(body: unknown): unknown {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: unknown }).data;
  }
  return body;
}

/** Unique suffix so re-runs don't collide with leftovers. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Sibling-control locator: page forms pair `<label>Text</label>` with the
 * input/select/textarea that follows — no htmlFor/id. Anchor with a regex
 * (e.g. /^Room Number/ so "Room Type" doesn't match).
 */
export function field(scope: Page | Locator, labelText: RegExp | string) {
  return scope
    .locator('label')
    .filter({ hasText: labelText })
    .first()
    .locator('xpath=following-sibling::*[self::input or self::select or self::textarea][1]');
}

export type Row = Record<string, unknown>;

function rows(body: unknown): Row[] {
  const data = unwrap(body);
  return Array.isArray(data) ? (data as Row[]) : [];
}

/** Poll a list endpoint until `predicate` matches or timeout — fire-and-forget sync needs retries. */
export async function waitForApiList(
  request: APIRequestContext,
  path: string,
  role: Role,
  predicate: (items: Row[]) => boolean,
  timeoutMs = 15_000,
): Promise<Row[]> {
  const deadline = Date.now() + timeoutMs;
  let last: Row[] = [];
  while (Date.now() < deadline) {
    const { status, body } = await apiGet(request, path, role);
    if (status === 200) {
      last = rows(body);
      if (predicate(last)) return last;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`waitForApiList timed out after ${timeoutMs}ms for ${path}. Last rows: ${JSON.stringify(last).slice(0, 500)}`);
}

/** Poll a list endpoint until `predicate` stops matching (e.g. entity deleted). */
export async function waitForApiListGone(
  request: APIRequestContext,
  path: string,
  role: Role,
  predicate: (items: Row[]) => boolean,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { status, body } = await apiGet(request, path, role);
    if (status === 200 && !predicate(rows(body))) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`waitForApiListGone timed out after ${timeoutMs}ms for ${path}`);
}

export interface Baseline {
  propertyId: number;
  tenantPropertyId: number;
  propertyName: string;
  roomIds: number[];
  roomNumbers: string[];
  guestId: number;
  guestName: string;
  guestEmail: string;
}

async function pageToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    try {
      return localStorage.getItem('aquri_token') ?? '';
    } catch {
      return '';
    }
  });
}

/** Read a list endpoint using the token held in the page's localStorage. */
async function pageApiRows(page: Page, path: string): Promise<Row[]> {
  const token = await pageToken(page);
  const res = await page.request.get(`http://localhost:5080/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status() !== 200) return [];
  const body = await res.json().catch(() => null);
  return rows(body);
}

/** Poll a list endpoint (via the page token) until `predicate` matches. */
async function pageApiWait(
  page: Page,
  path: string,
  predicate: (items: Row[]) => boolean,
  timeoutMs = 15_000,
): Promise<Row[]> {
  const deadline = Date.now() + timeoutMs;
  let last: Row[] = [];
  while (Date.now() < deadline) {
    last = await pageApiRows(page, path);
    if (predicate(last)) return last;
    await page.waitForTimeout(500);
  }
  throw new Error(`seedBaselineUI timed out for ${path}. Last rows: ${JSON.stringify(last).slice(0, 500)}`);
}

/**
 * Seed the operational tables by driving the real frontend forms (NOT the API):
 * Properties → Add Property, Rooms → Add Room (x3), Guests → Add Guest.
 * Entity creation is UI-only; EF ids are then resolved with verification reads.
 * Per constraints: seed via UI, verify via API, teardown via API (cleanupBaseline).
 */
export async function seedBaselineUI(page: Page): Promise<Baseline> {
  const suffix = uniqueSuffix();
  const propertyName = `QA Hotel ${suffix}`;
  const guestName = `QA Guest ${suffix}`;
  const guestEmail = `qa.guest.${suffix}@example.com`;
  const tag = suffix.slice(-4).toUpperCase();
  const roomNumbers = [`${tag}-1`, `${tag}-2`, `${tag}-3`];

  await page.goto('/');
  await waitForHydration(page);

  // 1) Property — UI form creates the row; no initial rooms (rooms are separate).
  await gotoNav(page, 'Properties');
  await page.getByRole('button', { name: 'Add Property', exact: true }).first().click();
  let modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();
  await field(modal, /^Property Name/).fill(propertyName);
  await field(modal, /^Address/).fill('1 QA Street, Cape Town');
  await modal.getByRole('button', { name: 'Create Property', exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  const propRows = await pageApiWait(
    page,
    `/properties?search=${encodeURIComponent(propertyName)}`,
    (items) => items.some((r) => r.name === propertyName),
  );
  const prop = propRows.find((r) => r.name === propertyName)!;
  const propertyId = Number(prop.id);
  const tenantPropertyId = Number(prop.propertyId ?? prop.id);

  // 2) Rooms — created through the Rooms modal (EF-PK lookup path the UI uses).
  await gotoNav(page, 'Rooms');
  const roomIds: number[] = [];
  for (const number of roomNumbers) {
    await page.getByRole('button', { name: 'Add Room', exact: true }).first().click();
    modal = page.locator('div.fixed.inset-0').last();
    await expect(modal).toBeVisible();
    await field(modal, /^Property/).selectOption({ label: propertyName });
    await field(modal, /^Room Number/).fill(number);
    await modal.getByRole('button', { name: 'Add Room', exact: true }).click();
    await expect(modal).toBeHidden({ timeout: 15_000 });

    const rows = await pageApiWait(
      page,
      `/rooms/property/${propertyId}`,
      (items) => items.some((r) => r.number === number),
    );
    roomIds.push(Number(rows.find((r) => r.number === number)!.id));
  }

  // 3) Guest — created through the Guests modal.
  await gotoNav(page, 'Guests');
  await page.getByRole('button', { name: 'Add Guest', exact: true }).first().click();
  modal = page.locator('div.fixed.inset-0').last();
  await expect(modal).toBeVisible();
  await field(modal, /^Full Name/).fill(guestName);
  await field(modal, /^Email/).fill(guestEmail);
  await field(modal, /^Phone/).fill('+27 82 000 0001');
  await field(modal, /^ID Number/).fill(`QA${suffix}`.slice(0, 13));
  await field(modal, /^Nationality/).fill('South Africa');
  await modal.getByRole('button', { name: 'Add Guest', exact: true }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  const guestRows = await pageApiWait(
    page,
    `/guests?search=${encodeURIComponent(guestEmail)}`,
    (items) => items.some((r) => r.email === guestEmail),
  );
  const guest = guestRows.find((r) => r.email === guestEmail)!;

  return {
    propertyId,
    tenantPropertyId,
    propertyName,
    roomIds,
    roomNumbers,
    guestId: Number(guest.id),
    guestName: String(guest.name),
    guestEmail: String(guest.email),
  };
}

/** Delete bookings → rooms → guest → messages → property, ignoring failures. Call in afterAll. */
export async function cleanupBaseline(request: APIRequestContext, b: Baseline, role: Role = 'admin'): Promise<void> {
  const { body: bookingsBody } = await apiGet(request, `/bookings?propertyId=${b.propertyId}`, role);
  for (const booking of rows(bookingsBody)) {
    await apiDelete(request, `/bookings/${booking.id}`, role);
  }
  for (const roomId of b.roomIds) {
    await apiDelete(request, `/rooms/${roomId}`, role);
  }
  await apiDelete(request, `/guests/${b.guestId}`, role);
  // Messages FK to Properties blocks delete; no DELETE endpoint — clear via cascade is absent,
  // so we just attempt and ignore failure (seed uses unique tenant ids anyway).
  await apiDelete(request, `/properties/${b.propertyId}`, role);
}
