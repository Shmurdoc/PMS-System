// ============================================
// HYDRATE → API → store full-state load
// ============================================
// Loads every collection the store persists, replacing whatever the store
// already holds with live data. Failure policy (per collection): keep the
// current rows, record the failure, keep going  -  one broken endpoint never
// blanks the app. A successful fetch with zero rows REPLACES the store
// (empty is a valid truth).
//
// Properties go first: their tenant ids key the per-property endpoints, and if
// that fetch fails those collections are skipped rather than cleared.
// /auth/me comes next, since nav, the route guard, and the property lock all
// read it. Everything else goes out in one parallel wave.
//
// Child rows carry the tenant id (PropertyId), not the property's primary key,
// so per-property fetches key on dto.propertyId. A per-property collection
// fails as a whole if any property fetch fails; partial data would look
// complete.
//
// Then map and apply. Booking and invoice joins are built from raw DTOs, so
// mapping never depends on store state.
//
// /auth/me is hydrated too: the persist `partialize` excludes `user`, so after
// a page reload the current user must be fetched back from the token.

import { useAppStore } from '../../store/useAppStore';
import { getAuthToken, getTokenRole } from './config';
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

/** Keeps rows created while the fetch was in flight. They are not in the server
 *  list yet, so replacing the list would drop them. */
function mergeRows<T extends { id: string }>(serverRows: T[], localRows: T[]): T[] {
  const serverIds = new Set(serverRows.map((r) => r.id));
  return [...serverRows, ...localRows.filter((r) => !serverIds.has(r.id))];
}

// ---------- hydrate ----------

export async function hydrateFromApi(): Promise<HydrateResult> {
  const failed: string[] = [];
  if (!getAuthToken()) return { ok: false, failed: ['auth: no token'] };

  const store = useAppStore.getState();

  // Audit-trail reads are admin/manager only  -  other roles skip the fetch
  // instead of collecting a guaranteed 403 in `failed`.
  const tokenRole = getTokenRole();
  const canReadAudit = tokenRole === 'admin' || tokenRole === 'manager';
  // Insights, workflows, and agents are admin/manager resources. Asking for
  // them as front desk only produces a 403 on every login.
  const canReadAi = tokenRole === 'admin' || tokenRole === 'manager';

  // Properties first. Their tenant ids key everything below.
  let propertiesDto: ApiProperty[] | undefined;
  try {
    propertiesDto = await fetchProperties();
  } catch (error) {
    failed.push(`properties: ${errMsg(error)}`);
  }
  const propertiesOk = propertiesDto !== undefined;

  // Publish them now. The staff, room, and rate pickers read the store, and an
  // empty list keeps those forms blocked until the wave finishes.
  if (propertiesDto) store.setProperties(mergeRows(propertiesDto.map((p) => mapProperty(p)), useAppStore.getState().properties));

  // Current user next: nav, the route guard, and the property lock read it.
  const meDto = await settle('auth/me', fetchCurrentUser(), failed);
  if (meDto) store.setUser(mapUser(meDto));

  // Per-property endpoints take the tenant id, so a scoped user asks for their
  // own property only. Fetching the rest would fail the whole collection.
  const scopedPropertyId = meDto?.propertyId ?? null;
  const propertyIds = propertiesDto
    ? propertiesDto
        .filter((p) => scopedPropertyId == null || p.propertyId === scopedPropertyId || p.id === scopedPropertyId)
        .map((p) => p.propertyId)
        .filter((id) => id > 0)
    : [];

  // One parallel wave.
  const [
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
    settle('users', fetchUsers(), failed),
    settle('guests', fetchGuests(), failed),
    settle('maintenanceRequests', fetchMaintenanceRequests(), failed),
    settle('ratePlans', fetchRatePlans(), failed),
    settle('aiInsights', canReadAi ? fetchAiInsights() : Promise.resolve(undefined), failed),
    settle('workflows', canReadAi ? fetchWorkflows() : Promise.resolve(undefined), failed),
    settle('shifts', fetchShifts(), failed),
    settle('attendance', fetchAttendance(), failed),
    settle('messages', fetchMessages(), failed),
    settle('auditLogs', canReadAudit ? fetchAuditLogs() : Promise.resolve(undefined), failed),
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

  // Build the join contexts from the raw DTOs, not from store state.
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

  // Apply, but only the collections whose fetch succeeded.
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
      mergeRows(propertiesDto.map((p) => mapProperty(p, statsByPropertyId.get(String(p.id)))), useAppStore.getState().properties),
    );
  }

  if (roomsFlat) store.setRooms(mergeRows(roomsFlat.map(mapRoom), useAppStore.getState().rooms));
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
