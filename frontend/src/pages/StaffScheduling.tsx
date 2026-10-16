import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Plus, Edit, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Search, RefreshCw,
  Grid, List, ArrowLeftRight, Download, X, Trash2, Filter
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { toast } from 'sonner';
import type { Shift } from '../store/useAppStore';
import { newId } from '../utils/id';

const statusColors: Record<string, string> = {
  scheduled: 'bg-info/15 text-info',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-danger/15 text-danger',
  swapped: 'bg-purple-500/20 text-purple-400',
};

const departmentColors: Record<string, string> = {
  'Front Desk': 'bg-info/15 text-info border-info/30',
  'Housekeeping': 'bg-success/15 text-success border-success/30',
  'Kitchen': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Maintenance': 'bg-warning/15 text-warning border-warning/30',
  'Security': 'bg-danger/15 text-danger border-danger/30',
  'Management': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Finance': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

const inputClass = 'w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors';

const roles = ['Front Desk', 'Housekeeping', 'Kitchen', 'Maintenance', 'Security', 'Concierge', 'Chef', 'Manager'];
const departments = ['Front Desk', 'Housekeeping', 'Kitchen', 'Maintenance', 'Security', 'Management', 'Finance'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push(day);
  }
  return days;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime12(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // overnight shift
  return diff / 60;
}

interface ShiftFormData {
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  department: string;
  breakStart: string;
  breakEnd: string;
  notes: string;
}

const emptyForm: ShiftFormData = {
  userId: '',
  date: new Date().toISOString().split('T')[0],
  startTime: '09:00',
  endTime: '17:00',
  role: 'Front Desk',
  department: 'Front Desk',
  breakStart: '',
  breakEnd: '',
  notes: '',
};

export default function StaffScheduling() {
  const { users, shifts, addShift, updateShift, deleteShift, addAuditLog } = useAppStore();

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState<ShiftFormData>({ ...emptyForm });
  const [swapTargetUserId, setSwapTargetUserId] = useState('');

  // Computed
  const weekStart = useMemo(() => getWeekStart(currentWeek), [currentWeek]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const weekDateRange = useMemo(() => {
    const startStr = toDateStr(weekDays[0]);
    const endStr = toDateStr(weekDays[6]);
    return { startStr, endStr };
  }, [weekDays]);

  const weekShifts = useMemo(() => {
    return shifts.filter(s => {
      return s.date >= weekDateRange.startStr && s.date <= weekDateRange.endStr;
    });
  }, [shifts, weekDateRange]);

  const filteredWeekShifts = useMemo(() => {
    let filtered = weekShifts;
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(s => s.department === departmentFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.userName.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [weekShifts, departmentFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const totalShifts = weekShifts.length;
    const totalHours = weekShifts.reduce((sum, s) => sum + calcHours(s.startTime, s.endTime), 0);
    const overtimeHours = weekShifts.reduce((sum, s) => sum + (s.overtime || 0), 0);
    const cancellations = weekShifts.filter(s => s.status === 'cancelled').length;
    return { totalShifts, totalHours: Math.round(totalHours * 10) / 10, overtimeHours, cancellations };
  }, [weekShifts]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (departmentFilter !== 'all') {
      result = result.filter(u => u.department === departmentFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, departmentFilter, searchQuery]);

  // Navigation
  const prevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };
  const nextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };
  const goToToday = () => setCurrentWeek(new Date());

  // Helpers
  const getShiftsForUser = (userId: string, date: Date) => {
    const dateStr = toDateStr(date);
    return filteredWeekShifts.filter(s => s.userId === userId && s.date === dateStr);
  };

  const updateForm = (field: keyof ShiftFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getUserName = (userId: string): string => {
    return users.find(u => u.id === userId)?.name || 'Unknown';
  };

  // CRUD operations
  const handleCreateShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId) {
      toast.error('Please select an employee');
      return;
    }
    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }

    const userName = getUserName(formData.userId);
    const newShift: Shift = {
      id: newId('SHIFT'),
      userId: formData.userId,
      userName,
      startTime: formData.startTime,
      endTime: formData.endTime,
      date: formData.date,
      role: formData.role,
      department: formData.department,
      status: 'scheduled',
      breakStart: formData.breakStart || undefined,
      breakEnd: formData.breakEnd || undefined,
      notes: formData.notes || undefined,
    };

    addShift(newShift);
    addAuditLog({
      id: newId('LOG'),
      action: 'create',
      entityType: 'user',
      entityId: newShift.id,
      entityName: `Shift for ${userName}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Created shift for ${userName} on ${formData.date} (${formData.startTime}-${formData.endTime})`,
      timestamp: new Date().toISOString(),
    });
    toast.success('Shift created', { description: `${userName}: ${formData.date} ${formData.startTime}-${formData.endTime}` });
    setShowCreateModal(false);
    setFormData({ ...emptyForm });
  };

  const handleEditShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;

    const userName = getUserName(formData.userId);
    const updates: Partial<Shift> = {
      userId: formData.userId,
      userName,
      startTime: formData.startTime,
      endTime: formData.endTime,
      date: formData.date,
      role: formData.role,
      department: formData.department,
      breakStart: formData.breakStart || undefined,
      breakEnd: formData.breakEnd || undefined,
      notes: formData.notes || undefined,
    };

    updateShift(editingShift.id, updates);
    addAuditLog({
      id: newId('LOG'),
      action: 'update',
      entityType: 'user',
      entityId: editingShift.id,
      entityName: `Shift for ${userName}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Updated shift for ${userName} on ${formData.date}`,
      oldValue: JSON.stringify({ startTime: editingShift.startTime, endTime: editingShift.endTime }),
      newValue: JSON.stringify({ startTime: formData.startTime, endTime: formData.endTime }),
      timestamp: new Date().toISOString(),
    });
    toast.success('Shift updated', { description: `${userName}: ${formData.date}` });
    setShowEditModal(false);
    setEditingShift(null);
    setFormData({ ...emptyForm });
  };

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      userId: shift.userId,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      role: shift.role,
      department: shift.department || 'Front Desk',
      breakStart: shift.breakStart || '',
      breakEnd: shift.breakEnd || '',
      notes: shift.notes || '',
    });
    setShowEditModal(true);
  };

  const openSwapModal = (shift: Shift) => {
    setEditingShift(shift);
    setSwapTargetUserId('');
    setShowSwapModal(true);
  };

  const handleSwapShift = () => {
    if (!editingShift || !swapTargetUserId) {
      toast.error('Please select an employee to swap with');
      return;
    }

    const targetName = getUserName(swapTargetUserId);
    const originalName = editingShift.userName;

    // Find if target user has a shift on the same date to swap
    const targetShift = shifts.find(
      s => s.userId === swapTargetUserId && s.date === editingShift.date && s.status === 'scheduled'
    );

    // Update the original shift
    updateShift(editingShift.id, {
      userId: swapTargetUserId,
      userName: targetName,
      status: 'swapped',
      swappedWith: originalName,
    });

    // If target has a shift, swap it to the original user
    if (targetShift) {
      updateShift(targetShift.id, {
        userId: editingShift.userId,
        userName: originalName,
        status: 'swapped',
        swappedWith: targetName,
      });
    }

    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'user',
      entityId: editingShift.id,
      entityName: `Shift swap`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Swapped shift between ${originalName} and ${targetName} on ${editingShift.date}`,
      oldValue: originalName,
      newValue: targetName,
      timestamp: new Date().toISOString(),
    });
    toast.success('Shift swapped', { description: `${originalName} <-> ${targetName} on ${editingShift.date}` });
    setShowSwapModal(false);
    setEditingShift(null);
    setSwapTargetUserId('');
  };

  const openCancelConfirm = (shift: Shift) => {
    setEditingShift(shift);
    setShowCancelConfirm(true);
  };

  const handleCancelShift = () => {
    if (!editingShift) return;

    updateShift(editingShift.id, { status: 'cancelled' });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'user',
      entityId: editingShift.id,
      entityName: `Shift for ${editingShift.userName}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Cancelled shift for ${editingShift.userName} on ${editingShift.date}`,
      timestamp: new Date().toISOString(),
    });
    toast.success('Shift cancelled', { description: `${editingShift.userName}: ${editingShift.date}` });
    setShowCancelConfirm(false);
    setEditingShift(null);
  };

  const handleDeleteShift = (shift: Shift) => {
    deleteShift(shift.id);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'user',
      entityId: shift.id,
      entityName: `Shift for ${shift.userName}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Deleted shift for ${shift.userName} on ${shift.date}`,
      timestamp: new Date().toISOString(),
    });
    toast.success('Shift deleted');
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Employee', 'Date', 'Start Time', 'End Time', 'Role', 'Department', 'Status', 'Hours', 'Notes'];
    const rows = filteredWeekShifts.map(s => [
      s.userName,
      s.date,
      s.startTime,
      s.endTime,
      s.role,
      s.department || '',
      s.status,
      calcHours(s.startTime, s.endTime).toFixed(1),
      s.notes || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shifts_${weekDateRange.startStr}_to_${weekDateRange.endStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export complete', { description: 'Shifts exported to CSV' });
  };

  // Shift form (shared between create and edit)
  const renderShiftForm = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Employee</label>
        <select
          value={formData.userId}
          onChange={(e) => updateForm('userId', e.target.value)}
          className={inputClass}
          required
        >
          <option value="">Select employee...</option>
          {users.filter(u => u.status === 'active').map(user => (
            <option key={user.id} value={user.id}>{user.name} - {user.role}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => updateForm('date', e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Department</label>
          <select
            value={formData.department}
            onChange={(e) => updateForm('department', e.target.value)}
            className={inputClass}
          >
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Start Time</label>
          <input
            type="time"
            value={formData.startTime}
            onChange={(e) => updateForm('startTime', e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">End Time</label>
          <input
            type="time"
            value={formData.endTime}
            onChange={(e) => updateForm('endTime', e.target.value)}
            className={inputClass}
            required
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Role</label>
        <select
          value={formData.role}
          onChange={(e) => updateForm('role', e.target.value)}
          className={inputClass}
        >
          {roles.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Break Start</label>
          <input
            type="time"
            value={formData.breakStart}
            onChange={(e) => updateForm('breakStart', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Break End</label>
          <input
            type="time"
            value={formData.breakEnd}
            onChange={(e) => updateForm('breakEnd', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => updateForm('notes', e.target.value)}
          placeholder="Optional notes..."
          className={`${inputClass} min-h-[80px]`}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => { setShowCreateModal(false); setShowEditModal(false); setEditingShift(null); setFormData({ ...emptyForm }); }}
          className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Staff Scheduling</h1>
          <p className="text-muted-foreground">Manage shifts, schedules, and workload</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={goToToday}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Today
          </button>
          <button
            onClick={() => { setFormData({ ...emptyForm }); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Shift
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info/15 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalShifts}</p>
              <p className="text-sm text-muted-foreground">Shifts This Week</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalHours}h</p>
              <p className="text-sm text-muted-foreground">Total Hours</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/15 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.overtimeHours}h</p>
              <p className="text-sm text-muted-foreground">Overtime Hours</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger/15 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.cancellations}</p>
              <p className="text-sm text-muted-foreground">Cancellations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Week Navigation + Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={prevWeek} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center min-w-[200px]">
            <p className="font-semibold">
              {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <button onClick={nextWeek} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors w-48"
            />
          </div>
          {/* Department Filter */}
          <div className="relative flex items-center gap-1">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          {/* View Toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        /* Calendar View */
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-border/30">
            <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border/30">Staff</div>
            {weekDays.map((day, i) => {
              const isToday = day.toDateString() === new Date().toDateString();
              return (
                <div key={i} className={`p-3 text-center border-r border-border/30 last:border-r-0 ${isToday ? 'bg-primary/10' : ''}`}>
                  <p className="text-xs text-muted-foreground">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  <p className={`font-semibold ${isToday ? 'text-primary' : ''}`}>{day.getDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Staff Rows */}
          {filteredUsers.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No staff found matching your filters.</div>
          )}
          {filteredUsers.map((user) => (
            <div key={user.id} className="grid grid-cols-8 border-b border-border/20 last:border-b-0">
              <div className="p-3 border-r border-border/30 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.department}</p>
                </div>
              </div>
              {weekDays.map((day, i) => {
                const dayShifts = getShiftsForUser(user.id, day);
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={i} className={`p-2 border-r border-border/20 last:border-r-0 min-h-[80px] ${isToday ? 'bg-primary/5' : ''}`}>
                    {dayShifts.map((shift) => (
                      <motion.div
                        key={shift.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-2 rounded-lg text-xs mb-1 cursor-pointer hover:opacity-80 transition-opacity border ${
                          departmentColors[shift.department || ''] || 'bg-info/15 text-info border-info/30'
                        }`}
                        onClick={() => openEditModal(shift)}
                        title="Click to edit"
                      >
                        <p className="font-medium">{shift.startTime}-{shift.endTime}</p>
                        <p className="truncate opacity-80">{shift.role}</p>
                        {shift.status !== 'scheduled' && (
                          <span className={`inline-block mt-0.5 text-[10px] px-1 rounded ${statusColors[shift.status]}`}>
                            {shift.status}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border/30">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">End</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWeekShifts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">No shifts found for this week.</td>
                  </tr>
                )}
                {filteredWeekShifts.map((shift) => (
                  <motion.tr
                    key={shift.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-border/20 hover:bg-primary/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold">
                          {shift.userName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium text-sm">{shift.userName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{shift.date}</td>
                    <td className="py-3 px-4 text-sm">{formatTime12(shift.startTime)}</td>
                    <td className="py-3 px-4 text-sm">{formatTime12(shift.endTime)}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{shift.role}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${departmentColors[shift.department || ''] || 'bg-muted text-muted-foreground'}`}>
                        {shift.department || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${statusColors[shift.status]}`}>
                        {shift.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(shift)}
                          className="p-1.5 hover:bg-muted rounded transition-colors"
                          title="Edit shift"
                        >
                          <Edit className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => openSwapModal(shift)}
                          className="p-1.5 hover:bg-muted rounded transition-colors"
                          title="Swap shift"
                        >
                          <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {shift.status === 'scheduled' && (
                          <button
                            onClick={() => openCancelConfirm(shift)}
                            className="p-1.5 hover:bg-muted rounded transition-colors"
                            title="Cancel shift"
                          >
                            <XCircle className="w-4 h-4 text-danger" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteShift(shift)}
                          className="p-1.5 hover:bg-muted rounded transition-colors"
                          title="Delete shift"
                        >
                          <Trash2 className="w-4 h-4 text-danger" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Shift Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowCreateModal(false); setFormData({ ...emptyForm }); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg m-4 p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Add New Shift</h2>
                <button onClick={() => { setShowCreateModal(false); setFormData({ ...emptyForm }); }} className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderShiftForm(handleCreateShift, 'Add Shift')}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Shift Modal */}
      <AnimatePresence>
        {showEditModal && editingShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowEditModal(false); setEditingShift(null); setFormData({ ...emptyForm }); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg m-4 p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Edit Shift</h2>
                <button onClick={() => { setShowEditModal(false); setEditingShift(null); setFormData({ ...emptyForm }); }} className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderShiftForm(handleEditShift, 'Save Changes')}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Swap Shift Modal */}
      <AnimatePresence>
        {showSwapModal && editingShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowSwapModal(false); setEditingShift(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md m-4 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Swap Shift</h2>
                <button onClick={() => { setShowSwapModal(false); setEditingShift(null); }} className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Current shift info */}
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <p className="text-sm text-muted-foreground mb-1">Current Shift</p>
                <p className="font-medium">{editingShift.userName}</p>
                <p className="text-sm text-muted-foreground">
                  {editingShift.date} | {formatTime12(editingShift.startTime)} - {formatTime12(editingShift.endTime)}
                </p>
                <p className="text-sm text-muted-foreground">{editingShift.role} - {editingShift.department}</p>
              </div>

              <div className="flex items-center justify-center my-3">
                <ArrowLeftRight className="w-6 h-6 text-primary" />
              </div>

              {/* Target employee */}
              <div>
                <label className="text-sm font-medium mb-2 block">Swap With Employee</label>
                <select
                  value={swapTargetUserId}
                  onChange={(e) => setSwapTargetUserId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select employee...</option>
                  {users
                    .filter(u => u.id !== editingShift.userId && u.status === 'active')
                    .map(user => (
                      <option key={user.id} value={user.id}>{user.name} - {user.role}</option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowSwapModal(false); setEditingShift(null); }}
                  className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSwapShift}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
                >
                  Swap Shift
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Confirm Modal */}
      <AnimatePresence>
        {showCancelConfirm && editingShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowCancelConfirm(false); setEditingShift(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-sm m-4 p-6"
            >
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-danger/15 rounded-full flex items-center justify-center mx-auto mb-3">
                  <XCircle className="w-6 h-6 text-danger" />
                </div>
                <h2 className="text-xl font-bold">Cancel Shift?</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Are you sure you want to cancel the shift for <strong>{editingShift.userName}</strong> on{' '}
                  <strong>{editingShift.date}</strong> ({formatTime12(editingShift.startTime)} - {formatTime12(editingShift.endTime)})?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCancelConfirm(false); setEditingShift(null); }}
                  className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Keep Shift
                </button>
                <button
                  onClick={handleCancelShift}
                  className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
                >
                  Cancel Shift
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
