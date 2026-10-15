import { useAppStore } from '../store/useAppStore';

export type UserRole = 'admin' | 'manager' | 'front_desk' | 'housekeeping' | 'maintenance' | 'auditor' | 'guest';

export interface RolePermission {
  viewDashboard: boolean;
  viewBookings: boolean;
  createBookings: boolean;
  editBookings: boolean;
  cancelBookings: boolean;
  viewGuests: boolean;
  createGuests: boolean;
  editGuests: boolean;
  deleteGuests: boolean;
  viewRooms: boolean;
  manageRooms: boolean;
  viewFinances: boolean;
  createInvoices: boolean;
  refundPayments: boolean;
  viewReports: boolean;
  exportReports: boolean;
  viewStaff: boolean;
  manageStaff: boolean;
  viewMaintenance: boolean;
  createMaintenanceTickets: boolean;
  assignTickets: boolean;
  viewAuditLog: boolean;
  manageSettings: boolean;
  viewIntegrations: boolean;
  manageIntegrations: boolean;
  viewAIInsights: boolean;
  useAICommands: boolean;
  viewInventory: boolean;
  manageInventory: boolean;
  viewPayroll: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermission> = {
  admin: {
    viewDashboard: true,
    viewBookings: true,
    createBookings: true,
    editBookings: true,
    cancelBookings: true,
    viewGuests: true,
    createGuests: true,
    editGuests: true,
    deleteGuests: true,
    viewRooms: true,
    manageRooms: true,
    viewFinances: true,
    createInvoices: true,
    refundPayments: true,
    viewReports: true,
    exportReports: true,
    viewStaff: true,
    manageStaff: true,
    viewMaintenance: true,
    createMaintenanceTickets: true,
    assignTickets: true,
    viewAuditLog: true,
    manageSettings: true,
    viewIntegrations: true,
    manageIntegrations: true,
    viewAIInsights: true,
    useAICommands: true,
    viewInventory: true,
    manageInventory: true,
    viewPayroll: true,
  },
  manager: {
    viewDashboard: true,
    viewBookings: true,
    createBookings: true,
    editBookings: true,
    cancelBookings: true,
    viewGuests: true,
    createGuests: true,
    editGuests: true,
    deleteGuests: false,
    viewRooms: true,
    manageRooms: true,
    viewFinances: true,
    createInvoices: true,
    refundPayments: true,
    viewReports: true,
    exportReports: true,
    viewStaff: true,
    manageStaff: true,
    viewMaintenance: true,
    createMaintenanceTickets: true,
    assignTickets: true,
    viewAuditLog: true,
    manageSettings: false,
    viewIntegrations: true,
    manageIntegrations: false,
    viewAIInsights: true,
    useAICommands: true,
    viewInventory: true,
    manageInventory: true,
    viewPayroll: true,
  },
  front_desk: {
    viewDashboard: true,
    viewBookings: true,
    createBookings: true,
    editBookings: true,
    cancelBookings: false,
    viewGuests: true,
    createGuests: true,
    editGuests: true,
    deleteGuests: false,
    viewRooms: true,
    manageRooms: false,
    viewFinances: false,
    createInvoices: true,
    refundPayments: false,
    viewReports: false,
    exportReports: false,
    viewStaff: false,
    manageStaff: false,
    viewMaintenance: true,
    createMaintenanceTickets: true,
    assignTickets: false,
    viewAuditLog: false,
    manageSettings: false,
    viewIntegrations: false,
    manageIntegrations: false,
    viewAIInsights: false,
    useAICommands: false,
    viewInventory: false,
    manageInventory: false,
    viewPayroll: false,
  },
  housekeeping: {
    viewDashboard: false,
    viewBookings: false,
    createBookings: false,
    editBookings: false,
    cancelBookings: false,
    viewGuests: false,
    createGuests: false,
    editGuests: false,
    deleteGuests: false,
    viewRooms: true,
    manageRooms: false,
    viewFinances: false,
    createInvoices: false,
    refundPayments: false,
    viewReports: false,
    exportReports: false,
    viewStaff: false,
    manageStaff: false,
    viewMaintenance: true,
    createMaintenanceTickets: true,
    assignTickets: false,
    viewAuditLog: false,
    manageSettings: false,
    viewIntegrations: false,
    manageIntegrations: false,
    viewAIInsights: false,
    useAICommands: false,
    viewInventory: true,
    manageInventory: false,
    viewPayroll: false,
  },
  maintenance: {
    viewDashboard: false,
    viewBookings: false,
    createBookings: false,
    editBookings: false,
    cancelBookings: false,
    viewGuests: false,
    createGuests: false,
    editGuests: false,
    deleteGuests: false,
    viewRooms: true,
    manageRooms: false,
    viewFinances: false,
    createInvoices: false,
    refundPayments: false,
    viewReports: false,
    exportReports: false,
    viewStaff: false,
    manageStaff: false,
    viewMaintenance: true,
    createMaintenanceTickets: true,
    assignTickets: false,
    viewAuditLog: false,
    manageSettings: false,
    viewIntegrations: false,
    manageIntegrations: false,
    viewAIInsights: false,
    useAICommands: false,
    viewInventory: true,
    manageInventory: false,
    viewPayroll: false,
  },
  auditor: {
    viewDashboard: true,
    viewBookings: true,
    createBookings: false,
    editBookings: false,
    cancelBookings: false,
    viewGuests: true,
    createGuests: false,
    editGuests: false,
    deleteGuests: false,
    viewRooms: true,
    manageRooms: false,
    viewFinances: true,
    createInvoices: false,
    refundPayments: false,
    viewReports: true,
    exportReports: true,
    viewStaff: true,
    manageStaff: false,
    viewMaintenance: true,
    createMaintenanceTickets: false,
    assignTickets: false,
    viewAuditLog: true,
    manageSettings: false,
    viewIntegrations: true,
    manageIntegrations: false,
    viewAIInsights: false,
    useAICommands: false,
    viewInventory: true,
    manageInventory: false,
    viewPayroll: true,
  },
  guest: {
    viewDashboard: false,
    viewBookings: false,
    createBookings: false,
    editBookings: false,
    cancelBookings: false,
    viewGuests: false,
    createGuests: false,
    editGuests: false,
    deleteGuests: false,
    viewRooms: false,
    manageRooms: false,
    viewFinances: false,
    createInvoices: false,
    refundPayments: false,
    viewReports: false,
    exportReports: false,
    viewStaff: false,
    manageStaff: false,
    viewMaintenance: false,
    createMaintenanceTickets: false,
    assignTickets: false,
    viewAuditLog: false,
    manageSettings: false,
    viewIntegrations: false,
    manageIntegrations: false,
    viewAIInsights: false,
    useAICommands: false,
    viewInventory: false,
    manageInventory: false,
    viewPayroll: false,
  },
};

export function hasPermission(permission: keyof RolePermission): boolean {
  const store = useAppStore.getState();
  const userRole = (store.user?.role as UserRole) || 'front_desk';
  return ROLE_PERMISSIONS[userRole]?.[permission] ?? false;
}

export function canAccessRoute(routeId: string): boolean {
  const routePermissions: Record<string, (keyof RolePermission)[]> = {
    dashboard: ['viewDashboard'],
    bookings: ['viewBookings'],
    guests: ['viewGuests'],
    rooms: ['viewRooms'],
    finances: ['viewFinances'],
    reports: ['viewReports'],
    staff: ['viewStaff'],
    'staff-schedule': ['viewStaff'],
    'employee-profiles': ['viewStaff'],
    'rfid-management': ['viewStaff'],
    maintenance: ['viewMaintenance'],
    tickets: ['viewMaintenance'],
    messaging: [],
    checkin: ['viewBookings'],
    rates: ['viewBookings'],
    properties: ['viewRooms'],
    facility: ['viewMaintenance'],
    analytics: ['viewReports'],
    forecast: ['viewReports'],
    admin: ['manageSettings'],
    settings: ['manageSettings'],
    integrations: ['viewIntegrations'],
    inventory: ['viewInventory'],
    'ai-enhancements': ['viewAIInsights'],
  };
  
  const requiredPermissions = routePermissions[routeId];
  // Unmapped routes default to read-only: any role with a foothold can open them.
  if (!requiredPermissions) return true;
  
  return requiredPermissions.some(permission => hasPermission(permission));
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Administrator',
    manager: 'Manager',
    front_desk: 'Front Desk',
    housekeeping: 'Housekeeping',
    maintenance: 'Maintenance',
    auditor: 'Auditor',
    guest: 'Guest',
  };
  return labels[role];
}
