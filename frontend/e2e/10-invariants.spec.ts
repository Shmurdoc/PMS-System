import { test, expect, type APIRequestContext, type Browser } from '@playwright/test';
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiPatch,
  apiPostText,
  unwrap,
  uniqueSuffix,
  seedBaselineUI,
  cleanupBaseline,
  type Baseline,
  type Role,
} from './helpers';

/**
 * Seg 10 — cross-cutting invariants sweep (project admin seeds + RBAC probes per role).
 *
 * These are the guarantees the app must never violate, exercised at the API layer:
 *  - RBAC: every role/endpoint combination that should be forbidden returns 403,
 *    and the reads each role IS allowed return 200.
 *  - Booking: create-time validation (guest/room/date) and the status machine
 *    (illegal jumps + terminal states rejected).
 *  - Deposit: non-positive and over-total deposits rejected.
 *  - Payment: create guards (method/amount) and the one-way lifecycle
 *    (pending → completed → refunded, with re-entry rejected).
 *
 * Overlap + the happy booking lifecycle are covered in 02-admin-crud; this file
 * targets the negative/edge space those specs don't reach.
 */
test.describe.configure({ mode: 'serial' });

const SUFFIX = uniqueSuffix();

let b: Baseline | undefined;

async function ensureBaseline(browser: Browser): Promise<Baseline> {
  if (b) return b;
  const context = await browser.newContext({ storageState: '.auth/admin.json' });
  let seeded: Baseline;
  try {
    seeded = await seedBaselineUI(await context.newPage());
  } finally {
    await context.close();
  }
  b = seeded;
  return seeded;
}

test.afterAll(async ({ request }) => {
  if (b) await cleanupBaseline(request, b, 'admin');
});

/** Read the project's aquri_token straight from the request context's storage state. */
async function rawToken(request: APIRequestContext): Promise<string> {
  const state = await request.storageState();
  return (
    state.origins.flatMap((o) => o.localStorage).find((i) => i.name === 'aquri_token')?.value ?? ''
  );
}

/** POST a raw JSON body (needed for `[FromBody] string` / `[FromBody] decimal` actions). */
async function postRawJson(
  request: APIRequestContext,
  path: string,
  raw: string,
): Promise<{ status: number; body: unknown }> {
  const token = await rawToken(request);
  const base = process.env['AQURI_API_URL'] ?? 'http://localhost:5080';
  const res = await request.post(`${base}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: raw,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function probe(request: APIRequestContext, method: Method, path: string): Promise<number> {
  const role: Role = 'admin';
  if (method === 'GET') return (await apiGet(request, path, role)).status;
  if (method === 'POST') return (await apiPost(request, path, role, {})).status;
  if (method === 'PUT') return (await apiPut(request, path, role, {})).status;
  if (method === 'PATCH') return (await apiPatch(request, path, role, {})).status;
  return (await apiDelete(request, path, role)).status;
}

interface Probe {
  m: Method;
  path: string;
}

/**
 * Endpoints each role must be refused. Derived from the [Authorize(Roles=...)]
 * attributes across Aquri.API/Controllers (verified by reading the controllers).
 */
const FORBIDDEN: Record<'manager' | 'front_desk', Probe[]> = {
  manager: [
    { m: 'POST', path: '/users' },
    { m: 'PUT', path: '/users/1' },
    { m: 'DELETE', path: '/users/1' },
    { m: 'DELETE', path: '/expenses/1' },
    { m: 'DELETE', path: '/electricity/1' },
    { m: 'DELETE', path: '/properties/1' },
    { m: 'DELETE', path: '/rooms/1' },
    { m: 'DELETE', path: '/integrations/1' },
  ],
  front_desk: [
    // Users: reads are a scoped roster, writes stay admin-only
    { m: 'POST', path: '/users' },
    { m: 'PUT', path: '/users/1' },
    { m: 'DELETE', path: '/users/1' },
    // Class-level admin,manager controllers
    { m: 'GET', path: '/aiInsights' },
    { m: 'POST', path: '/aiInsights' },
    { m: 'PUT', path: '/aiInsights/1' },
    { m: 'DELETE', path: '/aiInsights/1' },
    { m: 'GET', path: '/workflows' },
    { m: 'POST', path: '/workflows' },
    { m: 'PUT', path: '/workflows/1' },
    { m: 'DELETE', path: '/workflows/1' },
    { m: 'GET', path: '/agents' },
    { m: 'POST', path: '/agents/1/run' },
    { m: 'PATCH', path: '/agents/1/status' },
    { m: 'POST', path: '/chat' },
    // Audit log writes
    { m: 'POST', path: '/auditlogs' },
    // Shifts (writes admin,manager)
    { m: 'POST', path: '/shifts' },
    { m: 'PUT', path: '/shifts/1' },
    { m: 'PUT', path: '/shifts/1/status' },
    { m: 'PUT', path: '/shifts/1/swap' },
    { m: 'DELETE', path: '/shifts/1' },
    // Tax configs
    { m: 'POST', path: '/taxconfigs' },
    { m: 'PUT', path: '/taxconfigs/1' },
    { m: 'DELETE', path: '/taxconfigs/1' },
    // RFID
    { m: 'POST', path: '/rfidtags' },
    { m: 'POST', path: '/rfidtags/1/revoke' },
    // Inventory (housekeeping/admin/manager)
    { m: 'POST', path: '/inventoryItems' },
    { m: 'PUT', path: '/inventoryItems/1' },
    { m: 'POST', path: '/inventoryItems/1/adjust' },
    { m: 'POST', path: '/inventoryItems/1/restock' },
    { m: 'DELETE', path: '/inventoryItems/1' },
    // Destructive deletes
    { m: 'DELETE', path: '/bookings/1' },
    { m: 'POST', path: '/payments/1/refund' },
    { m: 'DELETE', path: '/expenses/1' },
    { m: 'DELETE', path: '/electricity/1' },
    { m: 'DELETE', path: '/invoices/1' },
    { m: 'DELETE', path: '/messages/1' },
    { m: 'DELETE', path: '/rooms/1' },
    { m: 'DELETE', path: '/properties/1' },
    { m: 'PUT', path: '/properties/1' },
    // Room attribute writes
    { m: 'PUT', path: '/rooms/status' },
    { m: 'PUT', path: '/rooms/price' },
    // Integrations
    { m: 'POST', path: '/integrations' },
    { m: 'PUT', path: '/integrations/1' },
    { m: 'POST', path: '/integrations/1/sync' },
    { m: 'DELETE', path: '/integrations/1' },
    // Rate plans
    { m: 'POST', path: '/ratePlans' },
    { m: 'PUT', path: '/ratePlans/1' },
    { m: 'DELETE', path: '/ratePlans/1' },
  ],
};

test('RBAC: manager forbidden endpoints all → 403', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'manager');
  for (const p of FORBIDDEN.manager) {
    const status = await probe(request, p.m, p.path);
    expect(status, `${p.m} ${p.path}`).toBe(403);
  }
});

test('RBAC: manager allowed reads → 200', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'manager');
  for (const path of ['/users', '/aiInsights', '/workflows', '/agents', '/auditlogs']) {
    const { status } = await apiGet(request, path, 'manager');
    expect(status, `GET ${path}`).toBe(200);
  }
});

test('RBAC: front_desk forbidden endpoints all → 403', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'front_desk');
  for (const p of FORBIDDEN.front_desk) {
    const status = await probe(request, p.m, p.path);
    expect(status, `${p.m} ${p.path}`).toBe(403);
  }
});

test('RBAC: front_desk allowed reads → 200', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'front_desk');
  const paths = [
    '/users',
    '/guests',
    '/bookings?propertyId=1',
    '/rooms/property/1',
    '/expenses?propertyId=1',
    '/payments?propertyId=1',
    '/invoices?propertyId=1',
    '/tickets?propertyId=1',
    '/electricity?propertyId=1',
  ];
  for (const path of paths) {
    const { status } = await apiGet(request, path, 'front_desk');
    expect(status, `GET ${path}`).toBe(200);
  }
});

const iso = (days: number): string => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

function bodyOf(text: string): Record<string, unknown> {
  const parsed = JSON.parse(text) as unknown;
  return (unwrap(parsed) ?? {}) as Record<string, unknown>;
}

test('booking: create-time validation rejects bad guest / room / dates', async ({ request, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  const base = await ensureBaseline(browser);
  const checkIn = iso(20);
  const checkOut = iso(23);
  const payload = {
    propertyId: base.tenantPropertyId,
    guestId: base.guestId,
    roomId: base.roomIds[0],
    checkIn,
    checkOut,
    guests: 1,
    ratePerNight: 1000,
    source: 'Direct',
  };

  const badGuest = await apiPostText(request, '/bookings', 'admin', { ...payload, guestId: 9_999_999 });
  expect(badGuest.status).toBe(400);
  expect(badGuest.text).toContain('Guest not found.');

  const badRoom = await apiPostText(request, '/bookings', 'admin', { ...payload, roomId: 9_999_999 });
  expect(badRoom.status).toBe(400);
  expect(badRoom.text).toContain('Room not found.');

  const wrongProperty = await apiPostText(request, '/bookings', 'admin', {
    ...payload,
    propertyId: base.tenantPropertyId + 7,
  });
  expect(wrongProperty.status).toBe(400);
  expect(wrongProperty.text).toContain('Room does not belong to the specified property.');

  const badDates = await apiPostText(request, '/bookings', 'admin', { ...payload, checkOut: checkIn });
  expect(badDates.status).toBe(400);
  expect(badDates.text).toContain('Check-out must be after check-in.');
});

test('booking: status machine rejects illegal jumps and terminal-state changes', async ({ request, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  const base = await ensureBaseline(browser);

  const created = await apiPostText(request, '/bookings', 'admin', {
    propertyId: base.tenantPropertyId,
    guestId: base.guestId,
    roomId: base.roomIds[0],
    checkIn: iso(30),
    checkOut: iso(33),
    guests: 1,
    ratePerNight: 1000,
    source: 'Direct',
  });
  expect(created.status, created.text).toBe(201);
  const id = Number(bodyOf(created.text).id);
  expect(id).toBeGreaterThan(0);

  try {
    const jumps: Array<{ from: string; to: string }> = [
      { from: 'pending', to: 'checked-in' },
      { from: 'pending', to: 'checked-out' },
    ];
    for (const j of jumps) {
      const res = await apiPatch(request, `/bookings/${id}/status`, 'admin', j.to);
      expect(res.status, `illegal ${j.from} → ${j.to}`).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    }

    const unknown = await apiPatch(request, `/bookings/${id}/status`, 'admin', 'banana');
    expect(unknown.status).toBe(400);

    // Legal: pending → confirmed
    const confirmed = await apiPatch(request, `/bookings/${id}/status`, 'admin', 'confirmed');
    expect(confirmed.status).toBe(200);
    expect(String((unwrap(confirmed.body) as { status?: string }).status)).toBe('confirmed');

    // confirmed → checked-out is NOT allowed (must check in first)
    const skipCheckIn = await apiPatch(request, `/bookings/${id}/status`, 'admin', 'checked-out');
    expect(skipCheckIn.status).toBeGreaterThanOrEqual(400);
    expect(skipCheckIn.status).toBeLessThan(500);

    // Legal: confirmed → checked-in → checked-out
    for (const next of ['checked-in', 'checked-out'] as const) {
      const res = await apiPatch(request, `/bookings/${id}/status`, 'admin', next);
      expect(res.status, `legal → ${next}`).toBe(200);
      expect(String((unwrap(res.body) as { status?: string }).status)).toBe(next);
    }

    // checked-out is terminal
    const terminal = await apiPatch(request, `/bookings/${id}/status`, 'admin', 'cancelled');
    expect(terminal.status).toBeGreaterThanOrEqual(400);
    expect(terminal.status).toBeLessThan(500);
  } finally {
    await apiDelete(request, `/bookings/${id}`, 'admin');
  }
});

test('booking: deposit guards (non-positive + over-total)', async ({ request, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  const base = await ensureBaseline(browser);

  const created = await apiPostText(request, '/bookings', 'admin', {
    propertyId: base.tenantPropertyId,
    guestId: base.guestId,
    roomId: base.roomIds[0],
    checkIn: iso(40),
    checkOut: iso(43),
    guests: 1,
    ratePerNight: 1000,
    source: 'Direct',
  });
  expect(created.status, created.text).toBe(201);
  const body = bodyOf(created.text);
  const id = Number(body.id);
  const amount = Number(body.amount);
  expect(amount).toBe(3000); // 1000/night × 3 nights

  try {
    const zero = await postRawJson(request, `/bookings/${id}/deposit`, JSON.stringify(0));
    expect(zero.status).toBe(400);

    const negative = await postRawJson(request, `/bookings/${id}/deposit`, JSON.stringify(-5));
    expect(negative.status).toBe(400);

    const full = await postRawJson(request, `/bookings/${id}/deposit`, JSON.stringify(amount));
    expect(full.status).toBe(200);

    const over = await postRawJson(request, `/bookings/${id}/deposit`, JSON.stringify(1));
    expect(over.status).toBe(400);
  } finally {
    await apiDelete(request, `/bookings/${id}`, 'admin');
  }
});

test('payment: create guards + one-way lifecycle (pending → completed → refunded)', async ({ request, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'admin');
  const base = await ensureBaseline(browser);

  const badMethod = await apiPostText(request, '/payments', 'admin', {
    propertyId: base.tenantPropertyId,
    guestId: base.guestId,
    amount: 100,
    method: 'bitcoin',
    processedBy: 'QA-E2E',
  });
  expect(badMethod.status).toBe(400);

  const badAmount = await apiPostText(request, '/payments', 'admin', {
    propertyId: base.tenantPropertyId,
    guestId: base.guestId,
    amount: 0,
    method: 'card',
    processedBy: 'QA-E2E',
  });
  expect(badAmount.status).toBe(400);

  const created = await apiPost(request, '/payments', 'admin', {
    propertyId: base.tenantPropertyId,
    guestId: base.guestId,
    amount: 250,
    method: 'card',
    processedBy: 'QA-E2E',
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const payment = (unwrap(created.body) ?? {}) as { id?: number; status?: string };
  const id = Number(payment.id);
  expect(id).toBeGreaterThan(0);
  expect(String(payment.status).toLowerCase()).toContain('pending');

  // Refund before completion is refused.
  const earlyRefund = await apiPost(request, `/payments/${id}/refund`, 'admin', {});
  expect(earlyRefund.status).toBe(400);

  // Complete.
  const completed = await postRawJson(
    request,
    `/payments/${id}/complete`,
    JSON.stringify(`TX-E2E-${SUFFIX}`),
  );
  expect(completed.status, JSON.stringify(completed.body)).toBe(200);
  expect(String((unwrap(completed.body) as { status?: string }).status).toLowerCase()).toContain('complet');

  // Re-completing is refused.
  const reComplete = await postRawJson(
    request,
    `/payments/${id}/complete`,
    JSON.stringify('TX-E2E-AGAIN'),
  );
  expect(reComplete.status).toBe(400);

  // Refund.
  const refunded = await apiPost(request, `/payments/${id}/refund`, 'admin', {});
  expect(refunded.status, JSON.stringify(refunded.body)).toBe(200);
  expect(String((unwrap(refunded.body) as { status?: string }).status).toLowerCase()).toContain('refund');

  // Double refund refused.
  const reRefund = await apiPost(request, `/payments/${id}/refund`, 'admin', {});
  expect(reRefund.status).toBe(400);
});
