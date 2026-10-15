import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, MessageSquare, Workflow,
  ChevronRight, Sparkle, Lightbulb, Users,
  Wrench, DollarSign, Heart,
  Send, X, Bot, Activity, Play, Pause, Square,
  Plus, ToggleLeft, ToggleRight,
  Trash2, Eye, BarChart3, TrendingUp, FileText,
  CheckCircle, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../store/useAppStore';
import type { AiInsight, Workflow as WorkflowType } from '../store/useAppStore';
import { getAuthToken } from '../lib/api/config';
import { fetchAgents, runAgent, sendChat, updateAgentStatus } from '../lib/api/services';
import { mapAgent, mapAiInsight } from '../lib/api/mappers';
import type { AgentCard } from '../lib/api/mappers';

const AI_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  revenue: DollarSign,
  occupancy: Activity,
  staffing: Users,
  maintenance: Wrench,
  guest: Heart,
  operational: BarChart3,
};

const IMPACT_COLORS: Record<string, string> = {
  high: 'bg-danger/15 text-danger',
  medium: 'bg-warning/15 text-warning',
  low: 'bg-success/15 text-success',
};

const TYPE_COLORS: Record<string, string> = {
  revenue: 'bg-success/15 text-success',
  occupancy: 'bg-info/15 text-info',
  staffing: 'bg-purple-500/20 text-purple-400',
  maintenance: 'bg-orange-500/20 text-orange-400',
  guest: 'bg-pink-500/20 text-pink-400',
  operational: 'bg-cyan-500/20 text-cyan-400',
};

// Server agents ship without icons — keyed off the seeded names, Bot as catch-all.
const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Revenue Optimizer': DollarSign,
  'Guest Predictor': Heart,
  'Maintenance Scheduler': Wrench,
  'Rate Analyzer': TrendingUp,
  'Staffing Optimizer': Users,
  'Inventory Monitor': FileText,
};

interface AgentState {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'running' | 'paused' | 'stopped';
  lastRun: string;
  totalRuns: number;
  logs: { time: string; message: string }[];
}

// Seed shown until the API answers — first paint, no token, or a failed load.
const FALLBACK_AGENTS: AgentState[] = [
  {
    id: 'agent-1', name: 'Revenue Optimizer', description: 'Dynamic pricing optimization and revenue forecasting based on market demand',
    icon: DollarSign, status: 'running', lastRun: new Date(Date.now() - 300000).toISOString(), totalRuns: 142,
    logs: [
      { time: new Date(Date.now() - 300000).toISOString(), message: 'Analyzed 48 bookings, recommended 3 rate adjustments' },
      { time: new Date(Date.now() - 900000).toISOString(), message: 'Weekend rates optimized: +12% for Standard, +8% for Deluxe' },
      { time: new Date(Date.now() - 3600000).toISOString(), message: 'Revenue forecast updated for next 30 days' },
    ],
  },
  {
    id: 'agent-2', name: 'Guest Predictor', description: 'Predicts guest preferences, satisfaction scores, and repeat visit likelihood',
    icon: Heart, status: 'running', lastRun: new Date(Date.now() - 600000).toISOString(), totalRuns: 89,
    logs: [
      { time: new Date(Date.now() - 600000).toISOString(), message: 'Processed 8 guest profiles, updated 5 preference models' },
      { time: new Date(Date.now() - 1800000).toISOString(), message: 'VIP guest Sarah Johnson predicted satisfaction: 94%' },
    ],
  },
  {
    id: 'agent-3', name: 'Maintenance Scheduler', description: 'Predictive maintenance scheduling and resource optimization',
    icon: Wrench, status: 'paused', lastRun: new Date(Date.now() - 7200000).toISOString(), totalRuns: 67,
    logs: [
      { time: new Date(Date.now() - 7200000).toISOString(), message: 'HVAC inspection scheduled for rooms 201-210' },
      { time: new Date(Date.now() - 14400000).toISOString(), message: 'Pool pump efficiency at 87%, maintenance recommended in 14 days' },
    ],
  },
  {
    id: 'agent-4', name: 'Rate Analyzer', description: 'Competitive rate analysis and market positioning recommendations',
    icon: TrendingUp, status: 'running', lastRun: new Date(Date.now() - 1200000).toISOString(), totalRuns: 234,
    logs: [
      { time: new Date(Date.now() - 1200000).toISOString(), message: 'Compared rates with 12 competing properties in Sandton area' },
      { time: new Date(Date.now() - 3600000).toISOString(), message: 'Nexus Grand Hotel rates are 5% below market average for suites' },
    ],
  },
  {
    id: 'agent-5', name: 'Staffing Optimizer', description: 'AI-driven staff scheduling based on occupancy predictions and workload',
    icon: Users, status: 'stopped', lastRun: new Date(Date.now() - 86400000).toISOString(), totalRuns: 45,
    logs: [
      { time: new Date(Date.now() - 86400000).toISOString(), message: 'Generated weekly shift plan for 8 staff members' },
    ],
  },
  {
    id: 'agent-6', name: 'Inventory Monitor', description: 'Tracks supply levels and automates reorder recommendations',
    icon: FileText, status: 'running', lastRun: new Date(Date.now() - 900000).toISOString(), totalRuns: 178,
    logs: [
      { time: new Date(Date.now() - 900000).toISOString(), message: 'Scanned 8 inventory categories, 2 items below reorder level' },
      { time: new Date(Date.now() - 5400000).toISOString(), message: 'Reorder alert: Towels (Bath) at 80 units, reorder level 30' },
    ],
  },
];

const toAgentState = (card: AgentCard): AgentState => ({
  id: card.id,
  name: card.name,
  description: card.description,
  icon: AGENT_ICONS[card.name] ?? Bot,
  status: card.status,
  lastRun: card.lastRun ?? '',
  totalRuns: card.totalRuns,
  logs: card.logs,
});

// Lint's purity rule treats Date.now as a render-scope call — keep it at module scope.
const localId = (prefix: string) => `${prefix}-${Date.now()}`;
const elapsedMs = (timestamp: string) => Date.now() - new Date(timestamp).getTime();

export default function AIEnhancements() {
  const {
    aiInsights, addAiInsight, updateAiInsight,
    workflows, addWorkflow, updateWorkflow, deleteWorkflow,
    bookings, rooms, guests, invoices,
    addAuditLog,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'chat' | 'insights' | 'agents' | 'workflows'>('insights');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([
    { role: 'ai', content: 'Hello! I\'m your NEXUS AI Assistant. Ask me about occupancy, revenue, guests, bookings, or anything about your property. I have access to your live data.' },
  ]);
  const [chatInput, setChatInput] = useState('');

  // Insights filters
  const [insightTypeFilter, setInsightTypeFilter] = useState<string>('all');
  const [insightImpactFilter, setInsightImpactFilter] = useState<string>('all');
  const [insightStatusFilter, setInsightStatusFilter] = useState<string>('all');

  // Agents local state
  const [agentStates, setAgentStates] = useState<AgentState[]>(FALLBACK_AGENTS);
  const [showAgentLogModal, setShowAgentLogModal] = useState<string | null>(null);

  // Workflow form
  const [showWorkflowForm, setShowWorkflowForm] = useState(false);
  const [wfName, setWfName] = useState('');
  const [wfDescription, setWfDescription] = useState('');
  const [wfTrigger, setWfTrigger] = useState('New Booking');
  const [wfActions, setWfActions] = useState<string[]>([]);
  const [wfActionInput, setWfActionInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Replace the seed with server agents once a session exists.
  useEffect(() => {
    if (!getAuthToken()) return;
    fetchAgents()
      .then(dtos => setAgentStates(dtos.map(dto => toAgentState(mapAgent(dto)))))
      .catch(() => {/* keep the seed until a load succeeds */});
  }, []);

  // Computed stats
  const totalInsights = aiInsights.length;
  const acknowledgedCount = aiInsights.filter(i => i.dismissed === true).length; // using dismissed as a proxy
  const activeWorkflows = workflows.filter(w => w.status === 'active').length;
  const activeAgents = agentStates.filter(a => a.status === 'running').length;

  // Compute live data for AI chat
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const availableRooms = rooms.filter(r => r.status === 'available').length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const totalGuests = guests.length;
  const activeBookings = bookings.filter(b => b.status === 'checked-in' || b.status === 'confirmed').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const totalRevenue = bookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.amount, 0);
  const paidRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.total, 0);
  const avgRoomRate = bookings.length > 0
    ? Math.round(bookings.reduce((sum, b) => sum + b.amount, 0) / bookings.reduce((sum, b) => sum + b.nights, 0))
    : 0;
  const vipGuests = guests.filter(g => g.segment === 'VIP').length;
  const corporateGuests = guests.filter(g => g.segment === 'Corporate').length;

  const formatCurrency = (amount: number) => `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // AI Chat with real data
  const getAIResponse = (query: string): string => {
    const q = query.toLowerCase();

    if (q.includes('occupancy') || q.includes('occupied')) {
      return `Current Occupancy: ${occupancyRate}% (${occupiedRooms} of ${totalRooms} rooms occupied). ${availableRooms} rooms are available. Based on booking trends, I predict occupancy will reach ${Math.min(occupancyRate + 8, 100)}% by end of this week.`;
    }
    if (q.includes('revenue') || q.includes('money') || q.includes('income') || q.includes('earnings')) {
      return `Total booking revenue: ${formatCurrency(totalRevenue)}. Paid invoices total: ${formatCurrency(paidRevenue)}. Average rate per night: ${formatCurrency(avgRoomRate)}. Active bookings: ${activeBookings}. I recommend focusing on upselling suites which have the highest margin.`;
    }
    if (q.includes('guest') || q.includes('customer')) {
      return `Total guests in system: ${totalGuests}. VIP guests: ${vipGuests}. Corporate guests: ${corporateGuests}. Active check-ins: ${bookings.filter(b => b.status === 'checked-in').length}. Guest satisfaction is tracking well based on recent booking patterns.`;
    }
    if (q.includes('booking') || q.includes('reservation')) {
      return `Total bookings: ${bookings.length}. Active/confirmed: ${activeBookings}. Pending: ${pendingBookings}. Cancelled: ${bookings.filter(b => b.status === 'cancelled').length}. Checked-out: ${bookings.filter(b => b.status === 'checked-out').length}. Upcoming bookings look strong with ${bookings.filter(b => b.status === 'confirmed').length} confirmed.`;
    }
    if (q.includes('room') || q.includes('available') || q.includes('vacancy')) {
      const roomTypes = rooms.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const typeSummary = Object.entries(roomTypes).map(([type, count]) => `${type}: ${count}`).join(', ');
      return `Total rooms: ${totalRooms}. Available: ${availableRooms}. Occupied: ${occupiedRooms}. Maintenance: ${rooms.filter(r => r.status === 'maintenance').length}. Cleaning: ${rooms.filter(r => r.status === 'cleaning').length}. Room types: ${typeSummary}.`;
    }
    if (q.includes('staff') || q.includes('employee') || q.includes('schedule')) {
      return `Based on current ${occupancyRate}% occupancy, I recommend ${occupancyRate > 80 ? 'adding 2 extra housekeeping staff for peak hours' : 'maintaining current staffing levels'}. Consider cross-training front desk staff for concierge duties during low-traffic periods.`;
    }
    if (q.includes('price') || q.includes('rate') || q.includes('pricing')) {
      return `Average nightly rate: ${formatCurrency(avgRoomRate)}. At ${occupancyRate}% occupancy, ${occupancyRate > 85 ? 'there is room to increase rates by 10-15% on premium rooms' : 'current rates are well-positioned for market conditions'}. Weekend rates can be optimized for higher yield.`;
    }
    if (q.includes('forecast') || q.includes('predict') || q.includes('trend')) {
      return `Based on ${bookings.length} historical bookings: projected occupancy next week is ${Math.min(occupancyRate + 5, 98)}%. Revenue trend is ${totalRevenue > 50000 ? 'positive' : 'stable'}. Peak demand expected on weekends. Consider running a mid-week promotion to boost occupancy.`;
    }
    if (q.includes('invoice') || q.includes('payment') || q.includes('billing')) {
      const pendingInvoices = invoices.filter(i => i.status === 'pending').length;
      const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
      return `Total invoices: ${invoices.length}. Pending: ${pendingInvoices}. Overdue: ${overdueInvoices}. Paid: ${invoices.filter(i => i.status === 'paid').length}. Total collected: ${formatCurrency(paidRevenue)}. ${overdueInvoices > 0 ? 'Action needed: follow up on overdue invoices.' : 'All invoices are current.'}`;
    }
    if (q.includes('help') || q.includes('what can')) {
      return 'I can help with: occupancy analysis, revenue reports, guest insights, booking status, room availability, staffing recommendations, pricing optimization, demand forecasting, invoice/payment tracking, and more. Just ask!';
    }
    return `I've analyzed your query against current property data. We have ${occupancyRate}% occupancy, ${formatCurrency(totalRevenue)} in bookings, and ${totalGuests} guests. Try asking about specific topics like "revenue", "occupancy", "guests", "bookings", "rooms", "pricing", "forecast", or "invoices" for detailed insights.`;
  };

  // Backend answers when signed in; the local responder keeps chat usable offline.
  const getChatReply = async (message: string): Promise<string> => {
    if (getAuthToken()) {
      try {
        const res = await sendChat(message);
        if (res.reply) return res.reply;
      } catch {
        // API down or session expired — fall through to local answers
      }
    }
    return getAIResponse(message);
  };

  const handleSendChat = (text?: string) => {
    const userMsg = (text ?? chatInput).trim();
    if (!userMsg) return;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    getChatReply(userMsg).then(reply => {
      setChatMessages(prev => [...prev, { role: 'ai', content: reply }]);
    });
  };

  // Insight actions
  const handleAcknowledge = (insight: AiInsight) => {
    updateAiInsight(insight.id, { dismissed: false });
    toast.success(`Insight "${insight.title}" acknowledged`);
  };

  const handleImplement = (insight: AiInsight) => {
    updateAiInsight(insight.id, { dismissed: false });
    toast.success(`Insight "${insight.title}" marked as implemented`);
    addAuditLog({
      id: localId('log'),
      action: 'implement_insight',
      entityType: 'property',
      entityId: insight.id,
      entityName: insight.title,
      userId: 'system',
      userName: 'AI System',
      userRole: 'AI',
      details: `Implemented AI insight: ${insight.title} - ${insight.recommendation}`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleDismiss = (insight: AiInsight) => {
    updateAiInsight(insight.id, { dismissed: true });
    toast.info(`Insight "${insight.title}" dismissed`);
  };

  // Filter insights
  const filteredInsights = useMemo(() => {
    return aiInsights.filter(i => {
      if (insightTypeFilter !== 'all' && i.type !== insightTypeFilter) return false;
      if (insightImpactFilter !== 'all' && i.impact !== insightImpactFilter) return false;
      if (insightStatusFilter === 'new' && i.dismissed !== undefined) return false;
      if (insightStatusFilter === 'acknowledged' && i.dismissed !== false) return false;
      if (insightStatusFilter === 'dismissed' && i.dismissed !== true) return false;
      return true;
    });
  }, [aiInsights, insightTypeFilter, insightImpactFilter, insightStatusFilter]);

  // Quick Actions
  const handleGenerateReport = () => {
    const insight: AiInsight = {
      id: localId('ai'),
      type: 'revenue',
      title: 'Auto-Generated Operations Report',
      description: `Comprehensive analysis: ${occupancyRate}% occupancy across ${totalRooms} rooms. ${activeBookings} active bookings generating ${formatCurrency(totalRevenue)} in revenue.`,
      recommendation: `Focus on ${availableRooms} available rooms. ${pendingBookings > 0 ? `Confirm ${pendingBookings} pending bookings to secure revenue.` : 'All bookings are confirmed.'} Consider weekend promotions for Standard rooms.`,
      impact: 'high',
      timestamp: new Date().toISOString(),
    };
    addAiInsight(insight);
    toast.success('Operations report generated and added to insights');
    addAuditLog({
      id: localId('log'),
      action: 'generate_report',
      entityType: 'property',
      entityId: insight.id,
      entityName: 'AI Operations Report',
      userId: 'system',
      userName: 'AI System',
      userRole: 'AI',
      details: `Generated operations report: ${occupancyRate}% occupancy, ${formatCurrency(totalRevenue)} revenue`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleOptimizePricing = () => {
    const underOccupied = rooms.filter(r => r.status === 'available');
    const avgPrice = rooms.reduce((s, r) => s + r.price, 0) / rooms.length;
    const recommendation = occupancyRate > 85
      ? `High demand detected. Increase rates by 12-15% on premium rooms. Current avg rate: ${formatCurrency(avgPrice)}.`
      : occupancyRate > 60
      ? `Moderate demand. Consider a 5% increase on weekends and a 10% mid-week discount to boost occupancy.`
      : `Low occupancy. Recommend promotional rates: 20% off for stays of 3+ nights. Target corporate segment.`;

    const insight: AiInsight = {
      id: localId('ai'),
      type: 'revenue',
      title: 'Pricing Optimization Analysis',
      description: `Analyzed ${totalRooms} rooms at ${occupancyRate}% occupancy. ${underOccupied.length} rooms available. Average room rate: ${formatCurrency(avgPrice)}.`,
      recommendation,
      impact: occupancyRate > 80 ? 'high' : 'medium',
      timestamp: new Date().toISOString(),
    };
    addAiInsight(insight);
    toast.success('Pricing optimization analysis generated');
    addAuditLog({
      id: localId('log'),
      action: 'optimize_pricing',
      entityType: 'property',
      entityId: insight.id,
      entityName: 'Pricing Optimization',
      userId: 'system',
      userName: 'AI System',
      userRole: 'AI',
      details: `Pricing optimization: ${occupancyRate}% occupancy, avg rate ${formatCurrency(avgPrice)}`,
      timestamp: new Date().toISOString(),
    });
  };

  const handlePredictDemand = () => {
    const confirmedUpcoming = bookings.filter(b => b.status === 'confirmed').length;
    const predictedOccupancy = Math.min(occupancyRate + Math.round(confirmedUpcoming * 3), 100);

    const insight: AiInsight = {
      id: localId('ai'),
      type: 'occupancy',
      title: 'Demand Prediction - Next 7 Days',
      description: `Current: ${occupiedRooms} occupied, ${confirmedUpcoming} confirmed upcoming. Predicted peak occupancy: ${predictedOccupancy}% by weekend.`,
      recommendation: predictedOccupancy > 90
        ? `High demand expected. Prepare additional staff. Consider waitlist for premium rooms. Expected ${Math.round(predictedOccupancy * totalRooms / 100)} rooms occupied.`
        : `Moderate demand forecast. ${availableRooms} rooms projected to remain available. Run targeted promotions to corporate clients.`,
      impact: predictedOccupancy > 90 ? 'high' : 'medium',
      timestamp: new Date().toISOString(),
    };
    addAiInsight(insight);
    toast.success('Demand prediction generated');
    addAuditLog({
      id: localId('log'),
      action: 'predict_demand',
      entityType: 'property',
      entityId: insight.id,
      entityName: 'Demand Prediction',
      userId: 'system',
      userName: 'AI System',
      userRole: 'AI',
      details: `Demand prediction: ${predictedOccupancy}% expected occupancy, ${confirmedUpcoming} upcoming bookings`,
      timestamp: new Date().toISOString(),
    });
  };

  // Agent actions — optimistic locally, reconciled from the API response.
  const syncAgentStatus = (agentId: string, status: string) => {
    const numericId = Number(agentId);
    if (!getAuthToken() || !Number.isFinite(numericId)) return;
    updateAgentStatus(numericId, status)
      .then(dto => setAgentStates(prev => prev.map(a => a.id === agentId ? toAgentState(mapAgent(dto)) : a)))
      .catch(() => {/* optimistic state stands; next load resyncs */});
  };

  const toggleAgent = (agentId: string) => {
    const current = agentStates.find(a => a.id === agentId);
    if (!current) return;
    const newStatus = current.status === 'running' ? 'paused' : 'running';
    const now = new Date().toISOString();
    setAgentStates(prev => prev.map(a => a.id !== agentId ? a : {
      ...a,
      status: newStatus,
      lastRun: newStatus === 'running' ? now : a.lastRun,
      logs: [
        { time: now, message: `Agent ${newStatus === 'running' ? 'started' : 'paused'} by user` },
        ...a.logs,
      ],
    }));
    toast.success(`${current.name} ${newStatus === 'running' ? 'started' : 'paused'}`);
    syncAgentStatus(agentId, newStatus);
  };

  const stopAgent = (agentId: string) => {
    const current = agentStates.find(a => a.id === agentId);
    if (!current) return;
    const now = new Date().toISOString();
    setAgentStates(prev => prev.map(a => a.id !== agentId ? a : {
      ...a,
      status: 'stopped',
      logs: [
        { time: now, message: 'Agent stopped by user' },
        ...a.logs,
      ],
    }));
    toast.info(`${current.name} stopped`);
    syncAgentStatus(agentId, 'stopped');
  };

  const runAgentNow = (agentId: string) => {
    const agent = agentStates.find(a => a.id === agentId);
    const numericId = Number(agentId);
    if (!getAuthToken() || !Number.isFinite(numericId)) {
      toast.info('Agent runs need a live session — start the API and sign in');
      return;
    }
    runAgent(numericId)
      .then(result => {
        setAgentStates(prev => prev.map(a => a.id !== agentId ? a : toAgentState(mapAgent(result.agent))));
        addAiInsight(mapAiInsight(result.insight));
        toast.success(`${agent?.name ?? 'Agent'} completed — new insight added`);
      })
      .catch(() => toast.error('Agent run failed — check the API and try again'));
  };

  // Workflow actions
  const handleToggleWorkflow = (workflow: WorkflowType) => {
    const newStatus = workflow.status === 'active' ? 'inactive' : 'active';
    updateWorkflow(workflow.id, { status: newStatus });
    toast.success(`Workflow "${workflow.name}" ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    addAuditLog({
      id: localId('log'),
      action: 'toggle_workflow',
      entityType: 'property',
      entityId: workflow.id,
      entityName: workflow.name,
      userId: 'system',
      userName: 'AI System',
      userRole: 'AI',
      details: `Workflow "${workflow.name}" changed to ${newStatus}`,
      oldValue: workflow.status,
      newValue: newStatus,
      timestamp: new Date().toISOString(),
    });
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    deleteWorkflow(workflowId);
    setShowDeleteConfirm(null);
    toast.success(`Workflow "${workflow?.name}" deleted`);
    addAuditLog({
      id: localId('log'),
      action: 'delete_workflow',
      entityType: 'property',
      entityId: workflowId,
      entityName: workflow?.name ?? 'Unknown',
      userId: 'system',
      userName: 'AI System',
      userRole: 'AI',
      details: `Deleted workflow: ${workflow?.name}`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleCreateWorkflow = () => {
    if (!wfName.trim()) {
      toast.error('Workflow name is required');
      return;
    }
    if (wfActions.length === 0) {
      toast.error('Add at least one action');
      return;
    }
    const newWorkflow: WorkflowType = {
      id: `wf-${Date.now()}`,
      name: wfName,
      description: wfDescription || undefined,
      trigger: wfTrigger,
      actions: wfActions,
      status: 'active',
      createdBy: 'system',
      createdAt: new Date().toISOString(),
    };
    addWorkflow(newWorkflow);
    toast.success(`Workflow "${wfName}" created successfully`);
    addAuditLog({
      id: localId('log'),
      action: 'create_workflow',
      entityType: 'property',
      entityId: newWorkflow.id,
      entityName: wfName,
      userId: 'system',
      userName: 'AI System',
      userRole: 'AI',
      details: `Created workflow: ${wfName} (trigger: ${wfTrigger}, ${wfActions.length} actions)`,
      timestamp: new Date().toISOString(),
    });
    setWfName('');
    setWfDescription('');
    setWfTrigger('New Booking');
    setWfActions([]);
    setWfActionInput('');
    setShowWorkflowForm(false);
  };

  const addWfAction = () => {
    if (!wfActionInput.trim()) return;
    setWfActions(prev => [...prev, wfActionInput.trim()]);
    setWfActionInput('');
  };

  const removeWfAction = (index: number) => {
    setWfActions(prev => prev.filter((_, i) => i !== index));
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = elapsedMs(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const viewingAgentLogs = agentStates.find(a => a.id === showAgentLogModal);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Enhancements</h1>
          <p className="text-muted-foreground">AI-powered insights, agents, and workflow automation</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info/15 rounded-lg flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalInsights}</p>
              <p className="text-xs text-muted-foreground">Total Insights</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalInsights - acknowledgedCount}</p>
              <p className="text-xs text-muted-foreground">Active Insights</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Workflow className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeWorkflows}</p>
              <p className="text-xs text-muted-foreground">Active Workflows</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeAgents}</p>
              <p className="text-xs text-muted-foreground">Active Agents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/30 overflow-x-auto">
        {([
          { id: 'chat', label: 'AI Chat', icon: MessageSquare },
          { id: 'insights', label: 'AI Insights', icon: Lightbulb },
          { id: 'agents', label: 'AI Agents', icon: Bot },
          { id: 'workflows', label: 'Workflows', icon: Workflow },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
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

      {/* =================== CHAT TAB =================== */}
      {activeTab === 'chat' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ height: '500px' }}>
          <div className="h-full flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-border/30 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">NEXUS AI Assistant</h3>
                <p className="text-xs text-success flex items-center gap-1">
                  <span className="w-2 h-2 bg-success rounded-full" />
                  Online - Connected to live data
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted rounded-bl-md'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quick suggestions */}
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
              {['What is occupancy?', 'Revenue this month?', 'How many guests?', 'Room availability?'].map(q => (
                <button
                  key={q}
                  onClick={() => handleSendChat(q)}
                  className="px-3 py-1 bg-muted/50 rounded-full text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border/30">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask anything about your property..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                  className="flex-1 px-4 py-2 bg-muted border border-border/30 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                />
                <button
                  onClick={() => handleSendChat()}
                  disabled={!chatInput.trim()}
                  className="p-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 hover:shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================== INSIGHTS TAB =================== */}
      {activeTab === 'insights' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filters:</span>
            </div>
            <select
              value={insightTypeFilter}
              onChange={(e) => setInsightTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Types</option>
              <option value="revenue">Revenue</option>
              <option value="occupancy">Occupancy</option>
              <option value="staffing">Staffing</option>
              <option value="maintenance">Maintenance</option>
              <option value="guest">Guest</option>
              <option value="operational">Operational</option>
            </select>
            <select
              value={insightImpactFilter}
              onChange={(e) => setInsightImpactFilter(e.target.value)}
              className="px-3 py-1.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Impact</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={insightStatusFilter}
              onChange={(e) => setInsightStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="acknowledged">Active</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <span className="text-xs text-muted-foreground ml-auto">
              Showing {filteredInsights.length} of {aiInsights.length} insights
            </span>
          </div>

          {/* Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInsights.map((insight, i) => {
              const Icon = AI_ICON_MAP[insight.type] || Lightbulb;
              const typeColor = TYPE_COLORS[insight.type] || 'bg-gray-500/20 text-gray-400';
              const impactColor = IMPACT_COLORS[insight.impact] || '';
              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-card border border-border rounded-xl p-5 transition-colors ${
                    insight.dismissed ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${typeColor}`}>
                        {insight.type}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${impactColor}`}>
                        {insight.impact}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1">{insight.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>

                  {/* Confidence bar (derived from impact) */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Confidence</span>
                      <span>{insight.impact === 'high' ? '92%' : insight.impact === 'medium' ? '75%' : '58%'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          insight.impact === 'high' ? 'bg-success' : insight.impact === 'medium' ? 'bg-warning' : 'bg-warning'
                        }`}
                        style={{ width: insight.impact === 'high' ? '92%' : insight.impact === 'medium' ? '75%' : '58%' }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-muted/30 rounded-lg mb-3">
                    <p className="text-sm font-medium text-primary">{insight.recommendation}</p>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      insight.dismissed === true
                        ? 'bg-gray-500/20 text-gray-400'
                        : insight.dismissed === false
                        ? 'bg-success/15 text-success'
                        : 'bg-info/15 text-info'
                    }`}>
                      {insight.dismissed === true ? 'Dismissed' : insight.dismissed === false ? 'Active' : 'New'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(insight.timestamp)}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {insight.dismissed !== false && (
                      <button
                        onClick={() => handleAcknowledge(insight)}
                        className="flex-1 py-1.5 text-xs bg-info/15 text-info rounded-lg hover:bg-info/30 transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => handleImplement(insight)}
                      className="flex-1 py-1.5 text-xs bg-success/15 text-success rounded-lg hover:bg-success/30 transition-colors"
                    >
                      Implement
                    </button>
                    {insight.dismissed !== true && (
                      <button
                        onClick={() => handleDismiss(insight)}
                        className="flex-1 py-1.5 text-xs bg-gray-500/20 text-gray-400 rounded-lg hover:bg-gray-500/30 transition-colors"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredInsights.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No insights match your filters</p>
            </div>
          )}

          {/* Quick AI Actions */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkle className="w-5 h-5 text-primary" />
              Quick AI Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleGenerateReport}
                className="p-4 bg-muted/30 rounded-xl text-left hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-info group-hover:scale-110 transition-transform" />
                  <p className="font-medium">Generate Report</p>
                </div>
                <p className="text-sm text-muted-foreground">Create AI-powered analytics report from live data</p>
              </button>
              <button
                onClick={handleOptimizePricing}
                className="p-4 bg-muted/30 rounded-xl text-left hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-success group-hover:scale-110 transition-transform" />
                  <p className="font-medium">Optimize Pricing</p>
                </div>
                <p className="text-sm text-muted-foreground">Adjust rates based on occupancy and demand analysis</p>
              </button>
              <button
                onClick={handlePredictDemand}
                className="p-4 bg-muted/30 rounded-xl text-left hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                  <p className="font-medium">Predict Demand</p>
                </div>
                <p className="text-sm text-muted-foreground">Forecast occupancy and demand for coming week</p>
              </button>
            </div>
          </div>
        </>
      )}

      {/* =================== AGENTS TAB =================== */}
      {activeTab === 'agents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agentStates.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  agent.status === 'running' ? 'bg-primary/20 text-primary' :
                  agent.status === 'paused' ? 'bg-warning/15 text-warning' :
                  'bg-muted text-muted-foreground'
                }`}>
                  <agent.icon className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => runAgentNow(agent.id)}
                    className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                    title="Run now"
                  >
                    <Activity className="w-4 h-4 text-primary" />
                  </button>
                  <button
                    onClick={() => toggleAgent(agent.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      agent.status === 'running'
                        ? 'bg-success/15 hover:bg-success/30'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                    title={agent.status === 'running' ? 'Pause' : 'Start'}
                  >
                    {agent.status === 'running' ? (
                      <Pause className="w-4 h-4 text-success" />
                    ) : (
                      <Play className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {agent.status !== 'stopped' && (
                    <button
                      onClick={() => stopAgent(agent.id)}
                      className="p-1.5 rounded-lg bg-danger/10 hover:bg-danger/15 transition-colors"
                      title="Stop"
                    >
                      <Square className="w-4 h-4 text-danger" />
                    </button>
                  )}
                </div>
              </div>
              <h3 className="font-semibold mb-1">{agent.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{agent.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Last run</span>
                  <span>{agent.lastRun ? formatTimeAgo(agent.lastRun) : 'Never'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total runs</span>
                  <span>{agent.totalRuns}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/30">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  agent.status === 'running' ? 'bg-success/15 text-success' :
                  agent.status === 'paused' ? 'bg-warning/15 text-warning' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {agent.status === 'running' ? 'Running' : agent.status === 'paused' ? 'Paused' : 'Stopped'}
                </span>
                <button
                  onClick={() => setShowAgentLogModal(agent.id)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  View Logs
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* =================== WORKFLOWS TAB =================== */}
      {activeTab === 'workflows' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow, i) => (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-info/15 rounded-lg flex items-center justify-center">
                    <Workflow className="w-5 h-5 text-info" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleWorkflow(workflow)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        workflow.status === 'active' ? 'bg-success/15 hover:bg-success/30' : 'bg-muted hover:bg-muted/80'
                      }`}
                      title={workflow.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                      {workflow.status === 'active' ? (
                        <ToggleRight className="w-5 h-5 text-success" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(workflow.id)}
                      className="p-1.5 rounded-lg bg-danger/10 hover:bg-danger/15 transition-colors"
                      title="Delete workflow"
                    >
                      <Trash2 className="w-4 h-4 text-danger" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold mb-1">{workflow.name}</h3>
                {workflow.description && (
                  <p className="text-xs text-muted-foreground mb-2">{workflow.description}</p>
                )}
                <p className="text-sm text-muted-foreground mb-3">
                  Trigger: <span className="font-medium text-foreground">{workflow.trigger}</span>
                </p>
                <div className="space-y-1 mb-4">
                  {workflow.actions.slice(0, 3).map((action, j) => (
                    <p key={j} className="text-xs text-muted-foreground flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 flex-shrink-0" />
                      {action}
                    </p>
                  ))}
                  {workflow.actions.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{workflow.actions.length - 3} more actions</p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/30">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    workflow.status === 'active' ? 'bg-success/15 text-success' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {workflow.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    {workflow.lastRun && (
                      <span>Last: {formatTimeAgo(workflow.lastRun)}</span>
                    )}
                    <span className="ml-2">{workflow.actions.length} steps</span>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Add New Workflow */}
            <button
              onClick={() => setShowWorkflowForm(true)}
              className="bg-card border border-dashed border-border/30 rounded-xl p-5 flex flex-col items-center justify-center min-h-[200px] hover:border-primary/50 transition-colors cursor-pointer"
            >
              <Plus className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="font-medium">Create Workflow</p>
              <p className="text-sm text-muted-foreground">Automate your processes</p>
            </button>
          </div>
        </>
      )}

      {/* =================== AGENT LOG MODAL =================== */}
      <AnimatePresence>
        {showAgentLogModal && viewingAgentLogs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAgentLogModal(null)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg m-4 p-6 max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{viewingAgentLogs.name}</h2>
                  <p className="text-xs text-muted-foreground">Activity Logs</p>
                </div>
                <button onClick={() => setShowAgentLogModal(null)} className="p-1 hover:bg-muted rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  viewingAgentLogs.status === 'running' ? 'bg-success/15 text-success' :
                  viewingAgentLogs.status === 'paused' ? 'bg-warning/15 text-warning' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {viewingAgentLogs.status}
                </span>
                <span className="text-xs text-muted-foreground">Total runs: {viewingAgentLogs.totalRuns}</span>
                <span className="text-xs text-muted-foreground">Last: {viewingAgentLogs.lastRun ? formatTimeAgo(viewingAgentLogs.lastRun) : 'Never'}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {viewingAgentLogs.logs.map((log, i) => (
                  <div key={i} className="p-3 bg-muted/20 rounded-lg border-l-2 border-primary/30">
                    <p className="text-xs text-muted-foreground mb-1">{formatTimeAgo(log.time)}</p>
                    <p className="text-sm">{log.message}</p>
                  </div>
                ))}
                {viewingAgentLogs.logs.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No logs available</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =================== CREATE WORKFLOW MODAL =================== */}
      <AnimatePresence>
        {showWorkflowForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWorkflowForm(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg m-4 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Create Workflow</h2>
                <button onClick={() => setShowWorkflowForm(false)} className="p-1 hover:bg-muted rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Workflow Name *</label>
                  <input
                    type="text"
                    placeholder="Enter workflow name"
                    value={wfName}
                    onChange={(e) => setWfName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <textarea
                    placeholder="Describe what this workflow does"
                    value={wfDescription}
                    onChange={(e) => setWfDescription(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Trigger</label>
                  <select
                    value={wfTrigger}
                    onChange={(e) => setWfTrigger(e.target.value)}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="New Booking">New Booking</option>
                    <option value="Check-in">Check-in</option>
                    <option value="Check-out">Check-out</option>
                    <option value="Payment">Payment</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Actions *</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Add an action step..."
                      value={wfActionInput}
                      onChange={(e) => setWfActionInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWfAction(); } }}
                      className="flex-1 px-4 py-2 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    />
                    <button
                      onClick={addWfAction}
                      disabled={!wfActionInput.trim()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {wfActions.length > 0 && (
                    <div className="space-y-1">
                      {wfActions.map((action, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                          <span className="text-sm flex items-center gap-2">
                            <span className="w-5 h-5 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                              {i + 1}
                            </span>
                            {action}
                          </span>
                          <button
                            onClick={() => removeWfAction(i)}
                            className="p-1 hover:bg-danger/15 rounded text-danger transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {wfActions.length === 0 && (
                    <p className="text-xs text-muted-foreground">No actions added yet. Type an action and press Enter or click +</p>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowWorkflowForm(false)}
                    className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateWorkflow}
                    disabled={!wfName.trim() || wfActions.length === 0}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Workflow
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =================== DELETE CONFIRM MODAL =================== */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-sm m-4 p-6"
            >
              <h2 className="text-lg font-bold mb-2">Delete Workflow</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete this workflow? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteWorkflow(showDeleteConfirm)}
                  className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-danger/90 transition-colors"
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
