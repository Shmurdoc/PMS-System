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
  createExpense,
  createGuest,
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
  deleteExpense,
  deleteGuest as apiDeleteGuest,
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
  tapGuestTag,
  tapStaffTag,
  updateAiInsight as apiUpdateAiInsight,
  updateAttendance as apiUpdateAttendance,
  updateExpense,
  updateGuest as apiUpdateGuest,
  updateInventoryItem,
  updateMaintenanceRequest,
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
  CreateExpenseInput,
  CreateGuestInput,
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
  UpdateExpenseInput,
  UpdateGuestInput,
  UpdateInventoryItemInput,
  UpdateMaintenanceInput,
  UpdateRatePlanInput,
  UpdateShiftInput,
  UpdateTaxConfigInput,
  UpdateUserInput,
  UpdateWorkflowInput,
} from '../lib/api/services';
import type {
  ApiAiInsight,
  ApiAttendance,
  ApiBooking,
  ApiExpense,
  ApiGuest,
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
// onErr, when given, surfaces the failure to the user instead of only logging it.
function syncToApi(label: string, task: () => Promise<unknown>, onOk?: (data: unknown) => void, onErr?: (error: unknown) => void): void {
  if (!getAuthToken()) return;
  void task()
    .then((data) => onOk?.(data))
    .catch((error) => {
      console.warn(`[api] ${label} failed:`, error);
      onErr?.(error);
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
  entityType: 'booking' | 'guest' | 'room' | 'invoice' | 'payment' | 'ticket' | 'user' | 'property' | 'expense' | 'inventory' | 'workflow' | 'rfid_tag';
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
  reconcileProperty: (localId: string, serverId: string) => void;

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
  addElectricity: (record: ElectricityRecord) => void;
  updateElectricity: (id: string, updates: Partial<ElectricityRecord>) => void;
  deleteElectricity: (id: string) => void;

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
  reconcileInvoice: (localId: string, serverId: string, serverInvoiceNumber: string) => void;
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
  addIntegration: (integration: Integration) => void;
  updateIntegration: (id: string, updates: Partial<Integration>) => void;
  deleteIntegration: (id: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // UI State
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  activePage: string;
  setActivePage: (page: string) => void;
}

// ============================================
// MOCK DATA
// ============================================

const mockUsers: User[] = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah@nexus.com', role: 'General Manager', department: 'Management', phone: '+27 82 123 4567', hireDate: '2022-01-15', status: 'active' },
  { id: '2', name: 'Mike Chen', email: 'mike@nexus.com', role: 'Front Desk Manager', department: 'Front Desk', phone: '+27 82 234 5678', hireDate: '2021-06-01', status: 'active' },
  { id: '3', name: 'Emma Williams', email: 'emma@nexus.com', role: 'Housekeeping Supervisor', department: 'Housekeeping', phone: '+27 82 345 6789', hireDate: '2020-03-20', status: 'active' },
  { id: '4', name: 'James Brown', email: 'james@nexus.com', role: 'Maintenance Manager', department: 'Maintenance', phone: '+27 82 456 7890', hireDate: '2019-11-10', status: 'active' },
  { id: '5', name: 'Lisa Anderson', email: 'lisa@nexus.com', role: 'Finance Manager', department: 'Finance', phone: '+27 82 567 8901', hireDate: '2021-02-28', status: 'active' },
  { id: '6', name: 'David Martinez', email: 'david@nexus.com', role: 'Chef', department: 'Kitchen', phone: '+27 82 678 9012', hireDate: '2022-05-15', status: 'active' },
  { id: '7', name: 'Amy Taylor', email: 'amy@nexus.com', role: 'Concierge', department: 'Front Desk', phone: '+27 82 789 0123', hireDate: '2023-01-10', status: 'active' },
  { id: '8', name: 'Robert Kim', email: 'robert@nexus.com', role: 'Security Officer', department: 'Security', phone: '+27 82 890 1234', hireDate: '2020-08-05', status: 'active' },
];

const mockProperties: Property[] = [
  { id: '1', name: 'Nexus Grand Hotel', address: '123 Main Street, Sandton, Johannesburg', totalRooms: 150, occupiedRooms: 120, rating: 4.8, image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400', status: 'operational', phone: '+27 11 123 4567', email: 'grand@nexus.com', manager: 'Sarah Johnson', checkInTime: '14:00', checkOutTime: '11:00' },
  { id: '2', name: 'Nexus Beach Resort', address: '45 Marine Drive, Durban', totalRooms: 80, occupiedRooms: 65, rating: 4.6, image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400', status: 'operational', phone: '+27 31 234 5678', email: 'beach@nexus.com', manager: 'Mike Chen', checkInTime: '15:00', checkOutTime: '10:00' },
  { id: '3', name: 'Nexus City Lodge', address: '78 Church Street, Cape Town', totalRooms: 45, occupiedRooms: 38, rating: 4.5, image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400', status: 'operational', phone: '+27 21 345 6789', email: 'city@nexus.com', manager: 'Lisa Anderson', checkInTime: '14:00', checkOutTime: '11:00' },
  { id: '4', name: 'Nexus Garden Inn', address: '12 Botanical Road, Pretoria', totalRooms: 30, occupiedRooms: 22, rating: 4.3, image: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=400', status: 'operational', phone: '+27 12 456 7890', email: 'garden@nexus.com', manager: 'Emma Williams', checkInTime: '14:00', checkOutTime: '10:00' },
];

const mockRooms: Room[] = [
  { id: '101', propertyId: '1', number: '101', type: 'Standard Suite', floor: 1, status: 'available', price: 1500, description: 'Comfortable room with city view', amenities: ['WiFi', 'TV', 'AC'], image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400', maxOccupancy: 2, bedType: 'Queen', size: 28, view: 'City' },
  { id: '102', propertyId: '1', number: '102', type: 'Deluxe Room', floor: 1, status: 'occupied', price: 2200, description: 'Spacious room with balcony', amenities: ['WiFi', 'TV', 'AC', 'Mini Bar'], image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=400', maxOccupancy: 2, bedType: 'King', size: 35, view: 'Garden' },
  { id: '103', propertyId: '1', number: '103', type: 'Standard Suite', floor: 1, status: 'cleaning', price: 1500, description: 'Standard room recently cleaned', amenities: ['WiFi', 'TV', 'AC'], image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400', maxOccupancy: 2, bedType: 'Queen', size: 28, view: 'City' },
  { id: '201', propertyId: '1', number: '201', type: 'Executive Suite', floor: 2, status: 'available', price: 3500, description: 'Luxury suite with separate living area', amenities: ['WiFi', 'TV', 'AC', 'Jacuzzi', 'Room Service'], image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400', maxOccupancy: 3, bedType: 'King', size: 55, view: 'Panoramic' },
  { id: '202', propertyId: '1', number: '202', type: 'Deluxe Room', floor: 2, status: 'maintenance', price: 2200, description: 'Under maintenance', amenities: ['WiFi', 'TV', 'AC'], image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=400', maxOccupancy: 2, bedType: 'King', size: 35, view: 'City' },
  { id: '301', propertyId: '1', number: '301', type: 'Presidential Suite', floor: 3, status: 'occupied', price: 8500, description: 'Ultimate luxury with panoramic views', amenities: ['WiFi', 'TV', 'AC', 'Jacuzzi', 'Butler Service', 'Private Pool'], image: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=400', maxOccupancy: 4, bedType: 'King', size: 120, view: 'Panoramic' },
  { id: '401', propertyId: '2', number: '401', type: 'Ocean View', floor: 4, status: 'available', price: 2800, description: 'Stunning ocean views', amenities: ['WiFi', 'TV', 'AC', 'Balcony'], image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=400', maxOccupancy: 2, bedType: 'King', size: 40, view: 'Ocean' },
  { id: '402', propertyId: '2', number: '402', type: 'Beach Villa', floor: 4, status: 'occupied', price: 5500, description: 'Private villa steps from beach', amenities: ['WiFi', 'TV', 'AC', 'Private Pool', 'Butler'], image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400', maxOccupancy: 4, bedType: 'King', size: 85, view: 'Beach' },
];

const mockMessages: Message[] = [
  { id: '1', senderId: '2', senderName: 'Mike Chen', content: 'Morning team! Please ensure all checkout rooms are ready by 11 AM today.', timestamp: '2025-03-26T08:30:00', read: false, type: 'text' },
  { id: '2', senderId: '3', senderName: 'Emma Williams', content: 'Housekeeping report: 85% rooms completed, 15% in progress.', timestamp: '2025-03-26T09:15:00', read: true, type: 'text' },
  { id: '3', senderId: '4', senderName: 'James Brown', content: 'Pool pump maintenance completed. All systems operational.', timestamp: '2025-03-26T10:00:00', read: true, type: 'text' },
  { id: '4', senderId: '5', senderName: 'Lisa Anderson', content: 'Q1 financial report is ready for review. Revenue up 12% YoY.', timestamp: '2025-03-26T11:30:00', read: false, type: 'text' },
  { id: '5', senderId: '6', senderName: 'David Martinez', content: 'Kitchen inventory check complete. Need to reorder seafood supplies.', timestamp: '2025-03-26T12:00:00', read: false, type: 'text' },
];

const mockRfidTags: RfidTag[] = [
  { id: '1', propertyId: '1', kind: 'staff', tagNumber: 'RFID-001', userId: '1', userName: 'Sarah Johnson', status: 'active', accessLevel: 'Full Access', createdAt: '2024-01-15', lastUsed: '2025-03-26T08:00:00' },
  { id: '2', propertyId: '1', kind: 'staff', tagNumber: 'RFID-002', userId: '2', userName: 'Mike Chen', status: 'active', accessLevel: 'Front Desk', createdAt: '2024-02-01', lastUsed: '2025-03-26T07:45:00' },
  { id: '3', propertyId: '1', kind: 'staff', tagNumber: 'RFID-003', userId: '3', userName: 'Emma Williams', status: 'active', accessLevel: 'Housekeeping', createdAt: '2024-02-15', lastUsed: '2025-03-26T07:30:00' },
  { id: '4', propertyId: '1', kind: 'staff', tagNumber: 'RFID-004', userId: '4', userName: 'James Brown', status: 'inactive', accessLevel: 'Maintenance', createdAt: '2024-03-01', lastUsed: '2025-03-25T18:00:00' },
  { id: '5', propertyId: '1', kind: 'staff', tagNumber: 'RFID-005', userId: '5', userName: 'Lisa Anderson', status: 'active', accessLevel: 'Finance', createdAt: '2024-03-15', lastUsed: '2025-03-26T08:15:00' },
  { id: '6', propertyId: '1', kind: 'staff', tagNumber: 'RFID-006', userId: '8', userName: 'Robert Kim', status: 'active', accessLevel: 'Security', createdAt: '2024-04-01', lastUsed: '2025-03-26T06:00:00' },
  // Guest card bound to a mock stay — expires at checkout, so taps fail the expiry guard.
  { id: '7', propertyId: '1', kind: 'guest', tagNumber: 'RFID-G-100001', bookingId: 'BK001', guestName: 'Sarah Johnson', roomNumber: '301', status: 'active', accessLevel: 'Room 301', createdAt: '2026-03-20', expiresAt: '2026-03-30' },
];

const mockAttendance: AttendanceRecord[] = [
  { id: '1', userId: '1', userName: 'Sarah Johnson', checkIn: '2025-03-26T08:00:00', date: '2025-03-26', status: 'present' },
  { id: '2', userId: '2', userName: 'Mike Chen', checkIn: '2025-03-26T07:45:00', date: '2025-03-26', status: 'present' },
  { id: '3', userId: '3', userName: 'Emma Williams', checkIn: '2025-03-26T07:30:00', date: '2025-03-26', status: 'present' },
  { id: '4', userId: '4', userName: 'James Brown', checkIn: '2025-03-26T08:30:00', date: '2025-03-26', status: 'late' },
  { id: '5', userId: '5', userName: 'Lisa Anderson', checkIn: '2025-03-26T08:15:00', date: '2025-03-26', status: 'present' },
  { id: '6', userId: '6', userName: 'David Martinez', checkIn: '2025-03-26T06:00:00', date: '2025-03-26', status: 'present' },
  { id: '7', userId: '7', userName: 'Amy Taylor', checkIn: '2025-03-26T07:00:00', date: '2025-03-26', status: 'present' },
  { id: '8', userId: '8', userName: 'Robert Kim', checkIn: '2025-03-26T06:00:00', date: '2025-03-26', status: 'present' },
];

const mockShifts: Shift[] = [
  { id: '1', userId: '2', userName: 'Mike Chen', startTime: '07:00', endTime: '15:00', date: '2025-03-26', role: 'Front Desk', status: 'scheduled', department: 'Front Desk' },
  { id: '2', userId: '7', userName: 'Amy Taylor', startTime: '15:00', endTime: '23:00', date: '2025-03-26', role: 'Front Desk', status: 'scheduled', department: 'Front Desk' },
  { id: '3', userId: '3', userName: 'Emma Williams', startTime: '06:00', endTime: '14:00', date: '2025-03-26', role: 'Housekeeping', status: 'completed', department: 'Housekeeping' },
  { id: '4', userId: '6', userName: 'David Martinez', startTime: '06:00', endTime: '14:00', date: '2025-03-26', role: 'Kitchen', status: 'completed', department: 'Kitchen' },
  { id: '5', userId: '4', userName: 'James Brown', startTime: '08:00', endTime: '17:00', date: '2025-03-26', role: 'Maintenance', status: 'scheduled', department: 'Maintenance' },
  { id: '6', userId: '8', userName: 'Robert Kim', startTime: '18:00', endTime: '06:00', date: '2025-03-26', role: 'Security', status: 'scheduled', department: 'Security' },
];

const mockExpenses: Expense[] = [
  { id: '1', category: 'Supplies', amount: 2500, description: 'Cleaning supplies and toiletries', date: '2025-03-25', status: 'approved', submittedBy: 'Emma Williams', approvedBy: 'Sarah Johnson', approvedAt: '2025-03-25', propertyId: '1' },
  { id: '2', category: 'Maintenance', amount: 8500, description: 'HVAC system repair', date: '2025-03-24', status: 'approved', submittedBy: 'James Brown', approvedBy: 'Sarah Johnson', approvedAt: '2025-03-24', propertyId: '1' },
  { id: '3', category: 'Food & Beverage', amount: 12000, description: 'Weekly produce order', date: '2025-03-23', status: 'approved', submittedBy: 'David Martinez', approvedBy: 'Lisa Anderson', approvedAt: '2025-03-23', propertyId: '1' },
  { id: '4', category: 'Utilities', amount: 45000, description: 'March electricity bill', date: '2025-03-20', status: 'approved', submittedBy: 'Lisa Anderson', approvedBy: 'Sarah Johnson', approvedAt: '2025-03-20', propertyId: '1' },
  { id: '5', category: 'Marketing', amount: 8000, description: 'Online advertising campaign', date: '2025-03-18', status: 'pending', submittedBy: 'Sarah Johnson', propertyId: '1' },
  { id: '6', category: 'Supplies', amount: 1500, description: 'Office stationery', date: '2025-03-26', status: 'pending', submittedBy: 'Mike Chen', propertyId: '1' },
];

const mockInventory: InventoryItem[] = [
  { id: '1', name: 'King Size Sheets', category: 'Linens', quantity: 150, unit: 'sets', reorderLevel: 50, price: 450, supplier: 'Textile Co', sku: 'LIN-KSS-001', location: 'Main Store' },
  { id: '2', name: 'Towels (Bath)', category: 'Linens', quantity: 80, unit: 'pieces', reorderLevel: 30, price: 180, supplier: 'Textile Co', sku: 'LIN-TWL-001', location: 'Main Store' },
  { id: '3', name: 'Shampoo', category: 'Toiletries', quantity: 200, unit: 'bottles', reorderLevel: 50, price: 45, supplier: 'Hotel Supplies', sku: 'TOI-SHP-001', location: 'Amenity Room' },
  { id: '4', name: 'Soap Bars', category: 'Toiletries', quantity: 300, unit: 'pieces', reorderLevel: 100, price: 12, supplier: 'Hotel Supplies', sku: 'TOI-SOP-001', location: 'Amenity Room' },
  { id: '5', name: 'Coffee Beans', category: 'Kitchen', quantity: 25, unit: 'kg', reorderLevel: 10, price: 280, supplier: 'Coffee Masters', sku: 'KIT-COF-001', location: 'Kitchen Store' },
  { id: '6', name: 'Tea Bags', category: 'Kitchen', quantity: 500, unit: 'bags', reorderLevel: 200, price: 8, supplier: 'Coffee Masters', sku: 'KIT-TEA-001', location: 'Kitchen Store' },
  { id: '7', name: 'Minibar Snacks', category: 'F&B', quantity: 100, unit: 'items', reorderLevel: 30, price: 35, supplier: 'Snack Distributors', sku: 'FNB-SNK-001', location: 'F&B Store' },
  { id: '8', name: 'Cleaning Solution', category: 'Maintenance', quantity: 40, unit: 'liters', reorderLevel: 15, price: 120, supplier: 'Clean Pro', sku: 'MNT-CLN-001', location: 'Maintenance Store' },
];

const mockElectricity: ElectricityRecord[] = [
  { id: '1', date: '2025-03-26', consumption: 1250, cost: 3125, peakDemand: 180, zone: 'Main Building' },
  { id: '2', date: '2025-03-25', consumption: 1380, cost: 3450, peakDemand: 195, zone: 'Main Building' },
  { id: '3', date: '2025-03-24', consumption: 1420, cost: 3550, peakDemand: 200, zone: 'Main Building' },
  { id: '4', date: '2025-03-23', consumption: 1290, cost: 3225, peakDemand: 185, zone: 'Main Building' },
  { id: '5', date: '2025-03-22', consumption: 1150, cost: 2875, peakDemand: 170, zone: 'Main Building' },
  { id: '6', date: '2025-03-21', consumption: 980, cost: 2450, peakDemand: 150, zone: 'Main Building' },
  { id: '7', date: '2025-03-26', consumption: 450, cost: 1125, peakDemand: 65, zone: 'Annex' },
  { id: '8', date: '2025-03-25', consumption: 480, cost: 1200, peakDemand: 70, zone: 'Annex' },
];

const mockMaintenanceTickets: MaintenanceTicket[] = [
  { id: '1', roomId: '202', title: 'AC Unit Repair', description: 'Air conditioning not cooling properly in room 202', priority: 'high', status: 'in_progress', assignedTo: 'James Brown', createdAt: '2025-03-25T10:00:00', propertyId: '1' },
  { id: '2', roomId: '103', title: 'Bathroom Faucet Leak', description: 'Dripping faucet in bathroom', priority: 'medium', status: 'pending', createdAt: '2025-03-26T08:30:00', propertyId: '1' },
  { id: '3', title: 'Pool Pump Maintenance', description: 'Quarterly maintenance for pool filtration system', priority: 'medium', status: 'completed', assignedTo: 'James Brown', createdAt: '2025-03-24T09:00:00', completedAt: '2025-03-26T14:00:00', propertyId: '1' },
  { id: '4', title: 'Elevator Inspection', description: 'Annual safety inspection for main elevator', priority: 'high', status: 'scheduled', createdAt: '2025-03-20T11:00:00', propertyId: '1' },
  { id: '5', roomId: '301', title: 'TV Remote Replacement', description: 'Guest reported non-functional TV remote', priority: 'low', status: 'completed', assignedTo: 'James Brown', createdAt: '2025-03-25T16:00:00', completedAt: '2025-03-26T09:00:00', propertyId: '1' },
];

const mockAiInsights: AiInsight[] = [
  { id: '1', type: 'revenue', title: 'Revenue Optimization', description: 'Based on current booking trends and seasonal patterns', recommendation: 'Consider increasing weekend rates by 15% for April', impact: 'high', timestamp: '2025-03-26T08:00:00' },
  { id: '2', type: 'occupancy', title: 'Occupancy Forecast', description: 'Predictive analysis of room demand', recommendation: 'Expected 92% occupancy next week - optimize staff scheduling', impact: 'high', timestamp: '2025-03-26T07:30:00' },
  { id: '3', type: 'staffing', title: 'Staffing Recommendation', description: 'Workload analysis based on occupancy', recommendation: 'Add 2 housekeeping staff for afternoon shift on Friday', impact: 'medium', timestamp: '2025-03-26T09:00:00' },
  { id: '4', type: 'maintenance', title: 'Predictive Maintenance', description: 'Equipment health monitoring', recommendation: 'Schedule HVAC inspection within next 2 weeks', impact: 'medium', timestamp: '2025-03-26T10:00:00' },
  { id: '5', type: 'guest', title: 'Guest Experience', description: 'Satisfaction prediction based on reviews', recommendation: 'Focus on breakfast service quality - recent feedback mentions delays', impact: 'high', timestamp: '2025-03-26T11:00:00' },
];

const mockWorkflows: Workflow[] = [
  { id: '1', name: 'Guest Check-in Welcome', trigger: 'On check-in', actions: ['Send welcome email', 'Notify housekeeping', 'Update preferences'], status: 'active', lastRun: '2025-03-26T08:00:00', description: 'Automated welcome sequence for arriving guests' },
  { id: '2', name: 'Low Inventory Alert', trigger: 'Stock below reorder level', actions: ['Notify manager', 'Create purchase order', 'Log alert'], status: 'active', lastRun: '2025-03-26T07:00:00', description: 'Alert when inventory drops below threshold' },
  { id: '3', name: 'Late Checkout Auto-Extension', trigger: 'Check-out time exceeded', actions: ['Send notification', 'Apply late fee', 'Update room status'], status: 'inactive', lastRun: '2025-03-25T14:00:00', description: 'Handle late checkout scenarios automatically' },
  { id: '4', name: 'Maintenance Escalation', trigger: 'Ticket unresolved for 48hrs', actions: ['Escalate to manager', 'Notify department head', 'Log incident'], status: 'active', lastRun: '2025-03-25T12:00:00', description: 'Escalate unresolved maintenance tickets' },
];

const mockTickets: Ticket[] = [
  { id: 'TKT-001', ticketNumber: 'TKT-001', title: 'AC not cooling in Room 301', description: 'Guest reports air conditioning is not working properly. Room temperature remains high despite thermostat settings.', type: 'issue', category: 'maintenance', priority: 'high', status: 'in_progress', assigneeId: '4', assigneeName: 'James Brown', reporterId: '2', reporterName: 'Mike Chen', propertyId: '1', roomId: '301', guestId: '1', guestName: 'Sarah Johnson', dueDate: '2026-03-27', tags: ['ac', 'maintenance', 'urgent'], attachments: [], comments: [{ id: 'c1', ticketId: 'TKT-001', userId: '4', userName: 'James Brown', content: 'Technician dispatched. Arrival in 15 minutes.', isInternal: false, createdAt: '2026-03-26T09:00:00' }], createdAt: '2026-03-26T08:30:00', updatedAt: '2026-03-26T09:00:00' },
  { id: 'TKT-002', ticketNumber: 'TKT-002', title: 'Late checkout request', description: 'Guest requests late checkout until 2 PM due to flight schedule.', type: 'request', category: 'front_desk', priority: 'medium', status: 'pending', assigneeId: '2', assigneeName: 'Mike Chen', reporterId: '2', reporterName: 'Mike Chen', propertyId: '1', roomId: '201', guestId: '2', guestName: 'Michael Chen', dueDate: '2026-03-26', tags: ['checkout', 'guest-request'], attachments: [], comments: [], createdAt: '2026-03-26T07:00:00', updatedAt: '2026-03-26T07:00:00' },
  { id: 'TKT-003', ticketNumber: 'TKT-003', title: 'Pool area maintenance needed', description: 'Pool pump making unusual noise. Requires inspection before peak season.', type: 'task', category: 'maintenance', priority: 'urgent', status: 'open', assigneeId: '4', assigneeName: 'James Brown', reporterId: '1', reporterName: 'Sarah Johnson', propertyId: '1', tags: ['pool', 'maintenance', 'equipment'], attachments: [], comments: [], createdAt: '2026-03-25T14:00:00', updatedAt: '2026-03-25T14:00:00' },
  { id: 'TKT-004', ticketNumber: 'TKT-004', title: 'WiFi connectivity issues', description: 'Guest experiencing slow WiFi in Room 102. Already restarted router.', type: 'issue', category: 'it', priority: 'medium', status: 'resolved', assigneeId: '8', assigneeName: 'Robert Kim', reporterId: '6', reporterName: 'James Brown', propertyId: '1', roomId: '102', tags: ['wifi', 'it', 'resolved'], attachments: [], comments: [{ id: 'c2', ticketId: 'TKT-004', userId: '8', userName: 'Robert Kim', content: 'Router firmware updated. Issue resolved.', isInternal: false, createdAt: '2026-03-25T16:00:00' }], createdAt: '2026-03-25T15:00:00', updatedAt: '2026-03-25T16:00:00', resolvedAt: '2026-03-25T16:00:00' },
  { id: 'TKT-005', ticketNumber: 'TKT-005', title: 'Extra amenities request', description: 'VIP guest requests additional bathrobes and spa appointment.', type: 'request', category: 'guest_service', priority: 'high', status: 'in_progress', assigneeId: '7', assigneeName: 'Amy Taylor', reporterId: '7', reporterName: 'Amy Taylor', propertyId: '1', roomId: '301', guestId: '1', guestName: 'Sarah Johnson', dueDate: '2026-03-26', tags: ['vip', 'amenities', 'spa'], attachments: [], comments: [], createdAt: '2026-03-26T06:30:00', updatedAt: '2026-03-26T06:30:00' },
  { id: 'TKT-006', ticketNumber: 'TKT-006', title: 'Food quality complaint', description: 'Guest complained about breakfast service delay and cold food.', type: 'incident', category: 'food_beverage', priority: 'high', status: 'pending', assigneeId: '6', assigneeName: 'David Martinez', reporterId: '3', reporterName: 'Emma Williams', propertyId: '1', guestId: '3', guestName: 'Emma Williams', tags: ['fnb', 'complaint', 'breakfast'], attachments: [], comments: [], createdAt: '2026-03-26T10:00:00', updatedAt: '2026-03-26T10:00:00' },
];

const mockInvoices: Invoice[] = [
  { id: 'INV-2026-001', invoiceNumber: 'INV-2026-001', type: 'booking', bookingId: 'BK001', guestId: '1', guestName: 'Sarah Johnson', guestEmail: 'sarah@nexus.com', propertyId: '1', items: [{ id: 'i1', description: 'Presidential Suite - 4 nights', quantity: 4, unitPrice: 8500, taxRate: 15, amount: 34000, category: 'room' }], subtotal: 34000, taxAmount: 5100, discountAmount: 0, total: 39100, currency: 'ZAR', status: 'paid', issueDate: '2026-03-20', dueDate: '2026-03-25', paidDate: '2026-03-20', paidAmount: 39100, paymentMethod: 'card', createdAt: '2026-03-20T10:00:00', createdBy: 'Mike Chen' },
  { id: 'INV-2026-002', invoiceNumber: 'INV-2026-002', type: 'booking', bookingId: 'BK002', guestId: '2', guestName: 'Michael Chen', guestEmail: 'mike@nexus.com', propertyId: '1', items: [{ id: 'i2', description: 'Executive Suite - 2 nights', quantity: 2, unitPrice: 3500, taxRate: 15, amount: 7000, category: 'room' }], subtotal: 7000, taxAmount: 1050, discountAmount: 0, total: 8050, currency: 'ZAR', status: 'paid', issueDate: '2026-03-22', dueDate: '2026-03-27', paidDate: '2026-03-22', paidAmount: 8050, paymentMethod: 'eft', createdAt: '2026-03-22T14:00:00', createdBy: 'Mike Chen' },
  { id: 'INV-2026-003', invoiceNumber: 'INV-2026-003', type: 'service', guestId: '1', guestName: 'Sarah Johnson', guestEmail: 'sarah@nexus.com', propertyId: '1', items: [{ id: 'i3', description: 'Spa Treatment - Full Body Massage', quantity: 1, unitPrice: 1500, taxRate: 15, amount: 1500, category: 'spa' }, { id: 'i4', description: 'Champagne - Dom Perignon', quantity: 1, unitPrice: 2500, taxRate: 15, amount: 2500, category: 'minibar' }], subtotal: 4000, taxAmount: 600, discountAmount: 0, total: 4600, currency: 'ZAR', status: 'pending', issueDate: '2026-03-26', dueDate: '2026-03-30', notes: 'Charge to room', createdAt: '2026-03-26T11:00:00', createdBy: 'Amy Taylor' },
  { id: 'INV-2026-004', invoiceNumber: 'INV-2026-004', type: 'booking', bookingId: 'BK003', guestId: '3', guestName: 'Emma Williams', guestEmail: 'emma@nexus.com', propertyId: '1', items: [{ id: 'i5', description: 'Standard Suite - 3 nights', quantity: 3, unitPrice: 1500, taxRate: 15, amount: 4500, category: 'room' }], subtotal: 4500, taxAmount: 675, discountAmount: 450, total: 4725, currency: 'ZAR', status: 'pending', issueDate: '2026-03-25', dueDate: '2026-03-28', createdAt: '2026-03-25T09:00:00', createdBy: 'Mike Chen' },
];

const mockPayments: Payment[] = [
  { id: 'PAY-001', paymentNumber: 'PAY-001', invoiceId: 'INV-2026-001', bookingId: 'BK001', guestId: '1', guestName: 'Sarah Johnson', propertyId: '1', amount: 39100, currency: 'ZAR', method: 'card', status: 'completed', reference: 'TXN-12345', transactionId: 'ch_abc123', processedBy: 'Mike Chen', processedAt: '2026-03-20T10:05:00', createdAt: '2026-03-20T10:00:00' },
  { id: 'PAY-002', paymentNumber: 'PAY-002', invoiceId: 'INV-2026-002', bookingId: 'BK002', guestId: '2', guestName: 'Michael Chen', propertyId: '1', amount: 8050, currency: 'ZAR', method: 'eft', status: 'completed', reference: 'EFT-67890', processedBy: 'Mike Chen', processedAt: '2026-03-22T14:10:00', createdAt: '2026-03-22T14:00:00' },
  { id: 'PAY-003', paymentNumber: 'PAY-003', bookingId: 'BK004', guestId: '4', guestName: 'David Martinez', propertyId: '1', amount: 8400, currency: 'ZAR', method: 'cash', status: 'completed', processedBy: 'Mike Chen', processedAt: '2026-03-25T15:00:00', createdAt: '2026-03-25T14:30:00' },
];

const mockAuditLogs: AuditLog[] = [
  { id: 'LOG-001', action: 'create', entityType: 'booking', entityId: 'BK001', entityName: 'Booking BK001', userId: '2', userName: 'Mike Chen', userRole: 'Front Desk Manager', details: 'New booking created for Sarah Johnson', timestamp: '2026-03-20T10:00:00' },
  { id: 'LOG-002', action: 'update', entityType: 'booking', entityId: 'BK001', entityName: 'Booking BK001', userId: '2', userName: 'Mike Chen', userRole: 'Front Desk Manager', details: 'Booking confirmed', timestamp: '2026-03-20T10:05:00' },
  { id: 'LOG-003', action: 'checkin', entityType: 'booking', entityId: 'BK001', entityName: 'Booking BK001', userId: '2', userName: 'Mike Chen', userRole: 'Front Desk Manager', details: 'Guest checked in to Room 301', timestamp: '2026-03-26T14:00:00' },
  { id: 'LOG-004', action: 'payment', entityType: 'payment', entityId: 'PAY-001', entityName: 'Payment PAY-001', userId: '2', userName: 'Mike Chen', userRole: 'Front Desk Manager', details: 'Payment received: R39,100 via card', timestamp: '2026-03-20T10:05:00' },
  { id: 'LOG-005', action: 'create', entityType: 'ticket', entityId: 'TKT-001', entityName: 'Ticket TKT-001', userId: '2', userName: 'Mike Chen', userRole: 'Front Desk Manager', details: 'Maintenance ticket created: AC not cooling', timestamp: '2026-03-26T08:30:00' },
  { id: 'LOG-006', action: 'update', entityType: 'ticket', entityId: 'TKT-001', entityName: 'Ticket TKT-001', userId: '4', userName: 'James Brown', userRole: 'Maintenance Manager', details: 'Ticket assigned to James Brown', timestamp: '2026-03-26T08:45:00' },
  { id: 'LOG-007', action: 'update', entityType: 'room', entityId: '301', entityName: 'Room 301', userId: '2', userName: 'Mike Chen', userRole: 'Front Desk Manager', oldValue: 'available', newValue: 'occupied', details: 'Room status changed to occupied', timestamp: '2026-03-26T14:00:00' },
  { id: 'LOG-008', action: 'create', entityType: 'invoice', entityId: 'INV-2026-003', entityName: 'Invoice INV-2026-003', userId: '7', userName: 'Amy Taylor', userRole: 'Concierge', details: 'Service invoice created for spa treatment', timestamp: '2026-03-26T11:00:00' },
];

const mockTaxConfigs: TaxConfig[] = [
  { id: 'TAX-001', name: 'VAT', rate: 15, type: 'vat', included: false, applicableTo: ['room', 'fnb', 'spa'], validFrom: '2024-01-01', active: true },
  { id: 'TAX-002', name: 'Tourism Levy', rate: 1, type: 'tourism_levy', included: true, applicableTo: ['room'], validFrom: '2024-01-01', active: true },
  { id: 'TAX-003', name: 'City Tax', rate: 2, type: 'city_tax', included: true, applicableTo: ['room'], validFrom: '2025-01-01', active: true },
];

const mockBookings: Booking[] = [
  { id: 'BK001', guestId: '1', guestName: 'Sarah Johnson', guestEmail: 'sarah@nexus.com', guestPhone: '+27 82 123 4567', guestSegment: 'VIP', propertyId: '1', propertyName: 'Nexus Grand Hotel', roomId: '301', roomNumber: '301', roomType: 'Presidential Suite', checkIn: '2026-03-26', checkOut: '2026-03-30', nights: 4, guests: 2, adults: 2, children: 0, status: 'checked-in', paymentStatus: 'paid', amount: 34000, ratePerNight: 8500, depositPaid: 34000, balanceDue: 0, source: 'Direct', specialRequests: 'Late checkout, Ocean view', notes: 'VIP guest - arrange champagne on arrival', createdAt: '2026-03-20' },
  { id: 'BK002', guestId: '2', guestName: 'Michael Chen', guestEmail: 'mike@nexus.com', guestPhone: '+27 82 234 5678', guestSegment: 'Corporate', propertyId: '1', propertyName: 'Nexus Grand Hotel', roomId: '201', roomNumber: '201', roomType: 'Executive Suite', checkIn: '2026-03-27', checkOut: '2026-03-29', nights: 2, guests: 1, adults: 1, children: 0, status: 'confirmed', paymentStatus: 'paid', amount: 7000, ratePerNight: 3500, depositPaid: 7000, balanceDue: 0, source: 'Booking.com', createdAt: '2026-03-22' },
  { id: 'BK003', guestId: '3', guestName: 'Emma Williams', guestEmail: 'emma@nexus.com', guestPhone: '+27 82 345 6789', guestSegment: 'New', propertyId: '1', propertyName: 'Nexus Grand Hotel', roomId: '101', roomNumber: '101', roomType: 'Standard Suite', checkIn: '2026-03-28', checkOut: '2026-03-31', nights: 3, guests: 2, adults: 2, children: 0, status: 'pending', paymentStatus: 'pending', amount: 4500, ratePerNight: 1500, depositPaid: 0, balanceDue: 4500, source: 'Expedia', createdAt: '2026-03-25' },
  { id: 'BK004', guestId: '4', guestName: 'David Martinez', guestEmail: 'david@nexus.com', guestPhone: '+27 82 456 7890', guestSegment: 'Frequent', propertyId: '2', propertyName: 'Nexus Beach Resort', roomId: '401', roomNumber: '401', roomType: 'Ocean View', checkIn: '2026-03-25', checkOut: '2026-03-28', nights: 3, guests: 4, adults: 2, children: 2, status: 'checked-in', paymentStatus: 'paid', amount: 8400, ratePerNight: 2800, depositPaid: 8400, balanceDue: 0, source: 'Direct', specialRequests: 'Extra bed, Child-friendly room', createdAt: '2026-03-18' },
  { id: 'BK005', guestId: '5', guestName: 'Lisa Anderson', guestEmail: 'lisa@nexus.com', guestPhone: '+27 82 567 8901', guestSegment: 'VIP', propertyId: '2', propertyName: 'Nexus Beach Resort', roomId: '402', roomNumber: '402', roomType: 'Beach Villa', checkIn: '2026-04-01', checkOut: '2026-04-05', nights: 4, guests: 2, adults: 2, children: 0, status: 'confirmed', paymentStatus: 'partial', amount: 22000, ratePerNight: 5500, depositPaid: 11000, balanceDue: 11000, source: 'Direct', specialRequests: 'Private dinner setup on beach', createdAt: '2026-03-23' },
  { id: 'BK006', guestId: '6', guestName: 'James Brown', guestEmail: 'james@nexus.com', guestPhone: '+27 82 678 9012', guestSegment: 'Frequent', propertyId: '1', propertyName: 'Nexus Grand Hotel', roomId: '102', roomNumber: '102', roomType: 'Deluxe Room', checkIn: '2026-03-20', checkOut: '2026-03-22', nights: 2, guests: 1, adults: 1, children: 0, status: 'checked-out', paymentStatus: 'paid', amount: 4400, ratePerNight: 2200, depositPaid: 4400, balanceDue: 0, source: 'Airbnb', createdAt: '2026-03-15' },
  { id: 'BK007', guestId: '7', guestName: 'Amy Taylor', guestEmail: 'amy@nexus.com', guestPhone: '+27 82 789 0123', guestSegment: 'New', propertyId: '3', propertyName: 'Nexus City Lodge', roomId: '101', roomNumber: '101', roomType: 'Standard', checkIn: '2026-04-02', checkOut: '2026-04-04', nights: 2, guests: 1, adults: 1, children: 0, status: 'cancelled', paymentStatus: 'refunded', amount: 1700, ratePerNight: 850, source: 'Direct', notes: 'Guest cancelled due to travel changes', createdAt: '2026-03-24' },
  { id: 'BK008', guestId: '1', guestName: 'Sarah Johnson', guestEmail: 'sarah@nexus.com', guestPhone: '+27 82 123 4567', guestSegment: 'VIP', propertyId: '1', propertyName: 'Nexus Grand Hotel', roomId: '301', roomNumber: '301', roomType: 'Presidential Suite', checkIn: '2026-04-15', checkOut: '2026-04-20', nights: 5, guests: 2, adults: 2, children: 0, status: 'confirmed', paymentStatus: 'paid', amount: 42500, ratePerNight: 8500, depositPaid: 42500, balanceDue: 0, source: 'Direct', specialRequests: 'Same room as before, early check-in', createdAt: '2026-03-26' },
];

const mockGuests: Guest[] = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah@nexus.com', phone: '+27 82 123 4567', idNumber: '7801234567890', nationality: 'USA', segment: 'VIP', totalStays: 12, loyaltyPoints: 5200, preferences: ['Ocean view', 'High floor', 'Late checkout'], notes: 'Prefers quiet rooms away from elevators', createdAt: '2025-01-15', lastVisit: '2026-03-26', vipLevel: 'platinum', address: '123 Park Avenue, New York, NY 10001' },
  { id: '2', name: 'Michael Chen', email: 'mike@nexus.com', phone: '+27 82 234 5678', idNumber: '8012345678901', nationality: 'China', segment: 'Corporate', totalStays: 8, loyaltyPoints: 3400, preferences: ['Quiet room', 'Extra pillows', 'Early check-in'], notes: 'Corporate account - Tech Corp', createdAt: '2025-03-20', lastVisit: '2026-03-27', vipLevel: 'gold', companyName: 'Tech Corp International' },
  { id: '3', name: 'Emma Williams', email: 'emma@nexus.com', phone: '+27 82 345 6789', idNumber: '9012345678902', nationality: 'UK', segment: 'New', totalStays: 1, loyaltyPoints: 200, preferences: [], notes: 'First visit', createdAt: '2026-03-25', lastVisit: '2026-03-28', vipLevel: 'standard' },
  { id: '4', name: 'David Martinez', email: 'david@nexus.com', phone: '+27 82 456 7890', idNumber: '0012345678903', nationality: 'South Africa', segment: 'Frequent', totalStays: 15, loyaltyPoints: 7800, preferences: ['Suite', 'Breakfast included', 'Gym access'], notes: 'Diamond member - always brings family', createdAt: '2024-06-10', lastVisit: '2026-03-25', vipLevel: 'diamond', address: '45 Beach Road, Durban, 4056' },
  { id: '5', name: 'Lisa Anderson', email: 'lisa@nexus.com', phone: '+27 82 567 8901', idNumber: '1012345678904', nationality: 'South Africa', segment: 'VIP', totalStays: 6, loyaltyPoints: 2100, preferences: ['Beach view', 'Spa access'], notes: 'Honeymoon couple - arrange special amenities', createdAt: '2025-08-15', lastVisit: '2026-04-01', vipLevel: 'gold' },
  { id: '6', name: 'James Brown', email: 'james@nexus.com', phone: '+27 82 678 9012', idNumber: '2012345678905', nationality: 'South Africa', segment: 'Frequent', totalStays: 4, loyaltyPoints: 1200, preferences: ['Standard room', 'No preferences'], notes: 'Regular weekend guest', createdAt: '2025-11-01', lastVisit: '2026-03-22', vipLevel: 'standard' },
  { id: '7', name: 'Amy Taylor', email: 'amy@nexus.com', phone: '+27 82 789 0123', idNumber: '3012345678906', nationality: 'Australia', segment: 'New', totalStays: 1, loyaltyPoints: 150, preferences: ['City view'], notes: 'Backpacker - extended stay', createdAt: '2026-03-24', lastVisit: '2026-04-02', vipLevel: 'standard' },
  { id: '8', name: 'Robert Kim', email: 'robert@nexus.com', phone: '+27 82 890 1234', idNumber: '4012345678907', nationality: 'South Korea', segment: 'Corporate', totalStays: 3, loyaltyPoints: 900, preferences: ['Business center access'], notes: 'Samsung corporate account', createdAt: '2026-01-10', lastVisit: '2026-03-15', vipLevel: 'gold', companyName: 'Samsung Electronics' },
];

const mockRatePlans: RatePlan[] = [
  { id: 'RP001', name: 'Peak Season', roomTypes: ['All'], baseRate: 1850, season: 'Dec-Feb', minStay: 2, active: true, restrictions: [] },
  { id: 'RP002', name: 'Off-Season', roomTypes: ['All'], baseRate: 950, season: 'Jun-Aug', minStay: 1, active: true, restrictions: [] },
  { id: 'RP003', name: 'Weekend Special', roomTypes: ['Standard', 'Deluxe'], baseRate: 1200, season: 'Year-round', minStay: 2, active: true, restrictions: ['Fri-Sun only'] },
  { id: 'RP004', name: 'Corporate', roomTypes: ['All'], baseRate: 1100, season: 'Year-round', minStay: 1, active: true, restrictions: ['Corporate ID required'] },
];

const mockIntegrations: Integration[] = [
  { id: '1', name: 'Booking.com', category: 'OTA', status: 'connected', lastSync: '2 min ago', icon: 'calendar', description: 'Sync reservations and availability' },
  { id: '2', name: 'Stripe', category: 'Payment', status: 'connected', lastSync: '5 min ago', icon: 'credit-card', description: 'Process payments securely' },
  { id: '3', name: 'Twilio SMS', category: 'Communication', status: 'disconnected', lastSync: '-', icon: 'message-square', description: 'Send SMS notifications to guests' },
  { id: '4', name: 'Google Calendar', category: 'Productivity', status: 'disconnected', lastSync: '-', icon: 'calendar', description: 'Sync bookings with calendar' },
  { id: '5', name: 'Xero Accounting', category: 'Finance', status: 'connected', lastSync: '1 hr ago', icon: 'file-text', description: 'Automatic invoice sync' },
  { id: '6', name: 'Slack', category: 'Communication', status: 'connected', lastSync: 'Just now', icon: 'message-circle', description: 'Team notifications and alerts' },
  { id: '7', name: 'Zapier', category: 'Automation', status: 'syncing', lastSync: 'Syncing...', icon: 'zap', description: 'Connect 5000+ apps' },
  { id: '8', name: 'Mailchimp', category: 'Marketing', status: 'connected', lastSync: '30 min ago', icon: 'mail', description: 'Email marketing campaigns' },
];

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
      user: mockUsers[0],
      setUser: (user) => set({ user }),

      // Users CRUD
      users: mockUsers,
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
      properties: mockProperties,
      setProperties: (properties) => set({ properties }),
      reconcileProperty: (localId, serverId) => set((state) => ({
        properties: state.properties.map((p) => p.id === localId ? { ...p, id: serverId } : p)
      })),
      addProperty: (property) => {
        set((state) => ({ properties: [...state.properties, property] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(property.id) !== null) return;
        const input: CreatePropertyInput = {
          // Tenant identifier (unique int). Non-numeric local ids get a
          // timestamp-derived value so the uniqueness check always passes.
          propertyId: toNumericId(property.id) ?? Date.now(),
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
          get().reconcileProperty(property.id, String(dto.id));
        });
      },
      updateProperty: (id, updates) => {
        set((state) => ({
          properties: state.properties.map((p) => p.id === id ? { ...p, ...updates } : p)
        }));
        // Status is the only mutable field server-side — other edits stay local.
        if (updates.status === undefined) return;
        const numericId = toNumericId(id);
        if (numericId === null) return;
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
      rooms: mockRooms,
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
      messages: mockMessages,
      setMessages: (messages) => set({ messages }),
      reconcileMessage: (localId, serverId) => set((state) => ({
        messages: state.messages.map((m) => m.id === localId ? { ...m, id: serverId } : m)
      })),
      addMessage: (message) => {
        set((state) => ({ messages: [message, ...state.messages] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(message.id) !== null) return;
        const propertyId = toNumericId(get().properties[0]?.id ?? '') ?? 1;
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
      rfidTags: mockRfidTags,
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
        // Demo bindings (mock bookings/users) have no server counterpart — keep it local.
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
      attendance: mockAttendance,
      setAttendance: (attendance) => set({ attendance }),
      reconcileAttendance: (localId, serverId) => set((state) => ({
        attendance: state.attendance.map((a) => a.id === localId ? { ...a, id: serverId } : a)
      })),
      addAttendance: (record) => {
        set((state) => ({ attendance: [...state.attendance, record] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(record.id) !== null) return;
        const propertyId = toNumericId(get().properties[0]?.id ?? '') ?? 1;
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
      shifts: mockShifts,
      setShifts: (shifts) => set({ shifts }),
      reconcileShift: (localId, serverId) => set((state) => ({
        shifts: state.shifts.map((s) => s.id === localId ? { ...s, id: serverId } : s)
      })),
      addShift: (shift) => {
        set((state) => ({ shifts: [...state.shifts, shift] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(shift.id) !== null) return;
        const propertyId = toNumericId(get().properties[0]?.id ?? '') ?? 1;
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
      expenses: mockExpenses,
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
      inventory: mockInventory,
      setInventory: (inventory) => set({ inventory }),
      reconcileInventoryItem: (localId, serverId) => set((state) => ({
        inventory: state.inventory.map((i) => i.id === localId ? { ...i, id: serverId } : i)
      })),
      addInventoryItem: (item) => {
        set((state) => ({ inventory: [...state.inventory, item] }));
        if (toNumericId(item.id) !== null) return;
        const propertyId = toNumericId(get().properties[0]?.id ?? '') ?? 1;
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
      electricity: mockElectricity,
      addElectricity: (record) => set((state) => ({ electricity: [...state.electricity, record] })),
      updateElectricity: (id, updates) => set((state) => ({
        electricity: state.electricity.map((e) => e.id === id ? { ...e, ...updates } : e)
      })),
      deleteElectricity: (id) => set((state) => ({
        electricity: state.electricity.filter((e) => e.id !== id)
      })),

      // Maintenance Tickets CRUD
      maintenanceTickets: mockMaintenanceTickets,
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
      aiInsights: mockAiInsights,
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
      workflows: mockWorkflows,
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
      bookings: mockBookings,
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
      guests: mockGuests,
      setGuests: (guests) => set({ guests }),
      reconcileGuest: (localId, serverId) => set((state) => ({
        guests: state.guests.map((g) => g.id === localId ? { ...g, id: serverId } : g)
      })),
      addGuest: (guest) => {
        set((state) => ({ guests: [...state.guests, guest] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(guest.id) !== null) return;
        const input: CreateGuestInput = {
          name: guest.name,
          email: guest.email,
          phone: guest.phone,
          idNumber: guest.idNumber,
          nationality: guest.nationality,
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
      ratePlans: mockRatePlans,
      setRatePlans: (ratePlans) => set({ ratePlans }),
      reconcileRatePlan: (localId, serverId) => set((state) => ({
        ratePlans: state.ratePlans.map((p) => p.id === localId ? { ...p, id: serverId } : p)
      })),
      addRatePlan: (plan) => {
        set((state) => ({ ratePlans: [...state.ratePlans, plan] }));
        // A numeric id means the row already lives server-side — only local ids create.
        if (toNumericId(plan.id) !== null) return;
        const propertyId = toNumericId(get().properties[0]?.id ?? '') ?? 1;
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
      integrations: mockIntegrations,
      addIntegration: (integration) => set((state) => ({ integrations: [...state.integrations, integration] })),
      updateIntegration: (id, updates) => set((state) => ({
        integrations: state.integrations.map((i) => i.id === id ? { ...i, ...updates } : i)
      })),
      deleteIntegration: (id) => set((state) => ({
        integrations: state.integrations.filter((i) => i.id !== id)
      })),

      // Settings
      settings: defaultSettings,
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),

      // Tickets CRUD
      tickets: mockTickets,
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
      invoices: mockInvoices,
      setInvoices: (invoices) => set({ invoices }),
      reconcileInvoice: (localId, serverId, serverInvoiceNumber) => set((state) => ({
        invoices: state.invoices.map((i) => i.id === localId
          ? { ...i, id: serverId, invoiceNumber: serverInvoiceNumber }
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
          get().reconcileInvoice(invoice.id, String(dto.id), dto.invoiceNumber);
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
      payments: mockPayments,
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
        };
        syncToApi(`createPayment(${payment.id})`, () => createPayment(input), (data) => {
          const dto = data as ApiPayment;
          get().reconcilePayment(payment.id, String(dto.id), dto.paymentNumber);
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
      auditLogs: mockAuditLogs,
      setAuditLogs: (auditLogs) => set({ auditLogs }),
      addAuditLog: (log) => {
        set((state) => ({ auditLogs: [log, ...state.auditLogs] }));
        // Append-only server-side — no reconcile, the API stamps id and timestamp itself.
        if (toNumericId(log.id) !== null) return;
        const propertyId = toNumericId(get().properties[0]?.id ?? '') ?? 1;
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
        syncToApi(`createAuditLog(${log.id})`, () => createAuditLog(input));
      },

      // Tax Configs CRUD
      taxConfigs: mockTaxConfigs,
      setTaxConfigs: (taxConfigs) => set({ taxConfigs }),
      reconcileTaxConfig: (localId, serverId) => set((state) => ({
        taxConfigs: state.taxConfigs.map((t) => t.id === localId ? { ...t, id: serverId } : t)
      })),
      addTaxConfig: (config) => {
        set((state) => ({ taxConfigs: [...state.taxConfigs, config] }));
        if (toNumericId(config.id) !== null) return;
        const propertyId = toNumericId(get().properties[0]?.id ?? '') ?? 1;
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
      name: 'nexus-pms-storage',
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
