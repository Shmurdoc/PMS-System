import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Edit, Mail, Phone, Calendar,
  Clock, Activity, Grid, List, Trash2, Download,
  UserCheck, UserX, Briefcase, Building2, X, Save, Send
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { User } from '../store/useAppStore';
import toastHelpers from '../lib/toast';
import { exportToCsv } from '../utils/exportCsv';
import { PermissionGate } from '../components/demo/DemoControls';
import { newId } from '../utils/id';

const statusColors: Record<User['status'], string> = {
  active: 'bg-success/15 text-success',
  inactive: 'bg-gray-500/20 text-gray-400',
  on_leave: 'bg-warning/15 text-warning',
};

const shiftStatusColors: Record<string, string> = {
  scheduled: 'bg-info/15 text-info',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-danger/15 text-danger',
  swapped: 'bg-warning/15 text-warning',
};

const emptyForm = {
  name: '',
  email: '',
  role: '',
  department: '',
  phone: '',
  status: 'active' as User['status'],
};

export default function EmployeeProfiles() {
  const {
    users, attendance, shifts, messages,
    addUser, updateUser, deleteUser,
    addMessage, addAuditLog, user: currentUser,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Message form
  const [messageContent, setMessageContent] = useState('');
  const [messageRecipientId, setMessageRecipientId] = useState<string | null>(null);

  // Schedule target
  const [scheduleUserId, setScheduleUserId] = useState<string | null>(null);

  const departments = useMemo(
    () => ['all', ...Array.from(new Set(users.map(u => u.department)))],
    [users]
  );

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter;
      return matchesSearch && matchesDepartment;
    });
  }, [users, searchQuery, departmentFilter]);

  const getUserAttendance = (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return attendance.find(a => a.userId === userId && a.date === today);
  };

  const getUserAttendanceHistory = (userId: string) => {
    return attendance
      .filter(a => a.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  };

  const getUserShifts = (userId: string) => {
    return shifts
      .filter(s => s.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  // ── Validation ──────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email format';
    if (!formData.role.trim()) errors.role = 'Role is required';
    if (!formData.department.trim()) errors.department = 'Department is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Add Employee ────────────────────────────────────
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const newUser: User = {
      id: newId('EMP'),
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: formData.role.trim(),
      department: formData.department.trim(),
      phone: formData.phone.trim(),
      avatar: '',
      hireDate: new Date().toISOString().split('T')[0],
      status: formData.status,
    };
    addUser(newUser);
    addAuditLog({
      id: newId('LOG'),
      action: 'create',
      entityType: 'user',
      entityId: newUser.id,
      entityName: newUser.name,
      userId: currentUser?.id ?? 'system',
      userName: currentUser?.name ?? 'System',
      userRole: currentUser?.role ?? 'System',
      details: `Employee "${newUser.name}" added as ${newUser.role} in ${newUser.department}`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Employee added', `${newUser.name} has been added successfully`);
    setShowAddModal(false);
    resetForm();
  };

  // ── Edit Employee ───────────────────────────────────
  const openEditModal = (user: User) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone ?? '',
      status: user.status,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !editingUserId) return;
    const prev = users.find(u => u.id === editingUserId);
    updateUser(editingUserId, {
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: formData.role.trim(),
      department: formData.department.trim(),
      phone: formData.phone.trim(),
      status: formData.status,
    });
    addAuditLog({
      id: newId('LOG'),
      action: 'update',
      entityType: 'user',
      entityId: editingUserId,
      entityName: formData.name.trim(),
      userId: currentUser?.id ?? 'system',
      userName: currentUser?.name ?? 'System',
      userRole: currentUser?.role ?? 'System',
      details: `Employee "${formData.name.trim()}" profile updated`,
      oldValue: prev ? JSON.stringify({ name: prev.name, role: prev.role, department: prev.department, status: prev.status }) : undefined,
      newValue: JSON.stringify({ name: formData.name.trim(), role: formData.role.trim(), department: formData.department.trim(), status: formData.status }),
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Employee updated', `${formData.name.trim()} has been updated`);
    setShowEditModal(false);
    resetForm();
  };

  // ── Delete Employee ─────────────────────────────────
  const handleDelete = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    deleteUser(userId);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'delete',
      entityType: 'user',
      entityId: userId,
      entityName: user.name,
      userId: currentUser?.id ?? 'system',
      userName: currentUser?.name ?? 'System',
      userRole: currentUser?.role ?? 'System',
      details: `Employee "${user.name}" has been removed`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Employee deleted', `${user.name} has been removed`);
    setShowDeleteConfirm(null);
    if (selectedEmployee === userId) setSelectedEmployee(null);
  };

  // ── Send Message ────────────────────────────────────
  const openMessageModal = (userId: string) => {
    setMessageRecipientId(userId);
    setMessageContent('');
    setShowMessageModal(true);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || !messageRecipientId) return;
    const recipient = users.find(u => u.id === messageRecipientId);
    addMessage({
      id: `MSG-${Date.now()}`,
      senderId: currentUser?.id ?? 'system',
      senderName: currentUser?.name ?? 'System',
      content: messageContent.trim(),
      timestamp: new Date().toISOString(),
      read: false,
      type: 'text',
    });
    toastHelpers.success('Message sent', `Message sent to ${recipient?.name ?? 'employee'}`);
    setShowMessageModal(false);
    setMessageContent('');
    setMessageRecipientId(null);
  };

  // ── View Schedule ───────────────────────────────────
  const openScheduleModal = (userId: string) => {
    setScheduleUserId(userId);
    setShowScheduleModal(true);
  };

  // ── Export CSV ──────────────────────────────────────
  const handleExportCsv = () => {
    const data = filteredUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      phone: u.phone ?? '',
      status: u.status,
      hireDate: u.hireDate ?? '',
    }));
    exportToCsv(data, `employees_${new Date().toISOString().split('T')[0]}`, [
      { key: 'id', header: 'Employee ID' },
      { key: 'name', header: 'Name' },
      { key: 'email', header: 'Email' },
      { key: 'role', header: 'Role' },
      { key: 'department', header: 'Department' },
      { key: 'phone', header: 'Phone' },
      { key: 'status', header: 'Status' },
      { key: 'hireDate', header: 'Hire Date' },
    ]);
    toastHelpers.action.export();
  };

  // ── Reset form ─────────────────────────────────────
  const resetForm = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setEditingUserId(null);
  };

  // ── User messages count ────────────────────────────
  const getUserMessageCount = (userId: string) =>
    messages.filter(m => m.senderId === userId).length;

  // ── Selected user data ─────────────────────────────
  const selectedUser = selectedEmployee ? users.find(u => u.id === selectedEmployee) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Employee Profiles</h1>
          <p className="text-muted-foreground">Manage staff profiles, roles, and activity</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <PermissionGate permission="manageUsers">
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Employee
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </div>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          >
            {departments.map(dept => (
              <option key={dept} value={dept}>
                {dept === 'all' ? 'All Departments' : dept}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
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

      {/* Employee Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((user) => {
            const todayAttendance = getUserAttendance(user.id);
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => setSelectedEmployee(user.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{user.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">{user.role}</p>
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full mt-2 ${statusColors[user.status]}`}>
                      {user.status === 'active' ? <UserCheck className="w-3 h-3" /> : user.status === 'on_leave' ? <Clock className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      {user.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/30">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      {user.department}
                    </div>
                    <div className={`flex items-center gap-1.5 ${todayAttendance?.status === 'present' ? 'text-success' : todayAttendance?.status === 'late' ? 'text-warning' : 'text-muted-foreground'}`}>
                      <Activity className="w-4 h-4" />
                      {todayAttendance ? todayAttendance.status : 'No record'}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border/30">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const todayAttendance = getUserAttendance(user.id);
                return (
                  <tr key={user.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedEmployee(user.id)}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{user.role}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{user.department}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${statusColors[user.status]}`}>
                        {user.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-sm ${todayAttendance?.status === 'present' ? 'text-success' : todayAttendance?.status === 'late' ? 'text-warning' : 'text-muted-foreground'}`}>
                        {todayAttendance ? todayAttendance.status : 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <PermissionGate permission="manageUsers">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
                            className="p-1.5 hover:bg-muted rounded transition-colors"
                            title="Edit employee"
                          >
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(user.id); }}
                            className="p-1.5 hover:bg-danger/10 rounded transition-colors"
                            title="Delete employee"
                          >
                            <Trash2 className="w-4 h-4 text-danger" />
                          </button>
                        </div>
                      </PermissionGate>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          Employee Detail Modal
         ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedEmployee && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedEmployee(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 space-y-6">
                {/* Modal Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Employee Profile</h2>
                  <button onClick={() => setSelectedEmployee(null)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Profile Header */}
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-2xl font-bold">
                    {selectedUser.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{selectedUser.name}</h2>
                    <p className="text-muted-foreground">{selectedUser.role}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${statusColors[selectedUser.status]}`}>
                        {selectedUser.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-sm text-muted-foreground">- {selectedUser.department}</span>
                    </div>
                  </div>
                  <PermissionGate permission="manageUsers">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { openEditModal(selectedUser); setSelectedEmployee(null); }}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Edit employee"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(selectedUser.id)}
                        className="p-2 hover:bg-danger/10 rounded-lg transition-colors"
                        title="Delete employee"
                      >
                        <Trash2 className="w-4 h-4 text-danger" />
                      </button>
                    </div>
                  </PermissionGate>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">Email</span>
                    </div>
                    <p className="text-sm font-medium">{selectedUser.email}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Phone className="w-4 h-4" />
                      <span className="text-sm">Phone</span>
                    </div>
                    <p className="text-sm font-medium">{selectedUser.phone || 'N/A'}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Hire Date</span>
                    </div>
                    <p className="text-sm font-medium">{selectedUser.hireDate ?? 'N/A'}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Briefcase className="w-4 h-4" />
                      <span className="text-sm">Employee ID</span>
                    </div>
                    <p className="text-sm font-medium">EMP-{selectedUser.id.padStart(4, '0')}</p>
                  </div>
                </div>

                {/* Attendance History (replaces hardcoded activity logs) */}
                <div>
                  <h3 className="font-semibold mb-3">Recent Attendance</h3>
                  <div className="space-y-3">
                    {getUserAttendanceHistory(selectedUser.id).length === 0 && (
                      <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">No attendance records found.</p>
                    )}
                    {getUserAttendanceHistory(selectedUser.id).map((record) => (
                      <div key={record.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium capitalize">{record.status.replace('_', ' ')}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              record.status === 'present' ? 'bg-success/15 text-success' :
                              record.status === 'late' ? 'bg-warning/15 text-warning' :
                              record.status === 'absent' ? 'bg-danger/15 text-danger' :
                              'bg-info/15 text-info'
                            }`}>
                              {record.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {record.date} &middot; Check-in: {new Date(record.checkIn).toLocaleTimeString()}
                            {record.checkOut ? ` &middot; Check-out: ${new Date(record.checkOut).toLocaleTimeString()}` : ''}
                            {record.hoursWorked ? ` &middot; ${record.hoursWorked}h worked` : ''}
                            {record.overtime ? ` (+${record.overtime}h OT)` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Messages count */}
                <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Messages sent</span>
                  <span className="text-sm font-medium">{getUserMessageCount(selectedUser.id)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { openMessageModal(selectedUser.id); setSelectedEmployee(null); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Send Message
                  </button>
                  <button
                    onClick={() => { openScheduleModal(selectedUser.id); setSelectedEmployee(null); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    View Schedule
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════
          Add Employee Modal
         ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <form onSubmit={handleAdd} className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold">Add Employee</h2>
                  <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    placeholder="Full name"
                  />
                  {formErrors.name && <p className="text-xs text-danger mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    placeholder="email@example.com"
                  />
                  {formErrors.email && <p className="text-xs text-danger mt-1">{formErrors.email}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Role *</label>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                      placeholder="e.g. Front Desk Manager"
                    />
                    {formErrors.role && <p className="text-xs text-danger mt-1">{formErrors.role}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Department *</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                      placeholder="e.g. Front Desk"
                    />
                    {formErrors.department && <p className="text-xs text-danger mt-1">{formErrors.department}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                      placeholder="+27 82 000 0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as User['status'] })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="on_leave">On Leave</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border/30">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors text-sm"
                  >
                    <Save className="w-4 h-4" />
                    Add Employee
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════
          Edit Employee Modal
         ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <form onSubmit={handleEdit} className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold">Edit Employee</h2>
                  <button type="button" onClick={() => setShowEditModal(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                  />
                  {formErrors.name && <p className="text-xs text-danger mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                  />
                  {formErrors.email && <p className="text-xs text-danger mt-1">{formErrors.email}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Role *</label>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                    {formErrors.role && <p className="text-xs text-danger mt-1">{formErrors.role}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Department *</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                    {formErrors.department && <p className="text-xs text-danger mt-1">{formErrors.department}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as User['status'] })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="on_leave">On Leave</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border/30">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors text-sm"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════
          Send Message Modal
         ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showMessageModal && messageRecipientId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowMessageModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay"
              onClick={e => e.stopPropagation()}
            >
              <form onSubmit={handleSendMessage} className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold">Send Message</h2>
                  <button type="button" onClick={() => setShowMessageModal(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-bold">
                    {users.find(u => u.id === messageRecipientId)?.name.split(' ').map(n => n[0]).join('') ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">To: {users.find(u => u.id === messageRecipientId)?.name ?? 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{users.find(u => u.id === messageRecipientId)?.role ?? ''}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Message</label>
                  <textarea
                    value={messageContent}
                    onChange={e => setMessageContent(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
                    placeholder="Type your message..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border/30">
                  <button
                    type="button"
                    onClick={() => setShowMessageModal(false)}
                    className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!messageContent.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════
          View Schedule Modal
         ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showScheduleModal && scheduleUserId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold">
                    Schedule &mdash; {users.find(u => u.id === scheduleUserId)?.name ?? 'Employee'}
                  </h2>
                  <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {getUserShifts(scheduleUserId).length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg text-center">No shifts scheduled for this employee.</p>
                ) : (
                  <div className="space-y-3">
                    {getUserShifts(scheduleUserId).map(shift => (
                      <div key={shift.id} className="bg-muted/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{shift.date}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${shiftStatusColors[shift.status] ?? 'bg-muted text-muted-foreground'}`}>
                            {shift.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {shift.startTime} - {shift.endTime}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Briefcase className="w-3.5 h-3.5" />
                            {shift.role}
                          </div>
                          {shift.department && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Building2 className="w-3.5 h-3.5" />
                              {shift.department}
                            </div>
                          )}
                          {shift.overtime ? (
                            <div className="flex items-center gap-2 text-warning">
                              <Clock className="w-3.5 h-3.5" />
                              +{shift.overtime}h OT
                            </div>
                          ) : null}
                        </div>
                        {shift.notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic">{shift.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════
          Delete Confirmation Modal
         ════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-popover border border-border rounded-2xl shadow-overlay"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                <h2 className="text-lg font-bold text-danger">Delete Employee</h2>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete <span className="font-semibold text-foreground">{users.find(u => u.id === showDeleteConfirm)?.name}</span>? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(showDeleteConfirm)}
                    className="flex items-center gap-2 px-4 py-2 bg-danger/15 text-danger rounded-lg hover:bg-danger/30 transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
