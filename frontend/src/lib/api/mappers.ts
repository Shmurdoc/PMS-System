// ============================================
// API → STORE MAPPERS
// ============================================
// Pure DTO→frontend-contract translation. No I/O, no store imports beyond
// types. Rules:
//   - Every numeric PK becomes String(id) (frontend contract uses string ids).
//   - Dates: full ISO where the store expects a timestamp; date-only (yyyy-mm-dd)
//     where mock data uses plain dates.
//   - Unknown enum strings coerce to the frontend union via `oneOf` fallback.
//   - InvoiceItem.taxRate: backend stores a fraction (0.15), frontend treats it
//     as a percent (15) — converted here.
//
// DTO interfaces below mirror what System.Text.Json emits (camelCase, decimals
// as numbers, DateTime as ISO-8601 strings, nulls for nullable refs).

import type {
  AiInsight,
  AttendanceRecord,
  AuditLog,
  Booking,
  ElectricityRecord,
  Expense,
  Guest,
  Integration,
  InventoryItem,
  Invoice,
  MaintenanceTicket,
  Message,
  Payment,
  Property,
  RatePlan,
  Room,
  RfidTag,
  Shift,
  TaxConfig,
  Ticket,
  TicketComment,
  User,
  Workflow,
} from '../../store/useAppStore';

// ---------- DTO wire shapes ----------

export interface ApiUser {
  id: number;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  phone?: string | null;
  propertyId?: number | null;
  created: string;
  lastModified?: string | null;
}

export interface ApiGuest {
  id: number;
  propertyId: number;
  name: string;
  email: string;
  phone: string;
  idNumber: string;
  nationality: string;
  segment: string;
  totalStays: number;
  loyaltyPoints: number;
  preferences: string[];
  notes: string;
  address?: string | null;
  dateOfBirth?: string | null;
  passportNumber?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  allergies: string[];
  vipLevel?: string | null;
  companyName?: string | null;
  created: string;
}

export interface ApiBooking {
  id: number;
  propertyId: number;
  guestId: number;
  roomId: number;
  guestName?: string | null;
  roomNumber?: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  status: string;
  paymentStatus: string;
  amount: number;
  ratePerNight: number;
  depositPaid: number;
  source: string;
  specialRequests?: string | null;
  notes?: string | null;
  created: string;
}

export interface ApiProperty {
  id: number;
  propertyId: number;
  name: string;
  description?: string | null;
  status: string;
  address?: string | null;
  manager?: string | null;
  rating: number;
  phone?: string | null;
  email?: string | null;
  created: string;
  lastModified: string;
}

export interface ApiRoomOccupant {
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
}

export interface ApiRoom {
  id: number;
  number: string;
  propertyId: number;
  type: string;
  bedType?: string | null;
  view?: string | null;
  status: string;
  price: number;
  maxOccupancy: number;
  size?: number | null;
  floor: number;
  description?: string | null;
  image?: string | null;
  amenities: string[];
  lastCleaned?: string | null;
  lastInspected?: string | null;
  occupant?: ApiRoomOccupant | null;
}

export interface ApiMaintenanceRequest {
  id: number;
  propertyId: number;
  description: string;
  status: string;
  priority: string;
  created: string;
  lastModified: string;
}

export interface ApiTicketComment {
  id: number;
  ticketId: number;
  userId: number;
  userName: string;
  content: string;
  isInternal: boolean;
  created: string;
}

export interface ApiTicket {
  id: number;
  ticketNumber: string;
  title: string;
  description: string;
  type: string;
  category: string;
  priority: string;
  status: string;
  assigneeId?: number | null;
  assigneeName?: string | null;
  reporterId?: number | null;
  reporterName?: string | null;
  propertyId: number;
  roomId?: number | null;
  guestId?: number | null;
  guestName?: string | null;
  dueDate?: string | null;
  tags: string[];
  comments: ApiTicketComment[];
  created: string;
  lastModified?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
}

export interface ApiInvoiceItem {
  id: number;
  invoiceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
  category: string;
}

export interface ApiInvoice {
  id: number;
  invoiceNumber: string;
  type: string;
  bookingId?: number | null;
  guestId: number;
  guestName?: string | null;
  propertyId: number;
  items: ApiInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: string;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string | null;
  paidAmount: number;
  paymentMethod?: string | null;
  notes?: string | null;
  createdBy: string;
}

export interface ApiPayment {
  id: number;
  paymentNumber: string;
  invoiceId?: number | null;
  bookingId?: number | null;
  guestId: number;
  guestName?: string | null;
  propertyId: number;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference?: string | null;
  transactionId?: string | null;
  processedBy: string;
  processedAt?: string | null;
  created: string;
}

export interface ApiRatePlan {
  id: number;
  propertyId: number;
  name: string;
  roomTypes: string[];
  baseRate: number;
  season: string;
  minStay: number;
  active: boolean;
  restrictions: string[];
  created: string;
  lastModified: string;
}

export interface ApiExpense {
  id: number;
  propertyId: number;
  category: string;
  amount: number;
  description: string;
  date: string;
  status: string;
  submittedBy: string;
  receiptUrl?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  vendor?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  created: string;
  lastModified: string;
}

export interface ApiInventoryItem {
  id: number;
  propertyId: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  price: number;
  supplier: string;
  sku?: string | null;
  lastRestocked?: string | null;
  expiryDate?: string | null;
  location?: string | null;
  minOrderQuantity?: number | null;
  notes?: string | null;
  needsReorder: boolean;
  created: string;
  lastModified: string;
}

/** `POST /auth/login` payload: LoginResponseDto { Token, User }. */
export interface ApiLoginResponse {
  token: string;
  user: ApiUser;
}

// ---------- AI layer wire shapes ----------

export interface ApiAiInsight {
  id: number;
  propertyId: number | null;
  type: string;
  title: string;
  description: string;
  recommendation: string;
  impact: string;
  /** null = not acted on, false = acknowledged, true = dismissed. */
  dismissed: boolean | null;
  createdAt: string;
}

export interface ApiWorkflow {
  id: number;
  propertyId: number | null;
  name: string;
  description: string | null;
  trigger: string;
  actions: string[];
  status: string;
  lastRun: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ApiAgentLog {
  time: string;
  message: string;
}

export interface ApiAgent {
  id: number;
  key: string;
  name: string;
  description: string;
  status: string;
  lastRun: string | null;
  totalRuns: number;
  logs: ApiAgentLog[];
}

/** `POST /agents/{id}/run` payload: RunAgentResultDto { Agent, Insight }. */
export interface ApiRunAgentResult {
  agent: ApiAgent;
  insight: ApiAiInsight;
}

/** `POST /chat` payload: ChatResponse { Reply, Source, Intent }. */
export interface ApiChatResponse {
  reply: string;
  source: string;
  intent?: string | null;
}

// ---------- supporting-entity DTOs (Slice 5) ----------

export interface ApiShift {
  id: number;
  propertyId: number;
  userId: number;
  userName: string;
  startTime: string;
  endTime: string;
  date: string;
  role: string;
  status: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  overtime?: number | null;
  notes?: string | null;
  swappedWith?: string | null;
  department?: string | null;
  created: string;
  lastModified: string;
}

export interface ApiAttendance {
  id: number;
  propertyId: number;
  userId: number;
  userName: string;
  checkIn: string;
  checkOut?: string | null;
  date: string;
  status: string;
  hoursWorked?: number | null;
  overtime?: number | null;
  notes?: string | null;
  created: string;
  lastModified: string;
}

export interface ApiMessage {
  id: number;
  propertyId: number;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
  avatar?: string | null;
  channelId?: string | null;
  attachments: string[];
  type: string;
  recipientId?: number | null;
}

export interface ApiAuditLog {
  id: number;
  propertyId: number;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  userId: number;
  userName: string;
  userRole: string;
  details: string;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  timestamp: string;
}

export interface ApiTaxConfig {
  id: number;
  propertyId: number;
  name: string;
  /** Fraction, e.g. 0.15 for 15% VAT. */
  rate: number;
  type: string;
  included: boolean;
  applicableTo: string[];
  validFrom: string;
  validTo?: string | null;
  active: boolean;
  created: string;
  lastModified: string;
}

export interface ApiRfidTag {
  id: number;
  propertyId: number;
  kind: string;
  tagNumber: string;
  status: string;
  userId?: number | null;
  userName?: string | null;
  bookingId?: number | null;
  guestName?: string | null;
  roomNumber?: string | null;
  accessLevel: string;
  expiresAt?: string | null;
  lastUsed?: string | null;
  notes?: string | null;
  created: string;
  lastModified: string;
}

export interface ApiElectricityRecord {
  id: number;
  propertyId: number;
  date: string;
  consumption: number;
  cost: number;
  peakDemand: number;
  zone: string;
  created: string;
  lastModified: string;
}

export interface ApiIntegration {
  id: number;
  propertyId: number;
  name: string;
  category: string;
  status: string;
  lastSync?: string | null;
  icon?: string | null;
  description: string;
  apiKey?: string | null;
  webhookUrl?: string | null;
  configuredBy?: string | null;
  configuredAt?: string | null;
  created: string;
  lastModified: string;
}

// Tap responses — the store folds these over local rows; they never become rows themselves.
export interface ApiStaffTapResult {
  punch: string;
  attendanceId: number;
  userId: number;
  userName: string;
  tagNumber: string;
  checkIn: string;
  checkOut?: string | null;
}

export interface ApiGuestTapContext {
  tagId: number;
  tagNumber: string;
  accessLevel: string;
  expiresAt?: string | null;
  bookingId: number;
  guestId: number;
  guestName: string;
  roomId: number;
  roomNumber: string;
  bookingStatus: string;
  checkIn: string;
  checkOut: string;
}

// ---------- join contexts (built by hydrate from raw DTO lists) ----------

export interface BookingJoinContext {
  guestById: Map<string, ApiGuest>;
  /** Keyed by BOTH String(property.id) and String(property.propertyId) — the
   *  Booking.PropertyId FK is ambiguous between the two; either resolves. */
  propertyNameById: Map<string, string>;
  roomById: Map<string, ApiRoom>;
}

export interface InvoiceJoinContext {
  guestEmailById: Map<string, string>;
}

// ---------- frontend-only shapes (agents have no store model) ----------

export interface AgentLogEntry {
  time: string;
  message: string;
}

/** Agent card as the AI page tracks it — kept component-local, mapped here next to the DTOs it comes from. */
export interface AgentCard {
  id: string;
  key: string;
  name: string;
  description: string;
  status: 'running' | 'paused' | 'stopped';
  lastRun?: string;
  totalRuns: number;
  logs: AgentLogEntry[];
}

// ---------- helpers ----------

const dateOnly = (iso?: string | null): string => (iso ? iso.slice(0, 10) : '');

/** Full ISO timestamp → 'HH:MM' — the store keeps shift times as clock times. */
const timeOfDay = (iso?: string | null): string => (iso ? iso.slice(11, 16) : '');

const num = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number(value ?? 0);

/** Case/separator-insensitive lookup of a union member; falls back if unknown. */
function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const found = allowed.find((candidate) => candidate.toLowerCase().replace(/-/g, '_') === normalized);
  return found ?? fallback;
}

function oneOfOptional<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | undefined {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return allowed.find((candidate) => candidate.toLowerCase().replace(/-/g, '_') === normalized);
}

/** Backend stores tax as a fraction (0.15); the frontend renders it as a percent (15). */
const taxRateAsPercent = (rate: number): number => {
  const value = num(rate);
  return value > 0 && value <= 1 ? Math.round(value * 10000) / 100 : value;
};

const mapPropertyStatus = (value: string | null | undefined): Property['status'] => {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'active' || v === 'operational' || v === 'open') return 'operational';
  if (v === 'maintenance' || v === 'renovation') return 'maintenance';
  if (v === 'closed' || v === 'inactive' || v === 'retired') return 'closed';
  return oneOf(value, ['operational', 'maintenance', 'closed'] as const, 'operational');
};

/** Generic id-keyed index for building join contexts. */
export function indexBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) map.set(key(item), item);
  return map;
}

// ---------- mappers ----------

export function mapUser(dto: ApiUser): User {
  return {
    id: String(dto.id),
    name: dto.name,
    email: dto.email,
    role: dto.role,
    department: dto.department ?? '',
    phone: dto.phone ?? '',
    propertyId: dto.propertyId != null ? String(dto.propertyId) : null,
    hireDate: dateOnly(dto.created),
    status: 'active',
  };
}

export function mapGuest(dto: ApiGuest): Guest {
  return {
    id: String(dto.id),
    propertyId: String(dto.propertyId),
    name: dto.name,
    email: dto.email,
    phone: dto.phone,
    idNumber: dto.idNumber,
    nationality: dto.nationality,
    segment: oneOf(dto.segment, ['VIP', 'Frequent', 'New', 'Corporate'] as const, 'New'),
    totalStays: dto.totalStays,
    loyaltyPoints: dto.loyaltyPoints,
    preferences: dto.preferences ?? [],
    notes: dto.notes,
    createdAt: dateOnly(dto.created),
    lastVisit: dateOnly(dto.created),
    address: dto.address ?? undefined,
    dateOfBirth: dateOnly(dto.dateOfBirth) || undefined,
    passportNumber: dto.passportNumber ?? undefined,
    emergencyContact: dto.emergencyContact ?? undefined,
    emergencyPhone: dto.emergencyPhone ?? undefined,
    allergies: dto.allergies ?? [],
    vipLevel: oneOfOptional(dto.vipLevel, ['standard', 'gold', 'platinum', 'diamond'] as const),
    companyName: dto.companyName ?? undefined,
  };
}

export function mapProperty(
  dto: ApiProperty,
  stats?: { totalRooms: number; occupiedRooms: number },
): Property {
  return {
    id: String(dto.id),
    propertyId: String(dto.propertyId),
    name: dto.name,
    address: dto.address ?? '',
    totalRooms: stats?.totalRooms ?? 0,
    occupiedRooms: stats?.occupiedRooms ?? 0,
    rating: dto.rating,
    image: '',
    status: mapPropertyStatus(dto.status),
    phone: dto.phone ?? undefined,
    email: dto.email ?? undefined,
    manager: dto.manager ?? undefined,
    description: dto.description ?? undefined,
  };
}

export function mapRoom(dto: ApiRoom): Room {
  return {
    id: String(dto.id),
    propertyId: String(dto.propertyId),
    number: dto.number,
    type: dto.type,
    floor: dto.floor,
    status: oneOf(dto.status, ['available', 'occupied', 'maintenance', 'cleaning', 'reserved'] as const, 'available'),
    price: num(dto.price),
    description: dto.description ?? '',
    amenities: dto.amenities ?? [],
    image: dto.image ?? '',
    maxOccupancy: dto.maxOccupancy,
    lastCleaned: dto.lastCleaned ?? undefined,
    lastInspected: dto.lastInspected ?? undefined,
    bedType: dto.bedType ?? undefined,
    size: dto.size ?? undefined,
    view: dto.view ?? undefined,
  };
}

export function mapMaintenanceRequest(dto: ApiMaintenanceRequest): MaintenanceTicket {
  return {
    id: String(dto.id),
    title: dto.description,
    description: dto.description,
    priority: oneOf(dto.priority, ['low', 'medium', 'high', 'urgent'] as const, 'medium'),
    status: oneOf(dto.status, ['pending', 'in_progress', 'completed', 'scheduled'] as const, 'pending'),
    propertyId: String(dto.propertyId),
    createdAt: dto.created,
    completedAt: oneOf(dto.status, ['pending', 'in_progress', 'completed', 'scheduled'] as const, 'pending') ===
      'completed'
      ? dto.lastModified
      : undefined,
  };
}

export function mapBooking(dto: ApiBooking, ctx?: BookingJoinContext): Booking {
  const guest = ctx?.guestById.get(String(dto.guestId));
  const room = ctx?.roomById.get(String(dto.roomId));
  const amount = num(dto.amount);
  const deposit = num(dto.depositPaid);
  return {
    id: String(dto.id),
    guestId: String(dto.guestId),
    guestName: dto.guestName ?? guest?.name ?? '',
    guestEmail: guest?.email ?? '',
    guestPhone: guest?.phone ?? '',
    guestSegment: guest?.segment ?? '',
    propertyId: String(dto.propertyId),
    propertyName: ctx?.propertyNameById.get(String(dto.propertyId)) ?? '',
    roomId: String(dto.roomId),
    roomNumber: dto.roomNumber ?? room?.number ?? '',
    roomType: room?.type ?? '',
    checkIn: dateOnly(dto.checkIn),
    checkOut: dateOnly(dto.checkOut),
    nights: dto.nights,
    guests: dto.guests,
    status: oneOf(dto.status, ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no-show'] as const, 'pending'),
    paymentStatus: oneOf(dto.paymentStatus, ['pending', 'partial', 'paid', 'refunded'] as const, 'pending'),
    amount,
    ratePerNight: num(dto.ratePerNight),
    depositPaid: deposit,
    balanceDue: amount - deposit,
    source: dto.source,
    specialRequests: dto.specialRequests ?? undefined,
    notes: dto.notes ?? undefined,
    createdAt: dateOnly(dto.created),
  };
}

export function mapTicketComment(dto: ApiTicketComment): TicketComment {
  return {
    id: String(dto.id),
    ticketId: String(dto.ticketId),
    userId: String(dto.userId),
    userName: dto.userName,
    content: dto.content,
    isInternal: dto.isInternal,
    createdAt: dto.created,
  };
}

export function mapTicket(dto: ApiTicket): Ticket {
  return {
    id: String(dto.id),
    ticketNumber: dto.ticketNumber,
    title: dto.title,
    description: dto.description,
    type: oneOf(dto.type, ['issue', 'task', 'request', 'incident'] as const, 'issue'),
    category: oneOf(
      dto.category,
      ['front_desk', 'housekeeping', 'maintenance', 'food_beverage', 'security', 'it', 'guest_service', 'other'] as const,
      'other',
    ),
    priority: oneOf(dto.priority, ['low', 'medium', 'high', 'urgent', 'critical'] as const, 'medium'),
    status: oneOf(dto.status, ['open', 'in_progress', 'pending', 'resolved', 'closed', 'cancelled'] as const, 'open'),
    assigneeId: dto.assigneeId != null ? String(dto.assigneeId) : undefined,
    assigneeName: dto.assigneeName ?? undefined,
    reporterId: dto.reporterId != null ? String(dto.reporterId) : undefined,
    reporterName: dto.reporterName ?? undefined,
    propertyId: String(dto.propertyId),
    roomId: dto.roomId != null ? String(dto.roomId) : undefined,
    guestId: dto.guestId != null ? String(dto.guestId) : undefined,
    guestName: dto.guestName ?? undefined,
    dueDate: dto.dueDate ?? undefined,
    tags: [...(dto.tags ?? [])],
    attachments: [],
    comments: (dto.comments ?? []).map(mapTicketComment),
    createdAt: dto.created,
    updatedAt: dto.lastModified ?? dto.created,
    resolvedAt: dto.resolvedAt ?? undefined,
    closedAt: dto.closedAt ?? undefined,
  };
}

export function mapInvoice(dto: ApiInvoice, ctx?: InvoiceJoinContext): Invoice {
  return {
    id: String(dto.id),
    invoiceNumber: dto.invoiceNumber,
    type: oneOf(dto.type, ['booking', 'service', 'advance', 'final'] as const, 'booking'),
    bookingId: dto.bookingId != null ? String(dto.bookingId) : undefined,
    guestId: String(dto.guestId),
    guestName: dto.guestName ?? '',
    guestEmail: ctx?.guestEmailById.get(String(dto.guestId)) ?? '',
    propertyId: String(dto.propertyId),
    items: (dto.items ?? []).map((item) => ({
      id: String(item.id),
      description: item.description,
      quantity: item.quantity,
      unitPrice: num(item.unitPrice),
      taxRate: taxRateAsPercent(item.taxRate),
      amount: num(item.amount),
      category: item.category,
    })),
    subtotal: num(dto.subtotal),
    taxAmount: num(dto.taxAmount),
    discountAmount: num(dto.discountAmount),
    total: num(dto.total),
    currency: dto.currency,
    status: oneOf(
      dto.status,
      ['draft', 'pending', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'refunded'] as const,
      'pending',
    ),
    issueDate: dateOnly(dto.issueDate),
    dueDate: dateOnly(dto.dueDate),
    paidDate: dateOnly(dto.paidDate) || undefined,
    paidAmount: num(dto.paidAmount),
    paymentMethod: dto.paymentMethod ?? undefined,
    notes: dto.notes ?? undefined,
    createdAt: dto.issueDate,
    createdBy: dto.createdBy,
  };
}

export function mapPayment(dto: ApiPayment): Payment {
  return {
    id: String(dto.id),
    paymentNumber: dto.paymentNumber,
    invoiceId: dto.invoiceId != null ? String(dto.invoiceId) : undefined,
    bookingId: dto.bookingId != null ? String(dto.bookingId) : undefined,
    guestId: String(dto.guestId),
    guestName: dto.guestName ?? '',
    propertyId: String(dto.propertyId),
    amount: num(dto.amount),
    currency: dto.currency,
    method: oneOf(dto.method, ['cash', 'card', 'eft', 'wire_transfer', 'mobile_money', 'voucher'] as const, 'cash'),
    status: oneOf(dto.status, ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'] as const, 'pending'),
    reference: dto.reference ?? undefined,
    transactionId: dto.transactionId ?? undefined,
    processedBy: dto.processedBy,
    processedAt: dto.processedAt ?? undefined,
    createdAt: dto.created,
  };
}

export function mapRatePlan(dto: ApiRatePlan): RatePlan {
  return {
    id: String(dto.id),
    name: dto.name,
    roomTypes: [...(dto.roomTypes ?? [])],
    baseRate: num(dto.baseRate),
    season: dto.season,
    minStay: dto.minStay,
    active: dto.active,
    restrictions: [...(dto.restrictions ?? [])],
  };
}

export function mapExpense(dto: ApiExpense): Expense {
  return {
    id: String(dto.id),
    category: dto.category,
    amount: num(dto.amount),
    description: dto.description,
    date: dateOnly(dto.date),
    status: oneOf(dto.status, ['pending', 'approved', 'rejected'] as const, 'pending'),
    submittedBy: dto.submittedBy,
    receiptUrl: dto.receiptUrl ?? undefined,
    approvedBy: dto.approvedBy ?? undefined,
    approvedAt: dto.approvedAt ?? undefined,
    propertyId: dto.propertyId != null ? String(dto.propertyId) : undefined,
    vendor: dto.vendor ?? undefined,
    paymentMethod: dto.paymentMethod ?? undefined,
    notes: dto.notes ?? undefined,
  };
}

export function mapInventoryItem(dto: ApiInventoryItem): InventoryItem {
  return {
    id: String(dto.id),
    name: dto.name,
    category: dto.category,
    quantity: num(dto.quantity),
    unit: dto.unit,
    reorderLevel: num(dto.reorderLevel),
    price: num(dto.price),
    supplier: dto.supplier,
    sku: dto.sku ?? undefined,
    lastRestocked: dto.lastRestocked ?? undefined,
    expiryDate: dto.expiryDate ?? undefined,
    location: dto.location ?? undefined,
    minOrderQuantity: dto.minOrderQuantity ?? undefined,
    notes: dto.notes ?? undefined,
  };
}

export function mapAiInsight(dto: ApiAiInsight): AiInsight {
  return {
    id: String(dto.id),
    type: oneOf(
      dto.type,
      ['revenue', 'occupancy', 'staffing', 'maintenance', 'guest', 'operational'] as const,
      'revenue',
    ),
    title: dto.title,
    description: dto.description,
    recommendation: dto.recommendation,
    impact: oneOf(dto.impact, ['high', 'medium', 'low'] as const, 'medium'),
    timestamp: dto.createdAt,
    // Tri-state: null = not acted on (key absent), false = acknowledged, true = dismissed.
    dismissed: dto.dismissed ?? undefined,
  };
}

export function mapWorkflow(dto: ApiWorkflow): Workflow {
  return {
    id: String(dto.id),
    name: dto.name,
    trigger: dto.trigger,
    actions: [...(dto.actions ?? [])],
    status: oneOf(dto.status, ['active', 'inactive'] as const, 'active'),
    lastRun: dto.lastRun ?? undefined,
    description: dto.description ?? undefined,
    createdBy: dto.createdBy ?? undefined,
    createdAt: dto.createdAt,
  };
}

export function mapShift(dto: ApiShift): Shift {
  return {
    id: String(dto.id),
    userId: String(dto.userId),
    userName: dto.userName,
    startTime: timeOfDay(dto.startTime),
    endTime: timeOfDay(dto.endTime),
    date: dateOnly(dto.date),
    role: dto.role,
    status: oneOf(dto.status, ['scheduled', 'completed', 'cancelled', 'swapped'] as const, 'scheduled'),
    breakStart: dto.breakStart ? timeOfDay(dto.breakStart) : undefined,
    breakEnd: dto.breakEnd ? timeOfDay(dto.breakEnd) : undefined,
    overtime: dto.overtime ?? undefined,
    notes: dto.notes ?? undefined,
    swappedWith: dto.swappedWith ?? undefined,
    department: dto.department ?? undefined,
  };
}

export function mapAttendance(dto: ApiAttendance): AttendanceRecord {
  return {
    id: String(dto.id),
    userId: String(dto.userId),
    userName: dto.userName,
    checkIn: dto.checkIn,
    checkOut: dto.checkOut ?? undefined,
    date: dateOnly(dto.date),
    status: oneOf(dto.status, ['present', 'late', 'absent', 'on_leave'] as const, 'present'),
    hoursWorked: dto.hoursWorked ?? undefined,
    overtime: dto.overtime ?? undefined,
    notes: dto.notes ?? undefined,
  };
}

export function mapRfidTag(dto: ApiRfidTag): RfidTag {
  return {
    id: String(dto.id),
    propertyId: String(dto.propertyId),
    kind: oneOf(dto.kind, ['guest', 'staff'] as const, 'guest'),
    tagNumber: dto.tagNumber,
    status: oneOf(dto.status, ['active', 'inactive', 'lost', 'blocked'] as const, 'active'),
    userId: dto.userId != null ? String(dto.userId) : undefined,
    userName: dto.userName ?? undefined,
    bookingId: dto.bookingId != null ? String(dto.bookingId) : undefined,
    guestName: dto.guestName ?? undefined,
    roomNumber: dto.roomNumber ?? undefined,
    accessLevel: dto.accessLevel,
    expiresAt: dto.expiresAt ?? undefined,
    lastUsed: dto.lastUsed ?? undefined,
    notes: dto.notes ?? undefined,
    createdAt: dto.created,
  };
}

export function mapMessage(dto: ApiMessage): Message {
  return {
    id: String(dto.id),
    senderId: String(dto.senderId),
    senderName: dto.senderName,
    content: dto.content,
    timestamp: dto.timestamp,
    read: dto.read,
    avatar: dto.avatar ?? undefined,
    channelId: dto.channelId ?? undefined,
    attachments: dto.attachments,
    type: oneOf(dto.type, ['text', 'system', 'alert'] as const, 'text'),
  };
}

export function mapAuditLog(dto: ApiAuditLog): AuditLog {
  return {
    id: String(dto.id),
    action: dto.action,
    entityType: oneOf(dto.entityType, [
      'booking', 'guest', 'room', 'invoice', 'payment', 'ticket', 'user',
      'property', 'expense', 'inventory', 'workflow', 'rfid_tag', 'rate_plan',
    ] as const, 'booking'),
    entityId: dto.entityId,
    entityName: dto.entityName,
    userId: String(dto.userId),
    userName: dto.userName,
    userRole: dto.userRole,
    details: dto.details,
    oldValue: dto.oldValue ?? undefined,
    newValue: dto.newValue ?? undefined,
    ipAddress: dto.ipAddress ?? undefined,
    timestamp: dto.timestamp,
  };
}

export function mapTaxConfig(dto: ApiTaxConfig): TaxConfig {
  return {
    id: String(dto.id),
    name: dto.name,
    rate: taxRateAsPercent(dto.rate),
    type: oneOf(dto.type, [
      'vat', 'sales_tax', 'tourism_levy', 'city_tax', 'service_charge',
    ] as const, 'vat'),
    included: dto.included,
    applicableTo: dto.applicableTo ?? [],
    validFrom: dateOnly(dto.validFrom),
    validTo: dto.validTo ?? undefined,
    active: dto.active,
  };
}

export function mapAgentLog(dto: ApiAgentLog): AgentLogEntry {
  return { time: dto.time, message: dto.message };
}

export function mapAgent(dto: ApiAgent): AgentCard {
  return {
    id: String(dto.id),
    key: dto.key,
    name: dto.name,
    description: dto.description,
    status: oneOf(dto.status, ['running', 'paused', 'stopped'] as const, 'paused'),
    lastRun: dto.lastRun ?? undefined,
    totalRuns: dto.totalRuns,
    logs: (dto.logs ?? []).map(mapAgentLog),
  };
}

export function mapElectricity(dto: ApiElectricityRecord): ElectricityRecord {
  return {
    id: String(dto.id),
    date: dateOnly(dto.date),
    consumption: num(dto.consumption),
    cost: num(dto.cost),
    peakDemand: num(dto.peakDemand),
    zone: dto.zone,
  };
}

export function mapIntegration(dto: ApiIntegration): Integration {
  return {
    id: String(dto.id),
    name: dto.name,
    category: dto.category,
    status: oneOf(dto.status, ['connected', 'disconnected', 'error', 'syncing'] as const, 'disconnected'),
    lastSync: dto.lastSync ?? '',
    icon: dto.icon ?? '',
    description: dto.description,
    apiKey: dto.apiKey ?? undefined,
    webhookUrl: dto.webhookUrl ?? undefined,
    configuredBy: dto.configuredBy ?? undefined,
    configuredAt: dto.configuredAt ?? undefined,
  };
}
