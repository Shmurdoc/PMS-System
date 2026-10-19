// ============================================
// HYDRATE — API → store full-state load
// ============================================
// Loads every collection the store persists, replacing whatever the store
// already holds with live data. Failure policy (per collection): keep the
// current rows, record the failure, keep going — one broken endpoint never
// blanks the app. A successful fetch with zero rows REPLACES the store
// (empty is a valid truth).
//
// Fetch order:
//   0. No token → bail (never fetch unauthenticated).
//   1. GET /properties first — per-property list endpoints key off it and the
//      join maps are built from it. If it fails, the per-property collections
//      are skipped entirely (those rows stay as they are) and only globals
//      hydrate.
//   2. One parallel wave: /auth/me, /users, /guests, /maintenanceRequests,
//      /ratePlans, /aiInsights, /workflows, /shifts, /attendance, /messages,
//      /auditlogs, /taxconfigs + per-property rooms/bookings/invoices/payments/
//      tickets/rfidtags.
//      A per-property collection fails as a whole if ANY property fetch fails
//      (partial data would masquerade as complete).
//   3. Map + apply. Booking/invoice joins are built from RAW DTOs so mapping
//      never depends on store state.
//
// FK note: child rows store Property.Id (EF: HasOne<Property>().HasForeignKey
// → PK), so per-property fetches key on dto.id. Join maps also accept the
// tenant code (dto.propertyId) as a secondary key where it does not collide.
//
// /auth/me is hydrated too: the persist `partialize` excludes `user`, so after
// a page reload the current user must be fetched back from the token.

import { useAppStore } from '../../store/useAppStore';
import { getAuthToken } from './config';
import {
  indexBy,
  mapAiInsight,
  mapAttendance,
  mapAuditLog,
  mapBooking,
  mapElectricity,
  mapExpense,
  mapMessage,
  mapGuest,
  mapIntegration,
  mapInventoryItem,
  mapInvoice,
  mapMaintenanceRequest,
  mapPayment,
  mapProperty,
  mapRatePlan,
  mapRfidTag,
  mapRoom,
  mapShift,
  mapTaxConfig,
  mapTicket,
  mapUser,
  mapWorkflow,
} from './mappers';
import type { ApiGuest, ApiProperty, ApiRoom } from './mappers';
import {
  ApiError,
  fetchAiInsights,
  fetchAttendance,
  fetchAuditLogs,
  fetchBookingsForProperty,
  fetchElectricity,
  fetchExpenses,
  fetchIntegrations,
  fetchMessages,
  fetchCurrentUser,
  fetchGuests,
  fetchInventoryItems,
  fetchInvoicesForProperty,
  fetchMaintenanceRequests,
  fetchPaymentsForProperty,
  fetchProperties,
  fetchRatePlans,
  fetchRfidTagsForProperty,
  fetchRoomsForProperty,
  fetchShifts,
  fetchTaxConfigs,
  fetchTicketsForProperty,
  fetchUsers,
  fetchWorkflows,
} from './services';

// ---------- result ----------

export interface HydrateResult {
  /** True when every collection hydrated without a failure. */
  ok: boolean;
  /** One entry per failed collection (`collection: message`). */
  failed: string[];
}

// ---------- helpers ----------

function errMsg(error: unknown): string {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

/** Awaits a single-collection fetch, recording its failure instead of throwing. */
async function settle<T>(
  collection: string,
  task: Promise<T>,
  failed: string[],
): Promise<T | undefined> {
  try {
    return await task;
  } catch (error) {
    failed.push(`${collection}: ${errMsg(error)}`);
    return undefined;
  }
}

/**
 * Fetches one collection across every property. Returns undefined if ANY
 * property fetch failed (partial lists must not replace the store).
 */
async function fetchPerProperty<T>(
  collection: string,
  propertyIds: number[],
  fetchOne: (propertyId: number) => Promise<T[]>,
  failed: string[],
): Promise<T[][] | undefined> {
  const results = await Promise.all(
    propertyIds.map(async (propertyId) => {
      try {
        return await fetchOne(propertyId);
      } catch (error) {
        failed.push(`${collection}: property ${propertyId}: ${errMsg(error)}`);
        return undefined;
      }
    }),
  );
  return results.some((list) => list === undefined) ? undefined : (results as T[][]);
}

/** Concatenates per-property lists, keeping the first row per numeric id. */
function dedupeById<T extends { id: number }>(lists: T[][]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }
  }
  return out;
}

// ---------- hydrate ----------

export async function hydrateFromApi(): Promise<HydrateResult> {
  const failed: string[] = [];
  if (!getAuthToken()) return { ok: false, failed: ['auth: no token'] };

  const store = useAppStore.getState();

  // 1) Properties first — foundation for per-property fetches + joins.
  let propertiesDto: ApiProperty[] | undefined;
  try {
    propertiesDto = await fetchProperties();
  } catch (error) {
    failed.push(`properties: ${errMsg(error)}`);
  }
  const propertiesOk = propertiesDto !== undefined;
  const propertyIds = propertiesDto ? propertiesDto.map((p) => p.id) : [];

  // 2) One parallel wave.
  const [
    meDto,
    usersDto,
    guestsDto,
    maintenanceDto,
    ratePlansDto,
    aiInsightsDto,
    workflowsDto,
    shiftsDto,
    attendanceDto,
    messagesDto,
    auditLogsDto,
    taxConfigsDto,
    expensesDto,
    electricityDto,
    integrationsDto,
    inventoryDto,
    roomsLists,
    bookingLists,
    invoiceLists,
    paymentLists,
    ticketLists,
    rfidLists,
  ] = await Promise.all([
    settle('auth/me', fetchCurrentUser(), failed),
    settle('users', fetchUsers(), failed),
    settle('guests', fetchGuests(), failed),
    settle('maintenanceRequests', fetchMaintenanceRequests(), failed),
    settle('ratePlans', fetchRatePlans(), failed),
    settle('aiInsights', fetchAiInsights(), failed),
    settle('workflows', fetchWorkflows(), failed),
    settle('shifts', fetchShifts(), failed),
    settle('attendance', fetchAttendance(), failed),
    settle('messages', fetchMessages(), failed),
    settle('auditLogs', fetchAuditLogs(), failed),
    settle('taxConfigs', fetchTaxConfigs(), failed),
    settle('expenses', fetchExpenses(), failed),
    settle('electricity', fetchElectricity(), failed),
    settle('integrations', fetchIntegrations(), failed),
    settle('inventory', fetchInventoryItems(), failed),
    propertiesOk ? fetchPerProperty('rooms', propertyIds, fetchRoomsForProperty, failed) : Promise.resolve(undefined),
    propertiesOk ? fetchPerProperty('bookings', propertyIds, fetchBookingsForProperty, failed) : Promise.resolve(undefined),
    propertiesOk ? fetchPerProperty('invoices', propertyIds, fetchInvoicesForProperty, failed) : Promise.resolve(undefined),
    propertiesOk ? fetchPerProperty('payments', propertyIds, fetchPaymentsForProperty, failed) : Promise.resolve(undefined),
    propertiesOk ? fetchPerProperty('tickets', propertyIds, fetchTicketsForProperty, failed) : Promise.resolve(undefined),
    propertiesOk ? fetchPerProperty('rfidTags', propertyIds, fetchRfidTagsForProperty, failed) : Promise.resolve(undefined),
  ]);

  // 3) Join contexts from RAW DTOs (never from store state).
  const guestById = indexBy<ApiGuest>(guestsDto ?? [], (g) => String(g.id));
  const propertyNameById = new Map<string, string>();
  if (propertiesDto) {
    for (const property of propertiesDto) propertyNameById.set(String(property.id), property.name);
    for (const property of propertiesDto) {
      const tenantKey = String(property.propertyId);
      if (property.propertyId > 0 && !propertyNameById.has(tenantKey)) {
        propertyNameById.set(tenantKey, property.name);
      }
    }
  }
  const roomsFlat = roomsLists === undefined ? undefined : dedupeById(roomsLists);
  const roomById = indexBy<ApiRoom>(roomsFlat ?? [], (r) => String(r.id));
  const guestEmailById = new Map<string, string>();
  for (const [id, guest] of guestById) guestEmailById.set(id, guest.email);

  // 4) Apply — only collections whose fetch succeeded.
  if (meDto) store.setUser(mapUser(meDto));
  if (usersDto) store.setUsers(usersDto.map(mapUser));
  if (guestsDto) store.setGuests(guestsDto.map(mapGuest));
  if (maintenanceDto) store.setMaintenanceTickets(maintenanceDto.map(mapMaintenanceRequest));
  if (ratePlansDto) store.setRatePlans(ratePlansDto.map(mapRatePlan));
  if (aiInsightsDto) store.setAiInsights(aiInsightsDto.map(mapAiInsight));
  if (workflowsDto) store.setWorkflows(workflowsDto.map(mapWorkflow));
  if (shiftsDto) store.setShifts(shiftsDto.map(mapShift));
  if (attendanceDto) store.setAttendance(attendanceDto.map(mapAttendance));
  if (messagesDto) store.setMessages(messagesDto.map(mapMessage));
  if (auditLogsDto) store.setAuditLogs(auditLogsDto.map(mapAuditLog));
  if (taxConfigsDto) store.setTaxConfigs(taxConfigsDto.map(mapTaxConfig));
  if (expensesDto) store.setExpenses(expensesDto.map(mapExpense));
  if (electricityDto) store.setElectricity(electricityDto.map(mapElectricity));
  if (integrationsDto) store.setIntegrations(integrationsDto.map(mapIntegration));
  if (inventoryDto) store.setInventory(inventoryDto.map(mapInventoryItem));

  if (propertiesDto) {
    // Occupancy stats come from the rooms fetched for the same wave; without
    // them a property reports 0/0 rather than mock numbers.
    const statsByPropertyId = new Map<string, { totalRooms: number; occupiedRooms: number }>();
    if (roomsFlat) {
      for (const property of propertiesDto) {
        const rooms = roomsFlat.filter(
          (r) => r.propertyId === property.id ||
            (property.propertyId > 0 && r.propertyId === property.propertyId),
        );
        statsByPropertyId.set(String(property.id), {
          totalRooms: rooms.length,
          occupiedRooms: rooms.filter((r) => (r.status ?? '').toLowerCase() === 'occupied').length,
        });
      }
    }
    store.setProperties(
      propertiesDto.map((p) => mapProperty(p, statsByPropertyId.get(String(p.id)))),
    );
  }

  if (roomsFlat) store.setRooms(roomsFlat.map(mapRoom));
  if (bookingLists) {
    store.setBookings(
      dedupeById(bookingLists).map((b) =>
        mapBooking(b, { guestById, propertyNameById, roomById }),
      ),
    );
  }
  if (invoiceLists) {
    store.setInvoices(
      dedupeById(invoiceLists).map((i) => mapInvoice(i, { guestEmailById })),
    );
  }
  if (paymentLists) store.setPayments(dedupeById(paymentLists).map(mapPayment));
  if (ticketLists) store.setTickets(dedupeById(ticketLists).map(mapTicket));
  if (rfidLists) store.setRfidTags(dedupeById(rfidLists).map(mapRfidTag));

  return { ok: failed.length === 0, failed };
}
