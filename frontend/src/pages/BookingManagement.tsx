import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Plus, Search, Edit, Eye, Check, X, 
  Clock, User, Phone, Mail, Star, ChevronDown, ChevronUp,
  RefreshCw, Download, Grid, List, 
  CheckCircle, XCircle, Users, DollarSign, Trash2, AlertTriangle,
  BedDouble, MapPin, Hash, CreditCard, FileText
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Booking } from '../store/useAppStore';
import { toast } from 'sonner';
import { exportToCsv } from '../utils/exportCsv';
import { resolveTaxRatePercent } from '../lib/tax';

// ─── colour maps ──────────────────────────────────────────────────────────────
const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending:       { bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/30' },
  confirmed:     { bg: 'bg-info/15',   text: 'text-info',   border: 'border-info/30' },
  'checked-in':  { bg: 'bg-success/15',  text: 'text-success',  border: 'border-success/30' },
  'checked-out': { bg: 'bg-gray-500/20',   text: 'text-gray-400',   border: 'border-gray-500/30' },
  cancelled:     { bg: 'bg-danger/15',    text: 'text-danger',    border: 'border-danger/30' },
  'no-show':     { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
};

const paymentStatusColors: Record<string, { bg: string; text: string }> = {
  pending:  { bg: 'bg-warning/15', text: 'text-warning' },
  partial:  { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  paid:     { bg: 'bg-success/15',  text: 'text-success' },
  refunded: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

const segmentColors: Record<string, string> = {
  VIP:       'bg-warning/15 text-warning',
  Corporate: 'bg-info/15 text-info',
  Frequent:  'bg-success/15 text-success',
  New:       'bg-purple-500/20 text-purple-400',
};

const SOURCES = ['Direct', 'Booking.com', 'Expedia', 'Airbnb', 'Agoda', 'TripAdvisor', 'Phone', 'Walk-in'];

// ─── helpers ──────────────────────────────────────────────────────────────────
function nightsBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

function generateBookingId(): string {
  return 'BK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
}

// ─── empty form state ─────────────────────────────────────────────────────────
interface BookingFormData {
  guestId: string;
  propertyId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  source: string;
  specialRequests: string;
  notes: string;
  paymentStatus: 'pending' | 'partial' | 'paid';
  depositPaid: number;
}

const emptyForm: BookingFormData = {
  guestId: '',
  propertyId: '',
  roomId: '',
  checkIn: '',
  checkOut: '',
  adults: 1,
  children: 0,
  source: 'Direct',
  specialRequests: '',
  notes: '',
  paymentStatus: 'pending',
  depositPaid: 0,
};

// ─── sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? statusColors.pending;
  const icon = status === 'checked-in' ? <CheckCircle className="w-3 h-3" /> :
               status === 'cancelled'  ? <XCircle className="w-3 h-3" /> :
               status === 'pending'    ? <Clock className="w-3 h-3" /> :
               status === 'confirmed'  ? <Check className="w-3 h-3" /> :
               status === 'no-show'    ? <AlertTriangle className="w-3 h-3" /> :
               <User className="w-3 h-3" />;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {icon}
      {status.replace('-', ' ').toUpperCase()}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const colors = paymentStatusColors[status] ?? paymentStatusColors.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}>
      {status.toUpperCase()}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function BookingManagement() {
  const {
    bookings, addBooking, updateBooking, deleteBooking,
    guests, rooms, properties,
    addInvoice, addAuditLog,
    updateRoom, taxConfigs,
  } = useAppStore();
  const me = useAppStore((s) => s.user);
const role = useAppStore((s) => s.user?.role);
  const canManage = role === 'admin' || role === 'manager';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editBookingId, setEditBookingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState<BookingFormData>({ ...emptyForm });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── derived data ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: bookings.length,
      pending: bookings.filter(b => b.status === 'pending').length,
      checkedIn: bookings.filter(b => b.status === 'checked-in').length,
      arrivingToday: bookings.filter(b => b.checkIn === today && (b.status === 'confirmed' || b.status === 'pending')).length,
      revenue: bookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + b.amount, 0),
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    let filtered = [...bookings];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.guestName.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        b.roomNumber.includes(q) ||
        b.guestEmail.toLowerCase().includes(q) ||
        b.propertyName.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') filtered = filtered.filter(b => b.status === statusFilter);
    if (sourceFilter !== 'all') filtered = filtered.filter(b => b.source === sourceFilter);
    if (propertyFilter !== 'all') filtered = filtered.filter(b => b.propertyId === propertyFilter);

    filtered.sort((a, b) => {
      if (sortBy === 'date') return sortOrder === 'asc' ? a.checkIn.localeCompare(b.checkIn) : b.checkIn.localeCompare(a.checkIn);
      if (sortBy === 'amount') return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      return sortOrder === 'asc' ? a.guestName.localeCompare(b.guestName) : b.guestName.localeCompare(a.guestName);
    });
    return filtered;
  }, [bookings, searchQuery, statusFilter, sourceFilter, propertyFilter, sortBy, sortOrder]);

  // ── room availability check (double-booking prevention) ───────────────────
  const isRoomAvailable = useCallback((roomId: string, checkIn: string, checkOut: string, excludeBookingId?: string): boolean => {
    return !bookings.some(b => {
      if (b.roomId !== roomId) return false;
      if (excludeBookingId && b.id === excludeBookingId) return false;
      if (b.status === 'cancelled' || b.status === 'no-show') return false;
      // overlap: b.checkIn < checkOut && b.checkOut > checkIn
      return b.checkIn < checkOut && b.checkOut > checkIn;
    });
  }, [bookings]);

  // Available rooms for selected property + dates
  const availableRooms = useMemo(() => {
    if (!form.propertyId || !form.checkIn || !form.checkOut) return [];
    return rooms
      .filter(r => r.propertyId === form.propertyId)
      .filter(r => isRoomAvailable(r.id, form.checkIn, form.checkOut, editBookingId ?? undefined));
  }, [rooms, form.propertyId, form.checkIn, form.checkOut, isRoomAvailable, editBookingId]);

  // Auto-compute amount
  const computedNights = form.checkIn && form.checkOut ? nightsBetween(form.checkIn, form.checkOut) : 0;
  const selectedRoom = rooms.find(r => r.id === form.roomId);
  const computedAmount = computedNights * (selectedRoom?.price ?? 0);
  const computedBalance = Math.max(0, computedAmount - (form.depositPaid || 0));

  // ── form handlers ─────────────────────────────────────────────────────────
  const updateForm = (updates: Partial<BookingFormData>) => {
    setForm(prev => ({ ...prev, ...updates }));
    // Clear related errors
    Object.keys(updates).forEach(k => {
      if (formErrors[k]) setFormErrors(prev => { const next = { ...prev }; delete next[k]; return next; });
    });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.guestId) errors.guestId = 'Please select a guest';
    if (!form.propertyId) errors.propertyId = 'Please select a property';
    if (!form.roomId) errors.roomId = 'Please select a room';
    if (!form.checkIn) errors.checkIn = 'Check-in date is required';
    if (!form.checkOut) errors.checkOut = 'Check-out date is required';
    if (form.checkIn && form.checkOut && form.checkIn >= form.checkOut) errors.checkOut = 'Check-out must be after check-in';
    if (form.checkIn && form.checkIn < new Date().toISOString().split('T')[0] && !editBookingId) errors.checkIn = 'Check-in cannot be in the past';
    if (computedNights <= 0 && form.checkIn && form.checkOut) errors.checkOut = 'Stay must be at least 1 night';
    if (form.adults < 1) errors.adults = 'At least 1 adult required';
    if (selectedRoom && (form.adults + form.children) > (selectedRoom.maxOccupancy ?? 4)) {
      errors.adults = `Max occupancy for this room is ${selectedRoom.maxOccupancy ?? 4}`;
    }
    if (form.roomId && form.checkIn && form.checkOut && !isRoomAvailable(form.roomId, form.checkIn, form.checkOut, editBookingId ?? undefined)) {
      errors.roomId = 'Room is not available for these dates (double-booking)';
    }
    if (form.depositPaid < 0) errors.depositPaid = 'Deposit cannot be negative';
    if (form.depositPaid > computedAmount) errors.depositPaid = 'Deposit cannot exceed total amount';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openNewBooking = () => {
    setForm({ ...emptyForm, propertyId: me?.propertyId ?? properties[0]?.propertyId ?? '' });
    setFormErrors({});
    setEditBookingId(null);
    setShowNewModal(true);
  };

  const openEditBooking = (booking: Booking) => {
    setForm({
      guestId: booking.guestId,
      propertyId: booking.propertyId,
      roomId: booking.roomId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      adults: booking.adults ?? booking.guests,
      children: booking.children ?? 0,
      source: booking.source,
      specialRequests: booking.specialRequests ?? '',
      notes: booking.notes ?? '',
      paymentStatus: booking.paymentStatus === 'refunded' ? 'pending' : booking.paymentStatus,
      depositPaid: booking.depositPaid ?? 0,
    });
    setFormErrors({});
    setEditBookingId(booking.id);
    setShowNewModal(true);
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const guest = guests.find(g => g.id === form.guestId);
    const room = rooms.find(r => r.id === form.roomId);
    const property = properties.find(p => p.propertyId === form.propertyId);
    if (!guest || !room || !property) {
      toast.error('Invalid guest, room, or property selection');
      return;
    }

    const nights = nightsBetween(form.checkIn, form.checkOut);
    const amount = nights * room.price;
    const now = new Date().toISOString();

    if (editBookingId) {
      // ── UPDATE existing booking ──
      updateBooking(editBookingId, {
        guestId: guest.id,
        guestName: guest.name,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        guestSegment: guest.segment,
        propertyId: property.propertyId,
        propertyName: property.name,
        roomId: room.id,
        roomNumber: room.number,
        roomType: room.type,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        nights,
        guests: form.adults + form.children,
        adults: form.adults,
        children: form.children,
        amount,
        ratePerNight: room.price,
        depositPaid: form.depositPaid,
        balanceDue: Math.max(0, amount - form.depositPaid),
        source: form.source,
        specialRequests: form.specialRequests || undefined,
        notes: form.notes || undefined,
        paymentStatus: form.paymentStatus,
        updatedAt: now,
      });
      addAuditLog({
        id: 'AL' + Date.now(),
        action: 'update_booking',
        userId: me?.id ?? '',
        userName: me?.name ?? 'You',
        userRole: me?.role ?? '',
        entityName: guest.name,
        details: `Updated booking ${editBookingId} for ${guest.name}`,
        timestamp: now,
        entityType: 'booking',
        entityId: editBookingId,
      });
      toast.success(`Booking ${editBookingId} updated successfully`);
    } else {
      // ── CREATE new booking ──
      const newId = generateBookingId();
      const newBooking: Booking = {
        id: newId,
        guestId: guest.id,
        guestName: guest.name,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        guestSegment: guest.segment,
        propertyId: property.propertyId,
        propertyName: property.name,
        roomId: room.id,
        roomNumber: room.number,
        roomType: room.type,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        nights,
        guests: form.adults + form.children,
        adults: form.adults,
        children: form.children,
        status: 'pending',
        paymentStatus: form.paymentStatus,
        amount,
        ratePerNight: room.price,
        depositPaid: form.depositPaid,
        balanceDue: Math.max(0, amount - form.depositPaid),
        source: form.source,
        specialRequests: form.specialRequests || undefined,
        notes: form.notes || undefined,
        createdAt: now,
      };
      addBooking(newBooking);

      // Mark room as reserved if booking is for today or future
      if (form.checkIn <= new Date().toISOString().split('T')[0]) {
        updateRoom(room.id, { status: 'reserved' });
      }

      addAuditLog({
        id: 'AL' + Date.now(),
        action: 'create_booking',
        userId: me?.id ?? '',
        userName: me?.name ?? 'You',
        userRole: me?.role ?? '',
        entityName: guest.name,
        details: `Created booking ${newId} for ${guest.name} — Room ${room.number} at ${property.name}`,
        timestamp: now,
        entityType: 'booking',
        entityId: newId,
      });
      toast.success(`Booking ${newId} created for ${guest.name}`);
    }

    setShowNewModal(false);
    setEditBookingId(null);
    setSelectedBooking(null);
  };

  // ── status transitions ────────────────────────────────────────────────────
  const handleStatusChange = (bookingId: string, newStatus: Booking['status']) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const now = new Date().toISOString();
    updateBooking(bookingId, { status: newStatus, updatedAt: now });

    // Side-effects based on status
    if (newStatus === 'checked-in') {
      updateRoom(booking.roomId, { status: 'occupied' });
      toast.success(`${booking.guestName} checked in to Room ${booking.roomNumber}`);
    } else if (newStatus === 'checked-out') {
      updateRoom(booking.roomId, { status: 'cleaning' });
      // Auto-create invoice on checkout — tax from the active TaxConfigs
      // (server-derived once hydrated; 15% fallback when none apply).
      const invoiceId = 'INV' + Date.now().toString(36).toUpperCase();
      const today = now.split('T')[0];
      const taxRate = resolveTaxRatePercent(taxConfigs, 'room', today, 15);
      const taxAmount = Math.round(booking.amount * taxRate) / 100;
      const total = Math.round((booking.amount + taxAmount) * 100) / 100;
      addInvoice({
        id: invoiceId,
        invoiceNumber: invoiceId,
        type: 'final',
        bookingId,
        guestId: booking.guestId,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        propertyId: booking.propertyId,
        items: [{
          id: 'item-' + Date.now(),
          description: `Room ${booking.roomNumber} (${booking.roomType}) — ${booking.nights} night(s)`,
          quantity: booking.nights,
          unitPrice: booking.ratePerNight ?? (booking.amount / booking.nights),
          taxRate,
          amount: booking.amount,
          category: 'room',
        }],
        subtotal: booking.amount,
        taxAmount,
        discountAmount: 0,
        total,
        currency: 'ZAR',
        status: booking.paymentStatus === 'paid' ? 'paid' : 'pending',
        issueDate: today,
        dueDate: today,
        paidDate: booking.paymentStatus === 'paid' ? today : undefined,
        paidAmount: booking.paymentStatus === 'paid' ? total : 0,
        notes: `Auto-generated on checkout for booking ${bookingId}`,
        createdAt: now,
        createdBy: 'system',
      });
      toast.success(`${booking.guestName} checked out. Invoice ${invoiceId} created.`);
    } else if (newStatus === 'cancelled') {
      // Free the room if it was reserved/occupied
      const room = rooms.find(r => r.id === booking.roomId);
      if (room && (room.status === 'reserved' || room.status === 'occupied')) {
        updateRoom(booking.roomId, { status: 'available' });
      }
      toast.info(`Booking ${bookingId} cancelled`);
    } else if (newStatus === 'no-show') {
      const room = rooms.find(r => r.id === booking.roomId);
      if (room && room.status === 'reserved') {
        updateRoom(booking.roomId, { status: 'available' });
      }
      toast.warning(`${booking.guestName} marked as no-show`);
    } else if (newStatus === 'confirmed') {
      toast.success(`Booking ${bookingId} confirmed`);
    }

    addAuditLog({
      id: 'AL' + Date.now(),
      action: `booking_${newStatus.replace('-', '_')}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      entityName: `Booking ${bookingId}`,
      details: `Booking ${bookingId} status changed to ${newStatus}`,
      timestamp: now,
      entityType: 'booking',
      entityId: bookingId,
    });

    // Close detail modal if open
    if (selectedBooking?.id === bookingId) setSelectedBooking(null);
  };

  // ── delete booking ────────────────────────────────────────────────────────
  const handleDelete = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    deleteBooking(bookingId);
    if (booking) {
      const room = rooms.find(r => r.id === booking.roomId);
      if (room && (room.status === 'reserved' || room.status === 'occupied')) {
        updateRoom(booking.roomId, { status: 'available' });
      }
    }
    addAuditLog({
      id: 'AL' + Date.now(),
      action: 'delete_booking',
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      entityName: booking?.guestName ?? bookingId,
      details: `Deleted booking ${bookingId}`,
      timestamp: new Date().toISOString(),
      entityType: 'booking',
      entityId: bookingId,
    });
    toast.success(`Booking ${bookingId} deleted`);
    setShowDeleteConfirm(null);
    if (selectedBooking?.id === bookingId) setSelectedBooking(null);
  };

  // ── export CSV ────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (filteredBookings.length === 0) {
      toast.warning('No bookings to export');
      return;
    }
    exportToCsv(
      filteredBookings.map(b => ({
        id: b.id,
        guestName: b.guestName,
        guestEmail: b.guestEmail,
        guestPhone: b.guestPhone,
        property: b.propertyName,
        room: b.roomNumber,
        roomType: b.roomType,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        nights: b.nights,
        guests: b.guests,
        status: b.status,
        paymentStatus: b.paymentStatus,
        amount: b.amount,
        source: b.source,
        specialRequests: b.specialRequests ?? '',
        createdAt: b.createdAt,
      })),
      `bookings_${new Date().toISOString().split('T')[0]}`,
      [
        { key: 'id', header: 'Booking ID' },
        { key: 'guestName', header: 'Guest Name' },
        { key: 'guestEmail', header: 'Email' },
        { key: 'guestPhone', header: 'Phone' },
        { key: 'property', header: 'Property' },
        { key: 'room', header: 'Room #' },
        { key: 'roomType', header: 'Room Type' },
        { key: 'checkIn', header: 'Check-in' },
        { key: 'checkOut', header: 'Check-out' },
        { key: 'nights', header: 'Nights' },
        { key: 'guests', header: 'Guests' },
        { key: 'status', header: 'Status' },
        { key: 'paymentStatus', header: 'Payment' },
        { key: 'amount', header: 'Amount (R)' },
        { key: 'source', header: 'Source' },
        { key: 'specialRequests', header: 'Special Requests' },
        { key: 'createdAt', header: 'Created' },
      ]
    );
    toast.success(`Exported ${filteredBookings.length} bookings to CSV`);
  };

  // ── toggle sort ───────────────────────────────────────────────────────────
  const toggleSort = (col: 'date' | 'amount' | 'name') => {
    if (sortBy === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('desc'); }
  };

  const sortIcon = (col: string) =>
    sortBy === col ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null;

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Booking Management</h1>
          <p className="text-muted-foreground">Manage reservations, check-ins, and guest bookings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={openNewBooking}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Booking
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border border-warning/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/15 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border border-success/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.checkedIn}</p>
              <p className="text-sm text-muted-foreground">Checked In</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border border-info/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info/15 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.arrivingToday}</p>
              <p className="text-sm text-muted-foreground">Arriving Today</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">R{stats.revenue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by guest, ID, room, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-muted border border-border/30 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked-in">Checked In</option>
            <option value="checked-out">Checked Out</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No-Show</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          >
            <option value="all">All Sources</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          >
            <option value="all">All Properties</option>
            {properties.map(p => <option key={p.id} value={p.propertyId}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── TABLE VIEW ── */}
      {viewMode === 'table' ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border/30">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                      Booking / Guest {sortIcon('name')}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-foreground">
                      Dates {sortIcon('date')}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 hover:text-foreground">
                      Amount {sortIcon('amount')}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => (
                  <motion.tr
                    key={booking.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-border/20 hover:bg-primary/5 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-sm">
                          {booking.guestName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{booking.guestName}</p>
                            {segmentColors[booking.guestSegment] && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${segmentColors[booking.guestSegment]}`}>
                                {booking.guestSegment}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">#{booking.id} · {booking.source}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium">Room {booking.roomNumber}</p>
                        <p className="text-xs text-muted-foreground">{booking.roomType}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm">{booking.checkIn}</p>
                        <p className="text-xs text-muted-foreground">→ {booking.checkOut} ({booking.nights}n)</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium">R{booking.amount.toLocaleString()}</p>
                        <PaymentBadge status={booking.paymentStatus} />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors" title="View Details"
                        >
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => openEditBooking(booking)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors" title="Edit Booking"
                        >
                          <Edit className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {booking.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'confirmed')}
                            className="p-2 hover:bg-info/15 rounded-lg transition-colors" title="Confirm"
                          >
                            <Check className="w-4 h-4 text-info" />
                          </button>
                        )}
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'checked-in')}
                            className="p-2 hover:bg-success/15 rounded-lg transition-colors" title="Check In"
                          >
                            <CheckCircle className="w-4 h-4 text-success" />
                          </button>
                        )}
                        {booking.status === 'checked-in' && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'checked-out')}
                            className="p-2 hover:bg-info/15 rounded-lg transition-colors" title="Check Out"
                          >
                            <RefreshCw className="w-4 h-4 text-info" />
                          </button>
                        )}
                        {(booking.status === 'pending' || booking.status === 'confirmed') && canManage && (
                          <button
                            onClick={() => setShowDeleteConfirm(booking.id)}
                            className="p-2 hover:bg-danger/15 rounded-lg transition-colors" title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-danger" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredBookings.length === 0 && (
            <div className="py-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No bookings found matching your criteria</p>
            </div>
          )}
        </div>
      ) : (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBookings.map((booking) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
                    {booking.guestName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-medium">{booking.guestName}</p>
                    <p className="text-xs text-muted-foreground">#{booking.id} · {booking.source}</p>
                  </div>
                </div>
                <StatusBadge status={booking.status} />
              </div>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><BedDouble className="w-3 h-3" /> Room</span>
                  <span>{booking.roomNumber} · {booking.roomType}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Property</span>
                  <span className="text-xs">{booking.propertyName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Check-in</span>
                  <span>{booking.checkIn}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Check-out</span>
                  <span>{booking.checkOut}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nights / Guests</span>
                  <span>{booking.nights}n / {booking.guests}p</span>
                </div>
              </div>
              <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                <div>
                  <p className="font-bold">R{booking.amount.toLocaleString()}</p>
                  <PaymentBadge status={booking.paymentStatus} />
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSelectedBooking(booking)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="View">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEditBooking(booking)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Edit">
                    <Edit className="w-4 h-4" />
                  </button>
                  {booking.status === 'confirmed' && (
                    <button onClick={() => handleStatusChange(booking.id, 'checked-in')} className="p-2 hover:bg-success/15 rounded-lg transition-colors" title="Check In">
                      <CheckCircle className="w-4 h-4 text-success" />
                    </button>
                  )}
                  {booking.status === 'checked-in' && (
                    <button onClick={() => handleStatusChange(booking.id, 'checked-out')} className="p-2 hover:bg-info/15 rounded-lg transition-colors" title="Check Out">
                      <RefreshCw className="w-4 h-4 text-info" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {filteredBookings.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No bookings found</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          BOOKING DETAIL MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedBooking(null)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative z-10 bg-popover border border-border rounded-xl shadow-overlay w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Booking #{selectedBooking.id}
                    </h2>
                    <p className="text-muted-foreground">{selectedBooking.propertyName}</p>
                  </div>
                  <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                {/* Guest Info */}
                <div className="bg-muted/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
                      {selectedBooking.guestName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{selectedBooking.guestName}</h3>
                        {segmentColors[selectedBooking.guestSegment] && (
                          <span className={`text-xs px-2 py-0.5 rounded ${segmentColors[selectedBooking.guestSegment]}`}>
                            {selectedBooking.guestSegment}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedBooking.guestEmail}</span>
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedBooking.guestPhone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Booking Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><BedDouble className="w-3 h-3" /> Room</p>
                    <p className="font-semibold">{selectedBooking.roomNumber}</p>
                    <p className="text-xs text-muted-foreground">{selectedBooking.roomType}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Check-in</p>
                    <p className="font-semibold">{selectedBooking.checkIn}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Check-out</p>
                    <p className="font-semibold">{selectedBooking.checkOut}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Stay</p>
                    <p className="font-semibold">{selectedBooking.nights} night{selectedBooking.nights !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">{selectedBooking.adults ?? selectedBooking.guests} adult{(selectedBooking.adults ?? selectedBooking.guests) !== 1 ? 's' : ''}{selectedBooking.children ? `, ${selectedBooking.children} child${selectedBooking.children !== 1 ? 'ren' : ''}` : ''}</p>
                  </div>
                </div>

                {/* Financial Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Rate/Night</p>
                    <p className="font-semibold">R{(selectedBooking.ratePerNight ?? (selectedBooking.amount / selectedBooking.nights)).toLocaleString()}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Total</p>
                    <p className="font-semibold text-lg">R{selectedBooking.amount.toLocaleString()}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Deposit Paid</p>
                    <p className="font-semibold text-success">R{(selectedBooking.depositPaid ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Balance Due</p>
                    <p className="font-semibold text-orange-400">R{(selectedBooking.balanceDue ?? selectedBooking.amount).toLocaleString()}</p>
                  </div>
                </div>

                {/* Status row */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <StatusBadge status={selectedBooking.status} />
                  <PaymentBadge status={selectedBooking.paymentStatus} />
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Source: {selectedBooking.source}</span>
                  {selectedBooking.createdAt && <span className="text-xs text-muted-foreground">Created: {selectedBooking.createdAt.split('T')[0]}</span>}
                  {selectedBooking.updatedAt && <span className="text-xs text-muted-foreground">Updated: {selectedBooking.updatedAt.split('T')[0]}</span>}
                </div>

                {/* Special Requests */}
                {selectedBooking.specialRequests && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-warning mb-1 flex items-center gap-1"><Star className="w-3 h-3" /> Special Requests</p>
                    <p className="text-sm">{selectedBooking.specialRequests}</p>
                  </div>
                )}
                {selectedBooking.notes && (
                  <div className="bg-info/10 border border-info/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-info mb-1">Staff Notes</p>
                    <p className="text-sm">{selectedBooking.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {selectedBooking.status === 'pending' && (
                    <button
                      onClick={() => handleStatusChange(selectedBooking.id, 'confirmed')}
                      className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Confirm
                    </button>
                  )}
                  {selectedBooking.status === 'confirmed' && (
                    <button
                      onClick={() => handleStatusChange(selectedBooking.id, 'checked-in')}
                      className="flex-1 py-2.5 bg-success text-white rounded-lg hover:bg-green-600 hover:shadow-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Check In
                    </button>
                  )}
                  {selectedBooking.status === 'checked-in' && (
                    <button
                      onClick={() => handleStatusChange(selectedBooking.id, 'checked-out')}
                      className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" /> Check Out
                    </button>
                  )}
                  <button
                    onClick={() => { openEditBooking(selectedBooking); setSelectedBooking(null); }}
                    className="py-2.5 px-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" /> Edit
                  </button>
                  {selectedBooking.status !== 'cancelled' && selectedBooking.status !== 'checked-out' && (
                    <button
                      onClick={() => handleStatusChange(selectedBooking.id, 'cancelled')}
                      className="py-2.5 px-4 bg-danger/15 text-danger rounded-lg hover:bg-danger/30 transition-colors flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Cancel
                    </button>
                  )}
                  {(selectedBooking.status === 'confirmed' || selectedBooking.status === 'pending') && (
                    <button
                      onClick={() => handleStatusChange(selectedBooking.id, 'no-show')}
                      className="py-2.5 px-4 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4" /> No-Show
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW / EDIT BOOKING MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showNewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowNewModal(false); setEditBookingId(null); }} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative z-10 bg-popover border border-border rounded-xl shadow-overlay w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">{editBookingId ? `Edit Booking #${editBookingId}` : 'New Booking'}</h2>
                  <button onClick={() => { setShowNewModal(false); setEditBookingId(null); }} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                  {/* Guest Selection */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Guest <span className="text-danger">*</span></label>
                    <select
                      value={form.guestId}
                      onChange={(e) => updateForm({ guestId: e.target.value })}
                      className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors ${formErrors.guestId ? 'border-danger/50' : 'border-border/30'}`}
                    >
                      <option value="">Choose a guest...</option>
                      {guests.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} — {g.email} ({g.segment})
                        </option>
                      ))}
                    </select>
                    {formErrors.guestId && <p className="text-xs text-danger mt-1">{formErrors.guestId}</p>}
                  </div>

                  {/* Property & Room */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Property <span className="text-danger">*</span></label>
                      <select
                        value={form.propertyId}
                        onChange={(e) => updateForm({ propertyId: e.target.value, roomId: '' })}
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors ${formErrors.propertyId ? 'border-danger/50' : 'border-border/30'}`}
                      >
                        <option value="">Select property...</option>
                        {properties.map(p => <option key={p.id} value={p.propertyId}>{p.name}</option>)}
                      </select>
                      {formErrors.propertyId && <p className="text-xs text-danger mt-1">{formErrors.propertyId}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Room <span className="text-danger">*</span></label>
                      <select
                        value={form.roomId}
                        onChange={(e) => updateForm({ roomId: e.target.value })}
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors ${formErrors.roomId ? 'border-danger/50' : 'border-border/30'}`}
                        disabled={!form.propertyId || !form.checkIn || !form.checkOut}
                      >
                        <option value="">{!form.propertyId ? 'Select property first' : !form.checkIn || !form.checkOut ? 'Select dates first' : `${availableRooms.length} rooms available`}</option>
                        {availableRooms.map(r => (
                          <option key={r.id} value={r.id}>
                            Room {r.number} — {r.type} (R{r.price.toLocaleString()}/night){r.bedType ? ` · ${r.bedType}` : ''}{r.view ? ` · ${r.view} view` : ''}
                          </option>
                        ))}
                      </select>
                      {formErrors.roomId && <p className="text-xs text-danger mt-1">{formErrors.roomId}</p>}
                      {form.propertyId && form.checkIn && form.checkOut && availableRooms.length === 0 && (
                        <p className="text-xs text-orange-400 mt-1">No rooms available for these dates</p>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Check-in Date <span className="text-danger">*</span></label>
                      <input
                        type="date"
                        value={form.checkIn}
                        onChange={(e) => updateForm({ checkIn: e.target.value, roomId: '' })}
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors ${formErrors.checkIn ? 'border-danger/50' : 'border-border/30'}`}
                      />
                      {formErrors.checkIn && <p className="text-xs text-danger mt-1">{formErrors.checkIn}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Check-out Date <span className="text-danger">*</span></label>
                      <input
                        type="date"
                        value={form.checkOut}
                        min={form.checkIn || undefined}
                        onChange={(e) => updateForm({ checkOut: e.target.value, roomId: '' })}
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors ${formErrors.checkOut ? 'border-danger/50' : 'border-border/30'}`}
                      />
                      {formErrors.checkOut && <p className="text-xs text-danger mt-1">{formErrors.checkOut}</p>}
                    </div>
                  </div>

                  {/* Computed stay info */}
                  {computedNights > 0 && selectedRoom && (
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-muted-foreground">{computedNights} night{computedNights !== 1 ? 's' : ''} × R{selectedRoom.price.toLocaleString()}/night</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">R{computedAmount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">excl. VAT</p>
                      </div>
                    </div>
                  )}

                  {/* Guests */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Adults <span className="text-danger">*</span></label>
                      <input
                        type="number"
                        value={form.adults}
                        min={1}
                        max={10}
                        onChange={(e) => updateForm({ adults: parseInt(e.target.value) || 1 })}
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors ${formErrors.adults ? 'border-danger/50' : 'border-border/30'}`}
                      />
                      {formErrors.adults && <p className="text-xs text-danger mt-1">{formErrors.adults}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Children</label>
                      <input
                        type="number"
                        value={form.children}
                        min={0}
                        max={8}
                        onChange={(e) => updateForm({ children: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Source</label>
                      <select
                        value={form.source}
                        onChange={(e) => updateForm({ source: e.target.value })}
                        className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      >
                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Payment Status</label>
                      <select
                        value={form.paymentStatus}
                        onChange={(e) => updateForm({ paymentStatus: e.target.value as BookingFormData['paymentStatus'] })}
                        className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      >
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Deposit Paid (R)</label>
                      <input
                        type="number"
                        value={form.depositPaid}
                        min={0}
                        step={100}
                        onChange={(e) => updateForm({ depositPaid: parseFloat(e.target.value) || 0 })}
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors ${formErrors.depositPaid ? 'border-danger/50' : 'border-border/30'}`}
                        placeholder="0.00"
                      />
                      {formErrors.depositPaid && <p className="text-xs text-danger mt-1">{formErrors.depositPaid}</p>}
                      {computedAmount > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">Balance due: R{computedBalance.toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  {/* Special Requests & Notes */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Special Requests</label>
                    <textarea
                      value={form.specialRequests}
                      onChange={(e) => updateForm({ specialRequests: e.target.value })}
                      placeholder="Late checkout, ocean view, extra pillows..."
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors min-h-[60px]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Staff Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => updateForm({ notes: e.target.value })}
                      placeholder="Internal notes visible only to staff..."
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors min-h-[60px]"
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => { setShowNewModal(false); setEditBookingId(null); }}
                      className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors font-medium"
                    >
                      {editBookingId ? 'Update Booking' : 'Create Booking'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative z-10 bg-popover border border-border rounded-xl shadow-overlay w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-danger/15 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <h3 className="font-bold">Delete Booking</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm mb-6">
                Are you sure you want to delete booking <span className="font-bold">#{showDeleteConfirm}</span>?
                {bookings.find(b => b.id === showDeleteConfirm) && (
                  <span> Guest: <span className="font-medium">{bookings.find(b => b.id === showDeleteConfirm)!.guestName}</span></span>
                )}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-danger/90 hover:shadow-lg transition-colors">
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
