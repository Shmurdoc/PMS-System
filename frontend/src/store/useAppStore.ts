import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import { getAuthToken } from '../lib/api/config';
import {
  addTicketComment as apiAddTicketComment,
  adjustInventoryQuantity,
  approveExpense,
  assignTicket,
  changeBookingStatus,
  changeShiftStatus,
  changeTicketStatus,
  completePayment,
  createAiInsight,
  createAttendance,
  createAuditLog,
  createBooking,
  createElectricity,
  createExpense,
  createGuest,
  createIntegration,
  createInventoryItem,
  createInvoice,
  createMaintenanceRequest,
  createMessage,
  createPayment,
  createProperty,
  createRatePlan,
  createRoom,
  createShift,
  createTaxConfig,
  createTicket,
  createUser,
  createWorkflow,
  deleteAiInsight as apiDeleteAiInsight,
  deleteAttendance as apiDeleteAttendance,
  deleteBooking as apiDeleteBooking,
  deleteElectricity as apiDeleteElectricity,
  deleteExpense,
  deleteGuest as apiDeleteGuest,
  deleteIntegration as apiDeleteIntegration,
  deleteInventoryItem,
  deleteInvoice as apiDeleteInvoice,
  deleteMaintenanceRequest as apiDeleteMaintenanceRequest,
  deleteMessage as apiDeleteMessage,
  deleteProperty as apiDeleteProperty,
  deleteRatePlan as apiDeleteRatePlan,
  deleteRoom as apiDeleteRoom,
  deleteShift as apiDeleteShift,
  deleteTaxConfig as apiDeleteTaxConfig,
  deleteTicket as apiDeleteTicket,
  deleteUser as apiDeleteUser,
  deleteWorkflow as apiDeleteWorkflow,
  issueRfidTag,
  markMessageRead as apiMarkMessageRead,
  recordBookingDeposit,
  recordInvoicePayment,
  refundPayment,
  rejectExpense,
  revokeRfidTag as apiRevokeRfidTag,
  restockInventoryItem,
  swapShift,
  syncIntegration as apiSyncIntegration,
  tapGuestTag,
  tapStaffTag,
  updateAiInsight as apiUpdateAiInsight,
  updateAttendance as apiUpdateAttendance,
  updateElectricity as apiUpdateElectricity,
  updateExpense,
  updateGuest as apiUpdateGuest,
  updateIntegration as apiUpdateIntegration,
  updateInventoryItem,
  updateMaintenanceRequest,
  updatePropertyDetails,
  updatePropertyStatus,
  updateRatePlan as apiUpdateRatePlan,
  updateRoomAmenities,
  updateRoomMaxOccupancy,
  updateRoomPrice,
  updateRoomStatus,
  updateRoomView,
  updateShift as apiUpdateShift,
  updateTaxConfig as apiUpdateTaxConfig,
  updateUser as apiUpdateUser,
  updateWorkflow as apiUpdateWorkflow,
} from '../lib/api/services';
import type {
  CreateAiInsightInput,
  CreateAttendanceInput,
  CreateAuditLogInput,
  CreateBookingInput,
  CreateElectricityInput,
  CreateExpenseInput,
  CreateGuestInput,
  CreateIntegrationInput,
  CreateInventoryItemInput,
  CreateInvoiceInput,
  CreateMessageInput,
  CreatePaymentInput,
  CreatePropertyInput,
  CreateRatePlanInput,
  CreateRoomInput,
  CreateShiftInput,
  CreateTaxConfigInput,
  CreateTicketInput,
  CreateUserInput,
  CreateWorkflowInput,
  IssueRfidTagInput,
  UpdateAiInsightInput,
  UpdateAttendanceInput,
  UpdateElectricityInput,
  UpdateExpenseInput,
  UpdateGuestInput,
  UpdateIntegrationInput,
  UpdateInventoryItemInput,
  UpdateMaintenanceInput,
  UpdateRatePlanInput,
  UpdateShiftInput,
  UpdateTaxConfigInput,
  UpdateUserInput,
  UpdateWorkflowInput,
} from '../lib/api/services';
import { mapInvoice } from '../lib/api/mappers';
import type {
  ApiAiInsight,
  ApiAttendance,
  ApiBooking,
  ApiElectricityRecord,
  ApiExpense,
  ApiGuest,
  ApiIntegration,
  ApiInventoryItem,
  ApiInvoice,
  ApiMessage,
  ApiPayment,
  ApiProperty,
  ApiRatePlan,
  ApiRfidTag,
  ApiRoom,
  ApiShift,
  ApiStaffTapResult,
  ApiTaxConfig,
  ApiTicket,
  ApiUser,
  ApiWorkflow,
} from '../lib/api/mappers';

// Store ids are strings; backend ids are ints. Non-numeric ids (mock/demo) never hit the network.
function toNumericId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// New properties need a unique, positive tenant PropertyId (the API field is an
// int and enforces uniqueness). Date.now() overflows Int32 (~1.76e12 > 2.147e9)
// and is rejected with a 400, so seed from epoch-seconds (fits Int32 until 2038)
// and hand out successive values within the session.
let tenantPropertyIdSeed = Math.floor(Date.now() / 1000);
function nextPropertyTenantId(): number {
  return tenantPropertyIdSeed++;
}

// Backend AppRoles vocabulary. Free-form display titles ('General Manager')
// and snake_case values ('front_desk') both arrive from the UI — normalise
// before sending so CreateUser/UpdateUser validation never rejects the role.
const APP_ROLES = new Set(['admin', 'manager', 'front_desk', 'housekeeping', 'maintenance', 'auditor']);

function normalizeAppRole(role: string): string {
  const snake = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (APP_ROLES.has(snake)) return snake;
  if (snake.includes('admin')) return 'admin';
  if (snake.includes('housekeep')) return 'housekeeping';
  if (snake.includes('maintenance') || snake.includes('security')) return 'maintenance';
  if (snake.includes('front') || snake.includes('desk') || snake.includes('concierge')) return 'front_desk';
  if (snake.includes('audit')) return 'auditor';
  if (snake.includes('manager') || snake.includes('chef') || snake.includes('finance')) return 'manager';
  return 'front_desk';
}

// Local-first sync: state is already updated; fire-and-forget the API call (demo sessions with no token skip it).
// onOk, when given, receives the response — creates use it to swap the local id for the server's.
// onErr, when given, handles the failure itself (custom message); without it the store shows a generic toast.
function syncToApi(label: string, task: () => Promise<unknown>, onOk?: (data: unknown) => void, onErr?: (error: unknown) => void): void {
  if (!getAuthToken()) return;
  void task()
    .then((data) => onOk?.(data))
    .catch((error) => {
      console.warn(`[api] ${label} failed:`, error);
      if (onErr) {
        onErr(error);
      } else {
        toast.error('Sync failed', {
          description: `${label} didn't reach the server. The change stays on screen until it does.`,
          duration: 5000,
        });
      }
    });
}

// Store shift times are clock strings ('07:00'); the API takes full timestamps on a date.
function isoAt(date: string, time: string): string {
  return time.includes('T') ? time : `${date}T${time}`;
}

// ============================================
// INTERFACES
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
  phone: string;
  hireDate: string;
  status: 'active' | 'inactive' | 'on_leave';
  propertyId?: string | null;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  certifications?: string[];
  notes?: string;
}

export interface Booking {
  id: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestSegment: string;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  adults?: number;
  children?: number;
  status: 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled' | 'no-show';
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded';
  amount: number;
  ratePerNight?: number;
  depositPaid?: number;
  balanceDue?: number;
  source: string;
  specialRequests?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Guest {
  id: string;
  propertyId?: string;
  name: string;
  email: string;
  phone: string;
  idNumber: string;
  nationality: string;
  segment: 'VIP' | 'Frequent' | 'New' | 'Corporate';
  totalStays: number;
  loyaltyPoints: number;
  preferences: string[];
  notes: string;
  createdAt: string;
  lastVisit: string;
  address?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  allergies?: string[];
  vipLevel?: 'standard' | 'gold' | 'platinum' | 'diamond';
  companyName?: string;
}

export interface Room {
  id: string;
  propertyId: string;
  number: string;
  type: string;
  floor: number;
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'reserved';
  price: number;
  description: string;
  amenities: string[];
  image: string;
  maxOccupancy?: number;
  lastCleaned?: string;
  lastInspected?: string;
  bedType?: string;
  size?: number; // sq meters
  view?: string;
}

export interface Property {
  id: string;
  propertyId: string;
  name: string;
  address: string;
  totalRooms: number;
  occupiedRooms: number;
  rating: number;
  image: string;
  status: 'operational' | 'maintenance' | 'closed';
  phone?: string;
  email?: string;
  manager?: string;
  checkInTime?: string;
  checkOutTime?: string;
  amenities?: string[];
  description?: string;
}

export interface RatePlan {
  id: string;
  name: string;
  roomTypes: string[];
  baseRate: number;
  season: string;
  minStay: number;
  active: boolean;
  restrictions: string[];
}

export interface Integration {
  id: string;
  name: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync: string;
  icon: string;
  description: string;
  apiKey?: string;
  webhookUrl?: string;
  configuredBy?: string;
  configuredAt?: string;
}

export interface AppSettings {
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  vatRate: number;
  tourismLevy: number;
  darkMode: boolean;
  aiSmartRecommendations: boolean;
  aiAutoResponses: boolean;
  aiPredictiveAnalytics: boolean;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  propertyName?: string;
  timezone?: string;
  dateFormat?: string;
  language?: string;
  maintenanceMode?: boolean;
  backupFrequency?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
  avatar?: string;
  channelId?: string;
  attachments?: string[];
  type?: 'text' | 'system' | 'alert';
}

export interface RfidTag {
  id: string;
  propertyId: string;
  kind: 'guest' | 'staff';
  tagNumber: string;
  status: 'active' | 'inactive' | 'lost' | 'blocked';
  /** Staff binding — staff tags have a user, guest tags a booking. */
  userId?: string;
  userName?: string;
  /** Guest binding — the stay the key card belongs to. */
  bookingId?: string;
  guestName?: string;
  roomNumber?: string;
  accessLevel: string;
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
  notes?: string;
}

export type StaffTapOutcome =
  | { kind: 'unknown' }
  | { kind: 'unbound' }
  | { kind: 'inactive' }
  | { kind: 'expired' }
  | { kind: 'punched'; punch: 'in' | 'out'; userName: string; checkIn: string; checkOut?: string };

export type GuestTapOutcome =
  | { kind: 'unknown' }
  | { kind: 'inactive' }
  | { kind: 'expired' }
  | { kind: 'resolved'; tag: RfidTag; booking?: Booking };

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  checkIn: string;
  checkOut?: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'on_leave';
  hoursWorked?: number;
  overtime?: number;
  notes?: string;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime: string;
  date: string;
  role: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'swapped';
  breakStart?: string;
  breakEnd?: string;
  overtime?: number;
  notes?: string;
  swappedWith?: string;
  department?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: string;
  receiptUrl?: string;
  approvedBy?: string;
  approvedAt?: string;
  propertyId?: string;
  vendor?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  price: number;
  supplier: string;
  sku?: string;
  lastRestocked?: string;
  expiryDate?: string;
  location?: string;
  minOrderQuantity?: number;
  notes?: string;
}

export interface ElectricityRecord {
  id: string;
  date: string;
  consumption: number;
  cost: number;
  peakDemand: number;
  zone: string;
}

export interface MaintenanceTicket {
  id: string;
  roomId?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'scheduled';
  assignedTo?: string;
  createdAt: string;
  completedAt?: string;
  propertyId?: string;
  estimatedCost?: number;
  actualCost?: number;
}

// ============================================
// TICKET MANAGEMENT SYSTEM
// ============================================

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  type: 'issue' | 'task' | 'request' | 'incident';
  category: 'front_desk' | 'housekeeping' | 'maintenance' | 'food_beverage' | 'security' | 'it' | 'guest_service' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed' | 'cancelled';
  assigneeId?: string;
  assigneeName?: string;
  reporterId?: string;
  reporterName?: string;
  propertyId: string;
  roomId?: string;
  guestId?: string;
  guestName?: string;
  dueDate?: string;
  tags: string[];
  attachments: string[];
  comments: TicketComment[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

// ============================================
// ENHANCED FINANCE SYSTEM
// ============================================

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'booking' | 'service' | 'advance' | 'final';
  bookingId?: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  propertyId: string;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: string;
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'refunded';
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
  category: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId?: string;
  bookingId?: string;
  guestId: string;
  guestName: string;
  propertyId: string;
  amount: number;
  currency: string;
  method: 'cash' | 'card' | 'eft' | 'wire_transfer' | 'mobile_money' | 'voucher';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  reference?: string;
  transactionId?: string;
  processedBy: string;
  processedAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'booking' | 'guest' | 'room' | 'invoice' | 'payment' | 'ticket' | 'user' | 'property' | 'expense' | 'inventory' | 'workflow' | 'rfid_tag' | 'rate_plan';
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  userRole: string;
  details: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface TaxConfig {
  id: string;
  name: string;
  rate: number;
  type: 'vat' | 'sales_tax' | 'tourism_levy' | 'city_tax' | 'service_charge';
  included: boolean;
  applicableTo: string[];
  validFrom: string;
  validTo?: string;
  active: boolean;
}

export interface AiInsight {
  id: string;
  type: 'revenue' | 'occupancy' | 'staffing' | 'maintenance' | 'guest' | 'operational';
  title: string;
  description: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
  dismissed?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  trigger: string;
  actions: string[];
  status: 'active' | 'inactive';
  lastRun?: string;
  description?: string;
  createdBy?: string;
  createdAt?: string;
}

// ============================================
// STORE STATE INTERFACE
// ============================================

export interface AppState {
  // Current user
  user: User | null;
  setUser: (user: User | null) => void;

  // Users CRUD
  users: User[];
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileUser: (localId: string, serverId: string) => void;

  // Properties CRUD
  properties: Property[];
  setProperties: (properties: Property[]) => void;
  addProperty: (property: Property) => void;
  updateProperty: (id: string, updates: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileProperty: (localId: string, serverId: string, propertyId?: string) => void;

  // Rooms CRUD
  rooms: Room[];
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;
  deleteRoom: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileRoom: (localId: string, serverId: string) => void;

  // Messages CRUD
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  markMessageRead: (id: string) => void;
  deleteMessage: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileMessage: (localId: string, serverId: string) => void;

  // RFID Tags CRUD
  rfidTags: RfidTag[];
  setRfidTags: (tags: RfidTag[]) => void;
  addRfidTag: (tag: RfidTag) => void;
  updateRfidTag: (id: string, updates: Partial<RfidTag>) => void;
  deleteRfidTag: (id: string) => void;
  /** Swaps a just-issued tag's local id for the one the API assigned. */
  reconcileRfidTag: (localId: string, serverId: string) => void;
  /** Blocks the tag — the only status the API owns. */
  revokeRfidTag: (id: string, notes?: string) => void;
  /** Badge tap: toggles today's attendance, local-first. */
  recordStaffTap: (tagNumber: string) => StaffTapOutcome;
  /** Guest tap: resolves the stay locally, stamps last-used, syncs the stamp. */
  resolveGuestTap: (tagNumber: string) => GuestTapOutcome;

  // Attendance CRUD
  attendance: AttendanceRecord[];
  setAttendance: (attendance: AttendanceRecord[]) => void;
  addAttendance: (record: AttendanceRecord) => void;
  updateAttendance: (id: string, updates: Partial<AttendanceRecord>) => void;
  deleteAttendance: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileAttendance: (localId: string, serverId: string) => void;

  // Shifts CRUD
  shifts: Shift[];
  setShifts: (shifts: Shift[]) => void;
  addShift: (shift: Shift) => void;
  updateShift: (id: string, updates: Partial<Shift>) => void;
  deleteShift: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileShift: (localId: string, serverId: string) => void;

  // Expenses CRUD
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
  reconcileExpense: (localId: string, serverId: string) => void;
  addExpense: (expense: Expense) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Inventory CRUD
  inventory: InventoryItem[];
  setInventory: (items: InventoryItem[]) => void;
  reconcileInventoryItem: (localId: string, serverId: string) => void;
  addInventoryItem: (item: InventoryItem) => void;
  updateInventory: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;

  // Electricity CRUD
  electricity: ElectricityRecord[];
  setElectricity: (records: ElectricityRecord[]) => void;
  addElectricity: (record: ElectricityRecord) => void;
  updateElectricity: (id: string, updates: Partial<ElectricityRecord>) => void;
  deleteElectricity: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileElectricity: (localId: string, serverId: string) => void;

  // Maintenance Tickets CRUD
  maintenanceTickets: MaintenanceTicket[];
  setMaintenanceTickets: (tickets: MaintenanceTicket[]) => void;
  addMaintenanceTicket: (ticket: MaintenanceTicket) => void;
  updateMaintenanceTicket: (id: string, updates: Partial<MaintenanceTicket>) => void;
  deleteMaintenanceTicket: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileMaintenanceTicket: (localId: string, serverId: string) => void;

  // Ticket Management CRUD
  tickets: Ticket[];
  setTickets: (tickets: Ticket[]) => void;
  addTicket: (ticket: Ticket) => void;
  updateTicket: (id: string, updates: Partial<Ticket>) => void;
  deleteTicket: (id: string) => void;
  addTicketComment: (ticketId: string, comment: TicketComment) => void;
  /** Swaps a just-created row's local id (and ticket number) for the server's. */
  reconcileTicket: (localId: string, serverId: string, serverTicketNumber: string) => void;

  // Invoices CRUD
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  /** Swaps a just-created row's local id for the server row (totals/status are the server's, name/email kept from the local row when the DTO omits them). */
  reconcileInvoice: (localId: string, server: Invoice) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;

  // Payments CRUD
  payments: Payment[];
  setPayments: (payments: Payment[]) => void;
  reconcilePayment: (localId: string, serverId: string, serverPaymentNumber: string) => void;
  addPayment: (payment: Payment) => void;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  deletePayment: (id: string) => void;

  // Audit Logs
  auditLogs: AuditLog[];
  setAuditLogs: (logs: AuditLog[]) => void;
  addAuditLog: (log: AuditLog) => void;

  // Tax Configuration CRUD
  taxConfigs: TaxConfig[];
  setTaxConfigs: (configs: TaxConfig[]) => void;
  reconcileTaxConfig: (localId: string, serverId: string) => void;
  addTaxConfig: (config: TaxConfig) => void;
  updateTaxConfig: (id: string, updates: Partial<TaxConfig>) => void;
  deleteTaxConfig: (id: string) => void;

  // AI Insights
  aiInsights: AiInsight[];
  setAiInsights: (aiInsights: AiInsight[]) => void;
  addAiInsight: (insight: AiInsight) => void;
  updateAiInsight: (id: string, updates: Partial<AiInsight>) => void;
  deleteAiInsight: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileAiInsight: (localId: string, serverId: string) => void;

  // Workflows CRUD
  workflows: Workflow[];
  setWorkflows: (workflows: Workflow[]) => void;
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileWorkflow: (localId: string, serverId: string) => void;

  // Bookings CRUD
  bookings: Booking[];
  setBookings: (bookings: Booking[]) => void;
  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, updates: Partial<Booking>) => void;
  deleteBooking: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileBooking: (localId: string, serverId: string) => void;

  // Guests CRUD
  guests: Guest[];
  setGuests: (guests: Guest[]) => void;
  addGuest: (guest: Guest) => void;
  updateGuest: (id: string, updates: Partial<Guest>) => void;
  deleteGuest: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileGuest: (localId: string, serverId: string) => void;

  // Rate Plans CRUD
  ratePlans: RatePlan[];
  setRatePlans: (plans: RatePlan[]) => void;
  addRatePlan: (plan: RatePlan) => void;
  updateRatePlan: (id: string, updates: Partial<RatePlan>) => void;
  deleteRatePlan: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileRatePlan: (localId: string, serverId: string) => void;

  // Integrations CRUD
  integrations: Integration[];
  setIntegrations: (integrations: Integration[]) => void;
  addIntegration: (integration: Integration) => void;
  updateIntegration: (id: string, updates: Partial<Integration>) => void;
  deleteIntegration: (id: string) => void;
  /** Stamps LastSync and flips status to connected. */
  syncIntegration: (id: string) => void;
  /** Swaps a just-created row's local id for the one the API assigned. */
  reconcileIntegration: (localId: string, serverId: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // UI State
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  activePage: string;
  setActivePage: (page: string) => void;
}

const defaultSettings: AppSettings = {
  checkInTime: '14:00',
  checkOutTime: '11:00',
  currency: 'ZAR',
  vatRate: 15,
  tourismLevy: 1,
  darkMode: true,
  aiSmartRecommendations: true,
  aiAutoResponses: true,
  aiPredictiveAnalytics: true,
  notifications: {
    email: true,
    sms: false,
    push: true,
  },
  propertyName: 'Nexus PMS',
  timezone: 'Africa/Johannesburg',
  dateFormat: 'DD/MM/YYYY',
  language: 'en',
  maintenanceMode: false,
  backupFrequency: 'daily',
};

// ============================================
// STORE CREATION
// ============================================

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Current user
      user: null,
      setUser: (user) => set({ user }),

      // Users CRUD
      users: [],
      setUsers: (users) => set({ users }),
      reconcileUser: (localId, serverId) => set((state) => ({
        users: state.users.map((u) => u.id === localId ? { ...u, id: serverId } : u)
      })),
      addUser: (user) => {
        set((state) => ({ users: [...state.users, user] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(user.id) !== null) return;
        const input: CreateUserInput = {
          email: user.email,
          name: user.name,
          role: normalizeAppRole(user.role),
          department: user.department || undefined,
          phone: user.phone || undefined,
          propertyId: user.propertyId ? toNumericId(user.propertyId) : null,
        };
        syncToApi(`createUser(${user.id})`, () => createUser(input), (data) => {
          const dto = data as ApiUser;
          get().reconcileUser(user.id, String(dto.id));
        });
      },
      updateUser: (id, updates) => {
        set((state) => ({
          users: state.users.map((u) => u.id === id ? { ...u, ...updates } : u)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        const current = get().users.find((u) => u.id === id);
        if (!current) return;
        // Name always sent (handler requires it); role only when present in the edit.
        const input: UpdateUserInput = {
          name: updates.name ?? current.name,
          department: (updates.department ?? current.department) || null,
          phone: (updates.phone ?? current.phone) || null,
          role: updates.role !== undefined ? normalizeAppRole(updates.role) : undefined,
          propertyId: updates.propertyId === undefined
            ? undefined
            : (updates.propertyId ? toNumericId(updates.propertyId) : null),
        };
        syncToApi(`updateUser(${id})`, () => apiUpdateUser(numericId, input));
      },
      deleteUser: (id) => {
        set((state) => ({
          users: state.users.filter((u) => u.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteUser(${id})`, () => apiDeleteUser(numericId));
        }
      },

      // Properties CRUD
      properties: [],
      setProperties: (properties) => set({ properties }),
      reconcileProperty: (localId, serverId, propertyId) => set((state) => ({
        properties: state.properties.map((p) => p.id === localId ? { ...p, id: serverId, ...(propertyId ? { propertyId } : {}) } : p)
      })),
      addProperty: (property) => {
        set((state) => ({ properties: [...state.properties, property] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(property.id) !== null) return;
        const input: CreatePropertyInput = {
          // Tenant identifier (unique int). Non-numeric local ids get a
          // timestamp-seeded value that stays within Int32 and never repeats.
          propertyId: toNumericId(property.id) ?? nextPropertyTenantId(),
          name: property.name,
          address: property.address,
          rating: property.rating,
          manager: property.manager || undefined,
          phone: property.phone || undefined,
          email: property.email || undefined,
          description: property.description || undefined,
        };
        syncToApi(`createProperty(${property.id})`, () => createProperty(input), (data) => {
          const dto = data as ApiProperty;
          get().reconcileProperty(property.id, String(dto.id), String(dto.propertyId));
        });
      },
      updateProperty: (id, updates) => {
        set((state) => ({
          properties: state.properties.map((p) => p.id === id ? { ...p, ...updates } : p)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        // Descriptive edits persist through the full-details endpoint.
        const detailKeys: (keyof Property)[] = [
          'name', 'address', 'description', 'manager', 'rating', 'phone', 'email',
        ];
        if (detailKeys.some((k) => updates[k] !== undefined)) {
          const current = get().properties.find((p) => p.id === id);
          if (current) {
            syncToApi(`updatePropertyDetails(${id})`, () => updatePropertyDetails(numericId, {
              name: current.name,
              address: current.address ?? '',
              description: current.description,
              manager: current.manager,
              rating: current.rating,
              phone: current.phone,
              email: current.email,
            }));
          }
        }
        // Status uses the lightweight status-only endpoint.
        if (updates.status === undefined) return;
        const wire = updates.status === 'operational' ? 'active'
          : updates.status === 'maintenance' ? 'maintenance'
          : 'retired';
        syncToApi(`updatePropertyStatus(${id})`, () => updatePropertyStatus(numericId, wire));
      },
      deleteProperty: (id) => {
        set((state) => ({
          properties: state.properties.filter((p) => p.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteProperty(${id})`, () => apiDeleteProperty(numericId));
        }
      },

      // Rooms CRUD
      rooms: [],
      setRooms: (rooms) => set({ rooms }),
      reconcileRoom: (localId, serverId) => set((state) => ({
        rooms: state.rooms.map((r) => r.id === localId ? { ...r, id: serverId } : r)
      })),
      addRoom: (room) => {
        set((state) => ({ rooms: [...state.rooms, room] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(room.id) !== null) return;
        const propertyId = toNumericId(room.propertyId);
        if (propertyId === null) return;
        const input: CreateRoomInput = {
          propertyId,
          number: room.number,
          type: room.type,
          price: room.price,
          maxOccupancy: room.maxOccupancy ?? 2,
          floor: room.floor,
          bedType: room.bedType,
          view: room.view,
          size: room.size,
          description: room.description || undefined,
          amenities: room.amenities.length > 0 ? room.amenities : undefined,
        };
        syncToApi(`createRoom(${room.id})`, () => createRoom(input), (data) => {
          const dto = data as ApiRoom;
          get().reconcileRoom(room.id, String(dto.id));
        });
      },
      updateRoom: (id, updates) => {
        // Snapshot amenities before local mutation so the add/remove diff uses the old list.
        const prevAmenities = get().rooms.find((r) => r.id === id)?.amenities;
        set((state) => ({
          rooms: state.rooms.map((r) => r.id === id ? { ...r, ...updates } : r)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        // Amenities: the API only takes single add/remove — diff old against new.
        if (updates.amenities !== undefined && prevAmenities !== undefined) {
          const old = prevAmenities;
          for (const amenity of updates.amenities) {
            if (!old.includes(amenity)) {
              syncToApi(`updateRoomAmenities(${id}+${amenity})`, () => updateRoomAmenities(numericId, 'add', amenity));
            }
          }
          for (const amenity of old) {
            if (!updates.amenities.includes(amenity)) {
              syncToApi(`updateRoomAmenities(${id}-${amenity})`, () => updateRoomAmenities(numericId, 'remove', amenity));
            }
          }
        }
        // Remaining mutable fields each have their own endpoint (roomId in body).
        if (updates.status !== undefined) {
          syncToApi(`updateRoomStatus(${id})`, () => updateRoomStatus(numericId, updates.status!));
        }
        if (updates.price !== undefined) {
          syncToApi(`updateRoomPrice(${id})`, () => updateRoomPrice(numericId, updates.price!));
        }
        if (updates.maxOccupancy !== undefined) {
          syncToApi(`updateRoomMaxOccupancy(${id})`, () => updateRoomMaxOccupancy(numericId, updates.maxOccupancy!));
        }
        if (updates.view !== undefined && updates.view !== '') {
          syncToApi(`updateRoomView(${id})`, () => updateRoomView(numericId, updates.view!));
        }
        // number/type/floor/description/bedType/size/image: no endpoint — local only.
      },
      deleteRoom: (id) => {
        set((state) => ({
          rooms: state.rooms.filter((r) => r.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteRoom(${id})`, () => apiDeleteRoom(numericId));
        }
      },

      // Messages CRUD
      messages: [],
      setMessages: (messages) => set({ messages }),
      reconcileMessage: (localId, serverId) => set((state) => ({
        messages: state.messages.map((m) => m.id === localId ? { ...m, id: serverId } : m)
      })),
      addMessage: (message) => {
        set((state) => ({ messages: [message, ...state.messages] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(message.id) !== null) return;
        const propertyId = toNumericId(get().user?.propertyId ?? get().properties[0]?.propertyId ?? '') ?? 1;
        const input: CreateMessageInput = {
          propertyId,
          content: message.content,
          type: message.type,
          channelId: message.channelId,
          attachments: message.attachments,
        };
        syncToApi(`createMessage(${message.id})`, () => createMessage(input), (data) => {
          const dto = data as ApiMessage;
          get().reconcileMessage(message.id, String(dto.id));
        });
      },
      markMessageRead: (id) => {
        set((state) => ({
          messages: state.messages.map((m) => m.id === id ? { ...m, read: true } : m)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`markMessageRead(${id})`, () => apiMarkMessageRead(numericId));
        }
      },
      deleteMessage: (id) => {
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteMessage(${id})`, () => apiDeleteMessage(numericId));
        }
      },

      // RFID Tags CRUD
      rfidTags: [],
      setRfidTags: (rfidTags) => set({ rfidTags }),
      reconcileRfidTag: (localId, serverId) => set((state) => ({
        rfidTags: state.rfidTags.map((t) => t.id === localId ? { ...t, id: serverId } : t)
      })),
      addRfidTag: (tag) => {
        set((state) => ({ rfidTags: [...state.rfidTags, tag] }));
        // A numeric id means the tag already lives server-side — only local ids issue.
        if (toNumericId(tag.id) !== null) return;
        const propertyId = toNumericId(tag.propertyId);
        const userId = toNumericId(tag.userId ?? '');
        const bookingId = toNumericId(tag.bookingId ?? '');
        // Ids that don't resolve to server rows stay local - nothing to sync against.
        if (propertyId === null) return;
        if (tag.kind === 'staff' && userId === null) return;
        if (tag.kind === 'guest' && bookingId === null) return;
        const input: IssueRfidTagInput = {
          propertyId,
          kind: tag.kind,
          tagNumber: tag.tagNumber,
          userId: tag.kind === 'staff' ? userId : null,
          bookingId: tag.kind === 'guest' ? bookingId : null,
          accessLevel: tag.accessLevel,
          expiresAt: tag.expiresAt ?? null,
          notes: tag.notes ?? null,
        };
        syncToApi(`issueRfidTag(${tag.id})`, () => issueRfidTag(input), (data) => {
          const dto = data as ApiRfidTag;
          get().reconcileRfidTag(tag.id, String(dto.id));
        }, () => {
          toast.error(`Couldn't sync tag ${tag.tagNumber} to the server`);
        });
      },
      updateRfidTag: (id, updates) => set((state) => ({
        rfidTags: state.rfidTags.map((t) => t.id === id ? { ...t, ...updates } : t)
      })),
      // Local-only removal — the API has no delete; revoking keeps rows for audit.
      deleteRfidTag: (id) => set((state) => ({
        rfidTags: state.rfidTags.filter((t) => t.id !== id)
      })),
      revokeRfidTag: (id, notes) => {
        set((state) => ({
          rfidTags: state.rfidTags.map((t) => t.id === id
            ? { ...t, status: 'blocked' as const, notes: notes ?? t.notes }
            : t)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        syncToApi(`revokeRfidTag(${id})`, () => apiRevokeRfidTag(numericId, notes ?? null));
      },
      recordStaffTap: (tagNumber) => {
        const tag = get().rfidTags.find((t) => t.tagNumber === tagNumber && t.kind === 'staff');
        if (!tag) return { kind: 'unknown' };
        if (!tag.userId || !tag.userName) return { kind: 'unbound' };
        if (tag.status !== 'active') return { kind: 'inactive' };
        // Expiry is day-granular — an evening tap on checkout day still resolves.
        const tappedAt = new Date().toISOString();
        if (tag.expiresAt && tappedAt.slice(0, 10) > tag.expiresAt.slice(0, 10)) return { kind: 'expired' };

        const userId = tag.userId;
        const userName = tag.userName;
        const today = tappedAt.slice(0, 10);
        const open = get().attendance
          .filter((a) => a.userId === userId && a.date === today && !a.checkOut)
          .sort((a, b) => b.checkIn.localeCompare(a.checkIn))[0];
        const punch: 'in' | 'out' = open ? 'out' : 'in';
        const checkIn = open ? open.checkIn : tappedAt;
        const checkOut = open ? tappedAt : undefined;
        const localId = open ? open.id : `att-${Date.now()}`;

        set((state) => ({
          attendance: open
            ? state.attendance.map((a) => a.id === open.id ? { ...a, checkOut: tappedAt } : a)
            : [...state.attendance, { id: localId, userId, userName, checkIn, date: today, status: 'present' as const }],
          rfidTags: state.rfidTags.map((t) => t.id === tag.id ? { ...t, lastUsed: tappedAt } : t),
        }));

        // The server owns punch order — fold its answer back over the local row.
        const propertyId = toNumericId(tag.propertyId);
        if (propertyId !== null) {
          syncToApi(`tapStaff(${tag.tagNumber})`, () => tapStaffTag(propertyId, tag.tagNumber), (data) => {
            const dto = data as ApiStaffTapResult;
            set((state) => ({
              attendance: state.attendance.map((a) => a.id === localId
                ? { ...a, id: String(dto.attendanceId), checkIn: dto.checkIn, checkOut: dto.checkOut ?? undefined }
                : a)
            }));
          });
        }

        return { kind: 'punched', punch, userName, checkIn, checkOut };
      },
      resolveGuestTap: (tagNumber) => {
        const tag = get().rfidTags.find((t) => t.tagNumber === tagNumber && t.kind === 'guest');
        if (!tag) return { kind: 'unknown' };
        if (tag.status !== 'active') return { kind: 'inactive' };
        // Expiry is day-granular — an evening tap on checkout day still resolves.
        const tappedAt = new Date().toISOString();
        if (tag.expiresAt && tappedAt.slice(0, 10) > tag.expiresAt.slice(0, 10)) return { kind: 'expired' };

        const stamped: RfidTag = { ...tag, lastUsed: tappedAt };
        set((state) => ({
          rfidTags: state.rfidTags.map((t) => t.id === tag.id ? stamped : t)
        }));

        const propertyId = toNumericId(tag.propertyId);
        if (propertyId !== null) {
          // The server stamps its own last-used; the stay context is resolved locally.
          syncToApi(`tapGuest(${tag.tagNumber})`, () => tapGuestTag(propertyId, tag.tagNumber));
        }

        return {
          kind: 'resolved',
          tag: stamped,
          booking: get().bookings.find((b) => b.id === tag.bookingId),
        };
      },

      // Attendance CRUD
      attendance: [],
      setAttendance: (attendance) => set({ attendance }),
      reconcileAttendance: (localId, serverId) => set((state) => ({
        attendance: state.attendance.map((a) => a.id === localId ? { ...a, id: serverId } : a)
      })),
      addAttendance: (record) => {
        set((state) => ({ attendance: [...state.attendance, record] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(record.id) !== null) return;
        const propertyId = toNumericId(get().user?.propertyId ?? get().properties[0]?.propertyId ?? '') ?? 1;
        const input: CreateAttendanceInput = {
          propertyId,
          userId: toNumericId(record.userId) ?? 0,
          userName: record.userName,
          checkIn: record.checkIn,
          status: record.status,
          notes: record.notes,
        };
        syncToApi(`createAttendance(${record.id})`, () => createAttendance(input), (data) => {
          const dto = data as ApiAttendance;
          get().reconcileAttendance(record.id, String(dto.id));
          // The create command has no checkOut column — follow up once the row has an id.
          const checkOut = record.checkOut;
          if (!checkOut) return;
          syncToApi(`updateAttendance(${dto.id}) checkOut`, () => apiUpdateAttendance(dto.id, { checkOut }));
        });
      },
      updateAttendance: (id, updates) => {
        set((state) => ({
          attendance: state.attendance.map((a) => a.id === id ? { ...a, ...updates } : a)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        const input: UpdateAttendanceInput = {};
        if (updates.checkOut !== undefined) input.checkOut = updates.checkOut;
        if (updates.status !== undefined) input.status = updates.status;
        if (updates.notes !== undefined) input.notes = updates.notes;
        if (Object.keys(input).length > 0) {
          syncToApi(`updateAttendance(${id})`, () => apiUpdateAttendance(numericId, input));
        }
      },
      deleteAttendance: (id) => {
        set((state) => ({
          attendance: state.attendance.filter((a) => a.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteAttendance(${id})`, () => apiDeleteAttendance(numericId));
        }
      },

      // Shifts CRUD
      shifts: [],
      setShifts: (shifts) => set({ shifts }),
      reconcileShift: (localId, serverId) => set((state) => ({
        shifts: state.shifts.map((s) => s.id === localId ? { ...s, id: serverId } : s)
      })),
      addShift: (shift) => {
        set((state) => ({ shifts: [...state.shifts, shift] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(shift.id) !== null) return;
        const propertyId = toNumericId(get().user?.propertyId ?? get().properties[0]?.propertyId ?? '') ?? 1;
        const input: CreateShiftInput = {
          propertyId,
          userId: toNumericId(shift.userId) ?? 0,
          userName: shift.userName,
          startTime: isoAt(shift.date, shift.startTime),
          endTime: isoAt(shift.date, shift.endTime),
          role: shift.role,
          department: shift.department,
        };
        syncToApi(`createShift(${shift.id})`, () => createShift(input), (data) => {
          const dto = data as ApiShift;
          get().reconcileShift(shift.id, String(dto.id));
          // The create command has no break/notes columns — follow up once the row has an id.
          const { breakStart, breakEnd, notes } = shift;
          if (!(breakStart && breakEnd) && !notes) return;
          syncToApi(`updateShift(${dto.id}) break/notes`, () => apiUpdateShift(dto.id, {
            breakStart: breakStart && breakEnd ? isoAt(shift.date, breakStart) : undefined,
            breakEnd: breakStart && breakEnd ? isoAt(shift.date, breakEnd) : undefined,
            notes,
          }));
        });
      },
      updateShift: (id, updates) => {
        set((state) => ({
          shifts: state.shifts.map((s) => s.id === id ? { ...s, ...updates } : s)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        const merged = get().shifts.find((s) => s.id === id);
        // Status transitions have dedicated endpoints; a swap reassigns the staff name too.
        const status = updates.status;
        if (status !== undefined) {
          const newStaffName = updates.userName ?? merged?.userName;
          if (status === 'swapped' && newStaffName) {
            syncToApi(`swapShift(${id})`, () => swapShift(numericId, newStaffName));
          } else {
            syncToApi(`changeShiftStatus(${id})`, () => changeShiftStatus(numericId, status));
          }
        }
        const input: UpdateShiftInput = {};
        if (updates.breakStart && updates.breakEnd && merged) {
          input.breakStart = isoAt(merged.date, updates.breakStart);
          input.breakEnd = isoAt(merged.date, updates.breakEnd);
        }
        if (updates.overtime !== undefined) input.overtime = updates.overtime;
        if (updates.notes !== undefined) input.notes = updates.notes;
        if (updates.department !== undefined) input.department = updates.department;
        if (Object.keys(input).length > 0) {
          syncToApi(`updateShift(${id})`, () => apiUpdateShift(numericId, input));
        }
      },
      deleteShift: (id) => {
        set((state) => ({
          shifts: state.shifts.filter((s) => s.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteShift(${id})`, () => apiDeleteShift(numericId));
        }
      },

      // Expenses CRUD
      expenses: [],
      setExpenses: (expenses) => set({ expenses }),
      reconcileExpense: (localId, serverId) => set((state) => ({
        expenses: state.expenses.map((e) => e.id === localId ? { ...e, id: serverId } : e)
      })),
      addExpense: (expense) => {
        set((state) => ({ expenses: [...state.expenses, expense] }));
        if (toNumericId(expense.id) !== null) return;
        const propertyId = toNumericId(expense.propertyId ?? '') ?? 1;
        const input: CreateExpenseInput = {
          propertyId,
          category: expense.category,
          amount: expense.amount,
          description: expense.description,
          date: expense.date,
          receiptUrl: expense.receiptUrl,
          vendor: expense.vendor,
          paymentMethod: expense.paymentMethod,
          notes: expense.notes,
        };
        syncToApi(`createExpense(${expense.id})`, () => createExpense(input), (data) => {
          get().reconcileExpense(expense.id, String((data as ApiExpense).id));
        });
      },
      updateExpense: (id, updates) => {
        set((state) => ({
          expenses: state.expenses.map((e) => e.id === id ? { ...e, ...updates } : e)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        // Status flips have their own endpoints; every other field goes through PUT.
        if (updates.status === 'approved') {
          syncToApi(`approveExpense(${id})`, () => approveExpense(numericId));
          return;
        }
        if (updates.status === 'rejected') {
          syncToApi(`rejectExpense(${id})`, () => rejectExpense(numericId));
          return;
        }
        const current = get().expenses.find((e) => e.id === id);
        if (!current) return;
        // Handler always applies the details block, so send merged current+updates.
        const input: UpdateExpenseInput = {
          category: updates.category ?? current.category,
          amount: updates.amount ?? current.amount,
          description: updates.description ?? current.description,
          date: updates.date ?? current.date,
          vendor: updates.vendor ?? current.vendor,
          notes: updates.notes ?? current.notes,
          receiptUrl: updates.receiptUrl ?? current.receiptUrl,
          paymentMethod: updates.paymentMethod ?? current.paymentMethod,
        };
        syncToApi(`updateExpense(${id})`, () => updateExpense(numericId, input));
      },
      deleteExpense: (id) => {
        set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteExpense(${id})`, () => deleteExpense(numericId));
        }
      },

      // Inventory CRUD
      inventory: [],
      setInventory: (inventory) => set({ inventory }),
      reconcileInventoryItem: (localId, serverId) => set((state) => ({
        inventory: state.inventory.map((i) => i.id === localId ? { ...i, id: serverId } : i)
      })),
      addInventoryItem: (item) => {
        set((state) => ({ inventory: [...state.inventory, item] }));
        if (toNumericId(item.id) !== null) return;
        const propertyId = toNumericId(get().user?.propertyId ?? get().properties[0]?.propertyId ?? '') ?? 1;
        const input: CreateInventoryItemInput = {
          propertyId,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          reorderLevel: item.reorderLevel,
          price: item.price,
          supplier: item.supplier,
          sku: item.sku,
          expiryDate: item.expiryDate,
          minOrderQuantity: item.minOrderQuantity,
        };
        syncToApi(`createInventoryItem(${item.id})`, () => createInventoryItem(input), (data) => {
          get().reconcileInventoryItem(item.id, String((data as ApiInventoryItem).id));
        });
      },
      updateInventory: (id, updates) => {
        const prev = get().inventory.find((i) => i.id === id);
        set((state) => ({
          inventory: state.inventory.map((i) => i.id === id ? { ...i, ...updates } : i)
        }));
        const numericId = toNumericId(id);
        if (numericId === null || !prev) return;
        // Quantity is not on the PUT command — it moves through adjust (signed
        // delta) or restock (delivery, also stamps lastRestocked).
        const delta = (updates.quantity ?? prev.quantity) - prev.quantity;
        if (updates.quantity !== undefined && delta !== 0) {
          if (updates.lastRestocked && updates.lastRestocked !== prev.lastRestocked) {
            syncToApi(`restockInventoryItem(${id})`, () => restockInventoryItem(numericId, delta));
          } else {
            syncToApi(`adjustInventoryQuantity(${id})`, () => adjustInventoryQuantity(numericId, delta));
          }
        }
        // Everything else is a sparse PUT — nulls keep current value.
        const input: UpdateInventoryItemInput = {
          name: updates.name ?? prev.name,
          category: updates.category ?? prev.category,
          unit: updates.unit ?? prev.unit,
          reorderLevel: updates.reorderLevel ?? prev.reorderLevel,
          price: updates.price ?? prev.price,
          supplier: updates.supplier ?? prev.supplier,
          location: updates.location ?? prev.location,
          notes: updates.notes ?? prev.notes,
          sku: updates.sku ?? prev.sku,
          expiryDate: updates.expiryDate ?? prev.expiryDate,
          minOrderQuantity: updates.minOrderQuantity ?? prev.minOrderQuantity,
        };
        syncToApi(`updateInventoryItem(${id})`, () => updateInventoryItem(numericId, input));
      },
      deleteInventoryItem: (id) => {
        set((state) => ({ inventory: state.inventory.filter((i) => i.id !== id) }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteInventoryItem(${id})`, () => deleteInventoryItem(numericId));
        }
      },

      // Electricity CRUD
      electricity: [],
      setElectricity: (electricity) => set({ electricity }),
      reconcileElectricity: (localId, serverId) => set((state) => ({
        electricity: state.electricity.map((e) => e.id === localId ? { ...e, id: serverId } : e)
      })),
      addElectricity: (record) => {
        set((state) => ({ electricity: [...state.electricity, record] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(record.id) !== null) return;
        const propertyId = toNumericId(get().user?.propertyId ?? get().properties[0]?.propertyId ?? '') ?? 1;
        const input: CreateElectricityInput = {
          propertyId,
          date: record.date,
          consumption: record.consumption,
          cost: record.cost,
          peakDemand: record.peakDemand,
          zone: record.zone,
        };
        syncToApi(`createElectricity(${record.id})`, () => createElectricity(input), (data) => {
          const dto = data as ApiElectricityRecord;
          get().reconcileElectricity(record.id, String(dto.id));
        });
      },
      updateElectricity: (id, updates) => {
        set((state) => ({
          electricity: state.electricity.map((e) => e.id === id ? { ...e, ...updates } : e)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        const input: UpdateElectricityInput = {};
        if (updates.date !== undefined) input.date = updates.date;
        if (updates.consumption !== undefined) input.consumption = updates.consumption;
        if (updates.cost !== undefined) input.cost = updates.cost;
        if (updates.peakDemand !== undefined) input.peakDemand = updates.peakDemand;
        if (updates.zone !== undefined) input.zone = updates.zone;
        if (Object.keys(input).length > 0) {
          syncToApi(`updateElectricity(${id})`, () => apiUpdateElectricity(numericId, input));
        }
      },
      deleteElectricity: (id) => {
        set((state) => ({
          electricity: state.electricity.filter((e) => e.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteElectricity(${id})`, () => apiDeleteElectricity(numericId));
        }
      },

      // Maintenance Tickets CRUD
      maintenanceTickets: [],
      setMaintenanceTickets: (maintenanceTickets) => set({ maintenanceTickets }),
      reconcileMaintenanceTicket: (localId, serverId) => set((state) => ({
        maintenanceTickets: state.maintenanceTickets.map((t) => t.id === localId ? { ...t, id: serverId } : t)
      })),
      addMaintenanceTicket: (ticket) => {
        set((state) => ({ maintenanceTickets: [...state.maintenanceTickets, ticket] }));
        const propertyId = ticket.propertyId !== undefined ? toNumericId(ticket.propertyId) : null;
        if (propertyId !== null) {
          syncToApi(`createMaintenanceRequest(${ticket.id})`, () => createMaintenanceRequest({
            propertyId,
            description: ticket.description || ticket.title,
            priority: ticket.priority,
            status: ticket.status,
          }), (data) => {
            const dto = data as { id: number };
            get().reconcileMaintenanceTicket(ticket.id, String(dto.id));
          });
        }
      },
      updateMaintenanceTicket: (id, updates) => {
        set((state) => ({
          maintenanceTickets: state.maintenanceTickets.map((t) => t.id === id ? { ...t, ...updates } : t)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          const input: UpdateMaintenanceInput = {};
          if (updates.description !== undefined) input.description = updates.description;
          if (updates.status !== undefined) input.status = updates.status;
          if (updates.priority !== undefined) input.priority = updates.priority;
          if (Object.keys(input).length > 0) {
            syncToApi(`updateMaintenanceRequest(${id})`, () => updateMaintenanceRequest(numericId, input));
          }
        }
      },
      deleteMaintenanceTicket: (id) => {
        set((state) => ({
          maintenanceTickets: state.maintenanceTickets.filter((t) => t.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteMaintenanceRequest(${id})`, () => apiDeleteMaintenanceRequest(numericId));
        }
      },

      // AI Insights
      aiInsights: [],
      setAiInsights: (aiInsights) => set({ aiInsights }),
      reconcileAiInsight: (localId, serverId) => set((state) => ({
        aiInsights: state.aiInsights.map((i) => i.id === localId ? { ...i, id: serverId } : i)
      })),
      addAiInsight: (insight) => {
        set((state) => ({ aiInsights: [insight, ...state.aiInsights] }));
        // A numeric id means the row already lives server-side (agent run / hydrate) — only local ids create.
        if (toNumericId(insight.id) !== null) return;
        const input: CreateAiInsightInput = {
          propertyId: null,
          type: insight.type,
          title: insight.title,
          description: insight.description,
          recommendation: insight.recommendation,
          impact: insight.impact,
        };
        syncToApi(`createAiInsight(${insight.id})`, () => createAiInsight(input), (data) => {
          get().reconcileAiInsight(insight.id, String((data as ApiAiInsight).id));
        });
      },
      updateAiInsight: (id, updates) => {
        set((state) => ({
          aiInsights: state.aiInsights.map((i) => i.id === id ? { ...i, ...updates } : i)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        const input: UpdateAiInsightInput = {};
        if (updates.type !== undefined) input.type = updates.type;
        if (updates.title !== undefined) input.title = updates.title;
        if (updates.description !== undefined) input.description = updates.description;
        if (updates.recommendation !== undefined) input.recommendation = updates.recommendation;
        if (updates.impact !== undefined) input.impact = updates.impact;
        if (updates.dismissed !== undefined) input.dismissed = updates.dismissed;
        if (Object.keys(input).length > 0) {
          syncToApi(`updateAiInsight(${id})`, () => apiUpdateAiInsight(numericId, input));
        }
      },
      deleteAiInsight: (id) => {
        set((state) => ({
          aiInsights: state.aiInsights.filter((i) => i.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteAiInsight(${id})`, () => apiDeleteAiInsight(numericId));
        }
      },

      // Workflows CRUD
      workflows: [],
      setWorkflows: (workflows) => set({ workflows }),
      reconcileWorkflow: (localId, serverId) => set((state) => ({
        workflows: state.workflows.map((w) => w.id === localId ? { ...w, id: serverId } : w)
      })),
      addWorkflow: (workflow) => {
        set((state) => ({ workflows: [...state.workflows, workflow] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(workflow.id) !== null) return;
        const input: CreateWorkflowInput = {
          propertyId: null,
          name: workflow.name,
          description: workflow.description,
          trigger: workflow.trigger,
          actions: [...workflow.actions],
          status: workflow.status,
          createdBy: workflow.createdBy,
        };
        syncToApi(`createWorkflow(${workflow.id})`, () => createWorkflow(input), (data) => {
          get().reconcileWorkflow(workflow.id, String((data as ApiWorkflow).id));
        });
      },
      updateWorkflow: (id, updates) => {
        set((state) => ({
          workflows: state.workflows.map((w) => w.id === id ? { ...w, ...updates } : w)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        const input: UpdateWorkflowInput = {};
        if (updates.name !== undefined) input.name = updates.name;
        if (updates.description !== undefined) input.description = updates.description;
        if (updates.trigger !== undefined) input.trigger = updates.trigger;
        if (updates.actions !== undefined) input.actions = [...updates.actions];
        if (updates.status !== undefined) input.status = updates.status;
        if (Object.keys(input).length > 0) {
          syncToApi(`updateWorkflow(${id})`, () => apiUpdateWorkflow(numericId, input));
        }
      },
      deleteWorkflow: (id) => {
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteWorkflow(${id})`, () => apiDeleteWorkflow(numericId));
        }
      },

      // UI State
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      activePage: 'dashboard',
      setActivePage: (activePage) => set({ activePage }),

      // Bookings CRUD
      bookings: [],
      setBookings: (bookings) => set({ bookings }),
      reconcileBooking: (localId, serverId) => set((state) => ({
        bookings: state.bookings.map((b) => b.id === localId ? { ...b, id: serverId } : b)
      })),
      addBooking: (booking) => {
        set((state) => ({ bookings: [...state.bookings, booking] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(booking.id) !== null) return;
        const propertyId = toNumericId(booking.propertyId);
        const guestId = toNumericId(booking.guestId);
        const roomId = toNumericId(booking.roomId);
        if (propertyId === null || guestId === null || roomId === null) return;
        const input: CreateBookingInput = {
          propertyId,
          guestId,
          roomId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guests: booking.guests,
          ratePerNight: booking.ratePerNight ?? booking.amount,
          source: booking.source,
        };
        syncToApi(`createBooking(${booking.id})`, () => createBooking(input), (data) => {
          const dto = data as ApiBooking;
          get().reconcileBooking(booking.id, String(dto.id));
        });
      },
      updateBooking: (id, updates) => {
        const prevDeposit = get().bookings.find((b) => b.id === id)?.depositPaid;
        set((state) => ({
          bookings: state.bookings.map((b) => b.id === id ? { ...b, ...updates } : b)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        // Status and deposit have endpoints; everything else stays local.
        if (updates.status !== undefined) {
          syncToApi(`changeBookingStatus(${id})`, () => changeBookingStatus(numericId, updates.status!));
        }
        if (updates.depositPaid !== undefined && updates.depositPaid !== prevDeposit) {
          syncToApi(`recordBookingDeposit(${id})`, () => recordBookingDeposit(numericId, updates.depositPaid!));
        }
      },
      deleteBooking: (id) => {
        set((state) => ({
          bookings: state.bookings.filter((b) => b.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteBooking(${id})`, () => apiDeleteBooking(numericId));
        }
      },

      // Guests CRUD
      guests: [],
      setGuests: (guests) => set({ guests }),
      reconcileGuest: (localId, serverId) => set((state) => ({
        guests: state.guests.map((g) => g.id === localId ? { ...g, id: serverId } : g)
      })),
      addGuest: (guest) => {
        set((state) => ({ guests: [...state.guests, guest] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(guest.id) !== null) return;
        const propertyId = toNumericId(
          guest.propertyId ?? get().user?.propertyId ?? get().properties[0]?.propertyId ?? '',
        );
        const input: CreateGuestInput = {
          name: guest.name,
          email: guest.email,
          phone: guest.phone,
          idNumber: guest.idNumber,
          nationality: guest.nationality,
          propertyId: propertyId ?? undefined,
        };
        syncToApi(`createGuest(${guest.id})`, () => createGuest(input), (data) => {
          const dto = data as ApiGuest;
          get().reconcileGuest(guest.id, String(dto.id));
        });
      },
      updateGuest: (id, updates) => {
        set((state) => ({
          guests: state.guests.map((g) => g.id === id ? { ...g, ...updates } : g)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        const current = get().guests.find((g) => g.id === id);
        if (!current) return;
        // Name, phone, nationality, notes always sent — the handler overwrites
        // them unconditionally, so omitting would wipe the stored values.
        const input: UpdateGuestInput = {
          name: updates.name ?? current.name,
          phone: updates.phone ?? current.phone,
          nationality: updates.nationality ?? current.nationality,
          notes: updates.notes ?? current.notes,
          address: (updates.address ?? current.address) || null,
          emergencyContact: (updates.emergencyContact ?? current.emergencyContact) || null,
          emergencyPhone: (updates.emergencyPhone ?? current.emergencyPhone) || null,
          vipLevel: (updates.vipLevel ?? current.vipLevel) || null,
        };
        syncToApi(`updateGuest(${id})`, () => apiUpdateGuest(numericId, input));
      },
      deleteGuest: (id) => {
        set((state) => ({
          guests: state.guests.filter((g) => g.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteGuest(${id})`, () => apiDeleteGuest(numericId));
        }
      },

      // Rate Plans CRUD
      ratePlans: [],
      setRatePlans: (ratePlans) => set({ ratePlans }),
      reconcileRatePlan: (localId, serverId) => set((state) => ({
        ratePlans: state.ratePlans.map((p) => p.id === localId ? { ...p, id: serverId } : p)
      })),
      addRatePlan: (plan) => {
        set((state) => ({ ratePlans: [...state.ratePlans, plan] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(plan.id) !== null) return;
        const propertyId = toNumericId(get().user?.propertyId ?? get().properties[0]?.propertyId ?? '') ?? 1;
        const input: CreateRatePlanInput = {
          propertyId,
          name: plan.name,
          baseRate: plan.baseRate,
          season: plan.season,
          minStay: plan.minStay,
          roomTypes: plan.roomTypes,
          restrictions: plan.restrictions,
        };
        syncToApi(`createRatePlan(${plan.id})`, () => createRatePlan(input), (data) => {
          const dto = data as ApiRatePlan;
          get().reconcileRatePlan(plan.id, String(dto.id));
        });
      },
      updateRatePlan: (id, updates) => {
        set((state) => ({
          ratePlans: state.ratePlans.map((p) => p.id === id ? { ...p, ...updates } : p)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        // Sparse — omitted fields keep their current value server-side.
        const input: UpdateRatePlanInput = {
          baseRate: updates.baseRate,
          roomTypes: updates.roomTypes,
          restrictions: updates.restrictions,
          active: updates.active,
        };
        syncToApi(`updateRatePlan(${id})`, () => apiUpdateRatePlan(numericId, input));
      },
      deleteRatePlan: (id) => {
        set((state) => ({
          ratePlans: state.ratePlans.filter((p) => p.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteRatePlan(${id})`, () => apiDeleteRatePlan(numericId));
        }
      },

      // Integrations CRUD
      integrations: [],
      setIntegrations: (integrations) => set({ integrations }),
      reconcileIntegration: (localId, serverId) => set((state) => ({
        integrations: state.integrations.map((i) => i.id === localId ? { ...i, id: serverId } : i)
      })),
      addIntegration: (integration) => {
        set((state) => ({ integrations: [...state.integrations, integration] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(integration.id) !== null) return;
        const propertyId = toNumericId(get().user?.propertyId ?? get().properties[0]?.propertyId ?? '') ?? 1;
        const input: CreateIntegrationInput = {
          propertyId,
          name: integration.name,
          category: integration.category,
          description: integration.description || undefined,
          icon: integration.icon || undefined,
          apiKey: integration.apiKey,
          webhookUrl: integration.webhookUrl,
        };
        syncToApi(`createIntegration(${integration.id})`, () => createIntegration(input), (data) => {
          const dto = data as ApiIntegration;
          get().reconcileIntegration(integration.id, String(dto.id));
        });
      },
      updateIntegration: (id, updates) => {
        set((state) => ({
          integrations: state.integrations.map((i) => i.id === id ? { ...i, ...updates } : i)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        const input: UpdateIntegrationInput = {};
        if (updates.name !== undefined) input.name = updates.name;
        if (updates.category !== undefined) input.category = updates.category;
        if (updates.description !== undefined) input.description = updates.description;
        if (updates.icon !== undefined) input.icon = updates.icon;
        if (updates.apiKey !== undefined) input.apiKey = updates.apiKey;
        if (updates.webhookUrl !== undefined) input.webhookUrl = updates.webhookUrl;
        if (Object.keys(input).length > 0) {
          syncToApi(`updateIntegration(${id})`, () => apiUpdateIntegration(numericId, input));
        }
      },
      syncIntegration: (id) => {
        const numericId = toNumericId(id);
        if (numericId === null) return;
        syncToApi(`syncIntegration(${id})`, () => apiSyncIntegration(numericId), (data) => {
          const dto = data as ApiIntegration;
          // Stamp locally from the response — no follow-up PUT (the sync endpoint already wrote it).
          set((state) => ({
            integrations: state.integrations.map((i) =>
              i.id === id ? { ...i, status: 'connected', lastSync: dto.lastSync ?? '' } : i)
          }));
        });
      },
      deleteIntegration: (id) => {
        set((state) => ({
          integrations: state.integrations.filter((i) => i.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteIntegration(${id})`, () => apiDeleteIntegration(numericId));
        }
      },

      // Settings
      settings: defaultSettings,
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),

      // Tickets CRUD
      tickets: [],
      setTickets: (tickets) => set({ tickets }),
      reconcileTicket: (localId, serverId, serverTicketNumber) => set((state) => ({
        tickets: state.tickets.map((t) => t.id === localId
          ? { ...t, id: serverId, ticketNumber: serverTicketNumber }
          : t)
      })),
      addTicket: (ticket) => {
        set((state) => ({ tickets: [...state.tickets, ticket] }));
        if (toNumericId(ticket.id) !== null) return;
        const propertyId = toNumericId(ticket.propertyId);
        const reporterId = toNumericId(ticket.reporterId ?? get().user?.id ?? '');
        if (propertyId === null || reporterId === null) return;
        const input: CreateTicketInput = {
          propertyId,
          reporterId,
          title: ticket.title,
          description: ticket.description,
          type: ticket.type,
          category: ticket.category,
          priority: ticket.priority,
          roomId: ticket.roomId ? toNumericId(ticket.roomId) : null,
          guestId: ticket.guestId ? toNumericId(ticket.guestId) : null,
          dueDate: ticket.dueDate ?? null,
          tags: ticket.tags,
        };
        syncToApi(`createTicket(${ticket.id})`, () => createTicket(input), (data) => {
          const dto = data as ApiTicket;
          get().reconcileTicket(ticket.id, String(dto.id), dto.ticketNumber);
        });
      },
      updateTicket: (id, updates) => {
        set((state) => ({
          tickets: state.tickets.map((t) => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        // Status and assignee have endpoints; everything else stays local.
        if (updates.status !== undefined) {
          syncToApi(`changeTicketStatus(${id})`, () => changeTicketStatus(numericId, updates.status!));
        }
        if (updates.assigneeId !== undefined) {
          const assigneeId = toNumericId(updates.assigneeId);
          if (assigneeId !== null) {
            syncToApi(`assignTicket(${id})`, () => assignTicket(numericId, assigneeId));
          }
        }
      },
      deleteTicket: (id) => {
        set((state) => ({
          tickets: state.tickets.filter((t) => t.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteTicket(${id})`, () => apiDeleteTicket(numericId));
        }
      },
      addTicketComment: (ticketId, comment) => {
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === ticketId ? { ...t, comments: [...t.comments, comment] } : t
          )
        }));
        const numericId = toNumericId(ticketId);
        const userId = toNumericId(comment.userId);
        if (numericId === null || userId === null) return;
        syncToApi(`addTicketComment(${ticketId})`, () =>
          apiAddTicketComment(numericId, userId, comment.content, comment.isInternal));
      },

      // Invoices CRUD
      invoices: [],
      setInvoices: (invoices) => set({ invoices }),
      reconcileInvoice: (localId, server) => set((state) => ({
        invoices: state.invoices.map((i) => i.id === localId
          ? {
              ...i,
              ...server,
              guestName: server.guestName || i.guestName,
              guestEmail: server.guestEmail || i.guestEmail,
              notes: server.notes ?? i.notes,
            }
          : i)
      })),
      addInvoice: (invoice) => {
        set((state) => ({ invoices: [...state.invoices, invoice] }));
        if (toNumericId(invoice.id) !== null) return;
        const propertyId = toNumericId(invoice.propertyId);
        const guestId = toNumericId(invoice.guestId);
        if (propertyId === null || guestId === null) return;
        const input: CreateInvoiceInput = {
          propertyId,
          guestId,
          bookingId: invoice.bookingId ? toNumericId(invoice.bookingId) : null,
          type: invoice.type,
          dueDate: invoice.dueDate,
          discountAmount: invoice.discountAmount,
          notes: invoice.notes ?? '',
          items: invoice.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            taxRate: it.taxRate,
            category: it.category,
          })),
          createdBy: invoice.createdBy,
        };
        syncToApi(`createInvoice(${invoice.id})`, () => createInvoice(input), (data) => {
          const dto = data as ApiInvoice;
          get().reconcileInvoice(invoice.id, mapInvoice(dto));
        });
      },
      updateInvoice: (id, updates) => {
        const prev = get().invoices.find((i) => i.id === id);
        set((state) => ({
          invoices: state.invoices.map((i) => i.id === id ? { ...i, ...updates } : i)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        // No generic PUT — only payment recording has an endpoint.
        const delta = (updates.paidAmount ?? 0) - (prev?.paidAmount ?? 0);
        if (updates.paidAmount !== undefined && delta > 0) {
          const method = updates.paymentMethod ?? prev?.paymentMethod ?? 'card';
          syncToApi(`recordInvoicePayment(${id})`, () => recordInvoicePayment(numericId, delta, method));
        }
      },
      deleteInvoice: (id) => {
        set((state) => ({
          invoices: state.invoices.filter((i) => i.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteInvoice(${id})`, () => apiDeleteInvoice(numericId));
        }
      },

      // Payments CRUD
      payments: [],
      setPayments: (payments) => set({ payments }),
      reconcilePayment: (localId, serverId, serverPaymentNumber) => set((state) => ({
        payments: state.payments.map((p) => p.id === localId
          ? { ...p, id: serverId, paymentNumber: serverPaymentNumber }
          : p)
      })),
      addPayment: (payment) => {
        set((state) => ({ payments: [...state.payments, payment] }));
        if (toNumericId(payment.id) !== null) return;
        const propertyId = toNumericId(payment.propertyId);
        const guestId = toNumericId(payment.guestId);
        if (propertyId === null || guestId === null) return;
        const input: CreatePaymentInput = {
          propertyId,
          guestId,
          invoiceId: payment.invoiceId ? toNumericId(payment.invoiceId) : null,
          bookingId: payment.bookingId ? toNumericId(payment.bookingId) : null,
          amount: payment.amount,
          method: payment.method,
          processedBy: payment.processedBy,
          reference: payment.reference ?? null,
        };
        syncToApi(`createPayment(${payment.id})`, () => createPayment(input), (data) => {
          const dto = data as ApiPayment;
          get().reconcilePayment(payment.id, String(dto.id), dto.paymentNumber);
          // The API creates payments as pending — if the row was logged as
          // already settled, run the complete transition right after.
          if (payment.status === 'completed') {
            syncToApi(`completePayment(${dto.id})`, () => completePayment(dto.id, payment.transactionId ?? null));
          }
        });
      },
      updatePayment: (id, updates) => {
        set((state) => ({
          payments: state.payments.map((p) => p.id === id ? { ...p, ...updates } : p)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        // Complete and refund have endpoints; everything else stays local.
        if (updates.status === 'completed') {
          const transactionId = updates.transactionId ?? null;
          syncToApi(`completePayment(${id})`, () => completePayment(numericId, transactionId));
        }
        if (updates.status === 'refunded') {
          syncToApi(`refundPayment(${id})`, () => refundPayment(numericId));
        }
      },
      deletePayment: (id) => {
        // No DELETE endpoint — local-only.
        set((state) => ({
          payments: state.payments.filter((p) => p.id !== id)
        }));
      },

      // Audit Logs
      auditLogs: [],
      setAuditLogs: (auditLogs) => set({ auditLogs }),
      addAuditLog: (log) => {
        set((state) => ({ auditLogs: [log, ...state.auditLogs] }));
        // Append-only server-side — no reconcile, the API stamps id and timestamp itself.
        if (toNumericId(log.id) !== null) return;
        const propertyId = toNumericId(get().user?.propertyId ?? get().properties[0]?.propertyId ?? '') ?? 1;
        const input: CreateAuditLogInput = {
          propertyId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          entityName: log.entityName,
          details: log.details,
          oldValue: log.oldValue,
          newValue: log.newValue,
        };
        // Audit writes are admin/manager-only server-side — other roles keep
        // their log locally, so a 403 here is expected and not worth a toast.
        syncToApi(`createAuditLog(${log.id})`, () => createAuditLog(input), undefined, () => undefined);
      },

      // Tax Configs CRUD
      taxConfigs: [],
      setTaxConfigs: (taxConfigs) => set({ taxConfigs }),
      reconcileTaxConfig: (localId, serverId) => set((state) => ({
        taxConfigs: state.taxConfigs.map((t) => t.id === localId ? { ...t, id: serverId } : t)
      })),
      addTaxConfig: (config) => {
        set((state) => ({ taxConfigs: [...state.taxConfigs, config] }));
        if (toNumericId(config.id) !== null) return;
        const propertyId = toNumericId(get().user?.propertyId ?? get().properties[0]?.propertyId ?? '') ?? 1;
        const input: CreateTaxConfigInput = {
          propertyId,
          name: config.name,
          rate: config.rate,
          type: config.type,
          included: config.included,
          applicableTo: config.applicableTo,
          validFrom: config.validFrom,
        };
        syncToApi(`createTaxConfig(${config.id})`, () => createTaxConfig(input), (data) => {
          const dto = data as ApiTaxConfig;
          get().reconcileTaxConfig(config.id, String(dto.id));
        });
      },
      updateTaxConfig: (id, updates) => {
        set((state) => ({
          taxConfigs: state.taxConfigs.map((t) => t.id === id ? { ...t, ...updates } : t)
        }));
        const numericId = toNumericId(id);
        if (numericId === null) return;
        // Name, type, and window start are immutable server-side — only the mutable fields go over the wire.
        const input: UpdateTaxConfigInput = {};
        if (updates.rate !== undefined) input.rate = updates.rate;
        if (updates.included !== undefined) input.included = updates.included;
        if (updates.active !== undefined) input.active = updates.active;
        if (updates.validTo !== undefined) input.validTo = updates.validTo;
        if (updates.applicableTo !== undefined) input.applicableTo = updates.applicableTo;
        if (Object.keys(input).length > 0) {
          syncToApi(`updateTaxConfig(${id})`, () => apiUpdateTaxConfig(numericId, input));
        }
      },
      deleteTaxConfig: (id) => {
        set((state) => ({
          taxConfigs: state.taxConfigs.filter((t) => t.id !== id)
        }));
        const numericId = toNumericId(id);
        if (numericId !== null) {
          syncToApi(`deleteTaxConfig(${id})`, () => apiDeleteTaxConfig(numericId));
        }
      },
    }),
    {
      name: 'aquri-pms-storage',
      partialize: (state) => ({
        bookings: state.bookings,
        guests: state.guests,
        rooms: state.rooms,
        users: state.users,
        properties: state.properties,
        settings: state.settings,
        integrations: state.integrations,
        ratePlans: state.ratePlans,
        expenses: state.expenses,
        inventory: state.inventory,
        maintenanceTickets: state.maintenanceTickets,
        workflows: state.workflows,
        messages: state.messages,
        sidebarCollapsed: state.sidebarCollapsed,
        tickets: state.tickets,
        invoices: state.invoices,
        payments: state.payments,
        auditLogs: state.auditLogs,
        taxConfigs: state.taxConfigs,
        aiInsights: state.aiInsights,
        rfidTags: state.rfidTags,
        attendance: state.attendance,
        shifts: state.shifts,
        electricity: state.electricity,
      }),
    }
  )
);
