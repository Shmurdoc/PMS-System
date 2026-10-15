import { useAppStore } from '../store/useAppStore';

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

let demoMode = false;
let globalLatency = { min: 200, max: 800 };
const locks = new Map<string, Promise<unknown>>();

export function setDemoMode(enabled: boolean): void {
  demoMode = enabled;
  globalLatency = enabled ? { min: 0, max: 50 } : { min: 200, max: 800 };
}

export function isDemoMode(): boolean {
  return demoMode;
}

export function getLatency(): number {
  const { min, max } = globalLatency;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function simulateLatency(): Promise<void> {
  const delay = getLatency();
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function acquireLock(resource: string): Promise<() => void> {
  while (locks.has(resource)) {
    await locks.get(resource);
  }
  
  let releaseLock: () => void;
  const lockPromise = new Promise<void>(resolve => {
    releaseLock = () => {
      locks.delete(resource);
      resolve();
    };
  });
  
  locks.set(resource, lockPromise);
  return releaseLock!;
}

export function createApiError(code: string, message: string, status: number): ApiError {
  return { code, message, status };
}

interface BookingPayload {
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
  amount: number;
}

export async function createBooking(payload: BookingPayload): Promise<{ success: boolean; data?: unknown; error?: ApiError }> {
  const store = useAppStore.getState();
  
  await simulateLatency();
  
  const releaseLock = await acquireLock(`booking_room_${payload.roomId}`);
  
  try {
    const existingBooking = store.bookings.find(b => 
      b.roomId === payload.roomId &&
      ((b.checkIn <= payload.checkIn && b.checkOut > payload.checkIn) ||
       (b.checkIn < payload.checkOut && b.checkOut <= payload.checkOut)) &&
      b.status !== 'cancelled'
    );
    
    if (existingBooking) {
      return {
        success: false,
        error: createApiError('ROOM_CONFLICT', 'Room is not available for selected dates', 409),
      };
    }
    
    const newBooking = {
      id: `BK-${Date.now()}`,
      ...payload,
      status: 'pending' as const,
      paymentStatus: 'pending' as const,
      source: demoMode ? 'Demo' : 'Direct',
      createdAt: new Date().toISOString(),
    };
    
    store.addBooking(newBooking);
    
    return { success: true, data: newBooking };
  } finally {
    releaseLock();
  }
}

interface InvoicePayload {
  bookingId: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
  propertyId: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
}

export async function createInvoice(payload: InvoicePayload): Promise<{ success: boolean; data?: unknown; error?: ApiError }> {
  const store = useAppStore.getState();
  
  await simulateLatency();
  
  const subtotal = payload.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = payload.items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100), 0);
  
  const newInvoice = {
    id: `INV-${Date.now()}`,
    invoiceNumber: `INV-${new Date().getFullYear()}-${String(store.invoices.length + 1).padStart(4, '0')}`,
    type: 'service' as const,
    bookingId: payload.bookingId,
    guestId: payload.guestId,
    guestName: payload.guestName,
    guestEmail: payload.guestEmail,
    propertyId: payload.propertyId,
    items: payload.items.map((item, idx) => ({
      id: `INV-ITEM-${idx}`,
      ...item,
      amount: item.quantity * item.unitPrice,
      category: 'Service',
    })),
    subtotal,
    taxAmount,
    discountAmount: 0,
    total: subtotal + taxAmount,
    currency: 'ZAR',
    status: 'draft' as const,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    createdBy: 'System',
  };
  
  store.addInvoice(newInvoice);
  
  return { success: true, data: newInvoice };
}

export async function processPayment(invoiceId: string, amount: number): Promise<{ success: boolean; data?: unknown; error?: ApiError }> {
  const store = useAppStore.getState();
  
  await simulateLatency();
  
  const invoice = store.invoices.find(i => i.id === invoiceId);
  if (!invoice) {
    return { success: false, error: createApiError('NOT_FOUND', 'Invoice not found', 404) };
  }
  
  const releaseLock = await acquireLock(`invoice_${invoiceId}`);
  
  try {
    store.updateInvoice(invoiceId, {
      status: 'paid',
      paidAmount: amount,
      paidDate: new Date().toISOString().split('T')[0],
    });
    
    return {
      success: true,
      data: { invoiceId, amount, status: 'completed', timestamp: new Date().toISOString() },
    };
  } finally {
    releaseLock();
  }
}

export async function updateGuest(guestId: string, updates: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: ApiError }> {
  const store = useAppStore.getState();
  
  await simulateLatency();
  
  const guest = store.guests.find(g => g.id === guestId);
  if (!guest) {
    return { success: false, error: createApiError('NOT_FOUND', 'Guest not found', 404) };
  }
  
  const releaseLock = await acquireLock(`guest_${guestId}`);
  
  try {
    store.updateGuest(guestId, updates);
    return { success: true, data: { guestId, ...updates } };
  } finally {
    releaseLock();
  }
}

export async function createMaintenanceTicket(payload: {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  roomId?: string;
}): Promise<{ success: boolean; data?: unknown; error?: ApiError }> {
  const store = useAppStore.getState();
  
  await simulateLatency();
  
  const newTicket = {
    id: `MT-${Date.now()}`,
    ...payload,
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
    assignedTo: undefined,
  };
  
  store.addMaintenanceTicket(newTicket);
  
  return { success: true, data: newTicket };
}

export function clearLocks(): void {
  locks.clear();
}
