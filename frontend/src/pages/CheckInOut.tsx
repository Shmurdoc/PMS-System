import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  LogIn, LogOut, Search, X, ChevronRight,
  Clock, Key, Bell, Eye, CreditCard,
  CheckCircle, XCircle, Calendar, Users, Building2,
  DoorOpen, Star, Shield, QrCode,
  Fingerprint, Printer, Scan, AlertTriangle
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Booking } from '../store/useAppStore';

const formatCurrency = (amount: number): string => {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const CheckInOutPage = () => {
  const {
    bookings,
    guests,
    updateBooking,
    updateRoom,
    addRfidTag,
    addPayment,
    addAuditLog,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'arrivals' | 'in-house' | 'departures'>('arrivals');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showKioskMode, setShowKioskMode] = useState(false);
  const [showPrintQueue, setShowPrintQueue] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Verification state
  const [idVerified, setIdVerified] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [keyCardIssued, setKeyCardIssued] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'eft'>('card');

  // Kiosk state
  const [kioskInput, setKioskInput] = useState('');
  const [kioskBooking, setKioskBooking] = useState<Booking | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Arrivals: checkIn is today AND status is confirmed
  const arrivals = useMemo(() =>
    bookings.filter(b => b.checkIn === today && b.status === 'confirmed'),
    [bookings, today]
  );

  // Departures: checkOut is today AND status is checked-in
  const departures = useMemo(() =>
    bookings.filter(b => b.checkOut === today && b.status === 'checked-in'),
    [bookings, today]
  );

  // In-House: all with status checked-in
  const inHouse = useMemo(() =>
    bookings.filter(b => b.status === 'checked-in'),
    [bookings]
  );

  const stats = useMemo(() => ({
    expectedArrivals: arrivals.length,
    inHouse: inHouse.length,
    expectedDepartures: departures.length,
    pendingPayments: bookings.filter(b =>
      (b.checkIn === today && b.status === 'confirmed' && b.paymentStatus !== 'paid')
    ).length,
    noShows: bookings.filter(b => b.status === 'no-show' && b.checkIn === today).length,
  }), [arrivals, inHouse, departures, bookings, today]);

  // Filtered list based on active tab
  const filteredBookings = useMemo(() => {
    let list: Booking[] = [];
    if (activeTab === 'arrivals') list = arrivals;
    else if (activeTab === 'departures') list = departures;
    else list = inHouse;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b =>
        b.guestName.toLowerCase().includes(q) ||
        b.roomNumber.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeTab, arrivals, departures, inHouse, searchQuery]);

  // Recent check-in/out actions from audit logs for print queue
  const recentActions = useMemo(() => {
    const checkInOuts = bookings.filter(b =>
      b.status === 'checked-in' || b.status === 'checked-out'
    );
    return checkInOuts.slice(0, 10);
  }, [bookings]);

  const resetVerification = useCallback(() => {
    setIdVerified(false);
    setPaymentVerified(false);
    setKeyCardIssued(false);
    setPaymentMethod('card');
  }, []);

  const openVerifyModal = useCallback((booking: Booking) => {
    resetVerification();
    setSelectedBooking(booking);
    // Auto-verify payment if already paid
    if (booking.paymentStatus === 'paid') {
      setPaymentVerified(true);
    }
    setShowVerifyModal(true);
    setShowDetailModal(false);
  }, [resetVerification]);

  const handleRecordPayment = useCallback(() => {
    if (!selectedBooking) return;
    const paymentId = `PAY-${Date.now()}`;
    const paymentNum = `PAY-${Date.now().toString().slice(-6)}`;
    addPayment({
      id: paymentId,
      paymentNumber: paymentNum,
      bookingId: selectedBooking.id,
      guestId: selectedBooking.guestId,
      guestName: selectedBooking.guestName,
      propertyId: selectedBooking.propertyId,
      amount: selectedBooking.balanceDue ?? selectedBooking.amount,
      currency: 'ZAR',
      method: paymentMethod,
      status: 'completed',
      processedBy: 'system',
      processedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    updateBooking(selectedBooking.id, { paymentStatus: 'paid', balanceDue: 0, depositPaid: selectedBooking.amount });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'payment',
      entityType: 'payment',
      entityId: paymentId,
      entityName: `Payment ${paymentNum}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Payment of ${formatCurrency(selectedBooking.balanceDue ?? selectedBooking.amount)} recorded for booking ${selectedBooking.id} via ${paymentMethod}`,
      timestamp: new Date().toISOString(),
    });
    setPaymentVerified(true);
    setSelectedBooking(prev => prev ? { ...prev, paymentStatus: 'paid' } : null);
    toast.success(`Payment of ${formatCurrency(selectedBooking.balanceDue ?? selectedBooking.amount)} recorded successfully`);
  }, [selectedBooking, paymentMethod, addPayment, updateBooking, addAuditLog]);

  const handleIssueKeyCard = useCallback(() => {
    if (!selectedBooking) return;
    const tagId = `RFID-G-${Date.now().toString().slice(-6)}`;
    addRfidTag({
      id: `rfid-${Date.now()}`,
      propertyId: selectedBooking.propertyId,
      kind: 'guest',
      tagNumber: tagId,
      bookingId: selectedBooking.id,
      guestName: selectedBooking.guestName,
      roomNumber: selectedBooking.roomNumber,
      status: 'active',
      accessLevel: `Room ${selectedBooking.roomNumber}`,
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: selectedBooking.checkOut,
      lastUsed: undefined,
      notes: `Guest key card for room ${selectedBooking.roomNumber}, booking ${selectedBooking.id}`,
    });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'create',
      entityType: 'room',
      entityId: tagId,
      entityName: `RFID Tag ${tagId}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `RFID key card ${tagId} issued to ${selectedBooking.guestName} for room ${selectedBooking.roomNumber}`,
      timestamp: new Date().toISOString(),
    });
    setKeyCardIssued(true);
    toast.success(`RFID key card issued for Room ${selectedBooking.roomNumber}`);
  }, [selectedBooking, addRfidTag, addAuditLog]);

  const handleCompleteCheckIn = useCallback(() => {
    if (!selectedBooking) return;
    if (!idVerified || !paymentVerified || !keyCardIssued) {
      toast.error('Please complete all verification steps before checking in');
      return;
    }
    updateBooking(selectedBooking.id, { status: 'checked-in', updatedAt: new Date().toISOString() });
    updateRoom(selectedBooking.roomId, { status: 'occupied' });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'checkin',
      entityType: 'booking',
      entityId: selectedBooking.id,
      entityName: `Booking ${selectedBooking.id}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Guest ${selectedBooking.guestName} checked in to Room ${selectedBooking.roomNumber}`,
      oldValue: 'confirmed',
      newValue: 'checked-in',
      timestamp: new Date().toISOString(),
    });
    toast.success(`${selectedBooking.guestName} checked in to Room ${selectedBooking.roomNumber}`);
    setShowVerifyModal(false);
    setSelectedBooking(null);
    resetVerification();
  }, [selectedBooking, idVerified, paymentVerified, keyCardIssued, updateBooking, updateRoom, addAuditLog, resetVerification]);

  const handleCheckOut = useCallback((booking: Booking) => {
    updateBooking(booking.id, { status: 'checked-out', updatedAt: new Date().toISOString() });
    updateRoom(booking.roomId, { status: 'cleaning' });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'checkout',
      entityType: 'booking',
      entityId: booking.id,
      entityName: `Booking ${booking.id}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Guest ${booking.guestName} checked out from Room ${booking.roomNumber}`,
      oldValue: 'checked-in',
      newValue: 'checked-out',
      timestamp: new Date().toISOString(),
    });
    toast.success(`${booking.guestName} checked out from Room ${booking.roomNumber}`);
    setShowCheckoutConfirm(null);
    setSelectedBooking(null);
  }, [updateBooking, updateRoom, addAuditLog]);

  const handlePrintReceipt = useCallback((booking: Booking) => {
    const guest = guests.find(g => g.id === booking.guestId);
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');
    if (receiptWindow) {
      receiptWindow.document.write(`
        <html>
        <head><title>Receipt - ${booking.id}</title>
        <style>
          body { font-family: monospace; padding: 20px; max-width: 350px; margin: 0 auto; }
          h1 { text-align: center; font-size: 18px; }
          hr { border: 1px dashed #000; }
          .row { display: flex; justify-content: space-between; margin: 4px 0; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
        </style></head>
        <body>
          <h1>NEXUS PMS</h1>
          <p class="center">${booking.propertyName}</p>
          <hr/>
          <p class="bold">${booking.status === 'checked-out' ? 'CHECK-OUT RECEIPT' : 'CHECK-IN RECEIPT'}</p>
          <div class="row"><span>Booking:</span><span>${booking.id}</span></div>
          <div class="row"><span>Guest:</span><span>${booking.guestName}</span></div>
          <div class="row"><span>Room:</span><span>${booking.roomNumber} (${booking.roomType})</span></div>
          <div class="row"><span>Check-in:</span><span>${booking.checkIn}</span></div>
          <div class="row"><span>Check-out:</span><span>${booking.checkOut}</span></div>
          <div class="row"><span>Nights:</span><span>${booking.nights}</span></div>
          <div class="row"><span>Guests:</span><span>${booking.guests}</span></div>
          <hr/>
          <div class="row bold"><span>Total:</span><span>R ${booking.amount.toFixed(2)}</span></div>
          <div class="row"><span>Payment:</span><span>${booking.paymentStatus.toUpperCase()}</span></div>
          ${guest ? `<div class="row"><span>Loyalty Pts:</span><span>${guest.loyaltyPoints}</span></div>` : ''}
          <hr/>
          <p class="center">Thank you for choosing Nexus!</p>
          <p class="center">${new Date().toLocaleString()}</p>
          <script>window.print();</script>
        </body></html>
      `);
      receiptWindow.document.close();
    }
  }, [guests]);

  const handleKioskSearch = useCallback(() => {
    if (!kioskInput.trim()) return;
    const found = bookings.find(b =>
      (b.id.toLowerCase() === kioskInput.trim().toLowerCase() ||
       b.guestName.toLowerCase().includes(kioskInput.trim().toLowerCase())) &&
      b.status === 'confirmed' &&
      b.checkIn === today
    );
    if (found) {
      setKioskBooking(found);
    } else {
      toast.error('No matching booking found for today\'s arrivals');
    }
  }, [kioskInput, bookings, today]);

  const handleKioskCheckIn = useCallback(() => {
    if (!kioskBooking) return;
    // Auto-generate key card
    const tagId = `RFID-KIOSK-${Date.now().toString().slice(-6)}`;
    addRfidTag({
      id: `rfid-kiosk-${Date.now()}`,
      propertyId: kioskBooking.propertyId,
      kind: 'guest',
      tagNumber: tagId,
      bookingId: kioskBooking.id,
      guestName: kioskBooking.guestName,
      roomNumber: kioskBooking.roomNumber,
      status: 'active',
      accessLevel: `Room ${kioskBooking.roomNumber}`,
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: kioskBooking.checkOut,
      notes: `Kiosk self-service key card for room ${kioskBooking.roomNumber}`,
    });
    updateBooking(kioskBooking.id, { status: 'checked-in', updatedAt: new Date().toISOString() });
    updateRoom(kioskBooking.roomId, { status: 'occupied' });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'checkin',
      entityType: 'booking',
      entityId: kioskBooking.id,
      entityName: `Booking ${kioskBooking.id}`,
      userId: 'system',
      userName: 'Kiosk Self-Service',
      userRole: 'kiosk',
      details: `Self-service check-in: ${kioskBooking.guestName} to Room ${kioskBooking.roomNumber}`,
      timestamp: new Date().toISOString(),
    });
    toast.success(`Welcome ${kioskBooking.guestName}! You're checked in to Room ${kioskBooking.roomNumber}`);
    setKioskBooking(null);
    setKioskInput('');
  }, [kioskBooking, addRfidTag, updateBooking, updateRoom, addAuditLog]);

  const handleNotifyGuest = useCallback((booking: Booking) => {
    toast.success(`Notification sent to ${booking.guestName} at ${booking.guestEmail}`);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'booking',
      entityId: booking.id,
      entityName: `Booking ${booking.id}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Notification sent to ${booking.guestName} (${booking.guestEmail})`,
      timestamp: new Date().toISOString(),
    });
  }, [addAuditLog]);

  const statusColors: Record<string, string> = {
    confirmed: 'bg-info/15 text-info border-info/30',
    'checked-in': 'bg-success/15 text-success border-success/30',
    'checked-out': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    pending: 'bg-warning/15 text-warning border-warning/30',
    cancelled: 'bg-danger/15 text-danger border-danger/30',
    'no-show': 'bg-danger/15 text-danger border-danger/30',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Check-In / Check-Out</h1>
          <p className="text-muted-foreground">Manage guest arrivals and departures in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setKioskBooking(null);
              setKioskInput('');
              setShowKioskMode(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-info/15 text-info rounded-lg hover:bg-info/30 transition-colors"
          >
            <Scan className="w-4 h-4" />
            Self-Service Kiosk
          </button>
          <button
            onClick={() => setShowPrintQueue(true)}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Queue
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 border border-info/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info/15 rounded-lg flex items-center justify-center">
              <LogIn className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.expectedArrivals}</p>
              <p className="text-xs text-muted-foreground">Expected Arrivals</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border border-success/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inHouse}</p>
              <p className="text-xs text-muted-foreground">In-House</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border border-orange-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <LogOut className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.expectedDepartures}</p>
              <p className="text-xs text-muted-foreground">Departures Today</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border border-warning/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/15 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendingPayments}</p>
              <p className="text-xs text-muted-foreground">Pending Payments</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border border-danger/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger/15 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.noShows}</p>
              <p className="text-xs text-muted-foreground">No Shows</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-2 border-b border-border/30 w-full sm:w-auto">
          {([
            { id: 'arrivals' as const, label: `Arrivals (${arrivals.length})`, icon: LogIn },
            { id: 'in-house' as const, label: `In-House (${inHouse.length})`, icon: Users },
            { id: 'departures' as const, label: `Departures (${departures.length})`, icon: LogOut },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, room, or booking ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* Booking Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredBookings.map((booking) => {
            const guest = guests.find(g => g.id === booking.guestId);
            const isVIP = guest?.segment === 'VIP';
            return (
              <motion.div
                key={booking.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
              >
                {/* Card Header */}
                <div className={`p-4 ${isVIP ? 'bg-warning/10 border-b border-warning/20' : 'border-b border-border/30'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                        isVIP ? 'bg-warning/30 text-yellow-300' : 'bg-primary/20 text-primary'
                      }`}>
                        {booking.guestName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{booking.guestName}</h3>
                          {isVIP && (
                            <span className="px-1.5 py-0.5 bg-warning/15 text-warning text-xs rounded flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" /> VIP
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{booking.guestEmail}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs border ${statusColors[booking.status] || 'bg-gray-500/20 text-gray-400'}`}>
                      {booking.status.replace('-', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span>Room {booking.roomNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{booking.checkIn}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{booking.guests} guest(s)</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{booking.nights} night(s)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DoorOpen className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{booking.roomType}</span>
                  </div>

                  {booking.specialRequests && (
                    <div className="flex flex-wrap gap-1.5">
                      {booking.specialRequests.split(',').map((req, i) => (
                        <span key={i} className="px-2 py-0.5 bg-info/10 text-info text-xs rounded-full">
                          {req.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Amount + Payment Status */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <span className="text-sm font-semibold">{formatCurrency(booking.amount)}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      booking.paymentStatus === 'paid' ? 'bg-success/15 text-success' :
                      booking.paymentStatus === 'partial' ? 'bg-warning/15 text-warning' :
                      'bg-danger/15 text-danger'
                    }`}>
                      Payment: {booking.paymentStatus}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {booking.status === 'confirmed' && (
                      <button
                        onClick={() => openVerifyModal(booking)}
                        className="flex-1 py-2 bg-success text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Key className="w-4 h-4" />
                        Check In
                      </button>
                    )}
                    {booking.status === 'checked-in' && activeTab === 'departures' && (
                      <button
                        onClick={() => setShowCheckoutConfirm(booking)}
                        className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <LogOut className="w-4 h-4" />
                        Check Out
                      </button>
                    )}
                    {booking.status === 'checked-in' && activeTab === 'in-house' && (
                      <button
                        onClick={() => {
                          setSelectedBooking(booking);
                          setShowDetailModal(true);
                        }}
                        className="flex-1 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setShowDetailModal(true);
                      }}
                      className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleNotifyGuest(booking)}
                      className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      title="Send Notification"
                    >
                      <Bell className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredBookings.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No guests found for this category</p>
        </div>
      )}

      {/* Guest Detail Modal */}
      <AnimatePresence>
        {selectedBooking && showDetailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowDetailModal(false); setSelectedBooking(null); }} />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Guest Details</h2>
                  <button onClick={() => { setShowDetailModal(false); setSelectedBooking(null); }} className="p-2 hover:bg-muted rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {(() => {
                  const guest = guests.find(g => g.id === selectedBooking.guestId);
                  const isVIP = guest?.segment === 'VIP';
                  return (
                    <>
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                          isVIP ? 'bg-warning/30 text-yellow-300' : 'bg-primary/20 text-primary'
                        }`}>
                          {selectedBooking.guestName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{selectedBooking.guestName}</h3>
                            {isVIP && (
                              <span className="px-2 py-0.5 bg-warning/15 text-warning text-xs rounded flex items-center gap-1">
                                <Star className="w-3 h-3 fill-current" /> VIP
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{selectedBooking.guestEmail}</p>
                          <p className="text-sm text-muted-foreground">{selectedBooking.guestPhone}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Room</p>
                          <p className="font-semibold">{selectedBooking.roomNumber} - {selectedBooking.roomType}</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Check-in</p>
                          <p className="font-semibold">{selectedBooking.checkIn}</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Check-out</p>
                          <p className="font-semibold">{selectedBooking.checkOut}</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="font-semibold">{formatCurrency(selectedBooking.amount)}</p>
                        </div>
                      </div>

                      {guest && (
                        <div className="bg-muted/30 rounded-lg p-4 mb-6">
                          <h4 className="font-semibold mb-2">Guest History</h4>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Stays</span>
                            <span className="font-medium">{guest.totalStays}</span>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Loyalty Points</span>
                            <span className="font-medium">{guest.loyaltyPoints}</span>
                          </div>
                          {guest.lastVisit && (
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-muted-foreground">Last Visit</span>
                              <span className="font-medium">{guest.lastVisit}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedBooking.specialRequests && (
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Bell className="w-4 h-4 text-info" /> Special Requests
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedBooking.specialRequests.split(',').map((req, i) => (
                              <span key={i} className="px-3 py-1 bg-info/10 text-info rounded-full text-sm">
                                {req.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        {selectedBooking.status === 'confirmed' && (
                          <button
                            onClick={() => {
                              setShowDetailModal(false);
                              openVerifyModal(selectedBooking);
                            }}
                            className="flex-1 py-2.5 bg-success text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <Key className="w-4 h-4" />
                            Check In
                          </button>
                        )}
                        {selectedBooking.status === 'checked-in' && (
                          <button
                            onClick={() => {
                              setShowDetailModal(false);
                              setShowCheckoutConfirm(selectedBooking);
                            }}
                            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                          >
                            <LogOut className="w-4 h-4" />
                            Check Out
                          </button>
                        )}
                        <button
                          onClick={() => handlePrintReceipt(selectedBooking)}
                          className="px-4 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2"
                        >
                          <Printer className="w-4 h-4" />
                          Print
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verify & Check-In Modal */}
      <AnimatePresence>
        {showVerifyModal && selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowVerifyModal(false); setSelectedBooking(null); resetVerification(); }} />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Verify & Check In</h2>
                  <button onClick={() => { setShowVerifyModal(false); setSelectedBooking(null); resetVerification(); }} className="p-2 hover:bg-muted rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Fingerprint className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{selectedBooking.guestName}</h3>
                  <p className="text-sm text-muted-foreground">Room {selectedBooking.roomNumber} - {selectedBooking.roomType}</p>
                  <p className="text-sm text-muted-foreground mt-1">{formatCurrency(selectedBooking.amount)}</p>
                </div>

                {/* Verification Steps */}
                <div className="space-y-3 mb-6">
                  {/* Step 1: ID Verification */}
                  <button
                    onClick={() => {
                      if (!idVerified) {
                        setIdVerified(true);
                        toast.success('ID verified successfully');
                      }
                    }}
                    disabled={idVerified}
                    className={`w-full p-4 rounded-lg flex items-center justify-between transition-colors ${
                      idVerified ? 'bg-success/15 border border-success/30' : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Shield className={`w-5 h-5 ${idVerified ? 'text-success' : 'text-muted-foreground'}`} />
                      <div className="text-left">
                        <p className="font-medium">ID Verification</p>
                        <p className="text-xs text-muted-foreground">
                          {idVerified ? 'Identity confirmed' : 'Scan or verify guest ID'}
                        </p>
                      </div>
                    </div>
                    {idVerified ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>

                  {/* Step 2: Payment Verification */}
                  <div className={`w-full p-4 rounded-lg transition-colors ${
                    paymentVerified ? 'bg-success/15 border border-success/30' : 'bg-muted/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className={`w-5 h-5 ${paymentVerified ? 'text-success' : 'text-purple-400'}`} />
                        <div className="text-left">
                          <p className="font-medium">Payment Verification</p>
                          <p className="text-xs text-muted-foreground">
                            {paymentVerified
                              ? 'Payment confirmed'
                              : `Balance due: ${formatCurrency(selectedBooking.balanceDue ?? selectedBooking.amount)}`}
                          </p>
                        </div>
                      </div>
                      {paymentVerified ? (
                        <CheckCircle className="w-5 h-5 text-success" />
                      ) : null}
                    </div>
                    {!paymentVerified && (
                      <div className="mt-3 space-y-2">
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'eft')}
                          className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="card">Credit/Debit Card</option>
                          <option value="cash">Cash</option>
                          <option value="eft">EFT</option>
                        </select>
                        <button
                          onClick={handleRecordPayment}
                          className="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
                        >
                          Record Payment ({formatCurrency(selectedBooking.balanceDue ?? selectedBooking.amount)})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Step 3: RFID Key Card */}
                  <button
                    onClick={() => {
                      if (!keyCardIssued) {
                        handleIssueKeyCard();
                      }
                    }}
                    disabled={keyCardIssued}
                    className={`w-full p-4 rounded-lg flex items-center justify-between transition-colors ${
                      keyCardIssued ? 'bg-success/15 border border-success/30' : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <QrCode className={`w-5 h-5 ${keyCardIssued ? 'text-success' : 'text-info'}`} />
                      <div className="text-left">
                        <p className="font-medium">RFID Key Card</p>
                        <p className="text-xs text-muted-foreground">
                          {keyCardIssued ? 'Key card issued' : `Issue key for Room ${selectedBooking.roomNumber}`}
                        </p>
                      </div>
                    </div>
                    {keyCardIssued ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2 mb-4">
                  <div className={`flex-1 h-1.5 rounded-full ${idVerified ? 'bg-success' : 'bg-muted'}`} />
                  <div className={`flex-1 h-1.5 rounded-full ${paymentVerified ? 'bg-success' : 'bg-muted'}`} />
                  <div className={`flex-1 h-1.5 rounded-full ${keyCardIssued ? 'bg-success' : 'bg-muted'}`} />
                </div>

                <button
                  onClick={handleCompleteCheckIn}
                  disabled={!idVerified || !paymentVerified || !keyCardIssued}
                  className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                    idVerified && paymentVerified && keyCardIssued
                      ? 'bg-success text-white hover:bg-green-600'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  <CheckCircle className="w-5 h-5" />
                  Complete Check-In
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Confirmation Modal */}
      <AnimatePresence>
        {showCheckoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckoutConfirm(null)} />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-sm"
            >
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-info/15 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LogOut className="w-8 h-8 text-info" />
                  </div>
                  <h3 className="text-lg font-bold">Confirm Check-Out</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Check out <strong>{showCheckoutConfirm.guestName}</strong> from Room <strong>{showCheckoutConfirm.roomNumber}</strong>?
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Room will be marked for cleaning.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCheckoutConfirm(null)}
                    className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleCheckOut(showCheckoutConfirm)}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Confirm Check-Out
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Queue Modal */}
      <AnimatePresence>
        {showPrintQueue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPrintQueue(false)} />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Print Queue</h2>
                  <button onClick={() => setShowPrintQueue(false)} className="p-2 hover:bg-muted rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {recentActions.length === 0 ? (
                  <div className="text-center py-8">
                    <Printer className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No recent check-in/out records to print</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActions.map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{booking.guestName}</p>
                          <p className="text-xs text-muted-foreground">
                            Room {booking.roomNumber} - {booking.status === 'checked-in' ? 'Checked In' : 'Checked Out'}
                          </p>
                        </div>
                        <button
                          onClick={() => handlePrintReceipt(booking)}
                          className="px-3 py-1.5 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors text-sm flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          Print
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kiosk Mode Modal */}
      <AnimatePresence>
        {showKioskMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowKioskMode(false)} />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold">Self-Service Kiosk</h2>
                  <button onClick={() => setShowKioskMode(false)} className="p-2 hover:bg-muted rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {!kioskBooking ? (
                  <>
                    <div className="text-center mb-8">
                      <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Scan className="w-12 h-12 text-primary" />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">Welcome</h3>
                      <p className="text-muted-foreground">
                        Enter your booking ID or name to check in
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Booking ID or guest name..."
                          value={kioskInput}
                          onChange={(e) => setKioskInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleKioskSearch(); }}
                          className="w-full pl-12 pr-4 py-3 bg-muted border border-border rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <button
                        onClick={handleKioskSearch}
                        className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold text-lg"
                      >
                        Find My Booking
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <div className="w-20 h-20 bg-success/15 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-10 h-10 text-success" />
                      </div>
                      <h3 className="text-xl font-bold">Booking Found!</h3>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 mb-6 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Guest</span>
                        <span className="font-semibold">{kioskBooking.guestName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Room</span>
                        <span className="font-semibold">{kioskBooking.roomNumber} - {kioskBooking.roomType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Check-in</span>
                        <span className="font-semibold">{kioskBooking.checkIn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Check-out</span>
                        <span className="font-semibold">{kioskBooking.checkOut}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nights</span>
                        <span className="font-semibold">{kioskBooking.nights}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-semibold">{formatCurrency(kioskBooking.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment</span>
                        <span className={`font-semibold ${
                          kioskBooking.paymentStatus === 'paid' ? 'text-success' : 'text-warning'
                        }`}>
                          {kioskBooking.paymentStatus.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {kioskBooking.paymentStatus !== 'paid' && (
                      <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
                        <p className="text-sm text-warning">
                          Outstanding balance: {formatCurrency(kioskBooking.balanceDue ?? kioskBooking.amount)}. Please see front desk for payment.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => { setKioskBooking(null); setKioskInput(''); }}
                        className="flex-1 py-3 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleKioskCheckIn}
                        disabled={kioskBooking.paymentStatus !== 'paid'}
                        className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
                          kioskBooking.paymentStatus === 'paid'
                            ? 'bg-success text-white hover:bg-green-600'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        Confirm Check-In
                      </button>
                    </div>
                  </>
                )}

                <button
                  onClick={() => setShowKioskMode(false)}
                  className="w-full py-3 bg-muted rounded-xl hover:bg-muted/80 transition-colors mt-4"
                >
                  Exit Kiosk Mode
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CheckInOutPage;
