import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Calendar, Users, Building2, DoorOpen, LogIn, Wallet,
  BadgeCheck, Tag, BarChart3, FileText, TrendingUp, Plug, Settings,
  Ticket, Search, Plus, Eye, CheckCircle, Clock, Star, Mail,
  Zap, Palette, Layers, Mic, Type, ImageIcon, CreditCard, AlignLeft,
  Moon, Sun, Sparkles,
  GitBranch, Workflow, Play, RefreshCw,
  Send, Paperclip, ArrowRight, Menu,
  X, Box, Activity, MessageSquare, Brain, Package, LogOut, GripVertical
} from 'lucide-react';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

import EmployeeProfiles from './pages/EmployeeProfiles';
import BookingManagement from './pages/BookingManagement';
import Guests from './pages/Guests';
import Rooms from './pages/Rooms';
import PropertyManagement from './pages/PropertyManagement';
import Messaging from './pages/Messaging';
import RfidManagement from './pages/RfidManagement';
import StaffScheduling from './pages/StaffScheduling';
import FinancialManagement from './pages/FinancialManagement';
import InventoryManagement from './pages/InventoryManagement';
import FacilityManagement from './pages/FacilityManagement';
import AIEnhancements from './pages/AIEnhancements';
import AdminPanel from './pages/AdminPanel';
import TicketManagement from './pages/TicketManagement';
import CheckInOut from './pages/CheckInOut';
import RateManagement from './pages/RateManagement';
import ReportsPage from './pages/ReportsPage';
import ForecastingPage from './pages/ForecastingPage';
import IntegrationsPage from './pages/Integrations';
import SettingsPage from './pages/Settings';
import LoginPage from './pages/LoginPage';
import { ErrorBoundary } from './pages/ErrorPages';
import NotificationBell from './components/notifications/NotificationBell';
import GlobalSearch from './components/search/GlobalSearch';
import { MetricCard, Panel, PageHeader, StatusBadge } from './components/shared';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useAppStore } from './store/useAppStore';
import { canAccessRoute, getRoleLabel, ROLE_PERMISSIONS, type UserRole } from './lib/rbac';
import { hydrateFromApi } from './lib/api/hydrate';
import { login as apiLogin, sendChat } from './lib/api/services';
import { clearAuthToken, getAuthToken, setAuthToken } from './lib/api/config';
import { mapUser } from './lib/api/mappers';

// ============================================
// TYPES & INTERFACES
// ============================================

// Most types are now imported from the store

interface AICommand {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  action: () => void;
}

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay';
  label: string;
  description: string;
  icon: LucideIcon;
  config?: Record<string, unknown>;
}



// ============================================
// AI ASSISTANT COMPONENT
// ============================================

// Offline fallback for the drawer — signed-in users get the API answer instead.
const cannedAssistantReply = (text: string): string => {
  const responses: Record<string, string> = {
    'booking': 'I can help you create a new booking. Would you like me to open the booking form or search for available rooms first?',
    'report': 'I can generate various reports. Which type would you like? Financial, occupancy, guest analysis, or custom?',
    'analytics': 'Live analytics are unavailable right now. When connected, I can show occupancy, revenue, and booking trends for your property.',
    'automation': 'I can help you set up automated workflows. What would you like to automate? Check-in emails, payment reminders, or review requests?',
    'help': 'I can assist with: creating bookings, managing guests, generating reports, analyzing data, setting up automations, and answering questions about your PMS.',
  };

  const lowerInput = text.toLowerCase();
  let response = responses['help'];

  Object.keys(responses).forEach(key => {
    if (lowerInput.includes(key)) response = responses[key];
  });

  return response;
};

const respondToAssistant = async (text: string): Promise<string> => {
  if (getAuthToken()) {
    try {
      const res = await sendChat(text);
      if (res.reply) return res.reply;
    } catch {
      // signed in but the call failed — canned reply keeps the drawer usable
    }
  }
  return cannedAssistantReply(text);
};

const AIAssistant = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hello! I\'m your AI assistant powered by NEXUS Intelligence. I can help you manage bookings, analyze data, generate reports, and automate workflows. What would you like to do?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const text = input;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsTyping(true);

    respondToAssistant(text).then(reply => {
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setIsTyping(false);
    });
  };

  const quickActions = [
    { label: 'New Booking', icon: Calendar },
    { label: 'Generate Report', icon: FileText },
    { label: 'View Analytics', icon: BarChart3 },
    { label: 'Create Workflow', icon: Workflow },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 400 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 400 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-[400px] bg-card border-l border-border z-[900] flex flex-col shadow-overlay"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">NEXUS AI</h3>
                <p className="text-xs text-muted-foreground">AI Assistant</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] p-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-br-md' 
                    : 'bg-muted text-foreground rounded-bl-md'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted p-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2 border-t border-border">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => setInput(action.label)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-full text-xs whitespace-nowrap transition-colors"
                >
                  <action.icon className="w-3 h-3" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={handleSend}
                className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <Paperclip className="w-3 h-3" />
                  Attach
                </button>
                <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <Mic className="w-3 h-3" />
                  Voice
                </button>
              </div>
              <span>Press Enter to send</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================
// VISUAL BUILDER COMPONENT (Builder.io/Webflow Inspired)
// ============================================

const VisualBuilder = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [canvasItems, setCanvasItems] = useState<{ id: string; type: string; x: number; y: number }[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [selectedCanvasItem, setSelectedCanvasItem] = useState<string | null>(null);

  const components = [
    { id: 'header', name: 'Header', icon: LayoutDashboard, category: 'Layout' },
    { id: 'text', name: 'Text Block', icon: Type, category: 'Content' },
    { id: 'image', name: 'Image', icon: ImageIcon, category: 'Content' },
    { id: 'button', name: 'Button', icon: CheckCircle, category: 'UI' },
    { id: 'card', name: 'Card', icon: CreditCard, category: 'UI' },
    { id: 'form', name: 'Form', icon: FileText, category: 'Input' },
    { id: 'chart', name: 'Chart', icon: BarChart3, category: 'Data' },
    { id: 'table', name: 'Table', icon: AlignLeft, category: 'Data' },
    { id: 'metric', name: 'Metric Card', icon: Activity, category: 'Data' },
    { id: 'calendar', name: 'Calendar', icon: Calendar, category: 'Widgets' },
  ];

  const handleDragStart = (componentId: string) => {
    setDraggedItem(componentId);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItem) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCanvasItems(prev => [...prev, { id: `${draggedItem}-${Date.now()}`, type: draggedItem, x, y }]);
      setDraggedItem(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[800]"
        >
          {/* Toolbar */}
          <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                <span className="font-semibold">Visual Builder</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Undo" onClick={() => { setCanvasItems(prev => prev.slice(0, -1)); toast.success('Undo: last component removed'); }}>
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Preview" onClick={() => toast.info(`Preview: ${canvasItems.length} components on canvas`)}>
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Save" onClick={() => { localStorage.setItem('nexus_visual_builder', JSON.stringify(canvasItems)); toast.success(`Layout saved — ${canvasItems.length} components`); }}>
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { localStorage.setItem('nexus_visual_builder', JSON.stringify(canvasItems)); toast.success('Layout published successfully!'); onClose(); }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Publish
              </button>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex h-[calc(100vh-56px)]">
            {/* Component Sidebar */}
            <div className="w-64 border-r border-border bg-card p-4 overflow-y-auto">
              <h4 className="text-sm font-medium mb-4 text-muted-foreground">Components</h4>
              <div className="space-y-2">
                {['Layout', 'Content', 'UI', 'Input', 'Data', 'Widgets'].map(category => (
                  <div key={category}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">{category}</p>
                    <div className="space-y-1">
                      {components.filter(c => c.category === category).map(component => (
                        <div
                          key={component.id}
                          draggable
                          onDragStart={() => handleDragStart(component.id)}
                          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted cursor-grab active:cursor-grabbing transition-colors"
                        >
                          <component.icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{component.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas */}
            <div 
              className="flex-1 bg-muted/30 relative overflow-auto"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-muted-foreground text-sm">Drag components here to build your interface</p>
              </div>
              {canvasItems.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{ position: 'absolute', left: item.x, top: item.y }}
                  className={`bg-card border-2 rounded-lg p-4 shadow-lg pointer-events-auto cursor-pointer ${selectedCanvasItem === item.id ? 'border-primary' : 'border-border'}`}
                  onClick={() => setSelectedCanvasItem(item.id)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium capitalize">{item.type}</span>
                    <button className="ml-auto p-1 hover:bg-red-500/20 rounded text-muted-foreground hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); setCanvasItems(prev => prev.filter(ci => ci.id !== item.id)); if (selectedCanvasItem === item.id) setSelectedCanvasItem(null); }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="w-48 h-24 bg-muted rounded flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">{item.type} Component</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Properties Panel */}
            <div className="w-72 border-l border-border bg-card p-4">
              <h4 className="text-sm font-medium mb-4 text-muted-foreground">Properties</h4>
              {selectedCanvasItem ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Component</label>
                    <p className="text-sm font-medium capitalize">{canvasItems.find(c => c.id === selectedCanvasItem)?.type}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Label</label>
                    <input type="text" className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" placeholder="Component label" defaultValue={canvasItems.find(c => c.id === selectedCanvasItem)?.type} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Style</label>
                    <select className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm">
                      <option>Default</option>
                      <option>Primary</option>
                      <option>Secondary</option>
                      <option>Ghost</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Size</label>
                    <div className="flex gap-2">
                      {['SM', 'MD', 'LG'].map(size => (
                        <button key={size} className="flex-1 py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-medium transition-colors">
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={() => { setCanvasItems(prev => prev.filter(ci => ci.id !== selectedCanvasItem)); setSelectedCanvasItem(null); }}
                    className="w-full py-2 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
                  >
                    Delete Component
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a component to edit its properties</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================
// WORKFLOW BUILDER (Loquix/Uncodixfy Inspired)
// ============================================

const WorkflowBuilder = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { addWorkflow, addAuditLog } = useAppStore();
  const [workflowName] = useState('New Booking VIP Treatment');
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: '1', type: 'trigger', label: 'New Booking', description: 'Triggered when a new booking is created', icon: Calendar },
    { id: '2', type: 'action', label: 'Send Email', description: 'Send confirmation email to guest', icon: Mail },
    { id: '3', type: 'condition', label: 'VIP Check', description: 'Check if guest is VIP', icon: Star },
    { id: '4', type: 'action', label: 'Upgrade Room', description: 'Auto-upgrade to best available room', icon: ArrowRight },
  ]);
  const [testResult, setTestResult] = useState<string | null>(null);

  const nodeTypes: Record<string, { color: string; icon: React.ElementType }> = {
    trigger: { color: 'bg-emerald-500/20 border-emerald-500/50', icon: Zap },
    action: { color: 'bg-blue-500/20 border-blue-500/50', icon: Play },
    condition: { color: 'bg-amber-500/20 border-amber-500/50', icon: GitBranch },
    delay: { color: 'bg-purple-500/20 border-purple-500/50', icon: Clock },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-4 bg-card border border-border rounded-2xl z-[700] shadow-overlay overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="h-16 border-b border-border flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Workflow className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Automation Workflow</h3>
                <p className="text-xs text-muted-foreground">New Booking VIP Treatment</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { 
                  setTestResult('running');
                  setTimeout(() => {
                    setTestResult('passed');
                    toast.success(`Workflow test passed — ${nodes.length} nodes executed successfully`);
                  }, 1500);
                }}
                className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
              >
                {testResult === 'running' ? 'Testing...' : testResult === 'passed' ? 'Test Passed' : 'Test'}
              </button>
              <button 
                onClick={() => {
                  const wf = {
                    id: `WF-${Date.now()}`,
                    name: workflowName,
                    description: `Automation: ${nodes.map(n => n.label).join(' → ')}`,
                    trigger: nodes.find(n => n.type === 'trigger')?.label || 'Manual',
                    actions: nodes.filter(n => n.type !== 'trigger').map(n => n.label),
                    steps: nodes.length,
                    status: 'active' as const,
                    lastRun: new Date().toISOString(),
                    runs: 0,
                  };
                  addWorkflow(wf);
                  addAuditLog({ id: 'AL' + Date.now(), action: 'create', entityType: 'workflow', entityId: wf.id, entityName: wf.name, userId: 'system', userName: 'System', userRole: 'Admin', details: `Created workflow: ${wf.name}`, timestamp: new Date().toISOString() });
                  toast.success(`Workflow "${workflowName}" saved and activated!`);
                  onClose();
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Save &amp; Activate
              </button>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors ml-2">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex">
            {/* Node Palette */}
            <div className="w-56 border-r border-border p-4 bg-muted/30">
              <h4 className="text-sm font-medium mb-4">Add Node</h4>
              <div className="space-y-2">
                {[
                  { type: 'trigger', label: 'Trigger', icon: Zap, desc: 'Start workflow' },
                  { type: 'action', label: 'Action', icon: Play, desc: 'Perform action' },
                  { type: 'condition', label: 'Condition', icon: GitBranch, desc: 'Branch logic' },
                  { type: 'delay', label: 'Delay', icon: Clock, desc: 'Wait period' },
                ].map(item => (
                  <div
                    key={item.type}
                    onClick={() => {
                      const newNode: WorkflowNode = {
                        id: String(Date.now()),
                        type: item.type as WorkflowNode['type'],
                        label: `New ${item.label}`,
                        description: `Configure this ${item.label.toLowerCase()} step`,
                        icon: item.icon,
                      };
                      setNodes(prev => [...prev, newNode]);
                      toast.success(`${item.label} node added`);
                    }}
                    className="p-3 bg-card border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 bg-muted/30 p-8 relative overflow-auto">
              <div className="flex flex-col items-center gap-8">
                {nodes.map((node, index) => (
                  <div key={node.id} className="relative">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`w-72 p-4 rounded-xl border-2 ${nodeTypes[node.type].color} bg-card cursor-pointer hover:shadow-lg transition-shadow`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-background rounded-lg">
                          {(() => {
                            const IconComponent = node.icon;
                            return <IconComponent className="w-5 h-5" />;
                          })()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{node.label}</span>
                            <button 
                              className="p-1 hover:bg-background rounded transition-colors"
                              onClick={() => { setNodes(prev => prev.filter(n => n.id !== node.id)); toast.info(`Removed "${node.label}" node`); }}
                              title="Remove node"
                            >
                              <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{node.description}</p>
                        </div>
                      </div>
                    </motion.div>
                    {index < nodes.length - 1 && (
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-8 w-0.5 h-8 bg-border" />
                    )}
                  </div>
                ))}
                <button 
                  onClick={() => {
                    const newNode: WorkflowNode = {
                      id: String(Date.now()),
                      type: 'action',
                      label: 'New Action',
                      description: 'Configure this action step',
                      icon: Play,
                    };
                    setNodes(prev => [...prev, newNode]);
                    toast.success('Action node added');
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Add Node</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================
// 3D VISUALIZATION COMPONENT
// ============================================

const Property3D = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { rooms } = useAppStore();
  const available = rooms.filter(r => r.status === 'available').length;
  const occupied = rooms.filter(r => r.status === 'occupied').length;
  const maintenance = rooms.filter(r => r.status === 'maintenance').length;
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[600] flex items-center justify-center p-8"
        >
          <div className="w-full max-w-5xl h-[80vh] bg-card border border-border rounded-2xl overflow-hidden shadow-overlay" role="dialog" aria-modal="true" aria-label="3D Property View">
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <Box className="w-5 h-5 text-primary" />
                <span className="font-semibold">3D Property View</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition-colors">Floor 1</button>
                <button className="px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition-colors">Floor 2</button>
                <button className="px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition-colors">Floor 3</button>
                <div className="h-6 w-px bg-border mx-2" />
                <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* 3D Canvas Placeholder */}
            <div className="flex-1 h-[calc(80vh-56px)] bg-gradient-to-br from-muted/50 to-muted relative flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 mx-auto mb-6 relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-2xl rotate-45 animate-pulse" />
                  <div className="absolute inset-4 bg-primary/30 rounded-xl rotate-12" />
                  <div className="absolute inset-8 bg-primary/40 rounded-lg" />
                  <Box className="absolute inset-0 m-auto w-12 h-12 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">3D Visualization</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Interactive 3D property model with real-time room status, 
                  IoT device integration, and guest location tracking.
                </p>
                  <div className="flex gap-4 justify-center mt-6">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    Available: {available}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    Occupied: {occupied}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                    Maintenance: {maintenance}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================

// Offline demo credentials — used only when the API login is unreachable/fails.
const DEMO_CREDENTIALS = [
  { email: 'admin@nexus.com', password: 'admin123' },
  { email: 'manager@nexus.com', password: 'manager123' },
  { email: 'front@nexus.com', password: 'front123' },
];

// Guards against React StrictMode double-invoking the mount effect.
let hydrationStarted = false;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('nexus_logged_in') === 'true';
  });
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [visualBuilderOpen, setVisualBuilderOpen] = useState(false);
  const [workflowBuilderOpen, setWorkflowBuilderOpen] = useState(false);
  const [property3DOpen, setProperty3DOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('nexus_theme') !== 'light';
  });
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  
  const { properties, user } = useAppStore();
  const userInitials = user?.name
    ? user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const userRoleLabel = user
    ? (ROLE_PERMISSIONS[user.role as UserRole] ? getRoleLabel(user.role as UserRole) : user.role)
    : '';

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('light', !darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('nexus_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Login handler — API-first; demo credentials fall back to offline mode.
  const handleLogin = async (email: string, password: string): Promise<void> => {
    try {
      const { token, user } = await apiLogin(email, password);
      setAuthToken(token);
      useAppStore.getState().setUser(mapUser(user));
      localStorage.setItem('nexus_logged_in', 'true');
      setIsLoggedIn(true);
      void hydrateFromApi().then((result) => {
        if (!result.ok) console.warn('Hydration completed with failures:', result.failed);
      });
      toast.success('Welcome back to NEXUS PMS!');
    } catch (error) {
      const demoMatch = DEMO_CREDENTIALS.find((c) => c.email === email && c.password === password);
      if (!demoMatch) {
        throw error instanceof Error ? error : new Error('Login failed.');
      }
      const offlineRole = email.startsWith('admin') ? 'admin' : email.startsWith('manager') ? 'manager' : 'front_desk';
      const offlineName = email.startsWith('admin') ? 'Admin User' : email.startsWith('manager') ? 'Manager User' : 'Front Desk';
      useAppStore.getState().setUser({
        id: '0',
        name: offlineName,
        email,
        role: offlineRole,
        department: '',
        phone: '',
        hireDate: '',
        status: 'active',
      });
      localStorage.setItem('nexus_logged_in', 'true');
      setIsLoggedIn(true);
      toast.success('Welcome back to NEXUS PMS! (offline demo mode)');
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('nexus_logged_in');
    clearAuthToken();
    useAppStore.getState().setUser(null);
    setIsLoggedIn(false);
    setActivePage('dashboard');
    toast.success('Logged out successfully');
  };

  // Re-hydrate from the API on reload when a session is already active.
  useEffect(() => {
    if (localStorage.getItem('nexus_logged_in') !== 'true' || !getAuthToken()) return;
    if (hydrationStarted) return;
    hydrationStarted = true;
    void hydrateFromApi().then((result) => {
      if (!result.ok) console.warn('Hydration completed with failures:', result.failed);
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setCommandPaletteOpen(false);
        setMobileMenuOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setAiAssistantOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setVisualBuilderOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigationSections = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'D' },
      ],
    },
    {
      label: 'Front Desk',
      items: [
        { id: 'bookings', label: 'Bookings', icon: Calendar, shortcut: 'B' },
        { id: 'guests', label: 'Guests', icon: Users, shortcut: 'G' },
        { id: 'checkin', label: 'Check-In/Out', icon: LogIn, shortcut: 'C' },
        { id: 'rooms', label: 'Rooms', icon: DoorOpen, shortcut: 'R' },
        { id: 'rates', label: 'Rates', icon: Tag, shortcut: 'T' },
      ],
    },
    {
      label: 'Properties',
      items: [
        { id: 'properties', label: 'Properties', icon: Building2, shortcut: 'P' },
        { id: 'facility', label: 'Facility', icon: Zap, shortcut: '' },
        { id: 'inventory', label: 'Inventory & POS', icon: Package, shortcut: '' },
      ],
    },
    {
      label: 'Finance',
      items: [
        { id: 'finances', label: 'Finances', icon: Wallet, shortcut: 'F' },
        { id: 'analytics', label: 'Analytics', icon: BarChart3, shortcut: 'A' },
        { id: 'reports', label: 'Reports', icon: FileText, shortcut: 'E' },
        { id: 'forecast', label: 'Forecasting', icon: TrendingUp, shortcut: 'O' },
      ],
    },
    {
      label: 'Staff & HR',
      items: [
        { id: 'staff', label: 'Staff & RFID', icon: BadgeCheck, shortcut: 'S' },
        { id: 'employee-profiles', label: 'Employee Profiles', icon: Users, shortcut: '' },
        { id: 'staff-schedule', label: 'Staff Schedule', icon: Calendar, shortcut: '' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { id: 'tickets', label: 'Tickets', icon: Ticket, shortcut: '' },
        { id: 'messaging', label: 'Messaging', icon: MessageSquare, shortcut: '' },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { id: 'ai-enhancements', label: 'AI Enhancements', icon: Brain, shortcut: '' },
      ],
    },
    {
      label: 'System',
      items: [
        { id: 'admin', label: 'Admin', icon: Settings, shortcut: '' },
        { id: 'integrations', label: 'Integrations', icon: Plug, shortcut: 'I' },
        { id: 'settings', label: 'Settings', icon: Settings, shortcut: ',' },
      ],
    },
  ];

  // Flat list for keyboard shortcuts and page routing
  const navigationItems = navigationSections.flatMap(s => s.items);

  const aiCommands: AICommand[] = [
    { id: '1', label: 'Generate Booking Report', icon: <FileText className="w-4 h-4" />, description: 'Create a summary of recent bookings', action: () => { setActivePage('reports'); toast.success('Navigated to Reports — generate a booking report there'); } },
    { id: '2', label: 'Analyze Revenue Trends', icon: <TrendingUp className="w-4 h-4" />, description: 'View AI-powered revenue insights', action: () => { setActivePage('forecast'); toast.success('Navigated to Forecasting — revenue analysis loaded'); } },
    { id: '3', label: 'Optimize Room Rates', icon: <Tag className="w-4 h-4" />, description: 'Get rate recommendations', action: () => { setActivePage('rates'); toast.success('Navigated to Rate Management — optimize rates'); } },
    { id: '4', label: 'Create Automation', icon: <Workflow className="w-4 h-4" />, description: 'Build a new workflow', action: () => setWorkflowBuilderOpen(true) },
  ];

  const DashboardView = () => {
    const { bookings, rooms, guests, updateRoom, addAuditLog } = useAppStore();
    
    // Filter by selected property
    const filteredRooms = selectedPropertyId === 'all' 
      ? rooms 
      : rooms.filter(r => r.propertyId === selectedPropertyId);
    const filteredBookings = selectedPropertyId === 'all'
      ? bookings
      : bookings.filter(b => b.propertyId === selectedPropertyId);
    
    const currentProperty = selectedPropertyId === 'all' 
      ? null 
      : properties.find((p) => p.id === selectedPropertyId);
    
    const today = new Date().toISOString().split('T')[0];
    const activeBookings = filteredBookings.filter(b => b.status === 'checked-in' || b.status === 'confirmed').length;
    const todayArrivals = filteredBookings.filter(b => b.checkIn === today && b.status === 'confirmed').length;
    const todayDepartures = filteredBookings.filter(b => b.checkOut === today && b.status === 'checked-in').length;
    const totalRevenue = filteredBookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + b.amount, 0);
    const availableRooms = filteredRooms.filter(r => r.status === 'available').length;
    const occupiedRooms = filteredRooms.filter(r => r.status === 'occupied').length;
    const totalRooms = filteredRooms.length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    const totalGuests = guests.length;
    const totalProperties = properties.length;

    // --- Compute chart data from store ---
    // Revenue & Occupancy: group bookings by week
    const revenueData = (() => {
      const now = new Date();
      const weeks: { name: string; occupancy: number; revenue: number }[] = [];
      for (let w = 3; w >= 0; w--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() - w * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 7);
        const startStr = weekStart.toISOString().split('T')[0];
        const endStr = weekEnd.toISOString().split('T')[0];
        const weekBookings = filteredBookings.filter(b => b.checkIn >= startStr && b.checkIn <= endStr);
        const weekRevenue = weekBookings.filter(b => b.paymentStatus === 'paid' || b.paymentStatus === 'partial').reduce((s, b) => s + b.amount, 0);
        const weekOccupied = weekBookings.filter(b => b.status === 'checked-in' || b.status === 'confirmed').length;
        const occ = totalRooms > 0 ? Math.round((weekOccupied / totalRooms) * 100) : 0;
        weeks.push({ name: `Week ${4 - w}`, occupancy: occ, revenue: Math.round(weekRevenue / 1000) });
      }
      return weeks;
    })();

    // Revenue by Source: aggregate from booking source field
    const sourceColors: Record<string, string> = {
      'Booking.com': '#c9a87c', 'Direct': '#34c759', 'Expedia': '#d4a72c',
      'Airbnb': '#d64545', 'Walk-in': '#8b5cf6', 'Phone': '#06b6d4',
      'Corporate': '#f59e0b', 'Travel Agent': '#ec4899', 'Other': '#8e8e93',
    };
    const sourceData = (() => {
      const sourceMap: Record<string, number> = {};
      filteredBookings.forEach(b => {
        const src = b.source || 'Other';
        sourceMap[src] = (sourceMap[src] || 0) + b.amount;
      });
      return Object.entries(sourceMap)
        .map(([name, value]) => ({ name, value, color: sourceColors[name] || '#8e8e93' }))
        .sort((a, b) => b.value - a.value);
    })();

    // Apply Recommendation handler — raise premium room rates by 10%
    const handleApplyRecommendation = () => {
      const premiumTypes = ['Suite', 'Penthouse', 'Presidential', 'Executive', 'Deluxe'];
      let count = 0;
      filteredRooms.forEach(room => {
        if (premiumTypes.some(t => room.type.toLowerCase().includes(t.toLowerCase()))) {
          const newPrice = Math.round(room.price * 1.10);
          updateRoom(room.id, { price: newPrice });
          count++;
        }
      });
      addAuditLog({ id: 'AL' + Date.now(), action: 'rate_adjustment', entityType: 'room', entityId: 'bulk', entityName: 'Premium room rates', userId: 'system', userName: 'System', userRole: 'Admin', details: `AI recommendation applied: raised ${count} premium room rates by 10%`, timestamp: new Date().toISOString() });
      toast.success(`Rate adjustment applied to ${count} premium rooms (+10%)`);
    };
    
    return (
    <div className="space-y-4">
      {/* Dashboard Header */}
      <PageHeader
        title="Dashboard"
        subtitle={currentProperty ? currentProperty.name : 'All Properties Overview'}
        meta={<p>{new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>}
      />

      {/* Property Header */}
      {currentProperty && (
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-4 h-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{currentProperty.name}</h3>
              <p className="text-xs text-muted-foreground">{currentProperty.address}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          label="Occupancy Rate" 
          value={`${occupancyRate}%`} 
          delta={`${availableRooms} available of ${totalRooms} rooms`} 
          deltaType={occupancyRate > 70 ? 'up' : 'neutral'} 
          icon={Activity} 
        />
        <MetricCard 
          label="Total Revenue" 
          value={`R${totalRevenue.toLocaleString()}`} 
          delta={`${filteredBookings.length} bookings`} 
          deltaType="up" 
          icon={Wallet} 
        />
        <MetricCard 
          label="Active Bookings" 
          value={String(activeBookings)} 
          delta={`${todayArrivals} arrivals, ${todayDepartures} departures`} 
          deltaType="up" 
          icon={Calendar} 
        />
        <MetricCard 
          label={selectedPropertyId === 'all' ? "Total Properties" : "Rooms"} 
          value={selectedPropertyId === 'all' ? String(totalProperties) : String(totalRooms)} 
          delta={selectedPropertyId === 'all' ? `${totalGuests} guests` : `${occupiedRooms} occupied`} 
          deltaType="up" 
          icon={selectedPropertyId === 'all' ? Building2 : Users} 
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Revenue & Occupancy" className="lg:col-span-2" action={<button className="text-xs text-primary hover:underline" onClick={() => { const csv = 'Week,Occupancy %,Revenue (R1000s)\n' + revenueData.map(d => `${d.name},${d.occupancy},${d.revenue}`).join('\n'); const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'revenue_occupancy.csv'; a.click(); URL.revokeObjectURL(url); toast.success('Revenue data exported'); }}>Export</button>}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-gold)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-gold)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--accent-gold)" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue (R1000s)" />
                <Area type="monotone" dataKey="occupancy" stroke="var(--accent-green)" fillOpacity={0.1} fill="var(--accent-green)" name="Occupancy %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Revenue by Source">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Recent Bookings */}
      <Panel 
        title="Recent Bookings" 
        action={<button className="text-xs text-primary hover:underline" onClick={() => setActivePage('bookings')}>View All</button>}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Guest</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Check-in</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Check-out</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBookings.slice(0, 5).map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium text-primary">#{booking.id}</TableCell>
                <TableCell>{booking.guestName}</TableCell>
                <TableCell>{booking.roomNumber}</TableCell>
                <TableCell>{booking.checkIn}</TableCell>
                <TableCell>{booking.checkOut}</TableCell>
                <TableCell className="font-medium">R{booking.amount.toLocaleString()}</TableCell>
                <TableCell>
                  <StatusBadge status={booking.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {/* AI Insights */}
      <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden">
        <div className="flex items-start gap-3 relative">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-0.5">AI-Powered Insights</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Based on your data patterns, we predict a 15% increase in bookings next week. 
              Consider raising rates by 8-10% for premium rooms to maximize revenue.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={handleApplyRecommendation}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                Apply Recommendation
              </button>
              <button 
                onClick={() => setActivePage('ai-enhancements')}
                className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


  const renderPage = () => {
    // Keyboard shortcuts and stale links can land on a denied page — fall back.
    if (!canAccessRoute(activePage)) return <DashboardView />;
    switch (activePage) {
      case 'dashboard': return <DashboardView />;
      case 'bookings': return <BookingManagement />;
      case 'guests': return <Guests />;
      case 'properties': return <PropertyManagement />;
      case 'rooms': return <Rooms />;
      case 'analytics': return <ForecastingPage />;
      case 'integrations': return <IntegrationsPage />;
      case 'settings': return <SettingsPage />;
      case 'employee-profiles': return <EmployeeProfiles />;
      case 'messaging': return <Messaging />;
      case 'staff-schedule': return <StaffScheduling />;
      case 'finances': return <FinancialManagement />;
      case 'inventory': return <InventoryManagement />;
      case 'facility': return <FacilityManagement />;
      case 'ai-enhancements': return <AIEnhancements />;
      case 'tickets': return <TicketManagement />;
      case 'admin': return <AdminPanel />;
      case 'staff': return <RfidManagement />;
      case 'checkin': return <CheckInOut />;
      case 'rates': return <RateManagement />;
      case 'reports': return <ReportsPage />;
      case 'forecast': return <ForecastingPage />;
      // A stale or unknown page key lands on the dashboard instead of a dead end.
      default: return <DashboardView />;
    }
  };

  // Show login page if not logged in
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
        <div className="min-h-screen bg-background text-foreground">
          {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside
          className={`fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border shadow-lg z-50 transition-[transform,width] duration-300 flex flex-col ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } ${sidebarCollapsed ? 'lg:w-[72px]' : 'w-72'}`}
        >
          {/* Brand */}
          <div className="h-14 flex items-center px-4 border-b border-sidebar-border flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 hidden lg:block">
                  <h1 className="font-bold text-sm tracking-tight text-foreground">NEXUS</h1>
                  <p className="text-[9px] text-muted-foreground tracking-widest uppercase">PMS</p>
                </div>
              )}
            </div>
            <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="lg:hidden ml-auto p-1.5 hover:bg-muted rounded-lg">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Navigation */}
          <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin">
            {navigationSections.map((section) => {
              const visibleItems = section.items.filter(item => canAccessRoute(item.id));
              if (visibleItems.length === 0) return null;
              return (
              <div key={section.label}>
                {!sidebarCollapsed && (
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 px-2 mb-1">{section.label}</p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setActivePage(item.id); setMobileMenuOpen(false); }}
                      aria-label={item.label}
                      aria-current={activePage === item.id ? 'page' : undefined}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activePage === item.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      {!sidebarCollapsed && (
                        <span className="flex-1 text-left truncate">{item.label}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              );
            })}
          </nav>

          {/* User Footer */}
          <div className="flex-shrink-0 p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-semibold flex-shrink-0 text-xs text-primary" aria-hidden="true">
                {userInitials}
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">{user?.name ?? 'Signed out'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{userRoleLabel}</p>
                  </div>
                  <button onClick={handleLogout} aria-label="Log out" title="Log out" className="p-1.5 hover:bg-destructive/15 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`transition-[margin-left] duration-300 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-72'}`}>
          {/* Header */}
          <header className="h-14 border-b border-border/60 flex items-center justify-between px-4 lg:px-6 sticky top-0 bg-background z-40">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} aria-label="Open menu" className="lg:hidden p-1.5 hover:bg-muted rounded-lg transition-colors">
                <Menu className="w-4 h-4" aria-hidden="true" />
              </button>
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label="Toggle sidebar" title="Toggle sidebar" className="hidden lg:flex p-1.5 hover:bg-muted rounded-lg transition-colors">
                <Menu className="w-4 h-4" aria-hidden="true" />
              </button>
              <h2 className="font-semibold capitalize text-sm hidden sm:block">{activePage.replace('-', ' ')}</h2>
            </div>

            <div className="flex items-center gap-2">
              {/* Property Selector */}
              <div className="relative">
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  aria-label="Select property"
                  className="appearance-none pl-2.5 pr-7 py-1.5 bg-muted border border-border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
                >
                  <option value="all">{properties.length} Properties</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Building2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" aria-hidden="true" />
              </div>

              {/* Search */}
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Open search"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden md:inline">Search</span>
                <kbd className="hidden lg:inline px-1 py-0.5 bg-background/30 rounded text-[9px]">K</kbd>
              </button>

              {/* Theme Toggle */}
              <button onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title={darkMode ? 'Light mode' : 'Dark mode'}>
                {darkMode ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
              </button>

              {/* Notifications */}
              <NotificationBell />

              {/* Mobile logout */}
              <div className="lg:hidden">
                <button onClick={handleLogout} aria-label="Log out" className="p-1.5 hover:bg-destructive/15 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-4 md:p-6">
            {renderPage()}
          </div>
        </main>

        {/* Global Search */}
        <GlobalSearch 
          isOpen={searchOpen} 
          onClose={() => setSearchOpen(false)} 
          onNavigate={(page) => setActivePage(page)}
        />

      {/* Command Palette */}
      <AnimatePresence>
        {commandPaletteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[1000] flex items-start justify-center pt-32"
            onClick={() => setCommandPaletteOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-xl bg-card border border-border rounded-xl shadow-overlay overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Search pages, bookings, guests..."
                    aria-label="Search commands"
                    autoFocus
                    className="flex-1 bg-transparent text-lg focus:outline-none"
                  />
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">ESC</kbd>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                <p className="text-xs font-medium text-muted-foreground px-3 py-2">PAGES</p>
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActivePage(item.id);
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <span className="text-xs text-muted-foreground">⌘{item.shortcut}</span>
                  </button>
                ))}
                <p className="text-xs font-medium text-muted-foreground px-3 py-2 mt-2">AI COMMANDS</p>
                {aiCommands.map((cmd) => (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.action();
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    {cmd.icon}
                    <div className="flex-1 text-left">
                      <p className="text-sm">{cmd.label}</p>
                      <p className="text-xs text-muted-foreground">{cmd.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Assistant */}
      <AIAssistant isOpen={aiAssistantOpen} onClose={() => setAiAssistantOpen(false)} />

      {/* Visual Builder */}
      <VisualBuilder isOpen={visualBuilderOpen} onClose={() => setVisualBuilderOpen(false)} />

      {/* Workflow Builder */}
      <WorkflowBuilder isOpen={workflowBuilderOpen} onClose={() => setWorkflowBuilderOpen(false)} />

      {/* 3D Property View */}
      <Property3D isOpen={property3DOpen} onClose={() => setProperty3DOpen(false)} />
        </div>
    </ErrorBoundary>
  );
}

export default App;
