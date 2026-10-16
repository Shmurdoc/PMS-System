// ============================================
// API SERVICES — endpoint-level transport functions
// ============================================
// Thin wrappers over apiRequest that unwrap the {success,data,error} envelope
// and throw ApiError on failure. Returns RAW DTOs; mapping to store shapes
// happens in hydrate.ts / callers (mappers.ts), so this layer never imports
// the store.
//
// List-endpoint quirks (verified against controllers/handlers):
//   - GET /bookings | /invoices | /payments | /tickets take a NON-nullable
//     [FromQuery] int propertyId and filter `PropertyId == propertyId`
//     strictly — an absent param binds to 0 and returns an empty list.
//     Callers must fetch these PER PROPERTY.
//   - GET /rooms has no bare list route — only /rooms/property/{propertyId}.
//   - GET /maintenanceRequests and /ratePlans take int? — absent = all.
//   - GET /rfidtags takes a NON-nullable [FromQuery] int propertyId (plus an
//     optional kind filter) — fetch it per property like the list above.
//   - DELETE endpoints answer 204 No Content (empty body, unwrapped by the
//     envelope middleware) → apiRequest synthesizes {success:true}.

import { apiRequest } from '../api';
import { apiUrl } from './config';
import type {
  ApiAiInsight,
  ApiAgent,
  ApiAttendance,
  ApiAuditLog,
  ApiBooking,
  ApiMessage,
  ApiChatResponse,
  ApiElectricityRecord,
  ApiExpense,
  ApiGuest,
  ApiGuestTapContext,
  ApiIntegration,
  ApiInventoryItem,
  ApiInvoice,
  ApiLoginResponse,
  ApiMaintenanceRequest,
  ApiPayment,
  ApiProperty,
  ApiRatePlan,
  ApiRfidTag,
  ApiRoom,
  ApiRunAgentResult,
  ApiShift,
  ApiStaffTapResult,
  ApiTaxConfig,
  ApiTicket,
  ApiUser,
  ApiWorkflow,
} from './mappers';

// ---------- error ----------

export class ApiError extends Error {
  readonly code: string;

  constructor(message: string, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

// ---------- helpers ----------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/** Executes a request and returns envelope.data, or throws ApiError. */
async function unwrap<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiRequest<T>(apiUrl(path), {
    method: options.method ?? 'GET',
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.success) {
    throw new ApiError(
      response.error?.message ?? 'Request failed.',
      response.error?.code ?? 'REQUEST_FAILED',
    );
  }
  if (response.data === undefined) {
    // GET/POST/PUT answered 200 but carried no data — treat as failure so a
    // silent empty body can't wipe the store.
    throw new ApiError('Server returned an empty response.', 'EMPTY_RESPONSE');
  }
  return response.data;
}

/** Executes a request that may legitimately answer 204 (DELETE). */
async function unwrapOk(path: string, options: RequestOptions = {}): Promise<void> {
  const response = await apiRequest(apiUrl(path), {
    method: options.method ?? 'GET',
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.success) {
    throw new ApiError(
      response.error?.message ?? 'Request failed.',
      response.error?.code ?? 'REQUEST_FAILED',
    );
  }
}

// ---------- input shapes ----------

export interface CreateMaintenanceInput {
  propertyId: number;
  description: string;
  priority?: string;
  status?: string;
}

export interface UpdateMaintenanceInput {
  description?: string;
  status?: string;
  priority?: string;
}

export interface CreateAiInsightInput {
  propertyId?: number | null;
  type: string;
  title: string;
  description?: string;
  recommendation?: string;
  impact: string;
}

export interface UpdateAiInsightInput {
  type?: string;
  title?: string;
  description?: string;
  recommendation?: string;
  impact?: string;
  /** Tri-state: omitted keeps the current value, false acknowledges, true dismisses. */
  dismissed?: boolean | null;
}

export interface CreateWorkflowInput {
  propertyId?: number | null;
  name: string;
  description?: string;
  trigger: string;
  actions: string[];
  status?: string;
  createdBy?: string;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  trigger?: string;
  actions?: string[];
  status?: string;
}

export interface CreateShiftInput {
  propertyId: number;
  userId: number;
  userName: string;
  startTime: string;
  endTime: string;
  role: string;
  department?: string;
}

/** Sparse edit — omitted/null fields keep their current value. */
export interface UpdateShiftInput {
  breakStart?: string;
  breakEnd?: string;
  overtime?: number;
  notes?: string;
  department?: string;
}

export interface CreateAttendanceInput {
  propertyId: number;
  userId: number;
  userName: string;
  checkIn: string;
  status?: string;
  notes?: string;
}

/**
 * Sparse edit — null keeps the current value. The handler only accepts status
 * transitions into `late` or `on_leave`; anything else comes back as a failure.
 */
export interface UpdateAttendanceInput {
  checkOut?: string;
  status?: string;
  notes?: string;
}

export interface CreateElectricityInput {
  propertyId: number;
  date: string;
  consumption: number;
  cost: number;
  peakDemand: number;
  zone: string;
}

/** Sparse edit — null keeps the current value. */
export interface UpdateElectricityInput {
  date?: string;
  consumption?: number;
  cost?: number;
  peakDemand?: number;
  zone?: string;
}

/** ConfiguredBy is omitted — the controller stamps it from the JWT. */
export interface CreateIntegrationInput {
  propertyId: number;
  name: string;
  category: string;
  description?: string;
  icon?: string;
  apiKey?: string;
  webhookUrl?: string;
}

/** Sparse edit — null keeps the current value. */
export interface UpdateIntegrationInput {
  name?: string;
  category?: string;
  description?: string;
  icon?: string;
  apiKey?: string;
  webhookUrl?: string;
}

/** Sender fields are omitted — the controller stamps them from the authenticated claims. */
export interface CreateMessageInput {
  propertyId: number;
  content: string;
  type?: string;
  channelId?: string;
  attachments?: string[];
}

/** Acting user, role, and IP are omitted — the controller stamps them from claims/request. */
export interface CreateAuditLogInput {
  propertyId: number;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  details: string;
  oldValue?: string;
  newValue?: string;
}

/** Rate is a percent (15 = 15%); the API stores a fraction (0.15). */
export interface CreateTaxConfigInput {
  propertyId: number;
  name: string;
  rate: number;
  type: string;
  included: boolean;
  applicableTo: string[];
  validFrom: string;
}

/**
 * Sparse edit — omitted fields keep their current value. Name, type, and window
 * start are immutable server-side; end the window and create a successor instead.
 * Reactivation of a deactivated rule is not supported.
 */
export interface UpdateTaxConfigInput {
  rate?: number;
  included?: boolean;
  active?: boolean;
  validTo?: string;
  applicableTo?: string[];
}

// ---------- auth ----------

export async function login(email: string, password: string): Promise<ApiLoginResponse> {
  return unwrap<ApiLoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function fetchCurrentUser(): Promise<ApiUser> {
  return unwrap<ApiUser>('/auth/me');
}

// ---------- global lists (no property filter needed) ----------

export function fetchUsers(): Promise<ApiUser[]> {
  return unwrap<ApiUser[]>('/users');
}

export function fetchProperties(): Promise<ApiProperty[]> {
  return unwrap<ApiProperty[]>('/properties');
}

export function fetchGuests(): Promise<ApiGuest[]> {
  return unwrap<ApiGuest[]>('/guests');
}

export function fetchMaintenanceRequests(): Promise<ApiMaintenanceRequest[]> {
  return unwrap<ApiMaintenanceRequest[]>('/maintenanceRequests');
}

export function fetchRatePlans(): Promise<ApiRatePlan[]> {
  return unwrap<ApiRatePlan[]>('/ratePlans');
}

// Bare GET lists every row — filters (int? propertyId, string? status/category)
// are omitted, so the controller binds null and returns the full set.
export function fetchExpenses(): Promise<ApiExpense[]> {
  return unwrap<ApiExpense[]>('/expenses');
}

export function fetchInventoryItems(): Promise<ApiInventoryItem[]> {
  return unwrap<ApiInventoryItem[]>('/inventoryItems');
}

// ---------- per-property lists (propertyId is a strict equality filter) ----

export function fetchRoomsForProperty(propertyId: number): Promise<ApiRoom[]> {
  return unwrap<ApiRoom[]>(`/rooms/property/${propertyId}`);
}

export function fetchBookingsForProperty(propertyId: number): Promise<ApiBooking[]> {
  return unwrap<ApiBooking[]>(`/bookings?propertyId=${propertyId}`);
}

export function fetchInvoicesForProperty(propertyId: number): Promise<ApiInvoice[]> {
  return unwrap<ApiInvoice[]>(`/invoices?propertyId=${propertyId}`);
}

export function fetchPaymentsForProperty(propertyId: number): Promise<ApiPayment[]> {
  return unwrap<ApiPayment[]>(`/payments?propertyId=${propertyId}`);
}

export function fetchTicketsForProperty(propertyId: number): Promise<ApiTicket[]> {
  return unwrap<ApiTicket[]>(`/tickets?propertyId=${propertyId}`);
}

export function fetchRfidTagsForProperty(propertyId: number, kind?: 'guest' | 'staff'): Promise<ApiRfidTag[]> {
  const kindParam = kind ? `&kind=${kind}` : '';
  return unwrap<ApiRfidTag[]>(`/rfidtags?propertyId=${propertyId}${kindParam}`);
}

// ---------- mutations ----------

// Users ------------------------------------------------------------------

/**
 * Backend requires a password on create (min 8 chars). The UI has no password
 * field, so admin-created accounts get this temporary credential — the admin
 * shares it and the user rotates it on first login.
 */
export const TEMP_PASSWORD = 'ChangeMe123!';

export interface CreateUserInput {
  email: string;
  name: string;
  password?: string;
  role: string;
  department?: string;
  phone?: string;
}

/** Sparse — Name always sent (handler requires it); null keeps current server-side. */
export interface UpdateUserInput {
  name?: string;
  department?: string | null;
  phone?: string | null;
  role?: string;
  password?: string | null;
}

export function createUser(input: CreateUserInput): Promise<ApiUser> {
  return unwrap<ApiUser>('/users', {
    method: 'POST',
    body: {
      email: input.email,
      name: input.name,
      password: input.password ?? TEMP_PASSWORD,
      role: input.role,
      department: input.department ?? null,
      phone: input.phone ?? null,
    },
  });
}

/** Controller overrides Id from the route; email is immutable server-side. */
export function updateUser(id: number, input: UpdateUserInput): Promise<ApiUser> {
  return unwrap<ApiUser>(`/users/${id}`, {
    method: 'PUT',
    body: {
      id,
      name: input.name ?? null,
      department: input.department ?? null,
      phone: input.phone ?? null,
      role: input.role ?? null,
      password: input.password ?? null,
    },
  });
}

export function deleteUser(id: number): Promise<void> {
  return unwrapOk(`/users/${id}`, { method: 'DELETE' });
}

// Guests ------------------------------------------------------------------

export interface CreateGuestInput {
  name: string;
  email: string;
  phone: string;
  idNumber: string;
  nationality: string;
}

/** Name, phone, nationality, notes always sent (handler overwrites them unconditionally). */
export interface UpdateGuestInput {
  name: string;
  phone: string;
  nationality: string;
  notes: string;
  address?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  vipLevel?: string | null;
}

export function createGuest(input: CreateGuestInput): Promise<ApiGuest> {
  return unwrap<ApiGuest>('/guests', {
    method: 'POST',
    body: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      idNumber: input.idNumber,
      nationality: input.nationality,
    },
  });
}

/** Controller overrides Id from the route. */
export function updateGuest(id: number, input: UpdateGuestInput): Promise<ApiGuest> {
  return unwrap<ApiGuest>(`/guests/${id}`, {
    method: 'PUT',
    body: {
      id,
      name: input.name,
      phone: input.phone,
      nationality: input.nationality,
      notes: input.notes,
      address: input.address ?? null,
      emergencyContact: input.emergencyContact ?? null,
      emergencyPhone: input.emergencyPhone ?? null,
      vipLevel: input.vipLevel ?? null,
    },
  });
}

export function deleteGuest(id: number): Promise<void> {
  return unwrapOk(`/guests/${id}`, { method: 'DELETE' });
}

// Properties --------------------------------------------------------------

export interface CreatePropertyInput {
  /** Tenant identifier (unique int, not the PK). */
  propertyId: number;
  name: string;
  address: string;
  rating: number;
  manager?: string;
  phone?: string;
  email?: string;
  description?: string;
}

export function createProperty(input: CreatePropertyInput): Promise<ApiProperty> {
  return unwrap<ApiProperty>('/properties', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      name: input.name,
      address: input.address,
      rating: input.rating,
      manager: input.manager ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      description: input.description ?? null,
      initialRooms: [],
    },
  });
}

/** Status is the only mutable field server-side; other property edits stay local. */
export function updatePropertyStatus(
  id: number,
  status: 'active' | 'maintenance' | 'retired',
): Promise<ApiProperty> {
  return unwrap<ApiProperty>(`/properties/${id}`, {
    method: 'PUT',
    body: { id, status },
  });
}

export function deleteProperty(id: number): Promise<void> {
  return unwrapOk(`/properties/${id}`, { method: 'DELETE' });
}

// Rate plans --------------------------------------------------------------

export interface CreateRatePlanInput {
  propertyId: number;
  name: string;
  baseRate: number;
  season: string;
  minStay: number;
  roomTypes?: string[];
  restrictions?: string[];
}

/** Sparse — omitted fields keep their current value; Active null keeps current. */
export interface UpdateRatePlanInput {
  baseRate?: number;
  roomTypes?: string[];
  restrictions?: string[];
  active?: boolean;
}

export function createRatePlan(input: CreateRatePlanInput): Promise<ApiRatePlan> {
  return unwrap<ApiRatePlan>('/ratePlans', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      name: input.name,
      baseRate: input.baseRate,
      season: input.season,
      minStay: input.minStay,
      roomTypes: input.roomTypes ?? null,
      restrictions: input.restrictions ?? null,
    },
  });
}

/** Controller overrides Id from the route. */
export function updateRatePlan(id: number, input: UpdateRatePlanInput): Promise<ApiRatePlan> {
  return unwrap<ApiRatePlan>(`/ratePlans/${id}`, {
    method: 'PUT',
    body: {
      id,
      baseRate: input.baseRate ?? null,
      roomTypes: input.roomTypes ?? null,
      restrictions: input.restrictions ?? null,
      active: input.active ?? null,
    },
  });
}

export function deleteRatePlan(id: number): Promise<void> {
  return unwrapOk(`/ratePlans/${id}`, { method: 'DELETE' });
}

// Rooms -------------------------------------------------------------------

export interface CreateRoomInput {
  propertyId: number;
  number: string;
  type: string;
  price: number;
  maxOccupancy: number;
  floor: number;
  bedType?: string;
  view?: string;
  size?: number;
  description?: string;
  amenities?: string[];
}

export function createRoom(input: CreateRoomInput): Promise<ApiRoom> {
  return unwrap<ApiRoom>('/rooms', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      number: input.number,
      type: input.type,
      price: input.price,
      maxOccupancy: input.maxOccupancy,
      floor: input.floor,
      bedType: input.bedType ?? null,
      view: input.view ?? null,
      size: input.size ?? null,
      description: input.description ?? null,
      amenities: input.amenities ?? null,
    },
  });
}

/** Status: available | occupied | reserved | cleaning | maintenance. roomId rides in the body. */
export function updateRoomStatus(id: number, status: string): Promise<ApiRoom> {
  return unwrap<ApiRoom>('/rooms/status', {
    method: 'PUT',
    body: { roomId: id, status },
  });
}

export function updateRoomPrice(id: number, price: number): Promise<ApiRoom> {
  return unwrap<ApiRoom>('/rooms/price', {
    method: 'PUT',
    body: { roomId: id, price },
  });
}

export function updateRoomMaxOccupancy(id: number, maxOccupancy: number): Promise<ApiRoom> {
  return unwrap<ApiRoom>('/rooms/max-occupancy', {
    method: 'PUT',
    body: { roomId: id, maxOccupancy },
  });
}

export function updateRoomView(id: number, view: string): Promise<ApiRoom> {
  return unwrap<ApiRoom>('/rooms/view', {
    method: 'PUT',
    body: { roomId: id, view },
  });
}

/** Single amenity add/remove — the endpoint has no bulk-replace form. */
export function updateRoomAmenities(
  id: number,
  action: 'add' | 'remove',
  amenity: string,
): Promise<ApiRoom> {
  return unwrap<ApiRoom>('/rooms/amenities', {
    method: 'PUT',
    body: { roomId: id, action, amenity },
  });
}

export function deleteRoom(id: number): Promise<void> {
  return unwrapOk(`/rooms/${id}`, { method: 'DELETE' });
}

export function deleteBooking(id: number): Promise<void> {
  return unwrapOk(`/bookings/${id}`, { method: 'DELETE' });
}

// Bookings ----------------------------------------------------------------

export interface CreateBookingInput {
  propertyId: number;
  guestId: number;
  roomId: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  ratePerNight: number;
  source: string;
}

export function createBooking(input: CreateBookingInput): Promise<ApiBooking> {
  return unwrap<ApiBooking>('/bookings', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      guestId: input.guestId,
      roomId: input.roomId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      ratePerNight: input.ratePerNight,
      source: input.source,
    },
  });
}

/** Status: pending | confirmed | checked-in | checked-out | cancelled | no-show. */
export function changeBookingStatus(id: number, newStatus: string): Promise<ApiBooking> {
  return unwrap<ApiBooking>(`/bookings/${id}/status`, {
    method: 'PATCH',
    body: newStatus,
  });
}

/** Raw [FromBody] decimal — the envelope unwraps to a BookingDto. */
export function recordBookingDeposit(id: number, amount: number): Promise<ApiBooking> {
  return unwrap<ApiBooking>(`/bookings/${id}/deposit`, {
    method: 'POST',
    body: amount,
  });
}

// Tickets ------------------------------------------------------------------

export interface CreateTicketInput {
  propertyId: number;
  reporterId: number;
  title: string;
  description: string;
  type: string;
  category: string;
  priority: string;
  roomId?: number | null;
  guestId?: number | null;
  dueDate?: string | null;
  tags: string[];
}

export function createTicket(input: CreateTicketInput): Promise<ApiTicket> {
  return unwrap<ApiTicket>('/tickets', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      reporterId: input.reporterId,
      title: input.title,
      description: input.description,
      type: input.type,
      category: input.category,
      priority: input.priority,
      roomId: input.roomId ?? null,
      guestId: input.guestId ?? null,
      dueDate: input.dueDate ?? null,
      tags: input.tags,
    },
  });
}

/** Status: open | in_progress | pending | resolved | closed | cancelled. */
export function changeTicketStatus(id: number, newStatus: string): Promise<ApiTicket> {
  return unwrap<ApiTicket>(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: newStatus,
  });
}

/** Raw [FromBody] int — admin,manager only. */
export function assignTicket(id: number, assigneeId: number): Promise<ApiTicket> {
  return unwrap<ApiTicket>(`/tickets/${id}/assign`, {
    method: 'POST',
    body: assigneeId,
  });
}

export function addTicketComment(
  id: number,
  userId: number,
  content: string,
  isInternal: boolean,
): Promise<ApiTicket> {
  return unwrap<ApiTicket>(`/tickets/${id}/comments`, {
    method: 'POST',
    body: { userId, content, isInternal },
  });
}

export function deleteTicket(id: number): Promise<void> {
  return unwrapOk(`/tickets/${id}`, { method: 'DELETE' });
}

// Invoices -----------------------------------------------------------------

export interface CreateInvoiceInput {
  propertyId: number;
  guestId: number;
  bookingId?: number | null;
  type: string;
  dueDate: string;
  discountAmount: number;
  notes: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number; category: string }>;
  createdBy: string;
}

export function createInvoice(input: CreateInvoiceInput): Promise<ApiInvoice> {
  return unwrap<ApiInvoice>('/invoices', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      guestId: input.guestId,
      bookingId: input.bookingId ?? null,
      type: input.type,
      dueDate: input.dueDate,
      discountAmount: input.discountAmount,
      notes: input.notes,
      items: input.items,
      createdBy: input.createdBy,
    },
  });
}

/** Adds a line item; only allowed on draft/sent invoices server-side. */
export function addInvoiceItem(
  id: number,
  item: { description: string; quantity: number; unitPrice: number; taxRate: number; category: string },
): Promise<ApiInvoice> {
  return unwrap<ApiInvoice>(`/invoices/${id}/items`, {
    method: 'POST',
    body: {
      invoiceId: id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      category: item.category,
    },
  });
}

/** Records a payment against an invoice; flips to paid when fully settled. */
export function recordInvoicePayment(
  id: number,
  amount: number,
  paymentMethod: string,
): Promise<ApiInvoice> {
  return unwrap<ApiInvoice>(`/invoices/${id}/payments`, {
    method: 'POST',
    body: { id, amount, paymentMethod },
  });
}

export function deleteInvoice(id: number): Promise<void> {
  return unwrapOk(`/invoices/${id}`, { method: 'DELETE' });
}

// Payments -----------------------------------------------------------------

export interface CreatePaymentInput {
  propertyId: number;
  guestId: number;
  invoiceId?: number | null;
  bookingId?: number | null;
  amount: number;
  method: string;
  processedBy: string;
}

export function createPayment(input: CreatePaymentInput): Promise<ApiPayment> {
  return unwrap<ApiPayment>('/payments', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      guestId: input.guestId,
      invoiceId: input.invoiceId ?? null,
      bookingId: input.bookingId ?? null,
      amount: input.amount,
      method: input.method,
      processedBy: input.processedBy,
    },
  });
}

/** transactionId travels as a raw [FromBody] string? */
export function completePayment(id: number, transactionId: string | null): Promise<ApiPayment> {
  return unwrap<ApiPayment>(`/payments/${id}/complete`, {
    method: 'POST',
    body: transactionId,
  });
}

/** One-way transition — no body. */
export function refundPayment(id: number): Promise<ApiPayment> {
  return unwrap<ApiPayment>(`/payments/${id}/refund`, { method: 'POST' });
}

export function createMaintenanceRequest(
  input: CreateMaintenanceInput,
): Promise<ApiMaintenanceRequest> {
  return unwrap<ApiMaintenanceRequest>('/maintenanceRequests', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      description: input.description,
      priority: input.priority,
      status: input.status,
    },
  });
}

/** Sparse update — controller overrides Id from the route (`command with { Id = id }`). */
export function updateMaintenanceRequest(
  id: number,
  input: UpdateMaintenanceInput,
): Promise<ApiMaintenanceRequest> {
  return unwrap<ApiMaintenanceRequest>(`/maintenanceRequests/${id}`, {
    method: 'PUT',
    body: {
      id,
      description: input.description ?? null,
      status: input.status ?? null,
      priority: input.priority ?? null,
    },
  });
}

export function deleteMaintenanceRequest(id: number): Promise<void> {
  return unwrapOk(`/maintenanceRequests/${id}`, { method: 'DELETE' });
}

// ---------- expenses ----------

// SubmittedBy is stamped by the controller from the JWT, not sent by the client.
export interface CreateExpenseInput {
  propertyId: number;
  category: string;
  amount: number;
  description: string;
  date: string;
  receiptUrl?: string;
  vendor?: string;
  paymentMethod?: string;
  notes?: string;
}

/** Sparse — null fields keep their current value server-side. */
export interface UpdateExpenseInput {
  category?: string;
  amount?: number;
  description?: string;
  date?: string;
  vendor?: string;
  notes?: string;
  receiptUrl?: string;
  paymentMethod?: string;
}

export function createExpense(input: CreateExpenseInput): Promise<ApiExpense> {
  return unwrap<ApiExpense>('/expenses', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      category: input.category,
      amount: input.amount,
      description: input.description,
      date: input.date,
      receiptUrl: input.receiptUrl ?? null,
      vendor: input.vendor ?? null,
      paymentMethod: input.paymentMethod ?? null,
      notes: input.notes ?? null,
    },
  });
}

export function updateExpense(id: number, input: UpdateExpenseInput): Promise<ApiExpense> {
  return unwrap<ApiExpense>(`/expenses/${id}`, {
    method: 'PUT',
    body: {
      id,
      category: input.category ?? null,
      amount: input.amount ?? null,
      description: input.description ?? null,
      date: input.date ?? null,
      vendor: input.vendor ?? null,
      notes: input.notes ?? null,
      receiptUrl: input.receiptUrl ?? null,
      paymentMethod: input.paymentMethod ?? null,
    },
  });
}

// Approval workflow — no request body; the actor comes from the JWT.
export function approveExpense(id: number): Promise<ApiExpense> {
  return unwrap<ApiExpense>(`/expenses/${id}/approve`, { method: 'POST' });
}

export function rejectExpense(id: number): Promise<ApiExpense> {
  return unwrap<ApiExpense>(`/expenses/${id}/reject`, { method: 'POST' });
}

export function deleteExpense(id: number): Promise<void> {
  return unwrapOk(`/expenses/${id}`, { method: 'DELETE' });
}

// ---------- inventory ----------

export interface CreateInventoryItemInput {
  propertyId: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  price: number;
  supplier: string;
  sku?: string;
  expiryDate?: string;
  minOrderQuantity?: number;
}

/** Sparse — null fields keep their current value. Quantity is NOT edited here; use adjust/restock. */
export interface UpdateInventoryItemInput {
  name?: string;
  category?: string;
  unit?: string;
  reorderLevel?: number;
  price?: number;
  supplier?: string;
  location?: string;
  notes?: string;
  sku?: string;
  expiryDate?: string;
  minOrderQuantity?: number;
}

export function createInventoryItem(input: CreateInventoryItemInput): Promise<ApiInventoryItem> {
  return unwrap<ApiInventoryItem>('/inventoryItems', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      unit: input.unit,
      reorderLevel: input.reorderLevel,
      price: input.price,
      supplier: input.supplier,
      sku: input.sku ?? null,
      expiryDate: input.expiryDate ?? null,
      minOrderQuantity: input.minOrderQuantity ?? null,
    },
  });
}

export function updateInventoryItem(id: number, input: UpdateInventoryItemInput): Promise<ApiInventoryItem> {
  return unwrap<ApiInventoryItem>(`/inventoryItems/${id}`, {
    method: 'PUT',
    body: {
      id,
      name: input.name ?? null,
      category: input.category ?? null,
      unit: input.unit ?? null,
      reorderLevel: input.reorderLevel ?? null,
      price: input.price ?? null,
      supplier: input.supplier ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      sku: input.sku ?? null,
      expiryDate: input.expiryDate ?? null,
      minOrderQuantity: input.minOrderQuantity ?? null,
    },
  });
}

// Signed delta — negative for usage, positive for corrections. Controller binds a record, not a bare int.
export function adjustInventoryQuantity(id: number, delta: number): Promise<ApiInventoryItem> {
  return unwrap<ApiInventoryItem>(`/inventoryItems/${id}/adjust`, {
    method: 'POST',
    body: { delta },
  });
}

// Delivery — bumps quantity AND stamps lastRestocked. Controller binds a record.
export function restockInventoryItem(id: number, quantityAdded: number): Promise<ApiInventoryItem> {
  return unwrap<ApiInventoryItem>(`/inventoryItems/${id}/restock`, {
    method: 'POST',
    body: { quantityAdded },
  });
}

export function deleteInventoryItem(id: number): Promise<void> {
  return unwrapOk(`/inventoryItems/${id}`, { method: 'DELETE' });
}

// ---------- shifts (roster) ----------

/** Bare GET lists every shift (optional propertyId/userId/date/status filters are omitted). */
export function fetchShifts(): Promise<ApiShift[]> {
  return unwrap<ApiShift[]>('/shifts');
}

export function createShift(input: CreateShiftInput): Promise<ApiShift> {
  return unwrap<ApiShift>('/shifts', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      userId: input.userId,
      userName: input.userName,
      startTime: input.startTime,
      endTime: input.endTime,
      role: input.role,
      department: input.department ?? null,
    },
  });
}

/** Break, overtime, notes, department — time, date, role, and staff edits have no endpoint. */
export function updateShift(id: number, input: UpdateShiftInput): Promise<ApiShift> {
  return unwrap<ApiShift>(`/shifts/${id}`, {
    method: 'PUT',
    body: {
      id,
      breakStart: input.breakStart ?? null,
      breakEnd: input.breakEnd ?? null,
      overtime: input.overtime ?? null,
      notes: input.notes ?? null,
      department: input.department ?? null,
    },
  });
}

/** scheduled | completed | cancelled | swapped — the handler validates the vocabulary. */
export function changeShiftStatus(id: number, status: string): Promise<ApiShift> {
  return unwrap<ApiShift>(`/shifts/${id}/status`, {
    method: 'PUT',
    body: { id, status },
  });
}

/** Reassigns the shift to another staff member by name (covers the swapped transition too). */
export function swapShift(id: number, newStaffName: string): Promise<ApiShift> {
  return unwrap<ApiShift>(`/shifts/${id}/swap`, {
    method: 'PUT',
    body: { id, newStaffName },
  });
}

export function deleteShift(id: number): Promise<void> {
  return unwrapOk(`/shifts/${id}`, { method: 'DELETE' });
}

// ---------- attendance ----------

/** Bare GET lists every record (optional propertyId/userId/date/status filters are omitted). */
export function fetchAttendance(): Promise<ApiAttendance[]> {
  return unwrap<ApiAttendance[]>('/attendance');
}

export function createAttendance(input: CreateAttendanceInput): Promise<ApiAttendance> {
  return unwrap<ApiAttendance>('/attendance', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      userId: input.userId,
      userName: input.userName,
      checkIn: input.checkIn,
      status: input.status ?? null,
      notes: input.notes ?? null,
    },
  });
}

/** Clock-out, status, notes — omitted/null fields keep their current value. */
export function updateAttendance(id: number, input: UpdateAttendanceInput): Promise<ApiAttendance> {
  return unwrap<ApiAttendance>(`/attendance/${id}`, {
    method: 'PUT',
    body: {
      id,
      checkOut: input.checkOut ?? null,
      status: input.status ?? null,
      notes: input.notes ?? null,
    },
  });
}

export function deleteAttendance(id: number): Promise<void> {
  return unwrapOk(`/attendance/${id}`, { method: 'DELETE' });
}

// ---------- electricity ----------

/** Bare GET lists every reading (optional propertyId/zone filters are omitted). */
export function fetchElectricity(): Promise<ApiElectricityRecord[]> {
  return unwrap<ApiElectricityRecord[]>('/electricity');
}

export function createElectricity(input: CreateElectricityInput): Promise<ApiElectricityRecord> {
  return unwrap<ApiElectricityRecord>('/electricity', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      date: input.date,
      consumption: input.consumption,
      cost: input.cost,
      peakDemand: input.peakDemand,
      zone: input.zone,
    },
  });
}

/** Omitted/null fields keep their current value. */
export function updateElectricity(id: number, input: UpdateElectricityInput): Promise<ApiElectricityRecord> {
  return unwrap<ApiElectricityRecord>(`/electricity/${id}`, {
    method: 'PUT',
    body: {
      id,
      date: input.date ?? null,
      consumption: input.consumption ?? null,
      cost: input.cost ?? null,
      peakDemand: input.peakDemand ?? null,
      zone: input.zone ?? null,
    },
  });
}

export function deleteElectricity(id: number): Promise<void> {
  return unwrapOk(`/electricity/${id}`, { method: 'DELETE' });
}

// ---------- integrations ----------

/** Bare GET lists every integration (optional propertyId/category/status filters are omitted). */
export function fetchIntegrations(): Promise<ApiIntegration[]> {
  return unwrap<ApiIntegration[]>('/integrations');
}

export function createIntegration(input: CreateIntegrationInput): Promise<ApiIntegration> {
  return unwrap<ApiIntegration>('/integrations', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      icon: input.icon ?? null,
      apiKey: input.apiKey ?? null,
      webhookUrl: input.webhookUrl ?? null,
    },
  });
}

/** Sparse — only non-null fields are sent; the handler keeps the rest. */
export function updateIntegration(id: number, input: UpdateIntegrationInput): Promise<ApiIntegration> {
  return unwrap<ApiIntegration>(`/integrations/${id}`, {
    method: 'PUT',
    body: {
      id,
      name: input.name ?? null,
      category: input.category ?? null,
      description: input.description ?? null,
      icon: input.icon ?? null,
      apiKey: input.apiKey ?? null,
      webhookUrl: input.webhookUrl ?? null,
    },
  });
}

/** Body-less POST — stamps LastSync and flips status to connected. */
export function syncIntegration(id: number): Promise<ApiIntegration> {
  return unwrap<ApiIntegration>(`/integrations/${id}/sync`, { method: 'POST' });
}

export function deleteIntegration(id: number): Promise<void> {
  return unwrapOk(`/integrations/${id}`, { method: 'DELETE' });
}

// ---------- messages (staff chat) ----------

/** Bare GET — optional propertyId/recipientId/channelId/unreadOnly filters are omitted. */
export function fetchMessages(): Promise<ApiMessage[]> {
  return unwrap<ApiMessage[]>('/messages');
}

export function createMessage(input: CreateMessageInput): Promise<ApiMessage> {
  return unwrap<ApiMessage>('/messages', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      content: input.content,
      type: input.type ?? null,
      channelId: input.channelId ?? null,
      attachments: input.attachments ?? null,
    },
  });
}

/** Body-less PUT — marks one message read and returns it. */
export function markMessageRead(id: number): Promise<ApiMessage> {
  return unwrap<ApiMessage>(`/messages/${id}/read`, { method: 'PUT' });
}

/** Admin/manager only — a 403 for staff is expected, not an error. */
export function deleteMessage(id: number): Promise<void> {
  return unwrapOk(`/messages/${id}`, { method: 'DELETE' });
}

// ---------- audit trail ----------

/** Bare GET — optional propertyId/entityType/entityId/userId/action filters are omitted. */
export function fetchAuditLogs(): Promise<ApiAuditLog[]> {
  return unwrap<ApiAuditLog[]>('/auditlogs');
}

/** Admin/manager only — write-once entry; there is no update or delete. */
export function createAuditLog(input: CreateAuditLogInput): Promise<ApiAuditLog> {
  return unwrap<ApiAuditLog>('/auditlogs', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityName: input.entityName,
      details: input.details,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
    },
  });
}

// ---------- tax configs ----------

/** Bare GET — optional propertyId/type/active filters are omitted. */
export function fetchTaxConfigs(): Promise<ApiTaxConfig[]> {
  return unwrap<ApiTaxConfig[]>('/taxconfigs');
}

/** Admin/manager only. */
export function createTaxConfig(input: CreateTaxConfigInput): Promise<ApiTaxConfig> {
  return unwrap<ApiTaxConfig>('/taxconfigs', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      name: input.name,
      rate: input.rate / 100,
      type: input.type,
      validFrom: input.validFrom,
      included: input.included,
      applicableTo: input.applicableTo,
    },
  });
}

/** Admin/manager only — sparse; only the fields the handler reads are sent. */
export function updateTaxConfig(id: number, input: UpdateTaxConfigInput): Promise<ApiTaxConfig> {
  return unwrap<ApiTaxConfig>(`/taxconfigs/${id}`, {
    method: 'PUT',
    body: {
      id,
      rate: input.rate !== undefined ? input.rate / 100 : null,
      included: input.included ?? null,
      active: input.active ?? null,
      validTo: input.validTo ?? null,
      applicableTo: input.applicableTo ?? null,
    },
  });
}

/** Admin/manager only — a 403 for staff is expected, not an error. */
export function deleteTaxConfig(id: number): Promise<void> {
  return unwrapOk(`/taxconfigs/${id}`, { method: 'DELETE' });
}

// ---------- AI layer (ai-insights, workflows, agents, chat) ----------

export function fetchAiInsights(propertyId?: number): Promise<ApiAiInsight[]> {
  const query = propertyId != null ? `?propertyId=${propertyId}` : '';
  return unwrap<ApiAiInsight[]>(`/aiInsights${query}`);
}

export function createAiInsight(input: CreateAiInsightInput): Promise<ApiAiInsight> {
  return unwrap<ApiAiInsight>('/aiInsights', {
    method: 'POST',
    body: {
      propertyId: input.propertyId ?? null,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      recommendation: input.recommendation ?? null,
      impact: input.impact,
    },
  });
}

/** Sparse update — null fields keep their current value server-side. */
export function updateAiInsight(id: number, input: UpdateAiInsightInput): Promise<ApiAiInsight> {
  return unwrap<ApiAiInsight>(`/aiInsights/${id}`, {
    method: 'PUT',
    body: {
      id,
      type: input.type ?? null,
      title: input.title ?? null,
      description: input.description ?? null,
      recommendation: input.recommendation ?? null,
      impact: input.impact ?? null,
      dismissed: input.dismissed ?? null,
    },
  });
}

export function deleteAiInsight(id: number): Promise<void> {
  return unwrapOk(`/aiInsights/${id}`, { method: 'DELETE' });
}

export function fetchWorkflows(): Promise<ApiWorkflow[]> {
  return unwrap<ApiWorkflow[]>('/workflows');
}

export function createWorkflow(input: CreateWorkflowInput): Promise<ApiWorkflow> {
  return unwrap<ApiWorkflow>('/workflows', {
    method: 'POST',
    body: {
      propertyId: input.propertyId ?? null,
      name: input.name,
      description: input.description ?? null,
      trigger: input.trigger,
      actions: input.actions,
      status: input.status ?? null,
      createdBy: input.createdBy ?? null,
    },
  });
}

/** Sparse update — null fields keep their current value server-side. */
export function updateWorkflow(id: number, input: UpdateWorkflowInput): Promise<ApiWorkflow> {
  return unwrap<ApiWorkflow>(`/workflows/${id}`, {
    method: 'PUT',
    body: {
      id,
      name: input.name ?? null,
      description: input.description ?? null,
      trigger: input.trigger ?? null,
      actions: input.actions ?? null,
      status: input.status ?? null,
    },
  });
}

export function deleteWorkflow(id: number): Promise<void> {
  return unwrapOk(`/workflows/${id}`, { method: 'DELETE' });
}

export function fetchAgents(): Promise<ApiAgent[]> {
  return unwrap<ApiAgent[]>('/agents');
}

/** running | paused | stopped — the controller validates the vocabulary. */
export function updateAgentStatus(id: number, status: string): Promise<ApiAgent> {
  return unwrap<ApiAgent>(`/agents/${id}/status`, {
    method: 'PATCH',
    body: { id, status },
  });
}

/** Manual run — answers with the refreshed agent card plus the insight it created. */
export function runAgent(id: number): Promise<ApiRunAgentResult> {
  return unwrap<ApiRunAgentResult>(`/agents/${id}/run`, { method: 'POST' });
}

/** Chat answer; `source` is "deterministic" unless the backend holds an AI key. */
export function sendChat(message: string): Promise<ApiChatResponse> {
  return unwrap<ApiChatResponse>('/chat', {
    method: 'POST',
    body: { message },
  });
}

// RFID tags ----------------------------------------------------------------

/** Exactly one binding per tag: userId for staff, bookingId for guest (handler enforces). */
export interface IssueRfidTagInput {
  propertyId: number;
  kind: 'guest' | 'staff';
  tagNumber: string;
  userId?: number | null;
  bookingId?: number | null;
  accessLevel?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}

export function issueRfidTag(input: IssueRfidTagInput): Promise<ApiRfidTag> {
  return unwrap<ApiRfidTag>('/rfidtags', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      kind: input.kind,
      tagNumber: input.tagNumber,
      userId: input.userId ?? null,
      bookingId: input.bookingId ?? null,
      accessLevel: input.accessLevel ?? null,
      expiresAt: input.expiresAt ?? null,
      notes: input.notes ?? null,
    },
  });
}

/** Blocks the tag so taps stop resolving; the row and its history stay for audit. */
export function revokeRfidTag(id: number, notes?: string | null): Promise<ApiRfidTag> {
  return unwrap<ApiRfidTag>(`/rfidtags/${id}/revoke`, {
    method: 'POST',
    body: { notes: notes ?? null },
  });
}

export function tapStaffTag(propertyId: number, tagNumber: string): Promise<ApiStaffTapResult> {
  return unwrap<ApiStaffTapResult>('/rfidtags/tap/staff', {
    method: 'POST',
    body: { propertyId, tagNumber },
  });
}

export function tapGuestTag(propertyId: number, tagNumber: string): Promise<ApiGuestTapContext> {
  return unwrap<ApiGuestTapContext>('/rfidtags/tap/guest', {
    method: 'POST',
    body: { propertyId, tagNumber },
  });
}
