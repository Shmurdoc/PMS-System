import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, RefreshCw, Settings, Plus, Trash2,
  Search, Wifi, WifiOff, AlertCircle, Loader2,
  CreditCard, Calendar, BarChart3, Users, Cpu,
  Cloud, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../store/useAppStore';
import type { Integration } from '../store/useAppStore';

// ============================================
// TYPES
// ============================================

type IntegrationType = 'PMS' | 'Channel Manager' | 'Payment Gateway' | 'CRM' | 'Analytics' | 'IoT';
type StatusFilter = 'all' | 'connected' | 'disconnected' | 'error' | 'syncing';

const INTEGRATION_TYPES: IntegrationType[] = ['PMS', 'Channel Manager', 'Payment Gateway', 'CRM', 'Analytics', 'IoT'];

const typeIcons: Record<string, typeof CreditCard> = {
  'PMS': Cloud,
  'Channel Manager': Calendar,
  'Payment Gateway': CreditCard,
  'Payment': CreditCard,
  'CRM': Users,
  'Analytics': BarChart3,
  'IoT': Cpu,
  'OTA': Calendar,
  'Communication': Wifi,
  'Finance': BarChart3,
  'Productivity': Calendar,
  'Automation': Cpu,
  'Marketing': BarChart3,
};

// ============================================
// STATUS BADGE
// ============================================

function StatusBadge({ status }: { status: Integration['status'] }) {
  const config: Record<Integration['status'], { icon: typeof Check; label: string; className: string }> = {
    connected: { icon: Check, label: 'Connected', className: 'text-success bg-success/10 border-success/20' },
    disconnected: { icon: WifiOff, label: 'Disconnected', className: 'text-muted-foreground bg-muted/50 border-border/30' },
    error: { icon: AlertCircle, label: 'Error', className: 'text-danger bg-danger/10 border-danger/20' },
    syncing: { icon: Loader2, label: 'Syncing', className: 'text-info bg-info/10 border-info/20' },
  };
  const c = config[status];
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${c.className}`}>
      <Icon className={`w-3 h-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}

// ============================================
// COMPONENT
// ============================================

export default function Integrations() {
  const integrations = useAppStore((s) => s.integrations);
  const addIntegration = useAppStore((s) => s.addIntegration);
  const updateIntegration = useAppStore((s) => s.updateIntegration);
  const deleteIntegration = useAppStore((s) => s.deleteIntegration);
  const addAuditLog = useAppStore((s) => s.addAuditLog);
  const me = useAppStore((s) => s.user);
const role = useAppStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  // UI State
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<IntegrationType>('PMS');
  const [newDescription, setNewDescription] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  // Settings form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editWebhookUrl, setEditWebhookUrl] = useState('');

  // ============================================
  // FILTERING
  // ============================================

  const uniqueTypes = useMemo(() => {
    const types = new Set(integrations.map((i) => i.category));
    return Array.from(types).sort();
  }, [integrations]);

  const filtered = useMemo(() => {
    return integrations.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (typeFilter !== 'all' && i.category !== typeFilter) return false;
      if (searchQuery && !i.name.toLowerCase().includes(searchQuery.toLowerCase()) && !i.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [integrations, statusFilter, typeFilter, searchQuery]);

  const statusCounts = useMemo(() => ({
    all: integrations.length,
    connected: integrations.filter((i) => i.status === 'connected').length,
    disconnected: integrations.filter((i) => i.status === 'disconnected').length,
    error: integrations.filter((i) => i.status === 'error').length,
    syncing: integrations.filter((i) => i.status === 'syncing').length,
  }), [integrations]);

  // ============================================
  // CONNECT / DISCONNECT
  // ============================================

  const handleToggleConnect = useCallback((integration: Integration) => {
    const newStatus = integration.status === 'connected' ? 'disconnected' : 'connected';
    const now = new Date().toISOString();

    updateIntegration(integration.id, {
      status: newStatus,
      lastSync: newStatus === 'connected' ? new Date().toLocaleString('en-ZA') : integration.lastSync,
      configuredAt: now,
    });

    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: newStatus === 'connected' ? 'connect' : 'disconnect',
      entityType: 'property',
      entityId: integration.id,
      entityName: integration.name,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Integration "${integration.name}" ${newStatus === 'connected' ? 'connected' : 'disconnected'}`,
      timestamp: now,
    });

    toast.success(`${integration.name} ${newStatus === 'connected' ? 'connected' : 'disconnected'} successfully`);
  }, [me, updateIntegration, addAuditLog]);

  // ============================================
  // REFRESH / SYNC
  // ============================================

  const handleRefresh = useCallback((integration: Integration) => {
    updateIntegration(integration.id, { status: 'syncing', lastSync: 'Syncing...' });
    toast.info(`Syncing ${integration.name}...`);

    setTimeout(() => {
      const now = new Date().toLocaleString('en-ZA');
      updateIntegration(integration.id, { status: 'connected', lastSync: now });

      addAuditLog({
        id: `LOG-${Date.now()}`,
        action: 'update',
        entityType: 'property',
        entityId: integration.id,
        entityName: integration.name,
        userId: me?.id ?? '',
        userName: me?.name ?? 'You',
        userRole: me?.role ?? '',
        details: `Integration "${integration.name}" synced successfully at ${now}`,
        timestamp: new Date().toISOString(),
      });

      toast.success(`${integration.name} synced successfully`);
    }, 2000);
  }, [me, updateIntegration, addAuditLog]);

  // ============================================
  // SETTINGS MODAL
  // ============================================

  const openSettings = useCallback((integration: Integration) => {
    setSelectedIntegration(integration);
    setEditName(integration.name);
    setEditDescription(integration.description);
    setEditApiKey(integration.apiKey ?? '');
    setEditWebhookUrl(integration.webhookUrl ?? '');
    setShowSettingsModal(true);
  }, []);

  const handleSaveSettings = useCallback(() => {
    if (!selectedIntegration) return;
    if (!editName.trim()) {
      toast.error('Integration name is required');
      return;
    }

    const now = new Date().toISOString();
    updateIntegration(selectedIntegration.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      apiKey: editApiKey.trim() || undefined,
      webhookUrl: editWebhookUrl.trim() || undefined,
      configuredAt: now,
      configuredBy: 'system',
    });

    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'property',
      entityId: selectedIntegration.id,
      entityName: editName.trim(),
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Integration "${selectedIntegration.name}" settings updated`,
      oldValue: JSON.stringify({ name: selectedIntegration.name, description: selectedIntegration.description }),
      newValue: JSON.stringify({ name: editName.trim(), description: editDescription.trim() }),
      timestamp: now,
    });

    toast.success(`${editName.trim()} settings saved`);
    setShowSettingsModal(false);
    setSelectedIntegration(null);
  }, [me, selectedIntegration, editName, editDescription, editApiKey, editWebhookUrl, updateIntegration, addAuditLog]);

  // ============================================
  // ADD INTEGRATION
  // ============================================

  const handleAdd = useCallback(() => {
    if (!newName.trim()) {
      toast.error('Integration name is required');
      return;
    }

    const now = new Date().toISOString();
    const id = `int-${Date.now()}`;

    const integration: Integration = {
      id,
      name: newName.trim(),
      category: newType,
      status: 'disconnected',
      lastSync: '-',
      icon: newType.toLowerCase().replace(/\s+/g, '-'),
      description: newDescription.trim() || `${newType} integration`,
      apiKey: newApiKey.trim() || undefined,
      webhookUrl: newWebhookUrl.trim() || undefined,
      configuredBy: 'system',
      configuredAt: now,
    };

    addIntegration(integration);

    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'create',
      entityType: 'property',
      entityId: id,
      entityName: newName.trim(),
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `New integration "${newName.trim()}" (${newType}) added`,
      timestamp: now,
    });

    toast.success(`${newName.trim()} added successfully`);

    // Reset form
    setNewName('');
    setNewType('PMS');
    setNewDescription('');
    setNewApiKey('');
    setNewWebhookUrl('');
    setShowAddModal(false);
  }, [me, newName, newType, newDescription, newApiKey, newWebhookUrl, addIntegration, addAuditLog]);

  // ============================================
  // DELETE INTEGRATION
  // ============================================

  const handleDelete = useCallback((id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (!integration) return;

    deleteIntegration(id);

    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'delete',
      entityType: 'property',
      entityId: id,
      entityName: integration.name,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Integration "${integration.name}" deleted`,
      timestamp: new Date().toISOString(),
    });

    toast.success(`${integration.name} removed`);
    setShowDeleteConfirm(null);
  }, [me, integrations, deleteIntegration, addAuditLog]);

  // ============================================
  // RENDER
  // ============================================

  const getIcon = (category: string) => typeIcons[category] ?? Cloud;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Connect NEXUS PMS with third-party services</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Integration
        </button>
      </div>

      {/* Search + Type Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="pl-10 pr-8 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer transition-colors"
          >
            <option value="all">All Types</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b border-border/30 overflow-x-auto">
        {(['all', 'connected', 'disconnected', 'error', 'syncing'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
              {statusCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Wifi className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">No integrations found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Add your first integration to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((integration, index) => {
            const Icon = getIcon(integration.category);
            return (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border rounded-xl p-6"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <StatusBadge status={integration.status} />
                </div>

                {/* Info */}
                <h3 className="font-semibold mb-1">{integration.name}</h3>
                <p className="text-sm text-muted-foreground mb-1">{integration.description}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  <span className="opacity-70">Type:</span> {integration.category}
                  {integration.lastSync && integration.lastSync !== '-' && (
                    <> &middot; <span className="opacity-70">Last sync:</span> {integration.lastSync}</>
                  )}
                </p>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-border/20 pt-3">
                  <div className="flex gap-1.5">
                    {/* Refresh — only when connected or syncing */}
                    {(integration.status === 'connected' || integration.status === 'syncing') && (
                      <button
                        onClick={() => handleRefresh(integration)}
                        disabled={integration.status === 'syncing'}
                        className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                        title="Sync now"
                      >
                        <RefreshCw className={`w-4 h-4 text-muted-foreground ${integration.status === 'syncing' ? 'animate-spin' : ''}`} />
                      </button>
                    )}

                    {/* Settings */}
                    <button
                      onClick={() => openSettings(integration)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {/* Delete */}
                    {isAdmin && (
                      <button
                        onClick={() => setShowDeleteConfirm(integration.id)}
                        className="p-2 hover:bg-danger/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-danger" />
                      </button>
                    )}
                  </div>

                  {/* Connect/Disconnect */}
                  <button
                    onClick={() => handleToggleConnect(integration)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      integration.status === 'connected'
                        ? 'bg-danger/10 text-danger hover:bg-danger/15 border border-danger/20'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg'
                    }`}
                  >
                    {integration.status === 'connected' ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ============================================ */}
      {/* ADD INTEGRATION MODAL */}
      {/* ============================================ */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add Integration</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Booking.com"
                    className="w-full px-3 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Type *</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as IntegrationType)}
                    className="w-full px-3 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {INTEGRATION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Description</label>
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="What does this integration do?"
                    className="w-full px-3 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="Enter API key (optional)"
                    className="w-full px-3 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Webhook URL</label>
                  <input
                    type="url"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg transition-colors"
                >
                  Add Integration
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* SETTINGS MODAL */}
      {/* ============================================ */}
      <AnimatePresence>
        {showSettingsModal && selectedIntegration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => { setShowSettingsModal(false); setSelectedIntegration(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Integration Settings</h2>
                <button onClick={() => { setShowSettingsModal(false); setSelectedIntegration(null); }} className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status display */}
              <div className="flex items-center gap-3 mb-5 p-3 bg-muted/30 rounded-lg">
                <StatusBadge status={selectedIntegration.status} />
                <span className="text-xs text-muted-foreground">
                  Category: {selectedIntegration.category}
                </span>
                {selectedIntegration.configuredAt && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    Configured: {new Date(selectedIntegration.configuredAt).toLocaleDateString('en-ZA')}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Description</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={editApiKey}
                    onChange={(e) => setEditApiKey(e.target.value)}
                    placeholder="Enter API key"
                    className="w-full px-3 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Webhook URL</label>
                  <input
                    type="url"
                    value={editWebhookUrl}
                    onChange={(e) => setEditWebhookUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowSettingsModal(false); setSelectedIntegration(null); }}
                  className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ============================================ */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7 text-danger" />
                </div>
                <h2 className="text-lg font-bold mb-2">Delete Integration?</h2>
                <p className="text-sm text-muted-foreground">
                  This will permanently remove{' '}
                  <span className="font-medium text-foreground">
                    {integrations.find((i) => i.id === showDeleteConfirm)?.name}
                  </span>
                  . This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-danger/90 transition-colors"
                >
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
