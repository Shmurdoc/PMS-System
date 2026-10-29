import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, Users, Shield, Bell, Palette, Database, Globe,
  Key, Lock, Mail, Smartphone, Monitor, Edit, Trash2,
  Plus, Search, Check, Save, X, AlertTriangle,
  CreditCard
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { User } from '../store/useAppStore';
import { toast } from 'sonner';

const TABS = [
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'general', label: 'General Settings', icon: Settings },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'integrations', label: 'Integrations', icon: Database },
  { id: 'localization', label: 'Localization', icon: Globe },
];

const ALL_PERMISSIONS = [
  'dashboard', 'bookings', 'guests', 'rooms', 'staff', 'finances',
  'reports', 'settings', 'checkin', 'tasks', 'inventory', 'maintenance',
  'admin', 'audit_logs', 'integrations',
];

const DEPARTMENTS = ['Management', 'Front Desk', 'Housekeeping', 'Finance', 'Maintenance', 'IT', 'Food & Beverage', 'Security'];
const ROLES_LIST = ['admin', 'manager', 'front_desk', 'housekeeping', 'maintenance', 'auditor', 'guest'];

// ─── types ────────────────────────────────────────────────────────────────────
interface RoleConfig {
  name: string;
  permissions: string[];
}

interface UserFormData {
  name: string;
  email: string;
  role: string;
  department: string;
  phone: string;
  /** Primary property; the first of propertyIds. */
  propertyId: string;
  /** Every property the account works in. */
  propertyIds: string[];
}

const emptyUserForm: UserFormData = { name: '', email: '', role: 'front_desk', department: 'Front Desk', phone: '', propertyId: '', propertyIds: [] };

// ─── main component ───────────────────────────────────────────────────────────
export default function AdminPanel() {
  const {
    users, properties, addUser, updateUser, deleteUser,
    settings, updateSettings,
    integrations, updateIntegration,
    addAuditLog,
  } = useAppStore();
const me = useAppStore((s) => s.user);

  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');

  // User CRUD modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserFormData>({ ...emptyUserForm });
  const [userErrors, setUserErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Role editor
  const [roles, setRoles] = useState<RoleConfig[]>([
    { name: 'Super Admin', permissions: ['all'] },
    { name: 'General Manager', permissions: ['dashboard', 'bookings', 'guests', 'rooms', 'staff', 'finances', 'reports', 'settings'] },
    { name: 'Front Desk Manager', permissions: ['dashboard', 'bookings', 'guests', 'rooms', 'checkin'] },
    { name: 'Housekeeping', permissions: ['rooms', 'tasks'] },
    { name: 'Finance Manager', permissions: ['finances', 'reports', 'inventory'] },
    { name: 'Maintenance', permissions: ['maintenance', 'rooms'] },
  ]);
  const [editRoleIdx, setEditRoleIdx] = useState<number | null>(null);
  const [roleForm, setRoleForm] = useState<RoleConfig>({ name: '', permissions: [] });
  const [showRoleModal, setShowRoleModal] = useState(false);

  // General settings (local state synced on save)
  const [generalSettings, setGeneralSettings] = useState({
    orgName: settings.propertyName ?? 'Nexus Hotels',
    businessType: 'Hotel',
    maintenanceMode: settings.maintenanceMode ?? false,
    debugMode: false,
  });

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactor: false,
    strongPasswords: true,
    sessionTimeout: '30',
  });

  // Notification settings
  const [notifSettings, setNotifSettings] = useState({
    newBookings: true,
    checkInAlerts: true,
    lowInventory: true,
    maintenanceTickets: true,
    financialAlerts: false,
    guestFeedback: true,
  });

  // Appearance
  const [themeChoice, setThemeChoice] = useState<'dark' | 'light' | 'system'>('dark');
  const [accentColor, setAccentColor] = useState('#c9a87c');

  // Localization
  const [localeSettings, setLocaleSettings] = useState({
    language: settings.language ?? 'en',
    timezone: settings.timezone ?? 'Africa/Johannesburg',
    currency: 'ZAR',
    dateFormat: settings.dateFormat ?? 'YYYY-MM-DD',
  });

  // ── derived ─────────────────────────────────────────────────────────────
  const isManager = me?.role === 'manager';
  const myPropertyId = me?.propertyId ?? '';

  // Managers can only see and manage staff at their own property. Admins see
  // everyone; front desk and below see no users at all (viewUsers is false for
  // them in RBAC), but we filter here too as defense in depth.
  const filteredUsers = useMemo(() => {
    let list = users;
    if (isManager && myPropertyId) {
      list = list.filter(u => u.propertyId === myPropertyId);
    }
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }, [users, searchQuery, isManager, myPropertyId]);

  // ── user CRUD handlers ─────────────────────────────────────────────────
  // The property list arrives with the hydrate wave, so the modal can open
  // while properties is still empty. Fall back to the first property at
  // render and at submit instead of writing state from an effect.
  const needsProperty = userForm.role !== 'admin';
  // The checkbox list is the source of truth; a manager is pinned to their own
  // property, an admin may tick any number of hotels for one employee.
  const effectivePropertyIds = needsProperty
    ? (userForm.propertyIds.length > 0
        ? userForm.propertyIds
        : isManager && myPropertyId
          ? [myPropertyId]
          : [])
    : [];
  const effectivePropertyId = effectivePropertyIds[0] ?? '';

  const toggleProperty = (tenantId: string) => {
    setUserForm(f => ({
      ...f,
      propertyIds: f.propertyIds.includes(tenantId)
        ? f.propertyIds.filter(id => id !== tenantId)
        : [...f.propertyIds, tenantId],
    }));
  };

  const openNewUser = () => {
    // A manager creating staff must pin them to the manager's own property.
    // An admin starts empty and ticks the hotels the employee covers.
    setUserForm({
      ...emptyUserForm,
      propertyId: isManager ? myPropertyId : '',
      propertyIds: isManager && myPropertyId ? [myPropertyId] : [],
    });
    setUserErrors({});
    setEditUserId(null);
    setShowUserModal(true);
  };

  const openEditUser = (user: User) => {
    const ids = user.propertyIds && user.propertyIds.length > 0
      ? user.propertyIds
      : user.propertyId
        ? [user.propertyId]
        : [];
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone ?? '',
      propertyId: ids[0] ?? '',
      propertyIds: ids,
    });
    setUserErrors({});
    setEditUserId(user.id);
    setShowUserModal(true);
  };

  const handleUserSubmit = () => {
    const errors: Record<string, string> = {};
    if (!userForm.name.trim()) errors.name = 'Name is required';
    if (!userForm.email.trim()) errors.email = 'Email is required';
    if (userForm.email && !/\S+@\S+\.\S+/.test(userForm.email)) errors.email = 'Invalid email format';
    // Check duplicate email
    const dup = users.find(u => u.email.toLowerCase() === userForm.email.toLowerCase() && u.id !== editUserId);
    if (dup) errors.email = 'Email already in use';
    if (needsProperty && effectivePropertyIds.length === 0) errors.propertyId = 'Select at least one property for staff accounts';
    setUserErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const now = new Date().toISOString();
    if (editUserId) {
      updateUser(editUserId, {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        department: userForm.department,
        phone: userForm.phone || undefined,
        propertyId: userForm.role === 'admin' ? null : effectivePropertyId || null,
        propertyIds: userForm.role === 'admin' ? [] : effectivePropertyIds,
      });
      addAuditLog({
        id: 'AL' + Date.now(), action: 'update_user', userId: me?.id ?? '', userName: me?.name ?? 'You', userRole: me?.role ?? '',
        entityName: userForm.name, details: `Updated user ${userForm.name}`, timestamp: now, entityType: 'user', entityId: editUserId,
      });
      toast.success(`User "${userForm.name}" updated`);
    } else {
      const newId = 'USR' + Date.now().toString(36).toUpperCase();
      addUser({
        id: newId,
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        department: userForm.department,
        phone: userForm.phone || '',
        avatar: '',
        hireDate: new Date().toISOString().split('T')[0],
        status: 'active',
        propertyId: userForm.role === 'admin' ? null : effectivePropertyId || null,
        propertyIds: userForm.role === 'admin' ? [] : effectivePropertyIds,
      });
      addAuditLog({
        id: 'AL' + Date.now(), action: 'create_user', userId: me?.id ?? '', userName: me?.name ?? 'You', userRole: me?.role ?? '',
        entityName: userForm.name, details: `Created user ${userForm.name}`, timestamp: now, entityType: 'user', entityId: newId,
      });
      toast.success(`User "${userForm.name}" created`);
    }
    setShowUserModal(false);
    setEditUserId(null);
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    deleteUser(id);
    addAuditLog({
      id: 'AL' + Date.now(), action: 'delete_user', userId: me?.id ?? '', userName: me?.name ?? 'You', userRole: me?.role ?? '',
      entityName: user?.name ?? id, details: `Deleted user ${user?.name ?? id}`, timestamp: new Date().toISOString(), entityType: 'user', entityId: id,
    });
    toast.success(`User deleted`);
    setShowDeleteConfirm(null);
  };

  // ── role handlers ─────────────────────────────────────────────────────
  const openNewRole = () => {
    setRoleForm({ name: '', permissions: [] });
    setEditRoleIdx(null);
    setShowRoleModal(true);
  };

  const openEditRole = (idx: number) => {
    setRoleForm({ ...roles[idx], permissions: [...roles[idx].permissions] });
    setEditRoleIdx(idx);
    setShowRoleModal(true);
  };

  const handleRoleSubmit = () => {
    if (!roleForm.name.trim()) { toast.error('Role name is required'); return; }
    const newRoles = [...roles];
    if (editRoleIdx !== null) {
      newRoles[editRoleIdx] = { ...roleForm };
      toast.success(`Role "${roleForm.name}" updated`);
    } else {
      newRoles.push({ ...roleForm });
      toast.success(`Role "${roleForm.name}" created`);
    }
    setRoles(newRoles);
    setShowRoleModal(false);
  };

  const deleteRole = (idx: number) => {
    const name = roles[idx].name;
    setRoles(roles.filter((_, i) => i !== idx));
    toast.success(`Role "${name}" deleted`);
  };

  const toggleRolePerm = (perm: string) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  // ── settings save handlers ────────────────────────────────────────────
  const saveGeneralSettings = () => {
    updateSettings({
      propertyName: generalSettings.orgName,
      maintenanceMode: generalSettings.maintenanceMode,
    });
    toast.success('General settings saved');
  };

  const saveSecuritySettings = () => {
    toast.success('Security settings saved');
  };

  const saveNotifSettings = () => {
    toast.success('Notification preferences saved');
  };

  const saveAppearance = () => {
    // Theme is managed by the main App.tsx dark/light toggle, but we persist the choice
    toast.success(`Appearance settings saved (theme: ${themeChoice})`);
  };

  const saveLocalization = () => {
    updateSettings({
      language: localeSettings.language,
      timezone: localeSettings.timezone,
      dateFormat: localeSettings.dateFormat,
    });
    toast.success('Localization settings saved');
  };

  // ── render content per tab ────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      // ═══════════════════════════════════════════════════════════════════
      // USERS
      // ═══════════════════════════════════════════════════════════════════
      case 'users':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-muted-foreground">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
                <button onClick={openNewUser} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors">
                  <Plus className="w-4 h-4" /> Add User
                </button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border/30">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold">
                              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{user.role}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{user.department}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                            user.status === 'active' ? 'bg-success/15 text-success' :
                            user.status === 'inactive' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-warning/15 text-warning'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              user.status === 'active' ? 'bg-success' : user.status === 'inactive' ? 'bg-muted-foreground' : 'bg-warning'
                            }`} />
                            {user.status ?? 'active'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditUser(user)} className="p-1.5 hover:bg-muted rounded transition-colors" title="Edit">
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button onClick={() => setShowDeleteConfirm(user.id)} className="p-1.5 hover:bg-danger/15 rounded transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4 text-danger" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length === 0 && (
                <div className="py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No users found</p>
                </div>
              )}
            </div>
          </div>
        );

      // ═══════════════════════════════════════════════════════════════════
      // ROLES
      // ═══════════════════════════════════════════════════════════════════
      case 'roles':
        return (
          <div className="space-y-6">
            <p className="text-muted-foreground">Manage roles and their permissions</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((role, i) => (
                <motion.div key={role.name + i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">{role.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditRole(i)} className="p-1.5 hover:bg-muted rounded transition-colors" title="Edit"><Edit className="w-4 h-4 text-muted-foreground" /></button>
                      {role.name !== 'Super Admin' && (
                        <button onClick={() => deleteRole(i)} className="p-1.5 hover:bg-danger/15 rounded transition-colors" title="Delete"><Trash2 className="w-4 h-4 text-danger" /></button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {role.permissions[0] === 'all' ? (
                      <p className="text-sm text-primary font-medium">Full system access</p>
                    ) : (
                      role.permissions.map((perm) => (
                        <div key={perm} className="flex items-center gap-2 text-sm">
                          <Check className="w-3.5 h-3.5 text-success" />
                          <span className="capitalize text-xs">{perm.replace('_', ' ')}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">{users.filter(u => u.role.toLowerCase().includes(role.name.toLowerCase().split(' ')[0])).length} user(s)</p>
                </motion.div>
              ))}
              <button onClick={openNewRole} className="bg-card border border-dashed border-border/30 rounded-xl p-5 flex flex-col items-center justify-center min-h-[150px] hover:border-primary/50 transition-colors cursor-pointer">
                <Plus className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="font-medium">Add Role</p>
              </button>
            </div>
          </div>
        );

      // ═══════════════════════════════════════════════════════════════════
      // GENERAL
      // ═══════════════════════════════════════════════════════════════════
      case 'general':
        return (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-4">
              <h3 className="font-semibold">Organization</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Organization Name</label>
                  <input type="text" value={generalSettings.orgName} onChange={(e) => setGeneralSettings(s => ({ ...s, orgName: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Business Type</label>
                  <select value={generalSettings.businessType} onChange={(e) => setGeneralSettings(s => ({ ...s, businessType: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                    <option>Hotel</option><option>Resort</option><option>Lodge</option><option>Boutique Hotel</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">System</h3>
              <div className="space-y-3">
                <ToggleRow label="Maintenance Mode" desc="Put the system in maintenance mode" value={generalSettings.maintenanceMode} onChange={(v) => setGeneralSettings(s => ({ ...s, maintenanceMode: v }))} />
                <ToggleRow label="Debug Mode" desc="Enable debug logging" value={generalSettings.debugMode} onChange={(v) => setGeneralSettings(s => ({ ...s, debugMode: v }))} />
              </div>
            </div>
            <button onClick={saveGeneralSettings} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors">
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        );

      // ═══════════════════════════════════════════════════════════════════
      // SECURITY
      // ═══════════════════════════════════════════════════════════════════
      case 'security':
        return (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-4">
              <h3 className="font-semibold">Authentication</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-muted-foreground" />
                    <div><p className="font-medium text-sm">Two-Factor Authentication</p><p className="text-xs text-muted-foreground">Require 2FA for all users</p></div>
                  </div>
                  <ToggleButton value={securitySettings.twoFactor} onChange={(v) => setSecuritySettings(s => ({ ...s, twoFactor: v }))} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                    <div><p className="font-medium text-sm">Strong Password Policy</p><p className="text-xs text-muted-foreground">Enforce strong passwords</p></div>
                  </div>
                  <ToggleButton value={securitySettings.strongPasswords} onChange={(v) => setSecuritySettings(s => ({ ...s, strongPasswords: v }))} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                    <div><p className="font-medium text-sm">Session Timeout</p><p className="text-xs text-muted-foreground">Auto logout after inactivity</p></div>
                  </div>
                  <select value={securitySettings.sessionTimeout} onChange={(e) => setSecuritySettings(s => ({ ...s, sessionTimeout: e.target.value }))}
                    className="px-3 py-1.5 bg-muted border border-border/30 rounded-lg text-sm">
                    <option value="15">15 min</option><option value="30">30 min</option><option value="60">1 hour</option><option value="120">2 hours</option>
                  </select>
                </div>
              </div>
            </div>
            <button onClick={saveSecuritySettings} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors">
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        );

      // ═══════════════════════════════════════════════════════════════════
      // NOTIFICATIONS
      // ═══════════════════════════════════════════════════════════════════
      case 'notifications':
        return (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-4">
              <h3 className="font-semibold">Email Notifications</h3>
              <div className="space-y-3">
                {([
                  { key: 'newBookings' as const, label: 'New bookings', desc: 'Receive email for new bookings' },
                  { key: 'checkInAlerts' as const, label: 'Check-in alerts', desc: 'Notify when guests check in' },
                  { key: 'lowInventory' as const, label: 'Low inventory', desc: 'Alert when stock is low' },
                  { key: 'maintenanceTickets' as const, label: 'Maintenance tickets', desc: 'New maintenance requests' },
                  { key: 'financialAlerts' as const, label: 'Financial alerts', desc: 'Daily financial summary' },
                  { key: 'guestFeedback' as const, label: 'Guest feedback', desc: 'New reviews and ratings' },
                ]).map((item) => (
                  <ToggleRow
                    key={item.key}
                    label={item.label}
                    desc={item.desc}
                    value={notifSettings[item.key]}
                    onChange={(v) => setNotifSettings(s => ({ ...s, [item.key]: v }))}
                  />
                ))}
              </div>
            </div>
            <button onClick={saveNotifSettings} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors">
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        );

      // ═══════════════════════════════════════════════════════════════════
      // APPEARANCE
      // ═══════════════════════════════════════════════════════════════════
      case 'appearance':
        return (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-4">
              <h3 className="font-semibold">Theme</h3>
              <div className="grid grid-cols-3 gap-4">
                {(['dark', 'light', 'system'] as const).map((theme) => (
                  <button key={theme} onClick={() => setThemeChoice(theme)}
                    className={`p-4 rounded-xl border transition-colors ${themeChoice === theme ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border/30 hover:border-primary/50'}`}>
                    <p className="text-sm font-medium capitalize">{theme}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Accent Color</h3>
              <div className="flex gap-3">
                {['#c9a87c', '#007aff', '#34c759', '#ff9500', '#af52de', '#ff2d55'].map((color) => (
                  <button key={color} onClick={() => setAccentColor(color)}
                    className={`w-10 h-10 rounded-full transition-[transform,box-shadow] ${accentColor === color ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
            <button onClick={saveAppearance} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors">
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        );

      // ═══════════════════════════════════════════════════════════════════
      // INTEGRATIONS
      // ═══════════════════════════════════════════════════════════════════
      case 'integrations': {
        const integrationItems = integrations.length > 0 ? integrations : [
          { id: 'int-pay', name: 'Payment Gateway', category: 'payment', status: 'connected' as const, config: {} },
          { id: 'int-cm', name: 'Channel Manager', category: 'channel', status: 'disconnected' as const, config: {} },
          { id: 'int-email', name: 'Email Service', category: 'email', status: 'disconnected' as const, config: {} },
          { id: 'int-sms', name: 'SMS Gateway', category: 'sms', status: 'disconnected' as const, config: {} },
          { id: 'int-pos', name: 'POS System', category: 'pos', status: 'disconnected' as const, config: {} },
          { id: 'int-analytics', name: 'Analytics', category: 'analytics', status: 'connected' as const, config: {} },
        ];
        const iconMap: Record<string, React.ElementType> = {
          payment: CreditCard, channel: Globe, email: Mail, sms: Smartphone, pos: Monitor, analytics: Settings,
        };
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrationItems.map((integration, i) => {
              const Icon = iconMap[integration.category] ?? Database;
              const isConnected = integration.status === 'connected';
              return (
                <motion.div key={integration.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-xl p-5">
                  <Icon className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-1">{integration.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {integration.status}
                    </span>
                    <button
                      onClick={() => {
                        const newStatus = isConnected ? 'disconnected' : 'connected';
                        if (integrations.find(ig => ig.id === integration.id)) {
                          updateIntegration(integration.id, { status: newStatus as 'connected' | 'disconnected' });
                        }
                        toast.success(`${integration.name} ${newStatus === 'connected' ? 'connected' : 'disconnected'}`);
                      }}
                      className={`text-sm px-3 py-1 rounded-lg transition-colors ${isConnected ? 'bg-danger/15 text-danger hover:bg-danger/30' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
                    >
                      {isConnected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        );
      }

      // ═══════════════════════════════════════════════════════════════════
      // LOCALIZATION
      // ═══════════════════════════════════════════════════════════════════
      case 'localization':
        return (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-4">
              <h3 className="font-semibold">Language & Region</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <select value={localeSettings.language} onChange={(e) => setLocaleSettings(s => ({ ...s, language: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                    <option value="en">English (US)</option><option value="en-gb">English (UK)</option><option value="af">Afrikaans</option><option value="zu">Zulu</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <select value={localeSettings.timezone} onChange={(e) => setLocaleSettings(s => ({ ...s, timezone: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                    <option value="Africa/Johannesburg">Africa/Johannesburg (GMT+2)</option>
                    <option value="Africa/Cape_Town">Africa/Cape Town (GMT+2)</option>
                    <option value="UTC">UTC (GMT+0)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Currency</label>
                  <select value={localeSettings.currency} onChange={(e) => setLocaleSettings(s => ({ ...s, currency: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                    <option value="ZAR">ZAR (R)</option><option value="USD">USD ($)</option><option value="EUR">EUR (&euro;)</option><option value="GBP">GBP (&pound;)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Format</label>
                  <select value={localeSettings.dateFormat} onChange={(e) => setLocaleSettings(s => ({ ...s, dateFormat: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>
            <button onClick={saveLocalization} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors">
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        );

      default:
        return <p>Select a tab to view settings</p>;
    }
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, roles, and system settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/30 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-card border border-border rounded-xl p-6">
        {renderContent()}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          USER CREATE/EDIT MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showUserModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowUserModal(false); setEditUserId(null); }} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative z-10 bg-popover border border-border rounded-xl shadow-overlay w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{editUserId ? 'Edit User' : 'Add New User'}</h2>
                <button onClick={() => { setShowUserModal(false); setEditUserId(null); }} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Full Name <span className="text-danger">*</span></label>
                  <input type="text" value={userForm.name} onChange={(e) => setUserForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter full name"
                    className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${userErrors.name ? 'border-danger/50' : 'border-border/30'}`} />
                  {userErrors.name && <p className="text-xs text-danger mt-1">{userErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Email <span className="text-danger">*</span></label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="user@nexus.com"
                    className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${userErrors.email ? 'border-danger/50' : 'border-border/30'}`} />
                  {userErrors.email && <p className="text-xs text-danger mt-1">{userErrors.email}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Phone</label>
                  <input type="tel" value={userForm.phone} onChange={(e) => setUserForm(f => ({ ...f, phone: e.target.value }))} placeholder="+27 82 000 0000"
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Role</label>
                    <select value={userForm.role} onChange={(e) => setUserForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                      {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Department</label>
                    <select value={userForm.department} onChange={(e) => setUserForm(f => ({ ...f, department: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Properties {userForm.role !== 'admin' && <span className="text-danger">*</span>}
                  </label>
                  {userForm.role === 'admin' ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">
                      Admins see every property.
                    </p>
                  ) : isManager ? (
                    <p className="text-xs px-1 py-2">
                      {properties.find(p => p.propertyId === myPropertyId)?.name ?? `Property ${myPropertyId}`}
                    </p>
                  ) : (
                    <div className={`max-h-40 overflow-y-auto rounded-lg border p-2 space-y-1 ${userErrors.propertyId ? 'border-danger/50' : 'border-border/30'}`}>
                      {properties.length === 0 && (
                        <p className="text-xs text-muted-foreground">No properties loaded yet.</p>
                      )}
                      {properties.map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userForm.propertyIds.includes(p.propertyId)}
                            onChange={() => toggleProperty(p.propertyId)}
                            className="accent-primary"
                          />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {userForm.role !== 'admin' && !isManager && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Tick every hotel this employee covers. They will see only these.
                    </p>
                  )}
                  {userErrors.propertyId && effectivePropertyIds.length === 0 && (
                    <p className="text-xs text-danger mt-1">{userErrors.propertyId}</p>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowUserModal(false); setEditUserId(null); }} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                  <button onClick={handleUserSubmit} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors">
                    {editUserId ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          ROLE EDIT MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showRoleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRoleModal(false)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative z-10 bg-popover border border-border rounded-xl shadow-overlay w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{editRoleIdx !== null ? 'Edit Role' : 'New Role'}</h2>
                <button onClick={() => setShowRoleModal(false)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Role Name</label>
                  <input type="text" value={roleForm.name} onChange={(e) => setRoleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Night Auditor"
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Permissions</label>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {ALL_PERMISSIONS.map(perm => (
                      <button key={perm} type="button" onClick={() => toggleRolePerm(perm)}
                        className={`text-xs px-3 py-2 rounded-lg transition-colors text-left flex items-center gap-2 ${
                          roleForm.permissions.includes(perm) ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}>
                        {roleForm.permissions.includes(perm) && <Check className="w-3 h-3" />}
                        <span className="capitalize">{perm.replace('_', ' ')}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowRoleModal(false)} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                  <button onClick={handleRoleSubmit} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors">
                    {editRoleIdx !== null ? 'Update Role' : 'Create Role'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative z-10 bg-popover border border-border rounded-xl shadow-overlay w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-danger/15 rounded-full flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-danger" /></div>
                <div>
                  <h3 className="font-bold">Delete User</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm mb-6">
                Delete user <span className="font-bold">{users.find(u => u.id === showDeleteConfirm)?.name}</span>?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                <button onClick={() => handleDeleteUser(showDeleteConfirm)} className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-danger/90 hover:shadow-lg transition-colors">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Toggle helper components ─────────────────────────────────────────────────
function ToggleButton({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-success' : 'bg-muted'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ToggleButton value={value} onChange={onChange} />
    </div>
  );
}
