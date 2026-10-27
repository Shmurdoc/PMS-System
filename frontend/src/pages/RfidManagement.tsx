import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Fingerprint, Plus, Search, Edit, Eye, ToggleLeft, ToggleRight,
  Clock, Calendar, CheckCircle, XCircle, AlertTriangle, AlertCircle,
  QrCode, X, Trash2, Download, Users, Shield, Key,
  Nfc, Radio, Unplug, ScanLine
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { RfidTag, AttendanceRecord, StaffTapOutcome, GuestTapOutcome } from '../store/useAppStore';
import { connectSerialReader, isSerialReaderEnabled, normalizeTagNumber } from '../lib/nfc';

const statusColors: Record<string, string> = {
  active: 'bg-success/15 text-success',
  inactive: 'bg-gray-500/20 text-gray-400',
  lost: 'bg-danger/15 text-danger',
  blocked: 'bg-orange-500/20 text-orange-400',
};

const tapFailures: Record<string, string> = {
  unknown: 'Tag not found - issue it from the tags tab first',
  unbound: 'Tag has no staff member assigned',
  inactive: 'Tag is not active - activate it from the tags tab',
  expired: 'Tag has expired',
};

// Numeric ids come from the API; local-only demo tags carry rfid-<timestamp> ids.
const isServerTag = (id: string) => /^\d+$/.test(id);

export default function RfidManagement() {
  const {
    rfidTags,
    users,
    guests,
    bookings,
    properties,
    rooms,
    attendance,
    addRfidTag,
    updateRfidTag,
    deleteRfidTag,
    revokeRfidTag,
    recordStaffTap,
    resolveGuestTap,
    addAttendance,
    addAuditLog,
  } = useAppStore();
  const me = useAppStore((s) => s.user);
const role = useAppStore((s) => s.user?.role);
  const canManage = role === 'admin' || role === 'manager';

  const [activeTab, setActiveTab] = useState<'tags' | 'attendance' | 'tap'>('tags');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState<RfidTag | null>(null);
  const [showEditModal, setShowEditModal] = useState<RfidTag | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<RfidTag | null>(null);
  const [showManualCheckin, setShowManualCheckin] = useState(false);

  // Create form state
  const [createTagNumber, setCreateTagNumber] = useState('');
  const [createAutoGenerate, setCreateAutoGenerate] = useState(true);
  const [createAssignTo, setCreateAssignTo] = useState('');
  const [createAssignType, setCreateAssignType] = useState<'staff' | 'guest'>('staff');
  const [createAccessLevel, setCreateAccessLevel] = useState('Full Access');
  const [createRoomAccess, setCreateRoomAccess] = useState<string[]>([]);
  const [createNotes, setCreateNotes] = useState('');

  // Edit form state
  const [editAssignTo, setEditAssignTo] = useState('');
  const [editAssignName, setEditAssignName] = useState('');
  const [editAccessLevel, setEditAccessLevel] = useState('');
  const [editStatus, setEditStatus] = useState<RfidTag['status']>('active');
  const [editNotes, setEditNotes] = useState('');

  // Manual check-in state
  const [checkinUserId, setCheckinUserId] = useState('');

  // Attendance filter state
  const [attendanceDateFilter, setAttendanceDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceUserFilter, setAttendanceUserFilter] = useState('all');

  // Tap station state
  const [tapUid, setTapUid] = useState('');
  const [tapOutcome, setTapOutcome] = useState<StaffTapOutcome | GuestTapOutcome | null>(null);
  const [readerConnected, setReaderConnected] = useState(false);
  const readerDisconnectRef = useRef<(() => Promise<void>) | null>(null);

  const filteredTags = useMemo(() => {
    return rfidTags.filter(tag => {
      const matchesSearch = tag.tagNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (tag.userName ?? tag.guestName ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || tag.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rfidTags, searchQuery, statusFilter]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter(a => {
      const matchesDate = a.date === attendanceDateFilter;
      const matchesUser = attendanceUserFilter === 'all' || a.userId === attendanceUserFilter;
      return matchesDate && matchesUser;
    });
  }, [attendance, attendanceDateFilter, attendanceUserFilter]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayAttendance = useMemo(() => attendance.filter(a => a.date === todayStr), [attendance, todayStr]);
  const presentCount = todayAttendance.filter(a => a.status === 'present').length;
  const lateCount = todayAttendance.filter(a => a.status === 'late').length;
  const absentCount = todayAttendance.filter(a => a.status === 'absent').length;

  // Stats
  const stats = useMemo(() => ({
    total: rfidTags.length,
    active: rfidTags.filter(t => t.status === 'active').length,
    inactive: rfidTags.filter(t => t.status === 'inactive').length,
    lost: rfidTags.filter(t => t.status === 'lost').length,
    blocked: rfidTags.filter(t => t.status === 'blocked').length,
  }), [rfidTags]);

  const handleToggleStatus = useCallback((tag: RfidTag) => {
    if (isServerTag(tag.id)) {
      toast.error("Server-synced tags can't be toggled locally — revoke them instead");
      return;
    }
    const newStatus = tag.status === 'active' ? 'inactive' : 'active';
    updateRfidTag(tag.id, { status: newStatus });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'rfid_tag',
      entityId: tag.id,
      entityName: `RFID Tag ${tag.tagNumber}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `RFID tag ${tag.tagNumber} status changed from ${tag.status} to ${newStatus}`,
      oldValue: tag.status,
      newValue: newStatus,
      timestamp: new Date().toISOString(),
    });
    toast.success(`Tag ${tag.tagNumber} ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  }, [me, updateRfidTag, addAuditLog]);

  const handleDeleteTag = useCallback((tag: RfidTag) => {
    if (isServerTag(tag.id)) {
      toast.error("Server-synced tags can't be deleted — revoke them instead");
      return;
    }
    deleteRfidTag(tag.id);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'delete',
      entityType: 'rfid_tag',
      entityId: tag.id,
      entityName: `RFID Tag ${tag.tagNumber}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `RFID tag ${tag.tagNumber} assigned to ${tag.userName ?? tag.guestName ?? 'nobody'} was deleted`,
      timestamp: new Date().toISOString(),
    });
    toast.success(`Tag ${tag.tagNumber} deleted`);
    setShowDeleteConfirm(null);
  }, [me, deleteRfidTag, addAuditLog]);

  const handleCreateTag = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const tagNumber = createAutoGenerate
      ? `RFID-${Date.now().toString().slice(-6)}`
      : createTagNumber.trim();

    if (!tagNumber) {
      toast.error('Tag number is required');
      return;
    }
    if (tagNumber.length > 64 || !/^[\x21-\x7E]+$/.test(tagNumber)) {
      toast.error('Tag number must be 1-64 printable characters');
      return;
    }
    if (rfidTags.some(t => t.tagNumber.toLowerCase() === tagNumber.toLowerCase())) {
      toast.error(`Tag ${tagNumber} already exists`);
      return;
    }
    if (!createAssignTo) {
      toast.error('Please select a person to assign the tag to');
      return;
    }

    let assigneeName = '';
    if (createAssignType === 'staff') {
      const user = users.find(u => u.id === createAssignTo);
      assigneeName = user?.name ?? '';
    } else {
      const guest = guests.find(g => g.id === createAssignTo);
      assigneeName = guest?.name ?? '';
    }

    if (!assigneeName) {
      toast.error('Selected person not found');
      return;
    }

    // Staff tags bind to a user, guest tags to that guest's active booking —
    // a checked-in stay outranks a confirmed one, which outranks anything else still open.
    const stayRank = (status: string) => status === 'checked-in' ? 0 : status === 'confirmed' ? 1 : 2;
    const booking = createAssignType === 'guest'
      ? bookings
          .filter(b => b.guestId === createAssignTo && b.status !== 'checked-out')
          .sort((a, b) => stayRank(a.status) - stayRank(b.status))[0]
      : undefined;
    if (createAssignType === 'guest' && !booking) {
      toast.error('Selected guest has no active booking — check them in first');
      return;
    }
    const newTag: RfidTag = {
      id: `rfid-${Date.now()}`,
      propertyId: me?.propertyId ?? properties[0]?.propertyId ?? '1',
      kind: createAssignType === 'guest' ? 'guest' : 'staff',
      tagNumber,
      userId: createAssignType === 'staff' ? createAssignTo : undefined,
      userName: createAssignType === 'staff' ? assigneeName : undefined,
      bookingId: booking?.id,
      guestName: createAssignType === 'guest' ? assigneeName : undefined,
      roomNumber: booking?.roomNumber,
      status: 'active',
      accessLevel: createRoomAccess.length > 0
        ? `Rooms: ${createRoomAccess.join(', ')}`
        : createAccessLevel,
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: booking?.checkOut,
      notes: createNotes || undefined,
    };

    addRfidTag(newTag);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'create',
      entityType: 'rfid_tag',
      entityId: newTag.id,
      entityName: `RFID Tag ${tagNumber}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `RFID tag ${tagNumber} created and assigned to ${assigneeName} (${createAssignType})`,
      timestamp: new Date().toISOString(),
    });
    toast.success(`RFID tag ${tagNumber} created for ${assigneeName}`);

    // Reset form
    setCreateTagNumber('');
    setCreateAutoGenerate(true);
    setCreateAssignTo('');
    setCreateAssignType('staff');
    setCreateAccessLevel('Full Access');
    setCreateRoomAccess([]);
    setCreateNotes('');
    setShowCreateModal(false);
  }, [me, createAutoGenerate, createTagNumber, createAssignTo, createAssignType, createAccessLevel, createRoomAccess, createNotes, rfidTags, users, guests, bookings, properties, addRfidTag, addAuditLog]);

  const openEditModal = useCallback((tag: RfidTag) => {
    setEditAssignTo(tag.userId ?? '');
    setEditAssignName(tag.userName ?? tag.guestName ?? '');
    setEditAccessLevel(tag.accessLevel);
    setEditStatus(tag.status);
    setEditNotes(tag.notes ?? '');
    setShowEditModal(tag);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!showEditModal) return;

    const assigneeName = editAssignTo
      ? (users.find(u => u.id === editAssignTo)?.name ?? guests.find(g => g.id === editAssignTo)?.name ?? editAssignName)
      : editAssignName;

    // Blocking a tag goes through revoke — the API marks the row server-side.
    const revoking = editStatus === 'blocked' && showEditModal.status !== 'blocked';
    if (!revoking && isServerTag(showEditModal.id)) {
      toast.error("Server-synced tags only accept revoke (block) — other edits need the API");
      return;
    }
    const updates: Partial<RfidTag> = {
      userId: editAssignTo || showEditModal.userId,
      userName: assigneeName || showEditModal.userName,
      accessLevel: editAccessLevel,
      notes: editNotes || undefined,
    };
    if (!revoking) updates.status = editStatus;
    updateRfidTag(showEditModal.id, updates);
    if (revoking) revokeRfidTag(showEditModal.id, editNotes || undefined);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'rfid_tag',
      entityId: showEditModal.id,
      entityName: `RFID Tag ${showEditModal.tagNumber}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: revoking
        ? `RFID tag ${showEditModal.tagNumber} revoked: assignee=${assigneeName}, access=${editAccessLevel}, status=blocked`
        : `RFID tag ${showEditModal.tagNumber} updated: assignee=${assigneeName}, access=${editAccessLevel}, status=${editStatus}`,
      timestamp: new Date().toISOString(),
    });
    toast.success(revoking
      ? `Tag ${showEditModal.tagNumber} revoked (blocked)`
      : `Tag ${showEditModal.tagNumber} updated successfully`);
    setShowEditModal(null);
  }, [me, showEditModal, editAssignTo, editAssignName, editAccessLevel, editStatus, editNotes, users, guests, updateRfidTag, revokeRfidTag, addAuditLog]);

  const handleManualCheckin = useCallback(() => {
    if (!checkinUserId) {
      toast.error('Please select a user');
      return;
    }
    const user = users.find(u => u.id === checkinUserId);
    if (!user) {
      toast.error('User not found');
      return;
    }

    const now = new Date();
    const hour = now.getHours();
    const record: AttendanceRecord = {
      id: `att-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      checkIn: now.toISOString(),
      date: now.toISOString().split('T')[0],
      status: hour > 8 ? 'late' : 'present',
    };
    addAttendance(record);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'create',
      entityType: 'user',
      entityId: record.id,
      entityName: `Attendance ${record.id}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Manual check-in recorded for ${user.name} at ${now.toLocaleTimeString()} (${record.status})`,
      timestamp: now.toISOString(),
    });
    toast.success(`${user.name} checked in (${record.status})`);
    setCheckinUserId('');
    setShowManualCheckin(false);
  }, [me, checkinUserId, users, addAttendance, addAuditLog]);

  const handleQuickCheckIn = useCallback((userId: string, userName: string) => {
    const now = new Date();
    const hour = now.getHours();
    const record: AttendanceRecord = {
      id: `att-${Date.now()}`,
      userId,
      userName,
      checkIn: now.toISOString(),
      date: now.toISOString().split('T')[0],
      status: hour > 8 ? 'late' : 'present',
    };
    addAttendance(record);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'create',
      entityType: 'user',
      entityId: record.id,
      entityName: `Attendance ${record.id}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Quick check-in: ${userName} at ${now.toLocaleTimeString()} (${record.status})`,
      timestamp: now.toISOString(),
    });
    toast.success(`${userName} checked in (${record.status})`);
  }, [me, addAttendance, addAuditLog]);

  const handleExportCsv = useCallback(() => {
    const headers = ['Tag Number', 'Kind', 'Assigned To', 'User ID', 'Room', 'Status', 'Access Level', 'Created At', 'Last Used', 'Notes'];
    const rows = rfidTags.map(tag => [
      tag.tagNumber,
      tag.kind,
      tag.userName ?? tag.guestName ?? '',
      tag.userId ?? '',
      tag.roomNumber ?? '',
      tag.status,
      tag.accessLevel,
      tag.createdAt,
      tag.lastUsed ?? 'Never',
      tag.notes ?? '',
    ]);

    // Cells starting with =, +, - or @ execute as formulas in spreadsheets —
    // prefix them so a hostile tag number or note can't run code when exported.
    const csvSafe = (cell: string) => (/^[=+\-@]/.test(cell) ? `'${cell}` : cell);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${csvSafe(String(cell)).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rfid-tags-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('RFID tags exported to CSV');
  }, [rfidTags]);

  const handleToggleRoomAccess = useCallback((roomNumber: string) => {
    setCreateRoomAccess(prev =>
      prev.includes(roomNumber)
        ? prev.filter(r => r !== roomNumber)
        : [...prev, roomNumber]
    );
  }, []);

  // Serial readers emit the same UID several times per physical tap — swallow
  // repeats of the same tag for 4s (sliding) so one press can't punch twice.
  const lastTapRef = useRef<Map<string, number>>(new Map());

  const handleTap = useCallback((raw: string) => {
    const tagNumber = normalizeTagNumber(raw);
    if (!tagNumber) {
      toast.error('Tag number must be 1-64 characters');
      return;
    }
    const cooldownKey = tagNumber.toLowerCase();
    const readAt = Date.now();
    const lastRead = lastTapRef.current.get(cooldownKey) ?? 0;
    lastTapRef.current.set(cooldownKey, readAt);
    if (readAt - lastRead < 4000) {
      setTapUid('');
      return;
    }
    const tag = rfidTags.find(t => t.tagNumber.toLowerCase() === tagNumber.toLowerCase());
    if (!tag) {
      setTapOutcome({ kind: 'unknown' });
      toast.error(`No tag matches ${tagNumber}`);
      setTapUid('');
      return;
    }
    if (tag.kind === 'staff') {
      const outcome = recordStaffTap(tag.tagNumber);
      setTapOutcome(outcome);
      if (outcome.kind === 'punched') {
        toast.success(`${outcome.userName} checked ${outcome.punch}`);
      } else {
        toast.error(tapFailures[outcome.kind]);
      }
    } else {
      const outcome = resolveGuestTap(tag.tagNumber);
      setTapOutcome(outcome);
      if (outcome.kind === 'resolved') {
        toast.success(`Stay opened for ${outcome.tag.guestName ?? tag.tagNumber}`);
      } else {
        toast.error(tapFailures[outcome.kind]);
      }
    }
    setTapUid('');
  }, [rfidTags, recordStaffTap, resolveGuestTap]);

  // The reader keeps this callback from connect-time — forward through a ref.
  const tapHandlerRef = useRef(handleTap);
  useEffect(() => {
    tapHandlerRef.current = handleTap;
  }, [handleTap]);

  const handleConnectReader = useCallback(async () => {
    if (readerDisconnectRef.current) {
      const disconnect = readerDisconnectRef.current;
      readerDisconnectRef.current = null;
      setReaderConnected(false);
      await disconnect();
      toast.success('Reader disconnected');
      return;
    }
    try {
      readerDisconnectRef.current = await connectSerialReader((tagNumber) => tapHandlerRef.current(tagNumber));
      setReaderConnected(true);
      toast.success('Reader connected — present a tag');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reader failed to connect');
    }
  }, []);

  useEffect(() => () => {
    const disconnect = readerDisconnectRef.current;
    if (!disconnect) return;
    readerDisconnectRef.current = null;
    void disconnect();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">RFID & Attendance</h1>
          <p className="text-muted-foreground">Manage RFID tags and track staff attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowManualCheckin(true)}
            className="flex items-center gap-2 px-4 py-2 bg-info/15 text-info rounded-lg hover:bg-info/30 transition-colors"
          >
            <QrCode className="w-4 h-4" />
            Manual Check-in
          </button>
          {canManage && (
            <button
              onClick={() => {
                setCreateTagNumber('');
                setCreateAutoGenerate(true);
                setCreateAssignTo('');
                setCreateAssignType('staff');
                setCreateAccessLevel('Full Access');
                setCreateRoomAccess([]);
                setCreateNotes('');
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Tag
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/30">
        <button
          onClick={() => setActiveTab('tags')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'tags'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Fingerprint className="w-4 h-4" />
          RFID Tags ({rfidTags.length})
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'attendance'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Attendance
        </button>
        <button
          onClick={() => setActiveTab('tap')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'tap'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Nfc className="w-4 h-4" />
          Tap Station
        </button>
      </div>

      {activeTab === 'tags' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                  <Fingerprint className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Tags</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 border border-success/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 border border-gray-500/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-500/20 rounded-lg flex items-center justify-center">
                  <ToggleLeft className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inactive}</p>
                  <p className="text-sm text-muted-foreground">Inactive</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 border border-danger/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-danger/15 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.lost}</p>
                  <p className="text-sm text-muted-foreground">Lost</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 border border-orange-500/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.blocked}</p>
                  <p className="text-sm text-muted-foreground">Blocked</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by tag number or assigned to..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="lost">Lost</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {/* Tags Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border/30">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tag ID</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kind</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned To</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Access Level</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Used</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTags.length > 0 ? filteredTags.map((tag) => (
                    <tr key={tag.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Fingerprint className="w-4 h-4 text-primary" />
                          <span className="font-medium font-mono text-sm">{tag.tagNumber}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                          tag.kind === 'guest' ? 'bg-info/15 text-info' : 'bg-primary/15 text-primary'
                        }`}>
                          {tag.kind === 'guest' ? <Key className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                          {tag.kind.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold">
                            {(tag.userName ?? tag.guestName ?? '').split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <span className="text-sm">{tag.userName ?? tag.guestName}</span>
                            {tag.kind === 'guest' && tag.roomNumber && (
                              <span className="block text-xs text-muted-foreground">Room {tag.roomNumber}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{tag.accessLevel}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${statusColors[tag.status] || 'bg-gray-500/20 text-gray-400'}`}>
                          {tag.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{tag.createdAt}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {tag.lastUsed ? new Date(tag.lastUsed).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowViewModal(tag)}
                            className="p-1.5 hover:bg-muted rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {canManage && (
                            <button
                              onClick={() => openEditModal(tag)}
                              className="p-1.5 hover:bg-muted rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleStatus(tag)}
                            className="p-1.5 hover:bg-muted rounded transition-colors"
                            title={tag.status === 'active' ? 'Deactivate' : 'Activate'}
                          >
                            {tag.status === 'active' ? (
                              <ToggleRight className="w-4 h-4 text-success" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          {canManage && (
                            <button
                              onClick={() => setShowDeleteConfirm(tag)}
                              className="p-1.5 hover:bg-danger/15 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-danger" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No RFID tags found matching your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === 'attendance' ? (
        <>
          {/* Attendance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 text-center border border-success/30">
              <p className="text-3xl font-bold text-success">{presentCount}</p>
              <p className="text-sm text-muted-foreground">Present Today</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center border border-warning/30">
              <p className="text-3xl font-bold text-warning">{lateCount}</p>
              <p className="text-sm text-muted-foreground">Late Today</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center border border-danger/30">
              <p className="text-3xl font-bold text-danger">{absentCount}</p>
              <p className="text-sm text-muted-foreground">Absent Today</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-3xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">Total Staff</p>
            </div>
          </div>

          {/* Quick Check-in Kiosk */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Quick Check-in Kiosk
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Click a staff member to record their check-in
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {users.map((user) => {
                const hasCheckedIn = todayAttendance.some(a => a.userId === user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => !hasCheckedIn && handleQuickCheckIn(user.id, user.name)}
                    disabled={hasCheckedIn}
                    className={`p-4 rounded-xl border transition-colors text-left ${
                      hasCheckedIn
                        ? 'bg-success/15 border-success/30 cursor-not-allowed'
                        : 'bg-muted/30 border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-sm">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.role}</p>
                      </div>
                    </div>
                    <div className={`mt-3 text-sm ${hasCheckedIn ? 'text-success' : 'text-muted-foreground'}`}>
                      {hasCheckedIn ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Checked In
                        </span>
                      ) : (
                        'Click to check in'
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Attendance Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={attendanceDateFilter}
                onChange={(e) => setAttendanceDateFilter(e.target.value)}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
            </div>
            <select
              value={attendanceUserFilter}
              onChange={(e) => setAttendanceUserFilter(e.target.value)}
              className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            >
              <option value="all">All Staff</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Attendance Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border/30 flex items-center justify-between">
              <h3 className="font-semibold">
                Attendance Records ({attendanceDateFilter === todayStr ? 'Today' : attendanceDateFilter})
              </h3>
              <span className="text-sm text-muted-foreground">
                {filteredAttendance.length} record(s)
              </span>
            </div>
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border/30">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Check-in Time</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Check-out Time</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.length > 0 ? filteredAttendance.map((record) => (
                  <tr key={record.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold">
                          {record.userName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium">{record.userName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {record.checkIn ? new Date(record.checkIn).toLocaleTimeString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {record.checkOut ? new Date(record.checkOut).toLocaleTimeString() : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                        record.status === 'present' ? 'bg-success/15 text-success' :
                        record.status === 'late' ? 'bg-warning/15 text-warning' :
                        record.status === 'absent' ? 'bg-danger/15 text-danger' :
                        'bg-info/15 text-info'
                      }`}>
                        {record.status === 'present' ? <CheckCircle className="w-3 h-3" /> :
                         record.status === 'late' ? <Clock className="w-3 h-3" /> :
                         record.status === 'absent' ? <XCircle className="w-3 h-3" /> :
                         <AlertTriangle className="w-3 h-3" />}
                        {record.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No attendance records found for this date
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Tap Station */}
          <div className="bg-card border border-border rounded-xl p-6 max-w-2xl">
            <h3 className="font-semibold mb-1 flex items-center gap-2">
              <Nfc className="w-5 h-5" />
              Read a Tag
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Staff tags punch attendance, guest tags open the stay. Type the number by hand or connect a reader.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); handleTap(tapUid); }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="RFID-000123"
                value={tapUid}
                onChange={(e) => setTapUid(e.target.value)}
                autoFocus
                className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <ScanLine className="w-4 h-4" />
                Read
              </button>
            </form>
            {isSerialReaderEnabled() && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleConnectReader}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    readerConnected
                      ? 'bg-danger/15 text-danger hover:bg-danger/25'
                      : 'bg-info/15 text-info hover:bg-info/25'
                  }`}
                >
                  {readerConnected ? <Unplug className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
                  {readerConnected ? 'Disconnect reader' : 'Connect reader'}
                </button>
                <span className="text-xs text-muted-foreground">
                  {readerConnected ? 'Listening for taps' : 'Serial reader is off'}
                </span>
              </div>
            )}
          </div>

          {/* Last tap outcome */}
          {tapOutcome && (
            <div className={`bg-card border rounded-xl p-6 max-w-2xl ${
              tapOutcome.kind === 'punched' || tapOutcome.kind === 'resolved'
                ? 'border-success/30'
                : 'border-danger/30'
            }`}>
              {tapOutcome.kind === 'punched' && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-success/15 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold">{tapOutcome.userName} — checked {tapOutcome.punch}</p>
                    <p className="text-sm text-muted-foreground">
                      {tapOutcome.punch === 'in'
                        ? `In at ${new Date(tapOutcome.checkIn).toLocaleTimeString()}`
                        : `Out at ${tapOutcome.checkOut ? new Date(tapOutcome.checkOut).toLocaleTimeString() : '—'} · in since ${new Date(tapOutcome.checkIn).toLocaleTimeString()}`}
                    </p>
                  </div>
                </div>
              )}

              {tapOutcome.kind === 'resolved' && (
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-info/15 rounded-full flex items-center justify-center">
                      <Key className="w-6 h-6 text-info" />
                    </div>
                    <div>
                      <p className="font-semibold">{tapOutcome.tag.guestName ?? 'Guest'} — stay found</p>
                      <p className="text-sm text-muted-foreground">
                        Tag {tapOutcome.tag.tagNumber}
                        {tapOutcome.tag.lastUsed ? ` read at ${new Date(tapOutcome.tag.lastUsed).toLocaleTimeString()}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <span className="text-xs text-muted-foreground block">Room</span>
                      <span className="font-medium">{tapOutcome.tag.roomNumber ?? tapOutcome.booking?.roomNumber ?? '—'}</span>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <span className="text-xs text-muted-foreground block">Booking</span>
                      <span className="font-medium font-mono">{tapOutcome.booking?.id ?? tapOutcome.tag.bookingId ?? '—'}</span>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <span className="text-xs text-muted-foreground block">Stay</span>
                      <span className="font-medium">
                        {tapOutcome.booking ? `${tapOutcome.booking.checkIn} → ${tapOutcome.booking.checkOut}` : '—'}
                      </span>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <span className="text-xs text-muted-foreground block">Valid until</span>
                      <span className="font-medium">{tapOutcome.tag.expiresAt ?? '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {tapOutcome.kind !== 'punched' && tapOutcome.kind !== 'resolved' && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-danger/15 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-danger" />
                  </div>
                  <div>
                    <p className="font-semibold">Tap rejected</p>
                    <p className="text-sm text-muted-foreground">{tapFailures[tapOutcome.kind]}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* View Tag Modal */}
      <AnimatePresence>
        {showViewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowViewModal(null)} />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Tag Details</h2>
                  <button onClick={() => setShowViewModal(null)} className="p-2 hover:bg-muted rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Fingerprint className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold font-mono">{showViewModal.tagNumber}</h3>
                  <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full mt-2 ${statusColors[showViewModal.status]}`}>
                    {showViewModal.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">Kind</span>
                    <span className="text-sm font-medium">{showViewModal.kind === 'guest' ? 'Guest' : 'Staff'}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">Assigned To</span>
                    <span className="text-sm font-medium">{showViewModal.userName ?? showViewModal.guestName ?? '—'}</span>
                  </div>
                  {showViewModal.userId ? (
                    <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">User ID</span>
                      <span className="text-sm font-medium font-mono">{showViewModal.userId}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">Room</span>
                      <span className="text-sm font-medium font-mono">{showViewModal.roomNumber ?? showViewModal.bookingId ?? '—'}</span>
                    </div>
                  )}
                  <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">Access Level</span>
                    <span className="text-sm font-medium">{showViewModal.accessLevel}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">Created</span>
                    <span className="text-sm font-medium">{showViewModal.createdAt}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">Last Used</span>
                    <span className="text-sm font-medium">
                      {showViewModal.lastUsed ? new Date(showViewModal.lastUsed).toLocaleString() : 'Never'}
                    </span>
                  </div>
                  {showViewModal.expiresAt && (
                    <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">Expires</span>
                      <span className="text-sm font-medium">{showViewModal.expiresAt}</span>
                    </div>
                  )}
                  {showViewModal.notes && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground block mb-1">Notes</span>
                      <span className="text-sm">{showViewModal.notes}</span>
                    </div>
                  )}
                </div>

                {/* Scan History (simulated from recent attendance) */}
                {showViewModal.kind === 'staff' && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Recent Activity
                  </h4>
                  {(() => {
                    const userAttendance = attendance
                      .filter(a => a.userId === showViewModal.userId)
                      .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())
                      .slice(0, 5);
                    return userAttendance.length > 0 ? (
                      <div className="space-y-2">
                        {userAttendance.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-sm">
                            <span>{a.date}</span>
                            <span className="text-muted-foreground">
                              {new Date(a.checkIn).toLocaleTimeString()}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              a.status === 'present' ? 'bg-success/15 text-success' :
                              a.status === 'late' ? 'bg-warning/15 text-warning' :
                              'bg-danger/15 text-danger'
                            }`}>
                              {a.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent activity</p>
                    );
                  })()}
                </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowViewModal(null);
                      openEditModal(showViewModal);
                    }}
                    className="flex-1 py-2.5 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      handleToggleStatus(showViewModal);
                      setShowViewModal(null);
                    }}
                    className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-center gap-2"
                  >
                    {showViewModal.status === 'active' ? (
                      <><ToggleLeft className="w-4 h-4" /> Deactivate</>
                    ) : (
                      <><ToggleRight className="w-4 h-4" /> Activate</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Tag Modal */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(null)} />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Edit Tag {showEditModal.tagNumber}</h2>
                  <button onClick={() => setShowEditModal(null)} className="p-2 hover:bg-muted rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Assign To</label>
                    <select
                      value={editAssignTo}
                      disabled={isServerTag(showEditModal.id)}
                      onChange={(e) => {
                        setEditAssignTo(e.target.value);
                        const u = users.find(u => u.id === e.target.value);
                        const g = guests.find(g => g.id === e.target.value);
                        setEditAssignName(u?.name ?? g?.name ?? '');
                      }}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors disabled:opacity-50"
                    >
                      <option value="">Select person...</option>
                      {showEditModal.kind === 'staff' ? (
                        <optgroup label="Staff">
                          {users.map(user => (
                            <option key={`staff-${user.id}`} value={user.id}>{user.name} - {user.role}</option>
                          ))}
                        </optgroup>
                      ) : (
                        <optgroup label="Guests">
                          {guests.map(guest => (
                            <option key={`guest-${guest.id}`} value={guest.id}>{guest.name} ({guest.segment})</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Access Level</label>
                    <select
                      value={editAccessLevel}
                      onChange={(e) => setEditAccessLevel(e.target.value)}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="Full Access">Full Access</option>
                      <option value="Front Desk">Front Desk</option>
                      <option value="Housekeeping">Housekeeping</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Finance">Finance</option>
                      <option value="Security">Security</option>
                      <option value="Guest">Guest</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as RfidTag['status'])}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="lost">Lost</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Notes</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors resize-none"
                      placeholder="Optional notes..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(null)}
                      className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleEditSave}
                      className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-sm"
            >
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-danger/15 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-8 h-8 text-danger" />
                  </div>
                  <h3 className="text-lg font-bold">Delete RFID Tag</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Are you sure you want to delete tag <strong>{showDeleteConfirm.tagNumber}</strong> assigned to <strong>{showDeleteConfirm.userName ?? showDeleteConfirm.guestName ?? 'nobody'}</strong>?
                  </p>
                  <p className="text-xs text-danger mt-2">This action cannot be undone.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteTag(showDeleteConfirm)}
                    className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-danger/90 transition-colors"
                  >
                    Delete Tag
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Tag Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Create RFID Tag</h2>
                  <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-muted rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateTag} className="space-y-4">
                  {/* Tag Number */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Tag Number</label>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="autoGenerate"
                        checked={createAutoGenerate}
                        onChange={(e) => setCreateAutoGenerate(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="autoGenerate" className="text-sm text-muted-foreground">Auto-generate tag ID</label>
                    </div>
                    {!createAutoGenerate && (
                      <input
                        type="text"
                        placeholder="RFID-XXX"
                        value={createTagNumber}
                        onChange={(e) => setCreateTagNumber(e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      />
                    )}
                  </div>

                  {/* Assign Type */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Assign Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setCreateAssignType('staff'); setCreateAssignTo(''); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          createAssignType === 'staff'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <Users className="w-4 h-4 inline mr-1" /> Staff
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCreateAssignType('guest'); setCreateAssignTo(''); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          createAssignType === 'guest'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <Key className="w-4 h-4 inline mr-1" /> Guest
                      </button>
                    </div>
                  </div>

                  {/* Assign To */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Assign To ({createAssignType === 'staff' ? 'Staff Member' : 'Guest'})
                    </label>
                    <select
                      value={createAssignTo}
                      onChange={(e) => setCreateAssignTo(e.target.value)}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="">Select {createAssignType}...</option>
                      {createAssignType === 'staff'
                        ? users.map(user => (
                            <option key={user.id} value={user.id}>{user.name} - {user.role}</option>
                          ))
                        : guests.map(guest => (
                            <option key={guest.id} value={guest.id}>{guest.name} ({guest.segment})</option>
                          ))
                      }
                    </select>
                  </div>

                  {/* Access Level */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Access Level</label>
                    <select
                      value={createAccessLevel}
                      onChange={(e) => setCreateAccessLevel(e.target.value)}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="Full Access">Full Access</option>
                      <option value="Front Desk">Front Desk</option>
                      <option value="Housekeeping">Housekeeping</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Finance">Finance</option>
                      <option value="Security">Security</option>
                      <option value="Guest">Guest</option>
                    </select>
                  </div>

                  {/* Room Access Multi-select */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Room Access ({createRoomAccess.length} selected)
                    </label>
                    <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2 bg-muted/30 rounded-lg border border-border">
                      {rooms.map(room => (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => handleToggleRoomAccess(room.number)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            createRoomAccess.includes(room.number)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {room.number}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Notes</label>
                    <textarea
                      value={createNotes}
                      onChange={(e) => setCreateNotes(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors resize-none"
                      placeholder="Optional notes..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
                    >
                      Create Tag
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Check-in Modal */}
      <AnimatePresence>
        {showManualCheckin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowManualCheckin(false)} />
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Manual Check-in</h2>
                  <button onClick={() => setShowManualCheckin(false)} className="p-2 hover:bg-muted rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select a staff member for manual attendance check-in
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Staff Member</label>
                    <select
                      value={checkinUserId}
                      onChange={(e) => setCheckinUserId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="">Select staff member...</option>
                      {users.map(user => {
                        const alreadyIn = todayAttendance.some(a => a.userId === user.id);
                        return (
                          <option key={user.id} value={user.id} disabled={alreadyIn}>
                            {user.name} - {user.role}{alreadyIn ? ' (Already checked in)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Current time: {new Date().toLocaleTimeString()}
                    {new Date().getHours() > 8 && (
                      <span className="ml-2 text-warning">(will be marked as late)</span>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowManualCheckin(false)}
                      className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleManualCheckin}
                      disabled={!checkinUserId}
                      className={`flex-1 py-2.5 rounded-lg transition-colors ${
                        checkinUserId
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      Record Check-in
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
