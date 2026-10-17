import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, AlertTriangle, TrendingDown, Clock,
  Wrench, CheckCircle, Eye, X,
  Plus, Gauge, Activity, Bell, Edit, Trash2, Download, Filter, MapPin, Search
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { toast } from 'sonner';
import { newId } from '../utils/id';
import type { MaintenanceTicket, ElectricityRecord } from '../store/useAppStore';

const inputClass = 'w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors';

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-warning/15 text-warning',
  high: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-danger/15 text-danger',
  critical: 'bg-danger/15 text-danger',
};

const statusColors: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  in_progress: 'bg-info/15 text-info',
  completed: 'bg-success/15 text-success',
  scheduled: 'bg-purple-500/20 text-purple-400',
  cancelled: 'bg-danger/15 text-danger',
};

const chartColors = ['#c9a87c', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

const zones = ['Main Building', 'Annex', 'Kitchen', 'Pool', 'Laundry', 'Parking'];
const ticketCategories = ['Electrical', 'Plumbing', 'HVAC', 'Structural', 'Equipment', 'Cleaning', 'Safety', 'Other'];

interface TicketFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'scheduled';
  category: string;
  assignedTo: string;
  propertyId: string;
  roomId: string;
  estimatedCost: string;
  actualCost: string;
  notes: string;
}

const emptyTicketForm: TicketFormData = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'pending',
  category: 'Other',
  assignedTo: '',
  propertyId: '1',
  roomId: '',
  estimatedCost: '',
  actualCost: '',
  notes: '',
};

interface ElectricityFormData {
  date: string;
  consumption: number;
  cost: number;
  peakDemand: number;
  zone: string;
}

const emptyElectricityForm: ElectricityFormData = {
  date: new Date().toISOString().split('T')[0],
  consumption: 0,
  cost: 0,
  peakDemand: 0,
  zone: 'Main Building',
};

interface AlertItem {
  id: string;
  type: 'high_consumption' | 'overdue_ticket' | 'critical_ticket' | 'cost_spike';
  title: string;
  description: string;
  severity: 'warning' | 'critical' | 'info';
  timestamp: string;
}

export default function FacilityManagement() {
  const {
    electricity, maintenanceTickets, users, properties,
    addElectricity, updateElectricity, deleteElectricity,
    addMaintenanceTicket, updateMaintenanceTicket, deleteMaintenanceTicket,
    addAuditLog,
  } = useAppStore();
  const role = useAppStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  const [activeTab, setActiveTab] = useState<'electricity' | 'maintenance' | 'zones' | 'alerts'>('electricity');
  const [selectedZone, setSelectedZone] = useState('all');

  // Electricity modal state
  const [showAddElectricity, setShowAddElectricity] = useState(false);
  const [editingElectricity, setEditingElectricity] = useState<ElectricityRecord | null>(null);
  const [electricityForm, setElectricityForm] = useState<ElectricityFormData>({ ...emptyElectricityForm });

  // Maintenance modal state
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showEditTicket, setShowEditTicket] = useState(false);
  const [showViewTicket, setShowViewTicket] = useState(false);
  const [editingTicket, setEditingTicket] = useState<MaintenanceTicket | null>(null);
  const [ticketForm, setTicketForm] = useState<TicketFormData>({ ...emptyTicketForm });

  // Filters
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState('all');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [ticketSearch, setTicketSearch] = useState('');

  // Alerts acknowledged
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());

  // ============================================================
  // COMPUTED DATA
  // ============================================================

  const totalConsumption = useMemo(() => electricity.reduce((sum, e) => sum + e.consumption, 0), [electricity]);
  const totalCost = useMemo(() => electricity.reduce((sum, e) => sum + e.cost, 0), [electricity]);
  const avgCostPerKwh = useMemo(() => totalConsumption > 0 ? (totalCost / totalConsumption) : 0, [totalCost, totalConsumption]);
  const peakDemand = useMemo(() => electricity.length > 0 ? Math.max(...electricity.map(e => e.peakDemand)) : 0, [electricity]);

  const activeTickets = useMemo(() => maintenanceTickets.filter(t => t.status !== 'completed'), [maintenanceTickets]);
  const overdueTickets = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return maintenanceTickets.filter(t =>
      t.status !== 'completed' && new Date(t.createdAt) < weekAgo
    );
  }, [maintenanceTickets]);

  // Filtered electricity records
  const filteredElectricity = useMemo(() => {
    return selectedZone === 'all' ? electricity : electricity.filter(e => e.zone === selectedZone);
  }, [electricity, selectedZone]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    let result = maintenanceTickets;
    if (ticketPriorityFilter !== 'all') {
      result = result.filter(t => t.priority === ticketPriorityFilter);
    }
    if (ticketStatusFilter !== 'all') {
      result = result.filter(t => t.status === ticketStatusFilter);
    }
    if (ticketSearch) {
      const q = ticketSearch.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.assignedTo || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [maintenanceTickets, ticketPriorityFilter, ticketStatusFilter, ticketSearch]);

  // Chart data: monthly consumption trend (grouped by date from store)
  const consumptionTrendData = useMemo(() => {
    const byDate = new Map<string, { consumption: number; cost: number }>();
    electricity.forEach(e => {
      const existing = byDate.get(e.date) || { consumption: 0, cost: 0 };
      existing.consumption += e.consumption;
      existing.cost += e.cost;
      byDate.set(e.date, existing);
    });
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({ date: date.slice(5), consumption: data.consumption, cost: data.cost }));
  }, [electricity]);

  // Chart data: peak vs off-peak (grouped by zone from store)
  const peakOffPeakData = useMemo(() => {
    const byZone = new Map<string, { peak: number; total: number }>();
    electricity.forEach(e => {
      const existing = byZone.get(e.zone) || { peak: 0, total: 0 };
      existing.peak += e.peakDemand;
      existing.total += e.consumption;
      byZone.set(e.zone, existing);
    });
    return Array.from(byZone.entries()).map(([zone, data]) => ({
      zone,
      peak: data.peak,
      offPeak: Math.max(0, data.total - data.peak),
    }));
  }, [electricity]);

  // Zone consumption cards from store data
  const zoneConsumptionData = useMemo(() => {
    const byZone = new Map<string, { consumption: number; cost: number; records: number; maxPeak: number }>();
    electricity.forEach(e => {
      const existing = byZone.get(e.zone) || { consumption: 0, cost: 0, records: 0, maxPeak: 0 };
      existing.consumption += e.consumption;
      existing.cost += e.cost;
      existing.records += 1;
      existing.maxPeak = Math.max(existing.maxPeak, e.peakDemand);
      byZone.set(e.zone, existing);
    });
    return Array.from(byZone.entries()).map(([zone, data]) => ({
      zone,
      consumption: data.consumption,
      cost: data.cost,
      records: data.records,
      avgConsumption: data.records > 0 ? Math.round(data.consumption / data.records) : 0,
      maxPeak: data.maxPeak,
    }));
  }, [electricity]);

  // Pie chart data for zone breakdown
  const zonePieData = useMemo(() => {
    return zoneConsumptionData.map(z => ({ name: z.zone, value: z.consumption }));
  }, [zoneConsumptionData]);

  // Alerts generated from real data
  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];

    // High consumption zones (above average)
    if (zoneConsumptionData.length > 0) {
      const avgConsumption = totalConsumption / Math.max(zoneConsumptionData.length, 1);
      zoneConsumptionData.forEach(z => {
        if (z.consumption > avgConsumption * 1.5) {
          items.push({
            id: `alert-high-${z.zone}`,
            type: 'high_consumption',
            title: `High consumption: ${z.zone}`,
            description: `${z.zone} consumption (${z.consumption.toLocaleString()} kWh) is 50%+ above the zone average (${Math.round(avgConsumption).toLocaleString()} kWh).`,
            severity: 'warning',
            timestamp: new Date().toISOString(),
          });
        }
      });
    }

    // Overdue maintenance tickets (>7 days old, not completed)
    overdueTickets.forEach(t => {
      items.push({
        id: `alert-overdue-${t.id}`,
        type: 'overdue_ticket',
        title: `Overdue ticket: ${t.title}`,
        description: `Ticket "${t.title}" has been open since ${new Date(t.createdAt).toLocaleDateString()} and is still ${t.status}.`,
        severity: 'warning',
        timestamp: t.createdAt,
      });
    });

    // Critical/urgent tickets
    maintenanceTickets
      .filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed')
      .forEach(t => {
        items.push({
          id: `alert-critical-${t.id}`,
          type: 'critical_ticket',
          title: `${t.priority === 'urgent' ? 'Urgent' : 'High priority'}: ${t.title}`,
          description: t.description,
          severity: t.priority === 'urgent' ? 'critical' : 'warning',
          timestamp: t.createdAt,
        });
      });

    // Cost spikes (any single record cost > R3000)
    electricity
      .filter(e => e.cost > 3000)
      .forEach(e => {
        items.push({
          id: `alert-cost-${e.id}`,
          type: 'cost_spike',
          title: `Cost spike: ${e.zone}`,
          description: `R${e.cost.toFixed(2)} recorded on ${e.date} for ${e.zone} (${e.consumption} kWh).`,
          severity: 'info',
          timestamp: e.date + 'T00:00:00',
        });
      });

    return items;
  }, [zoneConsumptionData, totalConsumption, overdueTickets, maintenanceTickets, electricity]);

  const unacknowledgedAlerts = useMemo(
    () => alerts.filter(a => !acknowledgedAlerts.has(a.id)),
    [alerts, acknowledgedAlerts]
  );

  // ============================================================
  // ELECTRICITY CRUD
  // ============================================================

  const handleSaveElectricity = () => {
    if (editingElectricity) {
      updateElectricity(editingElectricity.id, electricityForm);
      addAuditLog({
        id: `LOG-${Date.now()}`,
        action: 'update',
        entityType: 'property',
        entityId: editingElectricity.id,
        entityName: `Electricity ${editingElectricity.zone}`,
        userId: 'system',
        userName: 'System',
        userRole: 'system',
        details: `Updated electricity record for ${electricityForm.zone} on ${electricityForm.date}`,
        timestamp: new Date().toISOString(),
      });
      toast.success('Electricity record updated');
    } else {
      const newId = `ELEC-${Date.now()}`;
      addElectricity({ id: newId, ...electricityForm });
      addAuditLog({
        id: `LOG-${Date.now()}`,
        action: 'create',
        entityType: 'property',
        entityId: newId,
        entityName: `Electricity ${electricityForm.zone}`,
        userId: 'system',
        userName: 'System',
        userRole: 'system',
        details: `Added electricity record for ${electricityForm.zone} on ${electricityForm.date}: ${electricityForm.consumption} kWh, R${electricityForm.cost.toFixed(2)}`,
        timestamp: new Date().toISOString(),
      });
      toast.success('Electricity record added');
    }
    setShowAddElectricity(false);
    setEditingElectricity(null);
    setElectricityForm({ ...emptyElectricityForm });
  };

  const handleEditElectricity = (record: ElectricityRecord) => {
    setEditingElectricity(record);
    setElectricityForm({
      date: record.date,
      consumption: record.consumption,
      cost: record.cost,
      peakDemand: record.peakDemand,
      zone: record.zone,
    });
    setShowAddElectricity(true);
  };

  const handleDeleteElectricity = (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      deleteElectricity(id);
      addAuditLog({
        id: `LOG-${Date.now()}`,
        action: 'update',
        entityType: 'property',
        entityId: id,
        entityName: 'Electricity Record',
        userId: 'system',
        userName: 'System',
        userRole: 'system',
        details: `Deleted electricity record ${id}`,
        timestamp: new Date().toISOString(),
      });
      toast.success('Electricity record deleted');
    }
  };

  // ============================================================
  // MAINTENANCE CRUD
  // ============================================================

  const updateTicketForm = (field: keyof TicketFormData, value: string) => {
    setTicketForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketForm.title.trim()) {
      toast.error('Title is required');
      return;
    }

    const newTicket: MaintenanceTicket = {
      id: newId('MT'),
      title: ticketForm.title,
      description: ticketForm.description,
      priority: ticketForm.priority,
      status: ticketForm.status,
      assignedTo: ticketForm.assignedTo || undefined,
      propertyId: ticketForm.propertyId || undefined,
      roomId: ticketForm.roomId || undefined,
      estimatedCost: ticketForm.estimatedCost ? parseFloat(ticketForm.estimatedCost) : undefined,
      actualCost: ticketForm.actualCost ? parseFloat(ticketForm.actualCost) : undefined,
      createdAt: new Date().toISOString(),
    };

    addMaintenanceTicket(newTicket);
    addAuditLog({
      id: newId('LOG'),
      action: 'create',
      entityType: 'ticket',
      entityId: newTicket.id,
      entityName: `Maintenance: ${newTicket.title}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Created maintenance ticket "${newTicket.title}" (${newTicket.priority} priority)`,
      timestamp: new Date().toISOString(),
    });
    toast.success('Maintenance ticket created', { description: newTicket.title });
    setShowCreateTicket(false);
    setTicketForm({ ...emptyTicketForm });
  };

  const openEditTicket = (ticket: MaintenanceTicket) => {
    setEditingTicket(ticket);
    setTicketForm({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      category: 'Other',
      assignedTo: ticket.assignedTo || '',
      propertyId: ticket.propertyId || '1',
      roomId: ticket.roomId || '',
      estimatedCost: ticket.estimatedCost?.toString() || '',
      actualCost: ticket.actualCost?.toString() || '',
      notes: '',
    });
    setShowEditTicket(true);
  };

  const handleEditTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;

    const updates: Partial<MaintenanceTicket> = {
      title: ticketForm.title,
      description: ticketForm.description,
      priority: ticketForm.priority,
      status: ticketForm.status,
      assignedTo: ticketForm.assignedTo || undefined,
      propertyId: ticketForm.propertyId || undefined,
      roomId: ticketForm.roomId || undefined,
      estimatedCost: ticketForm.estimatedCost ? parseFloat(ticketForm.estimatedCost) : undefined,
      actualCost: ticketForm.actualCost ? parseFloat(ticketForm.actualCost) : undefined,
      completedAt: ticketForm.status === 'completed' ? new Date().toISOString() : editingTicket.completedAt,
    };

    updateMaintenanceTicket(editingTicket.id, updates);
    addAuditLog({
      id: newId('LOG'),
      action: 'update',
      entityType: 'ticket',
      entityId: editingTicket.id,
      entityName: `Maintenance: ${ticketForm.title}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Updated maintenance ticket "${ticketForm.title}"`,
      oldValue: JSON.stringify({ status: editingTicket.status, priority: editingTicket.priority }),
      newValue: JSON.stringify({ status: ticketForm.status, priority: ticketForm.priority }),
      timestamp: new Date().toISOString(),
    });
    toast.success('Ticket updated', { description: ticketForm.title });
    setShowEditTicket(false);
    setEditingTicket(null);
    setTicketForm({ ...emptyTicketForm });
  };

  const openViewTicket = (ticket: MaintenanceTicket) => {
    setEditingTicket(ticket);
    setShowViewTicket(true);
  };

  const handleCompleteTicket = (ticket: MaintenanceTicket) => {
    updateMaintenanceTicket(ticket.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'ticket',
      entityId: ticket.id,
      entityName: `Maintenance: ${ticket.title}`,
      userId: 'system',
      userName: 'System',
      userRole: 'system',
      details: `Completed maintenance ticket "${ticket.title}"`,
      oldValue: ticket.status,
      newValue: 'completed',
      timestamp: new Date().toISOString(),
    });
    toast.success('Ticket completed', { description: ticket.title });
  };

  const handleDeleteTicket = (ticket: MaintenanceTicket) => {
    if (confirm(`Delete ticket "${ticket.title}"?`)) {
      deleteMaintenanceTicket(ticket.id);
      addAuditLog({
        id: `LOG-${Date.now()}`,
        action: 'update',
        entityType: 'ticket',
        entityId: ticket.id,
        entityName: `Maintenance: ${ticket.title}`,
        userId: 'system',
        userName: 'System',
        userRole: 'system',
        details: `Deleted maintenance ticket "${ticket.title}"`,
        timestamp: new Date().toISOString(),
      });
      toast.success('Ticket deleted');
    }
  };

  // ============================================================
  // EXPORT
  // ============================================================

  const exportElectricityCSV = () => {
    const headers = ['Date', 'Zone', 'Consumption (kWh)', 'Cost (R)', 'Peak Demand (kW)'];
    const rows = filteredElectricity.map(e => [e.date, e.zone, e.consumption, e.cost.toFixed(2), e.peakDemand]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `electricity_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export complete', { description: 'Electricity data exported to CSV' });
  };

  const exportMaintenanceCSV = () => {
    const headers = ['ID', 'Title', 'Description', 'Priority', 'Status', 'Assigned To', 'Room', 'Created', 'Completed', 'Est. Cost', 'Actual Cost'];
    const rows = filteredTickets.map(t => [
      t.id, t.title, t.description, t.priority, t.status,
      t.assignedTo || '', t.roomId || '', t.createdAt, t.completedAt || '',
      t.estimatedCost?.toFixed(2) || '', t.actualCost?.toFixed(2) || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export complete', { description: 'Maintenance tickets exported to CSV' });
  };

  const acknowledgeAlert = (id: string) => {
    setAcknowledgedAlerts(prev => new Set([...prev, id]));
    toast.success('Alert acknowledged');
  };

  // ============================================================
  // RENDER TICKET FORM
  // ============================================================

  const renderTicketForm = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Title</label>
        <input
          type="text"
          value={ticketForm.title}
          onChange={(e) => updateTicketForm('title', e.target.value)}
          placeholder="Enter ticket title"
          className={inputClass}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Description</label>
        <textarea
          value={ticketForm.description}
          onChange={(e) => updateTicketForm('description', e.target.value)}
          placeholder="Describe the issue..."
          className={`${inputClass} min-h-[100px]`}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Priority</label>
          <select
            value={ticketForm.priority}
            onChange={(e) => updateTicketForm('priority', e.target.value)}
            className={inputClass}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Status</label>
          <select
            value={ticketForm.status}
            onChange={(e) => updateTicketForm('status', e.target.value)}
            className={inputClass}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Category</label>
          <select
            value={ticketForm.category}
            onChange={(e) => updateTicketForm('category', e.target.value)}
            className={inputClass}
          >
            {ticketCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Assigned To</label>
          <select
            value={ticketForm.assignedTo}
            onChange={(e) => updateTicketForm('assignedTo', e.target.value)}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {users.filter(u => u.status === 'active').map(u => (
              <option key={u.id} value={u.name}>{u.name} - {u.role}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Property</label>
          <select
            value={ticketForm.propertyId}
            onChange={(e) => updateTicketForm('propertyId', e.target.value)}
            className={inputClass}
          >
            <option value="">Select property...</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Room (optional)</label>
          <input
            type="text"
            value={ticketForm.roomId}
            onChange={(e) => updateTicketForm('roomId', e.target.value)}
            placeholder="e.g. 202"
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Estimated Cost (R)</label>
          <input
            type="number"
            step="0.01"
            value={ticketForm.estimatedCost}
            onChange={(e) => updateTicketForm('estimatedCost', e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Actual Cost (R)</label>
          <input
            type="number"
            step="0.01"
            value={ticketForm.actualCost}
            onChange={(e) => updateTicketForm('actualCost', e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Notes</label>
        <textarea
          value={ticketForm.notes}
          onChange={(e) => updateTicketForm('notes', e.target.value)}
          placeholder="Optional notes..."
          className={`${inputClass} min-h-[60px]`}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => { setShowCreateTicket(false); setShowEditTicket(false); setEditingTicket(null); setTicketForm({ ...emptyTicketForm }); }}
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

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Facility & Utilities</h1>
          <p className="text-muted-foreground">Manage electricity, maintenance, and facility operations</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('alerts')}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            Alerts
            {unacknowledgedAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                {unacknowledgedAlerts.length}
              </span>
            )}
          </button>
          {activeTab === 'electricity' && (
            <button
              onClick={exportElectricityCSV}
              className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          {activeTab === 'maintenance' && (
            <>
              <button
                onClick={exportMaintenanceCSV}
                className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => { setTicketForm({ ...emptyTicketForm }); setShowCreateTicket(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Ticket
              </button>
            </>
          )}
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-warning/15 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-warning" />
            </div>
            {consumptionTrendData.length >= 2 && (
              <span className="text-xs text-success flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                {((consumptionTrendData[consumptionTrendData.length - 1].consumption - consumptionTrendData[consumptionTrendData.length - 2].consumption) / consumptionTrendData[consumptionTrendData.length - 2].consumption * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold">{totalConsumption.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Total kWh</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-danger/15 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-danger" />
            </div>
          </div>
          <p className="text-2xl font-bold">R{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-sm text-muted-foreground">Total Cost (ZAR)</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-info/15 rounded-lg flex items-center justify-center">
              <Wrench className="w-5 h-5 text-info" />
            </div>
          </div>
          <p className="text-2xl font-bold">{activeTickets.length}</p>
          <p className="text-sm text-muted-foreground">Active Tickets</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">{overdueTickets.length}</p>
          <p className="text-sm text-muted-foreground">Overdue Tickets</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/30 overflow-x-auto">
        {[
          { key: 'electricity' as const, label: 'Electricity', icon: Zap },
          { key: 'maintenance' as const, label: 'Maintenance', icon: Wrench },
          { key: 'zones' as const, label: 'Zones', icon: MapPin },
          { key: 'alerts' as const, label: 'Alerts', icon: Bell },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.key === 'alerts' && unacknowledgedAlerts.length > 0 && (
              <span className="w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                {unacknowledgedAlerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ==================== ELECTRICITY TAB ==================== */}
      {activeTab === 'electricity' && (
        <>
          {/* Zone Selector + Add Record */}
          <div className="flex gap-2 flex-wrap items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedZone('all')}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  selectedZone === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                All Zones
              </button>
              {[...new Set(electricity.map(e => e.zone))].map(zone => (
                <button
                  key={zone}
                  onClick={() => setSelectedZone(zone)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    selectedZone === zone ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setEditingElectricity(null); setElectricityForm({ ...emptyElectricityForm }); setShowAddElectricity(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Record
            </button>
          </div>

          {/* Electricity Records Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border/30">
              <h3 className="font-semibold">Electricity Records</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zone</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Consumption (kWh)</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost (R)</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Peak Demand (kW)</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredElectricity.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No records found.</td></tr>
                  )}
                  {filteredElectricity.map((record) => (
                    <tr key={record.id} className="border-b border-border/20 hover:bg-primary/5">
                      <td className="px-4 py-3 text-sm">{record.date}</td>
                      <td className="px-4 py-3 text-sm">{record.zone}</td>
                      <td className="px-4 py-3 text-sm font-medium">{record.consumption.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">R{record.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-sm">{record.peakDemand}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditElectricity(record)}
                            className="p-1.5 hover:bg-muted rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteElectricity(record.id)}
                              className="p-1.5 hover:bg-muted rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts from store data */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Consumption Trend</h3>
              <div className="h-64">
                {consumptionTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={consumptionTrendData}>
                      <defs>
                        <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c9a87c" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#c9a87c" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="consumption" stroke="#c9a87c" fillOpacity={1} fill="url(#colorConsumption)" name="kWh" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Peak vs Off-Peak by Zone</h3>
              <div className="h-64">
                {peakOffPeakData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peakOffPeakData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="zone" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Bar dataKey="peak" fill="#ef4444" name="Peak" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="offPeak" fill="#3b82f6" name="Off-Peak" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </div>
            </div>
          </div>

          {/* Zone Consumption Cards from store */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {zoneConsumptionData.map((zone, i) => (
              <motion.div
                key={zone.zone}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-warning" />
                    <h3 className="font-semibold">{zone.zone}</h3>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    zone.consumption > (totalConsumption / Math.max(zoneConsumptionData.length, 1)) * 1.5
                      ? 'bg-warning/15 text-warning'
                      : 'bg-success/15 text-success'
                  }`}>
                    {zone.consumption > (totalConsumption / Math.max(zoneConsumptionData.length, 1)) * 1.5 ? 'High' : 'Normal'}
                  </span>
                </div>
                <p className="text-2xl font-bold mb-1">{zone.consumption.toLocaleString()} kWh</p>
                <p className="text-sm text-muted-foreground">R{zone.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total cost</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Avg: {zone.avgConsumption} kWh/day</span>
                  <span>Peak: {zone.maxPeak} kW</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick stats */}
          <div className="bg-info/10 border border-info/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-5 h-5 text-info" />
              <h3 className="font-semibold text-info">Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Records</p>
                <p className="font-bold">{electricity.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Cost/kWh</p>
                <p className="font-bold">R{avgCostPerKwh.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Peak Demand</p>
                <p className="font-bold">{peakDemand} kW</p>
              </div>
              <div>
                <p className="text-muted-foreground">Zones Tracked</p>
                <p className="font-bold">{zoneConsumptionData.length}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== MAINTENANCE TAB ==================== */}
      {activeTab === 'maintenance' && (
        <>
          {/* Maintenance Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 border border-warning/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning/15 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{maintenanceTickets.filter(t => t.status === 'pending').length}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 border border-info/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-info/15 rounded-lg flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{maintenanceTickets.filter(t => t.status === 'in_progress').length}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 border border-success/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{maintenanceTickets.filter(t => t.status === 'completed').length}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 border border-danger/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-danger/15 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{maintenanceTickets.filter(t => t.priority === 'urgent' || t.priority === 'high').filter(t => t.status !== 'completed').length}</p>
                  <p className="text-sm text-muted-foreground">High Priority</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors w-52"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={ticketPriorityFilter}
                onChange={(e) => setTicketPriorityFilter(e.target.value)}
                className="px-3 py-2 bg-muted border border-border/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <select
              value={ticketStatusFilter}
              onChange={(e) => setTicketStatusFilter(e.target.value)}
              className="px-3 py-2 bg-muted border border-border/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Ticket List */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border/30">
              <h3 className="font-semibold">Maintenance Tickets ({filteredTickets.length})</h3>
            </div>
            <div className="divide-y divide-border/20">
              {filteredTickets.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No tickets match your filters.</div>
              )}
              {filteredTickets.map((ticket) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        ticket.status === 'completed' ? 'bg-success/15' :
                        ticket.status === 'in_progress' ? 'bg-info/15' : 'bg-warning/15'
                      }`}>
                        {ticket.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-success" />
                        ) : ticket.status === 'in_progress' ? (
                          <Wrench className="w-5 h-5 text-info" />
                        ) : (
                          <Clock className="w-5 h-5 text-warning" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium">{ticket.title}</h4>
                        <p className="text-sm text-muted-foreground truncate">{ticket.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          {ticket.roomId && <span>Room {ticket.roomId}</span>}
                          <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                          {ticket.assignedTo && <span>Assigned: {ticket.assignedTo}</span>}
                          {ticket.estimatedCost != null && <span>Est: R{ticket.estimatedCost.toFixed(2)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColors[ticket.status] || ''}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[ticket.priority] || ''}`}>
                        {ticket.priority}
                      </span>
                      <button
                        onClick={() => openViewTicket(ticket)}
                        className="p-1.5 hover:bg-muted rounded transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => openEditTicket(ticket)}
                        className="p-1.5 hover:bg-muted rounded transition-colors"
                        title="Edit ticket"
                      >
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {ticket.status !== 'completed' && (
                        <button
                          onClick={() => handleCompleteTicket(ticket)}
                          className="p-1.5 hover:bg-muted rounded transition-colors"
                          title="Mark as completed"
                        >
                          <CheckCircle className="w-4 h-4 text-success" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTicket(ticket)}
                        className="p-1.5 hover:bg-muted rounded transition-colors"
                        title="Delete ticket"
                      >
                        <Trash2 className="w-4 h-4 text-danger" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ==================== ZONES TAB ==================== */}
      {activeTab === 'zones' && (
        <>
          {/* Zone overview with pie chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Zone Consumption Breakdown</h3>
              <div className="h-72">
                {zonePieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={zonePieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {zonePieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No zone data available</div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4">Zone Consumption Trend</h3>
              <div className="h-72">
                {consumptionTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={consumptionTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Bar dataKey="consumption" fill="#c9a87c" name="kWh" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </div>
            </div>
          </div>

          {/* Zone Detail Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {zoneConsumptionData.map((zone, i) => {
              // Find daily trend for this zone
              const zoneDailyData = electricity
                .filter(e => e.zone === zone.zone)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(e => ({ date: e.date.slice(5), consumption: e.consumption }));

              return (
                <motion.div
                  key={zone.zone}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">{zone.zone}</h3>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      zone.consumption > (totalConsumption / Math.max(zoneConsumptionData.length, 1)) * 1.5
                        ? 'bg-danger/15 text-danger'
                        : zone.consumption > (totalConsumption / Math.max(zoneConsumptionData.length, 1))
                        ? 'bg-warning/15 text-warning'
                        : 'bg-success/15 text-success'
                    }`}>
                      {zone.consumption > (totalConsumption / Math.max(zoneConsumptionData.length, 1)) * 1.5
                        ? 'High'
                        : zone.consumption > (totalConsumption / Math.max(zoneConsumptionData.length, 1))
                        ? 'Moderate'
                        : 'Normal'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total kWh</p>
                      <p className="text-lg font-bold">{zone.consumption.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Cost</p>
                      <p className="text-lg font-bold">R{zone.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg/Day</p>
                      <p className="text-sm font-medium">{zone.avgConsumption} kWh</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Peak Demand</p>
                      <p className="text-sm font-medium">{zone.maxPeak} kW</p>
                    </div>
                  </div>
                  {/* Mini trend chart */}
                  {zoneDailyData.length > 1 && (
                    <div className="h-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={zoneDailyData}>
                          <Area type="monotone" dataKey="consumption" stroke="#c9a87c" fill="#c9a87c" fillOpacity={0.2} strokeWidth={1.5} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </motion.div>
              );
            })}
            {zoneConsumptionData.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground bg-card border border-border rounded-xl p-8">No zone data available. Add electricity records to see zone analytics.</div>
            )}
          </div>
        </>
      )}

      {/* ==================== ALERTS TAB ==================== */}
      {activeTab === 'alerts' && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">System Alerts ({unacknowledgedAlerts.length} new)</h3>
            {acknowledgedAlerts.size > 0 && (
              <button
                onClick={() => setAcknowledgedAlerts(new Set())}
                className="text-sm text-primary hover:underline"
              >
                Reset all acknowledged
              </button>
            )}
          </div>

          <div className="space-y-3">
            {alerts.length === 0 && (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                No alerts at this time. All systems are operating normally.
              </div>
            )}
            {alerts.map((alert) => {
              const isAcknowledged = acknowledgedAlerts.has(alert.id);
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: isAcknowledged ? 0.5 : 1, x: 0 }}
                  className={`bg-card border border-border rounded-xl p-4 border-l-4 ${
                    alert.severity === 'critical' ? 'border-danger' :
                    alert.severity === 'warning' ? 'border-warning' :
                    'border-info'
                  } ${isAcknowledged ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        alert.severity === 'critical' ? 'bg-danger/15' :
                        alert.severity === 'warning' ? 'bg-warning/15' :
                        'bg-info/15'
                      }`}>
                        {alert.severity === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-danger" />
                        ) : alert.severity === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-warning" />
                        ) : (
                          <Activity className="w-4 h-4 text-info" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{alert.title}</h4>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase ${
                            alert.severity === 'critical' ? 'bg-danger/15 text-danger' :
                            alert.severity === 'warning' ? 'bg-warning/15 text-warning' :
                            'bg-info/15 text-info'
                          }`}>
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    {!isAcknowledged && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="px-3 py-1.5 text-xs bg-muted rounded-lg hover:bg-muted/80 transition-colors shrink-0"
                      >
                        Acknowledge
                      </button>
                    )}
                    {isAcknowledged && (
                      <span className="text-xs text-success px-3 py-1.5">Acknowledged</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Add/Edit Electricity Modal */}
      <AnimatePresence>
        {showAddElectricity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowAddElectricity(false); setEditingElectricity(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-md m-4 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  {editingElectricity ? 'Edit Electricity Record' : 'Add Electricity Record'}
                </h2>
                <button onClick={() => { setShowAddElectricity(false); setEditingElectricity(null); }} className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Date</label>
                  <input
                    type="date"
                    value={electricityForm.date}
                    onChange={(e) => setElectricityForm({ ...electricityForm, date: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Zone</label>
                  <select
                    value={electricityForm.zone}
                    onChange={(e) => setElectricityForm({ ...electricityForm, zone: e.target.value })}
                    className={inputClass}
                  >
                    {zones.map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Consumption (kWh)</label>
                  <input
                    type="number"
                    value={electricityForm.consumption}
                    onChange={(e) => setElectricityForm({ ...electricityForm, consumption: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Cost (R)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={electricityForm.cost}
                    onChange={(e) => setElectricityForm({ ...electricityForm, cost: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Peak Demand (kW)</label>
                  <input
                    type="number"
                    value={electricityForm.peakDemand}
                    onChange={(e) => setElectricityForm({ ...electricityForm, peakDemand: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowAddElectricity(false); setEditingElectricity(null); }}
                    className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveElectricity}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
                  >
                    {editingElectricity ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {showCreateTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowCreateTicket(false); setTicketForm({ ...emptyTicketForm }); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg m-4 p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Create Maintenance Ticket</h2>
                <button onClick={() => { setShowCreateTicket(false); setTicketForm({ ...emptyTicketForm }); }} className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderTicketForm(handleCreateTicket, 'Create Ticket')}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Ticket Modal */}
      <AnimatePresence>
        {showEditTicket && editingTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowEditTicket(false); setEditingTicket(null); setTicketForm({ ...emptyTicketForm }); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg m-4 p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Edit Maintenance Ticket</h2>
                <button onClick={() => { setShowEditTicket(false); setEditingTicket(null); setTicketForm({ ...emptyTicketForm }); }} className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderTicketForm(handleEditTicket, 'Save Changes')}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Ticket Modal */}
      <AnimatePresence>
        {showViewTicket && editingTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => { setShowViewTicket(false); setEditingTicket(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg m-4 p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Ticket Details</h2>
                <button onClick={() => { setShowViewTicket(false); setEditingTicket(null); }} className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">ID</p>
                  <p className="font-mono text-sm">{editingTicket.id}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Title</p>
                  <p className="font-semibold text-lg">{editingTicket.title}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Description</p>
                  <p className="text-sm">{editingTicket.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Priority</p>
                    <span className={`inline-block text-xs px-2 py-1 rounded-full mt-1 ${priorityColors[editingTicket.priority]}`}>
                      {editingTicket.priority}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                    <span className={`inline-block text-xs px-2 py-1 rounded-full mt-1 ${statusColors[editingTicket.status]}`}>
                      {editingTicket.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Assigned To</p>
                    <p className="text-sm">{editingTicket.assignedTo || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Room</p>
                    <p className="text-sm">{editingTicket.roomId || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Created</p>
                    <p className="text-sm">{new Date(editingTicket.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
                    <p className="text-sm">{editingTicket.completedAt ? new Date(editingTicket.completedAt).toLocaleString() : 'Not yet'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Estimated Cost</p>
                    <p className="text-sm">{editingTicket.estimatedCost != null ? `R${editingTicket.estimatedCost.toFixed(2)}` : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Actual Cost</p>
                    <p className="text-sm">{editingTicket.actualCost != null ? `R${editingTicket.actualCost.toFixed(2)}` : 'N/A'}</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => { setShowViewTicket(false); setEditingTicket(null); }}
                    className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowViewTicket(false);
                      openEditTicket(editingTicket);
                    }}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
                  >
                    Edit
                  </button>
                  {editingTicket.status !== 'completed' && (
                    <button
                      onClick={() => {
                        handleCompleteTicket(editingTicket);
                        setShowViewTicket(false);
                        setEditingTicket(null);
                      }}
                      className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
