import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Ticket, Plus, Search, Trash2, Eye,
  Clock, AlertTriangle, CheckCircle, XCircle, User,
  MessageSquare, Send, Flag, Building2, Wrench, Utensils, 
  Shield, Laptop, HeadphonesIcon, HelpCircle, X, Save,
  AlertCircle, CheckSquare, XSquare
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import toastHelpers from '../lib/toast';
import { newId } from '../utils/id';

const PRIORITY_COLORS = {
  low: { bg: 'bg-info/15', text: 'text-info', border: 'border-info/30', label: 'Low' },
  medium: { bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/30', label: 'Medium' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', label: 'High' },
  urgent: { bg: 'bg-danger/15', text: 'text-danger', border: 'border-danger/30', label: 'Urgent' },
  critical: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', label: 'Critical' },
};

const STATUS_CONFIG = {
  open: { bg: 'bg-info/15', text: 'text-info', icon: AlertCircle, label: 'Open' },
  in_progress: { bg: 'bg-warning/15', text: 'text-warning', icon: Clock, label: 'In Progress' },
  pending: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: Clock, label: 'Pending' },
  resolved: { bg: 'bg-success/15', text: 'text-success', icon: CheckCircle, label: 'Resolved' },
  closed: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: XCircle, label: 'Closed' },
  cancelled: { bg: 'bg-danger/15', text: 'text-danger', icon: XSquare, label: 'Cancelled' },
};

const CATEGORIES = [
  { value: 'front_desk', label: 'Front Desk', icon: Building2 },
  { value: 'housekeeping', label: 'Housekeeping', icon: CheckSquare },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
  { value: 'food_beverage', label: 'Food & Beverage', icon: Utensils },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'it', label: 'IT', icon: Laptop },
  { value: 'guest_service', label: 'Guest Service', icon: HeadphonesIcon },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

const TYPES = [
  { value: 'issue', label: 'Issue', description: 'Problem or malfunction' },
  { value: 'task', label: 'Task', description: 'Assigned work item' },
  { value: 'request', label: 'Request', description: 'Guest or staff request' },
  { value: 'incident', label: 'Incident', description: 'Security or safety incident' },
];

export default function TicketManagement() {
  const { tickets, users, properties, rooms, guests, addTicket, updateTicket, deleteTicket, addTicketComment } = useAppStore();
  const role = useAppStore((s) => s.user?.role);
  const canManage = role === 'admin' || role === 'manager';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<typeof tickets[0] | null>(null);
  const [newComment, setNewComment] = useState('');
  const [, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'issue' as 'issue' | 'task' | 'request' | 'incident',
    category: 'front_desk' as typeof tickets[0]['category'],
    priority: 'medium' as typeof tickets[0]['priority'],
    propertyId: '1',
    roomId: '',
    guestId: '',
    assigneeId: '',
    dueDate: '',
    tags: [] as string[],
  });

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      pending: tickets.filter(t => t.status === 'pending').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      urgent: tickets.filter(t => t.priority === 'urgent' || t.priority === 'critical').length,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.guestName?.toLowerCase().includes(q) ||
        t.assigneeName?.toLowerCase().includes(q)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tickets, searchQuery, statusFilter, priorityFilter, categoryFilter]);

  const getPropertyName = (propertyId: string) => properties.find(p => p.id === propertyId)?.name || 'Unknown';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const ticketNumber = `TKT-${String(tickets.length + 1).padStart(3, '0')}`;
    const assignee = users.find(u => u.id === formData.assigneeId);
    const guest = guests.find(g => g.id === formData.guestId);
    
    const newTicket = {
      id: newId('TKT'),
      ticketNumber,
      title: formData.title,
      description: formData.description,
      type: formData.type,
      category: formData.category,
      priority: formData.priority,
      status: 'open' as const,
      assigneeId: formData.assigneeId || undefined,
      assigneeName: assignee?.name,
      reporterId: '1',
      reporterName: 'Current User',
      propertyId: formData.propertyId,
      roomId: formData.roomId || undefined,
      guestId: formData.guestId || undefined,
      guestName: guest?.name,
      dueDate: formData.dueDate || undefined,
      tags: formData.tags,
      attachments: [],
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    addTicket(newTicket);
    toastHelpers.success('Ticket created', `Ticket ${ticketNumber} has been created`);
    setShowCreateModal(false);
    resetForm();
  };

  const handleStatusChange = (ticketId: string, newStatus: typeof tickets[0]['status']) => {
    const updates: Partial<typeof tickets[0]> = { 
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    
    if (newStatus === 'resolved') {
      updates.resolvedAt = new Date().toISOString();
    }
    if (newStatus === 'closed') {
      updates.closedAt = new Date().toISOString();
    }
    
    updateTicket(ticketId, updates);
    toastHelpers.success('Ticket updated', `Status changed to ${STATUS_CONFIG[newStatus].label}`);
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, ...updates });
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedTicket) return;
    
    const comment = {
      id: `c-${Date.now()}`,
      ticketId: selectedTicket.id,
      userId: '1',
      userName: 'Current User',
      content: newComment,
      isInternal: false,
      createdAt: new Date().toISOString(),
    };
    
    addTicketComment(selectedTicket.id, comment);
    setSelectedTicket({ ...selectedTicket, comments: [...selectedTicket.comments, comment] });
    setNewComment('');
    toastHelpers.success('Comment added');
  };

  const handleDelete = (ticketId: string) => {
    if (confirm('Are you sure you want to delete this ticket?')) {
      deleteTicket(ticketId);
      toastHelpers.success('Ticket deleted');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'issue',
      category: 'front_desk',
      priority: 'medium',
      propertyId: '1',
      roomId: '',
      guestId: '',
      assigneeId: '',
      dueDate: '',
      tags: [],
    });
    setSelectedTicket(null);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ticket Management</h1>
          <p className="text-muted-foreground">Track and manage issues, tasks, and requests across all departments</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 hover:shadow-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Ticket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.open}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.urgent}</p>
              <p className="text-xs text-muted-foreground">Urgent</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Tickets List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30 bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ticket</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assignee</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Property</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => {
                const StatusIcon = STATUS_CONFIG[ticket.status].icon;
                return (
                  <tr key={ticket.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-sm">{ticket.ticketNumber}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{ticket.title}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{CATEGORIES.find(c => c.value === ticket.category)?.label || ticket.category}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority].bg} ${PRIORITY_COLORS[ticket.priority].text}`}>
                        <Flag className="w-3 h-3 mr-1" />
                        {PRIORITY_COLORS[ticket.priority].label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[ticket.status].bg} ${STATUS_CONFIG[ticket.status].text}`}>
                        <StatusIcon className="w-3 h-3" />
                        {STATUS_CONFIG[ticket.status].label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-sm">{ticket.assigneeName || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{getPropertyName(ticket.propertyId)}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => { setSelectedTicket(ticket); setShowDetailModal(true); }}
                          className="p-1.5 hover:bg-muted rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <button 
                            onClick={() => handleDelete(ticket.id)}
                            className="p-1.5 hover:bg-danger/10 rounded-lg text-danger"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredTickets.length === 0 && (
          <div className="text-center py-12">
            <Ticket className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No tickets found</p>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowCreateModal(false); resetForm(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">Create New Ticket</h3>
                <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-2 block">Title</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      placeholder="Brief description of the issue"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <textarea
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors resize-none"
                      placeholder="Detailed description..."
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as typeof formData.type })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      {TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as typeof formData.category })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as typeof formData.priority })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Property</label>
                    <select
                      value={formData.propertyId}
                      onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Room</label>
                    <select
                      value={formData.roomId}
                      onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="">N/A</option>
                      {rooms.filter(r => r.propertyId === formData.propertyId).map(r => (
                        <option key={r.id} value={r.id}>{r.number} - {r.type}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Assignee</label>
                    <select
                      value={formData.assigneeId}
                      onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="">Unassigned</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} - {u.role}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Due Date</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                    className="flex-1 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 hover:shadow-lg transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Create Ticket
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ticket Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowDetailModal(false); setSelectedTicket(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Ticket className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedTicket.ticketNumber}</h3>
                    <p className="text-sm text-muted-foreground">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => { setShowDetailModal(false); setSelectedTicket(null); }} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-5 space-y-6">
                {/* Ticket Info */}
                <div>
                  <h4 className="text-xl font-semibold mb-2">{selectedTicket.title}</h4>
                  <p className="text-muted-foreground">{selectedTicket.description}</p>
                </div>
                
                {/* Meta Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Priority</p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[selectedTicket.priority].bg} ${PRIORITY_COLORS[selectedTicket.priority].text}`}>
                      {PRIORITY_COLORS[selectedTicket.priority].label}
                    </span>
                  </div>
                  <div className="p-3 bg-muted rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedTicket.status].bg} ${STATUS_CONFIG[selectedTicket.status].text}`}>
                      {STATUS_CONFIG[selectedTicket.status].label}
                    </span>
                  </div>
                  <div className="p-3 bg-muted rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Category</p>
                    <p className="font-medium">{CATEGORIES.find(c => c.value === selectedTicket.category)?.label}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Assignee</p>
                    <p className="font-medium">{selectedTicket.assigneeName || 'Unassigned'}</p>
                  </div>
                </div>
                
                {/* Quick Status Change */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Change Status</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => handleStatusChange(selectedTicket.id, key as typeof tickets[0]['status'])}
                          disabled={selectedTicket.status === key}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedTicket.status === key
                              ? `${config.bg} ${config.text} cursor-default`
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {config.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Comments */}
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comments ({selectedTicket.comments.length})
                  </label>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedTicket.comments.map((comment) => (
                      <div key={comment.id} className="p-3 bg-muted rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                              <User className="w-3 h-3 text-primary" />
                            </div>
                            <span className="font-medium text-sm">{comment.userName}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                      placeholder="Add a comment..."
                      className="flex-1 px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    />
                    <button
                      onClick={handleAddComment}
                      className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 hover:shadow-lg transition-colors"
                    >
                      <Send className="w-4 h-4" />
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
