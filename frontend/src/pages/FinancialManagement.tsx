import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, DollarSign, Receipt, Download, Plus,
  Search, CheckCircle, Clock, CreditCard, ArrowUpRight, ArrowDownRight,
  BarChart3, Building2, Eye, X, Save, Printer, Edit2, Trash2,
  Banknote, CreditCard as CardIcon, Smartphone, Building, History,
  Calculator, FileText, AlertTriangle, Check, XCircle, RefreshCw,
  ChevronDown, Filter
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import type { Expense, Invoice, Payment } from '../store/useAppStore';
import { exportToCsv } from '../utils/exportCsv';
import toastHelpers from '../lib/toast';
import { newId } from '../utils/id';

/* ─── Constants ─── */
const INVOICE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  pending: { bg: 'bg-warning/15', text: 'text-warning' },
  sent: { bg: 'bg-info/15', text: 'text-info' },
  paid: { bg: 'bg-success/15', text: 'text-success' },
  partial: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  overdue: { bg: 'bg-danger/15', text: 'text-danger' },
  cancelled: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  refunded: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

const EXPENSE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-warning/15', text: 'text-warning' },
  approved: { bg: 'bg-success/15', text: 'text-success' },
  rejected: { bg: 'bg-danger/15', text: 'text-danger' },
};

const EXPENSE_CATEGORIES = ['Supplies', 'Maintenance', 'Food & Beverage', 'Utilities', 'Marketing', 'Staff', 'Equipment', 'Other'];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Credit/Debit Card', icon: CardIcon },
  { value: 'eft', label: 'EFT Transfer', icon: Building },
  { value: 'wire_transfer', label: 'Wire Transfer', icon: Building2 },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
  { value: 'voucher', label: 'Voucher', icon: Receipt },
];

const PIE_COLORS = ['#c9a87c', '#34c759', '#007aff', '#ff9500', '#af52de', '#ff2d55', '#5ac8fa', '#30b0c7'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ─── Helpers ─── */
const fmtR = (n: number) => `R${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getMonthKey = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
};

/* ─── Component ─── */
export default function FinancialManagement() {
  const { 
    expenses, addExpense, updateExpense, deleteExpense,
    invoices, addInvoice, updateInvoice, deleteInvoice,
    payments, addPayment, updatePayment,
    guests, bookings, properties,
    auditLogs, addAuditLog, taxConfigs, addTaxConfig, updateTaxConfig, deleteTaxConfig
  } = useAppStore();
  const me = useAppStore((s) => s.user);
  const role = useAppStore((s) => s.user?.role);
  const isAdmin = role === 'admin';
  
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payments' | 'expenses' | 'taxes' | 'audit'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('card');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'expense' | 'invoice'>('expense');
  const [showAddTax, setShowAddTax] = useState(false);
  const [editingTax, setEditingTax] = useState<typeof taxConfigs[0] | null>(null);
  
  const [expenseForm, setExpenseForm] = useState({
    category: 'Supplies',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    submittedBy: '',
    vendor: '',
    paymentMethod: 'cash',
    notes: '',
    propertyId: '',
  });

  const [taxForm, setTaxForm] = useState({
    name: '',
    rate: 0,
    type: 'vat' as 'vat' | 'sales_tax' | 'tourism_levy' | 'city_tax' | 'service_charge',
    active: true,
    included: false,
  });

  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    guestId: '',
    propertyId: '',
    type: 'booking' as Invoice['type'],
    dueDate: new Date(new Date().getTime() + 14 * 86400000).toISOString().split('T')[0],
    description: '',
    quantity: 1,
    unitPrice: 0,
    taxRate: 15,
    category: 'Room',
    discount: 0,
    notes: '',
  });

  const invoiceSubtotal = invoiceForm.quantity * invoiceForm.unitPrice;
  const invoiceTax = invoiceSubtotal * (invoiceForm.taxRate / 100);
  const invoiceTotal = Math.max(invoiceSubtotal + invoiceTax - invoiceForm.discount, 0);

  /* ─── Computed Stats ─── */
  const totalRevenue = useMemo(() => {
    return invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);
  }, [invoices]);
  
  const totalExpensesAmt = useMemo(() => {
    return expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const pendingExpensesAmt = useMemo(() => {
    return expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);
  
  const pendingPayments = useMemo(() => {
    return invoices.filter(i => i.status === 'pending' || i.status === 'sent' || i.status === 'partial')
      .reduce((sum, i) => sum + (i.total - (i.paidAmount || 0)), 0);
  }, [invoices]);
  
  const totalProfit = totalRevenue - totalExpensesAmt;

  // Trend percentages — compare current month vs previous month from actual invoices
  const trends = useMemo(() => {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const curRev = invoices.filter(i => i.status === 'paid' && getMonthKey(i.paidDate || i.issueDate) === curMonth).reduce((s, i) => s + i.total, 0);
    const prevRev = invoices.filter(i => i.status === 'paid' && getMonthKey(i.paidDate || i.issueDate) === prevMonth).reduce((s, i) => s + i.total, 0);
    const curExp = expenses.filter(e => e.status === 'approved' && getMonthKey(e.date) === curMonth).reduce((s, e) => s + e.amount, 0);
    const prevExp = expenses.filter(e => e.status === 'approved' && getMonthKey(e.date) === prevMonth).reduce((s, e) => s + e.amount, 0);

    const revTrend = prevRev > 0 ? ((curRev - prevRev) / prevRev * 100) : 0;
    const expTrend = prevExp > 0 ? ((curExp - prevExp) / prevExp * 100) : 0;
    const curProf = curRev - curExp;
    const prevProf = prevRev - prevExp;
    const profTrend = prevProf !== 0 ? ((curProf - prevProf) / Math.abs(prevProf) * 100) : 0;

    return { revenue: revTrend, expenses: expTrend, profit: profTrend };
  }, [invoices, expenses]);

  /* ─── Monthly Chart Data (from actual data) ─── */
  const monthlyData = useMemo(() => {
    const monthMap: Record<string, { revenue: number; expenses: number; bookings: number }> = {};
    
    // Revenue from paid invoices
    invoices.forEach(inv => {
      if (inv.status === 'paid') {
        const mk = getMonthKey(inv.paidDate || inv.issueDate);
        if (!monthMap[mk]) monthMap[mk] = { revenue: 0, expenses: 0, bookings: 0 };
        monthMap[mk].revenue += inv.total;
      }
    });

    // Expenses from approved expenses
    expenses.forEach(exp => {
      if (exp.status === 'approved') {
        const mk = getMonthKey(exp.date);
        if (!monthMap[mk]) monthMap[mk] = { revenue: 0, expenses: 0, bookings: 0 };
        monthMap[mk].expenses += exp.amount;
      }
    });

    // Also count from pending expenses for completeness
    expenses.forEach(exp => {
      if (exp.status === 'pending') {
        const mk = getMonthKey(exp.date);
        if (!monthMap[mk]) monthMap[mk] = { revenue: 0, expenses: 0, bookings: 0 };
        // Don't add pending to the chart — only approved
      }
    });

    // Bookings count per month
    bookings.forEach(b => {
      const mk = getMonthKey(b.checkIn);
      if (!monthMap[mk]) monthMap[mk] = { revenue: 0, expenses: 0, bookings: 0 };
      monthMap[mk].bookings += 1;
    });

    // Sort by month key and return last 12 months
    const sorted = Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, data]) => ({
        month: getMonthLabel(key),
        revenue: Math.round(data.revenue),
        expenses: Math.round(data.expenses),
        profit: Math.round(data.revenue - data.expenses),
        bookings: data.bookings,
      }));

    return sorted.length > 0 ? sorted : [{ month: 'No Data', revenue: 0, expenses: 0, profit: 0, bookings: 0 }];
  }, [invoices, expenses, bookings]);

  /* ─── Expense Breakdown (deterministic colors) ─── */
  const expenseBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    expenses.filter(e => e.status === 'approved').forEach(e => {
      breakdown[e.category] = (breakdown[e.category] || 0) + e.amount;
    });
    return Object.entries(breakdown).map(([name, value], idx) => ({
      name,
      value,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    }));
  }, [expenses]);

  /* ─── Revenue by Property ─── */
  const revenueByProperty = useMemo(() => {
    const propMap: Record<string, { name: string; revenue: number; invoiceCount: number }> = {};
    invoices.filter(i => i.status === 'paid').forEach(inv => {
      const prop = properties.find(p => p.id === inv.propertyId);
      const propName = prop?.name || 'Unknown Property';
      if (!propMap[inv.propertyId]) propMap[inv.propertyId] = { name: propName, revenue: 0, invoiceCount: 0 };
      propMap[inv.propertyId].revenue += inv.total;
      propMap[inv.propertyId].invoiceCount += 1;
    });
    return Object.entries(propMap).map(([, data], idx) => ({
      name: data.name,
      value: Math.round(data.revenue),
      invoices: data.invoiceCount,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    }));
  }, [invoices, properties]);

  /* ─── Payment Method Breakdown ─── */
  const paymentMethodBreakdown = useMemo(() => {
    const methodMap: Record<string, number> = {};
    payments.filter(p => p.status === 'completed').forEach(p => {
      const label = PAYMENT_METHODS.find(m => m.value === p.method)?.label || p.method;
      methodMap[label] = (methodMap[label] || 0) + p.amount;
    });
    return Object.entries(methodMap).map(([name, value], idx) => ({
      name,
      value: Math.round(value),
      color: PIE_COLORS[idx % PIE_COLORS.length],
    }));
  }, [payments]);

  /* ─── Filtered Data ─── */
  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (invoiceStatusFilter !== 'all') {
      result = result.filter(i => i.status === invoiceStatusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => 
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.guestName.toLowerCase().includes(q) ||
        i.guestEmail.toLowerCase().includes(q)
      );
    }
    return result;
  }, [invoices, searchQuery, invoiceStatusFilter]);

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (expenseStatusFilter !== 'all') {
      result = result.filter(e => e.status === expenseStatusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.submittedBy.toLowerCase().includes(q)
      );
    }
    return result;
  }, [expenses, searchQuery, expenseStatusFilter]);

  const filteredPayments = useMemo(() => {
    if (!searchQuery) return payments;
    const q = searchQuery.toLowerCase();
    return payments.filter(p => 
      p.paymentNumber.toLowerCase().includes(q) ||
      p.guestName.toLowerCase().includes(q) ||
      (p.reference?.toLowerCase().includes(q))
    );
  }, [payments, searchQuery]);

  const financialAuditLogs = useMemo(() => {
    return auditLogs
      .filter(l => ['invoice', 'payment', 'expense'].includes(l.entityType))
      .slice(0, 100);
  }, [auditLogs]);

  /* ─── Handlers ─── */
  const resetExpenseForm = () => {
    setExpenseForm({
      category: 'Supplies', amount: 0, description: '',
      date: new Date().toISOString().split('T')[0], submittedBy: '',
      vendor: '', paymentMethod: 'cash', notes: '', propertyId: '',
    });
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description.trim() || expenseForm.amount <= 0 || !expenseForm.submittedBy.trim()) {
      toastHelpers.error('Validation Error', 'Please fill description, amount, and submitted by');
      return;
    }
    const newExpense: Expense = {
      id: `EXP-${Date.now()}`,
      category: expenseForm.category,
      amount: expenseForm.amount,
      description: expenseForm.description,
      date: expenseForm.date,
      status: 'pending',
      submittedBy: expenseForm.submittedBy,
      vendor: expenseForm.vendor || undefined,
      paymentMethod: expenseForm.paymentMethod || undefined,
      notes: expenseForm.notes || undefined,
      propertyId: expenseForm.propertyId || undefined,
    };
    addExpense(newExpense);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'create',
      entityType: 'expense',
      entityId: newExpense.id,
      entityName: `Expense: ${expenseForm.description}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `New expense added: ${fmtR(expenseForm.amount)} for ${expenseForm.category}`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Expense added successfully');
    setShowAddExpense(false);
    resetExpenseForm();
  };

  const handleEditExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    if (!expenseForm.description.trim() || expenseForm.amount <= 0) {
      toastHelpers.error('Validation Error', 'Please fill description and amount');
      return;
    }
    updateExpense(editingExpense.id, {
      category: expenseForm.category,
      amount: expenseForm.amount,
      description: expenseForm.description,
      date: expenseForm.date,
      submittedBy: expenseForm.submittedBy,
      vendor: expenseForm.vendor || undefined,
      paymentMethod: expenseForm.paymentMethod || undefined,
      notes: expenseForm.notes || undefined,
      propertyId: expenseForm.propertyId || undefined,
    });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'expense',
      entityId: editingExpense.id,
      entityName: `Expense: ${expenseForm.description}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Expense updated: ${fmtR(expenseForm.amount)} for ${expenseForm.category}`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Expense updated');
    setShowEditExpense(false);
    setEditingExpense(null);
    resetExpenseForm();
  };

  const handleApproveExpense = (exp: Expense) => {
    updateExpense(exp.id, { status: 'approved', approvedBy: 'Current User', approvedAt: new Date().toISOString() });
    addAuditLog({
      id: newId('LOG'),
      action: 'update',
      entityType: 'expense',
      entityId: exp.id,
      entityName: `Expense: ${exp.description}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Expense approved: ${fmtR(exp.amount)}`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Expense approved');
  };

  const handleRejectExpense = (exp: Expense) => {
    updateExpense(exp.id, { status: 'rejected' });
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'update',
      entityType: 'expense',
      entityId: exp.id,
      entityName: `Expense: ${exp.description}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Expense rejected: ${fmtR(exp.amount)}`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Expense rejected');
  };

  const openEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseForm({
      category: exp.category,
      amount: exp.amount,
      description: exp.description,
      date: exp.date,
      submittedBy: exp.submittedBy,
      vendor: exp.vendor || '',
      paymentMethod: exp.paymentMethod || 'cash',
      notes: exp.notes || '',
      propertyId: exp.propertyId || '',
    });
    setShowEditExpense(true);
  };

  const handleDeleteConfirm = () => {
    if (!showDeleteConfirm) return;
    if (deleteType === 'expense') {
      const exp = expenses.find(e => e.id === showDeleteConfirm);
      deleteExpense(showDeleteConfirm);
      addAuditLog({
        id: `LOG-${Date.now()}`,
        action: 'delete',
        entityType: 'expense',
        entityId: showDeleteConfirm,
        entityName: `Expense: ${exp?.description || 'Unknown'}`,
        userId: me?.id ?? '',
        userName: me?.name ?? 'You',
        userRole: me?.role ?? '',
        details: `Expense deleted: ${exp ? fmtR(exp.amount) : 'N/A'}`,
        timestamp: new Date().toISOString(),
      });
      toastHelpers.success('Expense deleted');
    } else {
      const inv = invoices.find(i => i.id === showDeleteConfirm);
      deleteInvoice(showDeleteConfirm);
      addAuditLog({
        id: `LOG-${Date.now()}`,
        action: 'delete',
        entityType: 'invoice',
        entityId: showDeleteConfirm,
        entityName: `Invoice: ${inv?.invoiceNumber || 'Unknown'}`,
        userId: me?.id ?? '',
        userName: me?.name ?? 'You',
        userRole: me?.role ?? '',
        details: `Invoice deleted: ${inv ? fmtR(inv.total) : 'N/A'}`,
        timestamp: new Date().toISOString(),
      });
      toastHelpers.success('Invoice deleted');
    }
    setShowDeleteConfirm(null);
  };

  const handleMarkPaid = () => {
    if (!selectedInvoice) return;
    const amt = paymentAmount > 0 ? paymentAmount : selectedInvoice.total - (selectedInvoice.paidAmount || 0);
    const alreadyPaid = selectedInvoice.paidAmount || 0;
    const newPaid = alreadyPaid + amt;
    const isFullyPaid = newPaid >= selectedInvoice.total;
    
    updateInvoice(selectedInvoice.id, { 
      status: isFullyPaid ? 'paid' : 'partial', 
      paidDate: new Date().toISOString().split('T')[0],
      paidAmount: Math.min(newPaid, selectedInvoice.total),
      paymentMethod: paymentMethod,
    });
    
    const payment: Payment = {
      id: `PAY-${Date.now()}`,
      paymentNumber: `PAY-${String(payments.length + 1).padStart(4, '0')}`,
      invoiceId: selectedInvoice.id,
      guestId: selectedInvoice.guestId,
      guestName: selectedInvoice.guestName,
      propertyId: selectedInvoice.propertyId,
      amount: amt,
      currency: 'ZAR',
      method: paymentMethod as Payment['method'],
      status: 'completed',
      reference: paymentReference || undefined,
      transactionId: `TXN-${Date.now()}`,
      processedBy: 'Current User',
      processedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    addPayment(payment);
    
    addAuditLog({
      id: `LOG-${Date.now()}`,
      action: 'payment',
      entityType: 'payment',
      entityId: payment.id,
      entityName: `Payment ${payment.paymentNumber}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Payment received: ${fmtR(amt)} via ${paymentMethod} for invoice ${selectedInvoice.invoiceNumber}`,
      timestamp: new Date().toISOString(),
    });
    
    toastHelpers.success('Payment recorded', isFullyPaid ? 'Invoice fully paid' : `Partial payment: ${fmtR(amt)}`);
    setShowPaymentModal(false);
    setPaymentMethod('card');
    setPaymentAmount(0);
    setPaymentReference('');
  };

  const handleSendInvoice = (inv: Invoice) => {
    if (inv.status === 'draft') {
      updateInvoice(inv.id, { status: 'sent' });
      addAuditLog({
        id: `LOG-${Date.now()}`, action: 'update', entityType: 'invoice',
        entityId: inv.id, entityName: `Invoice ${inv.invoiceNumber}`,
        userId: me?.id ?? '', userName: me?.name ?? 'You', userRole: me?.role ?? '',
        details: `Invoice sent to ${inv.guestEmail}`, timestamp: new Date().toISOString(),
      });
      toastHelpers.success('Invoice sent', `Sent to ${inv.guestEmail}`);
    } else if (inv.status === 'pending') {
      updateInvoice(inv.id, { status: 'sent' });
      toastHelpers.success('Invoice resent');
    }
  };

  const handleCancelInvoice = (inv: Invoice) => {
    updateInvoice(inv.id, { status: 'cancelled' });
    addAuditLog({
      id: `LOG-${Date.now()}`, action: 'update', entityType: 'invoice',
      entityId: inv.id, entityName: `Invoice ${inv.invoiceNumber}`,
      userId: me?.id ?? '', userName: me?.name ?? 'You', userRole: me?.role ?? '',
      details: `Invoice cancelled`, timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Invoice cancelled');
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({
      guestId: '',
      propertyId: properties[0]?.id ?? '',
      type: 'booking',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 15,
      category: 'Room',
      discount: 0,
      notes: '',
    });
  };

  const handleAddInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.guestId || !invoiceForm.propertyId) {
      toastHelpers.error('Validation Error', 'Select a guest and property');
      return;
    }
    if (!invoiceForm.description.trim() || invoiceForm.quantity < 1 || invoiceForm.unitPrice <= 0) {
      toastHelpers.error('Validation Error', 'Add a line item with description, quantity and unit price');
      return;
    }
    const subtotal = invoiceForm.quantity * invoiceForm.unitPrice;
    const taxAmount = subtotal * (invoiceForm.taxRate / 100);
    const total = Math.max(subtotal + taxAmount - invoiceForm.discount, 0);
    const guest = guests.find((g) => g.id === invoiceForm.guestId);
    const today = new Date().toISOString().split('T')[0];
    const invoice: Invoice = {
      id: newId('INV'),
      invoiceNumber: `INV-${Date.now()}`,
      type: invoiceForm.type,
      guestId: invoiceForm.guestId,
      guestName: guest?.name ?? 'Guest',
      guestEmail: guest?.email ?? '',
      propertyId: invoiceForm.propertyId,
      items: [{
        id: newId('ITEM'),
        description: invoiceForm.description.trim(),
        quantity: invoiceForm.quantity,
        unitPrice: invoiceForm.unitPrice,
        taxRate: invoiceForm.taxRate,
        amount: subtotal,
        category: invoiceForm.category,
      }],
      subtotal,
      taxAmount,
      discountAmount: invoiceForm.discount,
      total,
      currency: 'ZAR',
      status: 'draft',
      issueDate: today,
      dueDate: invoiceForm.dueDate,
      notes: invoiceForm.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
      createdBy: me?.id ?? '',
    };
    addInvoice(invoice);
    addAuditLog({
      id: newId('LOG'),
      action: 'create',
      entityType: 'invoice',
      entityId: invoice.id,
      entityName: `Invoice: ${invoice.invoiceNumber}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Invoice created for ${invoice.guestName}: ${fmtR(total)}`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Invoice created', `${invoice.invoiceNumber} saved as draft`);
    setShowAddInvoice(false);
    resetInvoiceForm();
  };

  const handleCompletePayment = (p: Payment) => {
    updatePayment(p.id, { status: 'completed', transactionId: newId('TXN'), processedAt: new Date().toISOString() });
    addAuditLog({
      id: newId('LOG'),
      action: 'update',
      entityType: 'payment',
      entityId: p.id,
      entityName: `Payment ${p.paymentNumber}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Payment marked complete: ${fmtR(p.amount)} via ${p.method}`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Payment completed', `${p.paymentNumber} · ${fmtR(p.amount)}`);
  };

  const handleRefundPayment = (p: Payment) => {
    updatePayment(p.id, { status: 'refunded' });
    addAuditLog({
      id: newId('LOG'),
      action: 'update',
      entityType: 'payment',
      entityId: p.id,
      entityName: `Payment ${p.paymentNumber}`,
      userId: me?.id ?? '',
      userName: me?.name ?? 'You',
      userRole: me?.role ?? '',
      details: `Payment refunded: ${fmtR(p.amount)}`,
      timestamp: new Date().toISOString(),
    });
    toastHelpers.success('Payment refunded', `${p.paymentNumber} · ${fmtR(p.amount)}`);
  };

  /* ─── Export Handlers ─── */
  const handleExportInvoices = () => {
    const data = filteredInvoices.map(i => ({
      invoiceNumber: i.invoiceNumber,
      guestName: i.guestName,
      guestEmail: i.guestEmail,
      subtotal: i.subtotal,
      taxAmount: i.taxAmount,
      discountAmount: i.discountAmount,
      total: i.total,
      paidAmount: i.paidAmount || 0,
      status: i.status,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      paidDate: i.paidDate || '',
      paymentMethod: i.paymentMethod || '',
    }));
    exportToCsv(data, `invoices_${new Date().toISOString().split('T')[0]}`, [
      { key: 'invoiceNumber', header: 'Invoice #' },
      { key: 'guestName', header: 'Guest' },
      { key: 'guestEmail', header: 'Email' },
      { key: 'subtotal', header: 'Subtotal' },
      { key: 'taxAmount', header: 'Tax' },
      { key: 'discountAmount', header: 'Discount' },
      { key: 'total', header: 'Total' },
      { key: 'paidAmount', header: 'Paid' },
      { key: 'status', header: 'Status' },
      { key: 'issueDate', header: 'Issue Date' },
      { key: 'dueDate', header: 'Due Date' },
      { key: 'paidDate', header: 'Paid Date' },
      { key: 'paymentMethod', header: 'Payment Method' },
    ]);
    toastHelpers.success('Invoices exported to CSV');
  };

  const handleExportExpenses = () => {
    const data = filteredExpenses.map(e => ({
      id: e.id,
      date: e.date,
      desc: e.description,
      category: e.category,
      amount: e.amount,
      status: e.status,
      submittedBy: e.submittedBy,
      vendor: e.vendor || '',
    }));
    exportToCsv(data, `expenses_${new Date().toISOString().split('T')[0]}`, [
      { key: 'id', header: 'ID' },
      { key: 'date', header: 'Date' },
      { key: 'desc', header: 'Description' },
      { key: 'category', header: 'Category' },
      { key: 'amount', header: 'Amount' },
      { key: 'status', header: 'Status' },
      { key: 'submittedBy', header: 'Submitted By' },
      { key: 'vendor', header: 'Vendor' },
    ]);
    toastHelpers.success('Expenses exported to CSV');
  };

  const handleExportPayments = () => {
    const data = filteredPayments.map(p => ({
      paymentNumber: p.paymentNumber,
      guestName: p.guestName,
      amount: p.amount,
      method: p.method,
      status: p.status,
      reference: p.reference || '',
      processedAt: p.processedAt || '',
      processedBy: p.processedBy,
    }));
    exportToCsv(data, `payments_${new Date().toISOString().split('T')[0]}`, [
      { key: 'paymentNumber', header: 'Payment #' },
      { key: 'guestName', header: 'Guest' },
      { key: 'amount', header: 'Amount' },
      { key: 'method', header: 'Method' },
      { key: 'status', header: 'Status' },
      { key: 'reference', header: 'Reference' },
      { key: 'processedAt', header: 'Processed At' },
      { key: 'processedBy', header: 'Processed By' },
    ]);
    toastHelpers.success('Payments exported to CSV');
  };

  const handleExportAll = () => {
    if (activeTab === 'invoices') handleExportInvoices();
    else if (activeTab === 'expenses') handleExportExpenses();
    else if (activeTab === 'payments') handleExportPayments();
    else {
      handleExportInvoices();
      setTimeout(() => handleExportExpenses(), 500);
      setTimeout(() => handleExportPayments(), 1000);
      toastHelpers.success('All financial data exported');
    }
  };

  const handlePrintInvoice = (inv: Invoice) => {
    const prop = properties.find(p => p.id === inv.propertyId);
    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (!printWin) { toastHelpers.error('Popup blocked', 'Allow popups to print'); return; }
    printWin.document.write(`
<!DOCTYPE html><html><head><title>Invoice ${inv.invoiceNumber}</title>
<style>
  body { font-family: 'Georgia', serif; margin: 40px; color: #1a1a2e; }
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #c9a87c; padding-bottom: 20px; margin-bottom: 30px; }
  .logo { font-size: 28px; font-weight: bold; color: #c9a87c; }
  .logo-sub { color: #666; font-size: 12px; }
  .inv-num { text-align: right; font-size: 14px; }
  .inv-num h2 { font-size: 22px; margin: 0; color: #1a1a2e; }
  .guest-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .guest-info div { font-size: 13px; line-height: 1.8; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #1a1a2e; color: #c9a87c; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
  td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 13px; }
  .totals { text-align: right; font-size: 14px; line-height: 2; }
  .totals .grand { font-size: 20px; font-weight: bold; color: #c9a87c; border-top: 2px solid #c9a87c; padding-top: 8px; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 11px; text-transform: uppercase;
    ${inv.status === 'paid' ? 'background: #d4edda; color: #155724;' : inv.status === 'overdue' ? 'background: #f8d7da; color: #721c24;' : 'background: #fff3cd; color: #856404;'}}
  @media print { body { margin: 20px; } }
</style></head><body>
<div class="header">
  <div><div class="logo">NEXUS PMS</div><div class="logo-sub">${prop?.name || 'Luxury Hotel & Spa'}<br/>${prop?.address || ''}</div></div>
  <div class="inv-num"><h2>${inv.invoiceNumber}</h2><p>Issue: ${inv.issueDate}<br/>Due: ${inv.dueDate}</p><span class="status">${inv.status.toUpperCase()}</span></div>
</div>
<div class="guest-info">
  <div><strong>Bill To:</strong><br/>${inv.guestName}<br/>${inv.guestEmail}</div>
  <div style="text-align:right"><strong>Payment:</strong><br/>Currency: ZAR<br/>${inv.paymentMethod ? 'Method: ' + inv.paymentMethod : ''}</div>
</div>
<table><thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>${inv.items.map(it => `<tr><td>${it.description}</td><td>${it.quantity}</td><td>R${it.unitPrice.toLocaleString()}</td><td>${it.taxRate}%</td><td style="text-align:right">R${it.amount.toLocaleString()}</td></tr>`).join('')}</tbody></table>
<div class="totals">
  Subtotal: R${inv.subtotal.toLocaleString()}<br/>
  Tax: R${inv.taxAmount.toLocaleString()}<br/>
  ${inv.discountAmount > 0 ? `Discount: -R${inv.discountAmount.toLocaleString()}<br/>` : ''}
  <div class="grand">Total: R${inv.total.toLocaleString()}</div>
  ${inv.paidAmount ? `Paid: R${inv.paidAmount.toLocaleString()}<br/>Balance: R${(inv.total - inv.paidAmount).toLocaleString()}` : ''}
</div>
${inv.notes ? `<p style="margin-top:20px;font-size:12px;color:#666"><strong>Notes:</strong> ${inv.notes}</p>` : ''}
<div class="footer">Thank you for choosing ${prop?.name || 'Nexus PMS'} | Generated ${new Date().toLocaleString()}</div>
</body></html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 300);
  };

  /* ─── Tax Handlers ─── */
  const resetTaxForm = () => setTaxForm({ name: '', rate: 0, type: 'vat', active: true, included: false });
  
  const handleSaveTax = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxForm.name.trim() || taxForm.rate <= 0) {
      toastHelpers.error('Please enter tax name and rate');
      return;
    }
    if (editingTax) {
      updateTaxConfig(editingTax.id, taxForm);
      toastHelpers.success('Tax config updated');
    } else {
      addTaxConfig({ id: `TAX-${Date.now()}`, ...taxForm, applicableTo: ['room'], validFrom: new Date().toISOString().split('T')[0] });
      toastHelpers.success('Tax config added');
    }
    setShowAddTax(false);
    setEditingTax(null);
    resetTaxForm();
  };

  const handleDeleteTax = (id: string) => {
    deleteTaxConfig(id);
    toastHelpers.success('Tax config deleted');
  };

  /* ─── Quick Stats for Overview ─── */
  const invoiceStats = useMemo(() => ({
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    pending: invoices.filter(i => i.status === 'pending' || i.status === 'sent').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    draft: invoices.filter(i => i.status === 'draft').length,
  }), [invoices]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financial Management</h1>
          <p className="text-muted-foreground">Comprehensive financial tracking, invoicing, and reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportAll}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button 
            onClick={() => { resetExpenseForm(); setShowAddExpense(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/30 overflow-x-auto bg-card border border-border rounded-xl px-2">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'invoices', label: `Invoices (${invoices.length})`, icon: Receipt },
          { id: 'payments', label: `Payments (${payments.length})`, icon: CreditCard },
          { id: 'expenses', label: `Expenses (${expenses.length})`, icon: DollarSign },
          { id: 'taxes', label: 'Tax Config', icon: Calculator },
          { id: 'audit', label: 'Audit Log', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as typeof activeTab); setSearchQuery(''); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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

      {/* ═══════════════════ OVERVIEW TAB ═══════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 text-success" />
                </div>
                {trends.revenue !== 0 && (
                  <span className={`text-xs flex items-center gap-1 ${trends.revenue >= 0 ? 'text-success' : 'text-danger'}`}>
                    {trends.revenue >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trends.revenue >= 0 ? '+' : ''}{trends.revenue.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">{fmtR(totalRevenue)}</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-danger/15 rounded-lg flex items-center justify-center">
                  <ArrowDownRight className="w-5 h-5 text-danger" />
                </div>
                {trends.expenses !== 0 && (
                  <span className={`text-xs flex items-center gap-1 ${trends.expenses <= 0 ? 'text-success' : 'text-danger'}`}>
                    {trends.expenses >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trends.expenses >= 0 ? '+' : ''}{trends.expenses.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">{fmtR(totalExpensesAmt)}</p>
              <p className="text-sm text-muted-foreground">Total Expenses (Approved)</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                {trends.profit !== 0 && (
                  <span className={`text-xs flex items-center gap-1 ${trends.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                    {trends.profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trends.profit >= 0 ? '+' : ''}{trends.profit.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? '' : 'text-danger'}`}>{fmtR(totalProfit)}</p>
              <p className="text-sm text-muted-foreground">Net Profit</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-warning/15 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <span className="text-xs text-muted-foreground">{invoiceStats.pending} invoices</span>
              </div>
              <p className="text-2xl font-bold">{fmtR(pendingPayments)}</p>
              <p className="text-sm text-muted-foreground">Pending Payments</p>
            </motion.div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Invoices', value: invoiceStats.total, color: 'text-info' },
              { label: 'Paid', value: invoiceStats.paid, color: 'text-success' },
              { label: 'Pending', value: invoiceStats.pending, color: 'text-warning' },
              { label: 'Overdue', value: invoiceStats.overdue, color: 'text-danger' },
              { label: 'Pending Expenses', value: fmtR(pendingExpensesAmt), color: 'text-orange-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses Chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Revenue vs Expenses (Monthly)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorRevFin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34c759" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#34c759" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpFin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff3b30" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ff3b30" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} 
                      formatter={(value: number) => fmtR(value)} 
                    />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="#34c759" fillOpacity={1} fill="url(#colorRevFin)" name="Revenue" />
                    <Area type="monotone" dataKey="expenses" stroke="#ff3b30" fillOpacity={1} fill="url(#colorExpFin)" name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Expense Breakdown</h3>
              <div className="h-72">
                {expenseBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {expenseBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} 
                        formatter={(value: number) => fmtR(value)} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No approved expenses yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Second Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Property */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Revenue by Property</h3>
              <div className="h-72">
                {revenueByProperty.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByProperty}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} 
                        formatter={(value: number) => fmtR(value)} 
                      />
                      <Bar dataKey="value" name="Revenue" fill="#c9a87c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No revenue data</div>
                )}
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Payment Methods</h3>
              <div className="h-72">
                {paymentMethodBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {paymentMethodBreakdown.map((entry, index) => (
                          <Cell key={`pm-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} 
                        formatter={(value: number) => fmtR(value)} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">No payment data</div>
                )}
              </div>
            </div>
          </div>

          {/* Profit Chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Monthly Profit Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} 
                    formatter={(value: number) => fmtR(value)} 
                  />
                  <Bar dataKey="profit" name="Profit" fill="#c9a87c" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((entry, index) => (
                      <Cell key={`profit-${index}`} fill={entry.profit >= 0 ? '#34c759' : '#ff3b30'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Recent Transactions</h3>
              <button onClick={() => setActiveTab('payments')} className="text-sm text-primary hover:underline">
                View All
              </button>
            </div>
            <div className="space-y-2">
              {payments.slice(0, 8).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.status === 'completed' ? 'bg-success/15' : 'bg-warning/15'}`}>
                      <CreditCard className={`w-4 h-4 ${p.status === 'completed' ? 'text-success' : 'text-warning'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.guestName}</p>
                      <p className="text-xs text-muted-foreground">{p.paymentNumber} · {p.method.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmtR(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">{p.processedAt ? new Date(p.processedAt).toLocaleDateString() : '-'}</p>
                  </div>
                </div>
              ))}
              {payments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════ INVOICES TAB ═══════════════════ */}
      {activeTab === 'invoices' && (
        <>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by invoice #, guest name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  value={invoiceStatusFilter}
                  onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                  className="pl-10 pr-8 py-2.5 bg-card border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              <button onClick={handleExportInvoices} className="flex items-center gap-2 px-3 py-2.5 bg-muted rounded-xl text-sm hover:bg-muted/80">
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button onClick={() => { resetInvoiceForm(); setShowAddInvoice(true); }} className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm hover:bg-primary/90">
                <Plus className="w-4 h-4" />
                New Invoice
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Guest</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paid</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Issue / Due</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No invoices found</td></tr>
                  )}
                  {filteredInvoices.map((invoice) => {
                    const balance = invoice.total - (invoice.paidAmount || 0);
                    const colors = INVOICE_STATUS_COLORS[invoice.status] || INVOICE_STATUS_COLORS.draft;
                    return (
                      <tr key={invoice.id} className="border-b border-border/20 hover:bg-primary/5">
                        <td className="py-3 px-4">
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground capitalize">{invoice.type}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm">{invoice.guestName}</p>
                          <p className="text-xs text-muted-foreground">{invoice.guestEmail}</p>
                        </td>
                        <td className="py-3 px-4 font-medium">{fmtR(invoice.total)}</td>
                        <td className="py-3 px-4 text-sm text-success">{fmtR(invoice.paidAmount || 0)}</td>
                        <td className="py-3 px-4 text-sm font-medium">{balance > 0 ? <span className="text-warning">{fmtR(balance)}</span> : <span className="text-success">Settled</span>}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <p>{invoice.issueDate}</p>
                          <p className="text-xs text-muted-foreground">{invoice.dueDate}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                              <button 
                                onClick={() => { 
                                  setSelectedInvoice(invoice); 
                                  setPaymentAmount(invoice.total - (invoice.paidAmount || 0));
                                  setShowPaymentModal(true); 
                                }}
                                className="p-1.5 hover:bg-success/10 rounded-lg text-success"
                                title="Record Payment"
                              >
                                <CreditCard className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => { setViewingInvoice(invoice); setShowInvoiceDetail(true); }}
                              className="p-1.5 hover:bg-muted rounded-lg"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handlePrintInvoice(invoice)}
                              className="p-1.5 hover:bg-muted rounded-lg"
                              title="Print Invoice"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {(invoice.status === 'draft' || invoice.status === 'pending') && (
                              <button 
                                onClick={() => handleSendInvoice(invoice)}
                                className="p-1.5 hover:bg-info/10 rounded-lg text-info"
                                title="Send Invoice"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                            {invoice.status !== 'paid' && (
                              <button 
                                onClick={() => handleCancelInvoice(invoice)}
                                className="p-1.5 hover:bg-danger/10 rounded-lg text-danger"
                                title="Cancel Invoice"
                              >
                                <XCircle className="w-4 h-4" />
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
          </div>
          <p className="text-xs text-muted-foreground text-right">Showing {filteredInvoices.length} of {invoices.length} invoices</p>
        </>
      )}

      {/* ═══════════════════ PAYMENTS TAB ═══════════════════ */}
      {activeTab === 'payments' && (
        <>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by payment #, guest name, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
            </div>
            <button onClick={handleExportPayments} className="flex items-center gap-2 px-3 py-2.5 bg-muted rounded-xl text-sm hover:bg-muted/80">
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Payment Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            {(() => {
              const completed = payments.filter(p => p.status === 'completed');
              const totalCompleted = completed.reduce((s, p) => s + p.amount, 0);
              const pending = payments.filter(p => p.status === 'pending');
              const totalPending = pending.reduce((s, p) => s + p.amount, 0);
              const refunded = payments.filter(p => p.status === 'refunded');
              const totalRefunded = refunded.reduce((s, p) => s + p.amount, 0);
              return [
                { label: 'Total Received', value: fmtR(totalCompleted), count: `${completed.length} payments`, color: 'text-success' },
                { label: 'Pending', value: fmtR(totalPending), count: `${pending.length} payments`, color: 'text-warning' },
                { label: 'Refunded', value: fmtR(totalRefunded), count: `${refunded.length} payments`, color: 'text-purple-400' },
                { label: 'Average Payment', value: fmtR(completed.length > 0 ? totalCompleted / completed.length : 0), count: `Per transaction`, color: 'text-info' },
              ];
            })().map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{s.count}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Guest</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Processed By</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No payments found</td></tr>
                  )}
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border/20 hover:bg-primary/5">
                      <td className="py-3 px-4 font-medium">{payment.paymentNumber}</td>
                      <td className="py-3 px-4">{payment.guestName}</td>
                      <td className="py-3 px-4 font-medium">{fmtR(payment.amount)}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-muted rounded-full text-xs capitalize">{payment.method.replace('_', ' ')}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{payment.reference || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          payment.status === 'completed' ? 'bg-success/15 text-success' :
                          payment.status === 'pending' ? 'bg-warning/15 text-warning' :
                          payment.status === 'refunded' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-danger/15 text-danger'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{payment.processedAt ? new Date(payment.processedAt).toLocaleDateString() : '-'}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{payment.processedBy}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {(payment.status === 'pending' || payment.status === 'processing') && (
                            <button
                              onClick={() => handleCompletePayment(payment)}
                              title="Mark Complete"
                              className="p-1.5 hover:bg-success/10 rounded-lg text-success transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {payment.status === 'completed' && (isAdmin || role === 'manager') && (
                            <button
                              onClick={() => handleRefundPayment(payment)}
                              title="Refund"
                              className="p-1.5 hover:bg-danger/10 rounded-lg text-danger transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          {!((payment.status === 'pending' || payment.status === 'processing') ||
                            (payment.status === 'completed' && (isAdmin || role === 'manager'))) && (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-right">Showing {filteredPayments.length} of {payments.length} payments</p>
        </>
      )}

      {/* ═══════════════════ EXPENSES TAB ═══════════════════ */}
      {activeTab === 'expenses' && (
        <>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search expenses by description, category, or submitter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  value={expenseStatusFilter}
                  onChange={(e) => setExpenseStatusFilter(e.target.value)}
                  className="pl-10 pr-8 py-2.5 bg-card border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              <button onClick={handleExportExpenses} className="flex items-center gap-2 px-3 py-2.5 bg-muted rounded-xl text-sm hover:bg-muted/80">
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button 
                onClick={() => { resetExpenseForm(); setShowAddExpense(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Add Expense
              </button>
            </div>
          </div>

          {/* Expense Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Approved', value: fmtR(totalExpensesAmt), color: 'text-success' },
              { label: 'Pending Approval', value: fmtR(pendingExpensesAmt), color: 'text-warning' },
              { label: 'Rejected', value: fmtR(expenses.filter(e => e.status === 'rejected').reduce((s, e) => s + e.amount, 0)), color: 'text-danger' },
              { label: 'This Month', value: fmtR(expenses.filter(e => { const m = getMonthKey(e.date); const now = new Date(); return m === `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; }).reduce((s, e) => s + e.amount, 0)), color: 'text-info' },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-3">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vendor</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submitted By</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No expenses found</td></tr>
                  )}
                  {filteredExpenses.map((expense) => {
                    const colors = EXPENSE_STATUS_COLORS[expense.status] || EXPENSE_STATUS_COLORS.pending;
                    return (
                      <tr key={expense.id} className="border-b border-border/20 hover:bg-primary/5">
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 bg-muted rounded-full text-xs font-medium">{expense.category}</span>
                        </td>
                        <td className="py-3 px-4 text-sm max-w-xs truncate">{expense.description}</td>
                        <td className="py-3 px-4 font-medium">{fmtR(expense.amount)}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{expense.vendor || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {expense.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{expense.date}</td>
                        <td className="py-3 px-4 text-sm">{expense.submittedBy}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {expense.status === 'pending' && (
                              <>
                                <button 
                                  onClick={() => handleApproveExpense(expense)}
                                  className="p-1.5 hover:bg-success/10 rounded-lg text-success"
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleRejectExpense(expense)}
                                  className="p-1.5 hover:bg-danger/10 rounded-lg text-danger"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => openEditExpense(expense)}
                              className="p-1.5 hover:bg-muted rounded-lg"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button 
                                onClick={() => { setDeleteType('expense'); setShowDeleteConfirm(expense.id); }}
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
          </div>
          <p className="text-xs text-muted-foreground text-right">Showing {filteredExpenses.length} of {expenses.length} expenses</p>
        </>
      )}

      {/* ═══════════════════ TAX CONFIG TAB ═══════════════════ */}
      {activeTab === 'taxes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Tax Configuration</h3>
              <p className="text-sm text-muted-foreground">Manage tax rates applied to invoices and services</p>
            </div>
            <button 
              onClick={() => { resetTaxForm(); setEditingTax(null); setShowAddTax(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Add Tax
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {taxConfigs.map((tax) => (
              <div key={tax.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">{tax.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${tax.active ? 'bg-success/15 text-success' : 'bg-slate-500/20 text-slate-400'}`}>
                    {tax.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-3xl font-bold mb-1">{tax.rate}%</p>
                <p className="text-sm text-muted-foreground capitalize mb-1">{tax.type.replace('_', ' ')}</p>
                <p className="text-xs text-muted-foreground">{tax.included ? 'Included in price' : 'Added to price'}</p>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/20">
                  <button 
                    onClick={() => { setEditingTax(tax); setTaxForm({ name: tax.name, rate: tax.rate, type: tax.type, active: tax.active, included: tax.included }); setShowAddTax(true); }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                  <button 
                    onClick={() => updateTaxConfig(tax.id, { active: !tax.active })}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {tax.active ? 'Disable' : 'Enable'}
                  </button>
                  <button 
                    onClick={() => handleDeleteTax(tax.id)}
                    className="p-1.5 hover:bg-danger/10 rounded-lg text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {taxConfigs.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Calculator className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No tax configurations yet</p>
                <p className="text-xs mt-1">Add a tax to get started</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ AUDIT LOG TAB ═══════════════════ */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Financial Audit Trail</h3>
              <p className="text-sm text-muted-foreground">All financial actions logged for compliance</p>
            </div>
            <span className="text-xs text-muted-foreground">{financialAuditLogs.length} entries</span>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timestamp</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entity</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {financialAuditLogs.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No financial audit logs yet</td></tr>
                  )}
                  {financialAuditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border/20 hover:bg-primary/5">
                      <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-sm">{log.userName}</p>
                          <p className="text-xs text-muted-foreground">{log.userRole}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          log.action === 'create' ? 'bg-success/15 text-success' :
                          log.action === 'update' ? 'bg-info/15 text-info' :
                          log.action === 'delete' ? 'bg-danger/15 text-danger' :
                          log.action === 'payment' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className="text-sm capitalize">{log.entityType}</span>
                          <p className="text-xs text-muted-foreground">{log.entityName}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ ADD EXPENSE MODAL ═══════════════════ */}
      <AnimatePresence>
        {showAddExpense && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddExpense(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">Add New Expense</h3>
                <button onClick={() => setShowAddExpense(false)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddExpense} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Category *</label>
                    <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors">
                      {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Amount (R) *</label>
                    <input type="number" step="0.01" min="0.01" value={expenseForm.amount || ''} onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" required />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description *</label>
                  <input type="text" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    placeholder="e.g., Kitchen supplies for Q2"
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Date *</label>
                    <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Submitted By *</label>
                    <input type="text" value={expenseForm.submittedBy} onChange={(e) => setExpenseForm({ ...expenseForm, submittedBy: e.target.value })}
                      placeholder="e.g., John Smith"
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Vendor</label>
                    <input type="text" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                      placeholder="e.g., Makro, Builders Warehouse"
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
                    <select value={expenseForm.paymentMethod} onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors">
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Property</label>
                  <select value={expenseForm.propertyId} onChange={(e) => setExpenseForm({ ...expenseForm, propertyId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors">
                    <option value="">All Properties</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Notes</label>
                  <textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                    placeholder="Additional notes about this expense..."
                    rows={2}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors resize-none" />
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddExpense(false)} className="flex-1 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
                  <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
                    <Save className="w-4 h-4" />
                    Save Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ EDIT EXPENSE MODAL ═══════════════════ */}
      <AnimatePresence>
        {showEditExpense && editingExpense && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowEditExpense(false); setEditingExpense(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">Edit Expense</h3>
                <button onClick={() => { setShowEditExpense(false); setEditingExpense(null); }} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleEditExpense} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Category</label>
                    <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors">
                      {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Amount (R)</label>
                    <input type="number" step="0.01" min="0.01" value={expenseForm.amount || ''} onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" required />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description</label>
                  <input type="text" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Date</label>
                    <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Submitted By</label>
                    <input type="text" value={expenseForm.submittedBy} onChange={(e) => setExpenseForm({ ...expenseForm, submittedBy: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Vendor</label>
                    <input type="text" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
                    <select value={expenseForm.paymentMethod} onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors">
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Notes</label>
                  <textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors resize-none" />
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <button type="button" onClick={() => { setShowEditExpense(false); setEditingExpense(null); }} className="flex-1 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
                  <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
                    <Save className="w-4 h-4" />
                    Update Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ VIEW INVOICE MODAL ═══════════════════ */}
      <AnimatePresence>
        {showInvoiceDetail && viewingInvoice && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowInvoiceDetail(false); setViewingInvoice(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <div>
                  <h3 className="text-lg font-semibold">{viewingInvoice.invoiceNumber}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{viewingInvoice.type} Invoice</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePrintInvoice(viewingInvoice)} className="p-2 hover:bg-muted rounded-lg" title="Print"><Printer className="w-5 h-5" /></button>
                  <button onClick={() => { setShowInvoiceDetail(false); setViewingInvoice(null); }} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {/* Invoice Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Guest</p>
                      <p className="font-medium">{viewingInvoice.guestName}</p>
                      <p className="text-sm text-muted-foreground">{viewingInvoice.guestEmail}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Property</p>
                      <p className="text-sm">{properties.find(p => p.id === viewingInvoice.propertyId)?.name || 'N/A'}</p>
                    </div>
                    {viewingInvoice.bookingId && (
                      <div>
                        <p className="text-xs text-muted-foreground">Booking Reference</p>
                        <p className="text-sm">{viewingInvoice.bookingId}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${(INVOICE_STATUS_COLORS[viewingInvoice.status] || INVOICE_STATUS_COLORS.draft).bg} ${(INVOICE_STATUS_COLORS[viewingInvoice.status] || INVOICE_STATUS_COLORS.draft).text}`}>
                        {viewingInvoice.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Issue Date</p>
                      <p className="text-sm">{viewingInvoice.issueDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="text-sm">{viewingInvoice.dueDate}</p>
                    </div>
                    {viewingInvoice.paidDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">Paid Date</p>
                        <p className="text-sm text-success">{viewingInvoice.paidDate}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <h4 className="font-medium mb-3">Line Items</h4>
                  <div className="border border-border/30 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/30 text-xs">
                          <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Description</th>
                          <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Qty</th>
                          <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Unit Price</th>
                          <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Tax</th>
                          <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingInvoice.items.map((item) => (
                          <tr key={item.id} className="border-t border-border/20">
                            <td className="py-2 px-3 text-sm">{item.description}</td>
                            <td className="py-2 px-3 text-sm text-center">{item.quantity}</td>
                            <td className="py-2 px-3 text-sm text-right">{fmtR(item.unitPrice)}</td>
                            <td className="py-2 px-3 text-sm text-right">{item.taxRate}%</td>
                            <td className="py-2 px-3 text-sm text-right font-medium">{fmtR(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{fmtR(viewingInvoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{fmtR(viewingInvoice.taxAmount)}</span>
                    </div>
                    {viewingInvoice.discountAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="text-success">-{fmtR(viewingInvoice.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-border/30">
                      <span>Total</span>
                      <span className="text-foreground">{fmtR(viewingInvoice.total)}</span>
                    </div>
                    {(viewingInvoice.paidAmount || 0) > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Paid</span>
                          <span className="text-success">{fmtR(viewingInvoice.paidAmount || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-muted-foreground">Balance Due</span>
                          <span className={viewingInvoice.total - (viewingInvoice.paidAmount || 0) > 0 ? 'text-warning' : 'text-success'}>
                            {fmtR(viewingInvoice.total - (viewingInvoice.paidAmount || 0))}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {viewingInvoice.notes && (
                  <div className="p-3 bg-muted/30 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{viewingInvoice.notes}</p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">Created {new Date(viewingInvoice.createdAt).toLocaleString()} by {viewingInvoice.createdBy}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ NEW INVOICE MODAL ═══════════════════ */}
      <AnimatePresence>
        {showAddInvoice && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddInvoice(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">New Invoice</h3>
                <button onClick={() => setShowAddInvoice(false)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddInvoice} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Guest *</label>
                    <select
                      value={invoiceForm.guestId}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, guestId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 appearance-none"
                    >
                      <option value="">Select guest…</option>
                      {guests.map((g) => (
                        <option key={g.id} value={g.id}>{g.name} · {g.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Property *</label>
                    <select
                      value={invoiceForm.propertyId}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, propertyId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 appearance-none"
                    >
                      <option value="">Select property…</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Invoice Type</label>
                    <select
                      value={invoiceForm.type}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, type: e.target.value as Invoice['type'] })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 appearance-none capitalize"
                    >
                      <option value="booking">Booking</option>
                      <option value="service">Service</option>
                      <option value="advance">Advance</option>
                      <option value="final">Final</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Due Date *</label>
                    <input
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Line Item</label>
                  <input
                    type="text"
                    value={invoiceForm.description}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                    placeholder="e.g., Deluxe Suite — 2 nights"
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Quantity *</label>
                    <input
                      type="number" min="1" step="1"
                      value={invoiceForm.quantity}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, quantity: Math.max(parseInt(e.target.value, 10) || 1, 1) })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Unit Price (R) *</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={invoiceForm.unitPrice || ''}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, unitPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Tax Rate (%)</label>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={invoiceForm.taxRate}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, taxRate: Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 100) })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Category</label>
                    <select
                      value={invoiceForm.category}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, category: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 appearance-none"
                    >
                      <option value="Room">Room</option>
                      <option value="Food & Beverage">Food &amp; Beverage</option>
                      <option value="Service">Service</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Discount (R)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={invoiceForm.discount || ''}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, discount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Notes</label>
                    <input
                      type="text"
                      value={invoiceForm.notes}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-xl grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Subtotal</p>
                    <p className="font-semibold">{fmtR(invoiceSubtotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tax</p>
                    <p className="font-semibold">{fmtR(invoiceTax)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-bold text-primary">{fmtR(invoiceTotal)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddInvoice(false)} className="flex-1 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90">
                    <Save className="w-4 h-4" />
                    Create Invoice
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ PAYMENT MODAL ═══════════════════ */}
      <AnimatePresence>
        {showPaymentModal && selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-popover border border-border rounded-2xl shadow-overlay"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">Record Payment</h3>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Invoice</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${(INVOICE_STATUS_COLORS[selectedInvoice.status] || INVOICE_STATUS_COLORS.draft).bg} ${(INVOICE_STATUS_COLORS[selectedInvoice.status] || INVOICE_STATUS_COLORS.draft).text}`}>
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <p className="font-semibold">{selectedInvoice.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.guestName}</p>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-bold">{fmtR(selectedInvoice.total)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="font-bold text-success">{fmtR(selectedInvoice.paidAmount || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-bold text-warning">{fmtR(selectedInvoice.total - (selectedInvoice.paidAmount || 0))}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Payment Amount (R)</label>
                  <input 
                    type="number" step="0.01" min="0.01"
                    max={selectedInvoice.total - (selectedInvoice.paidAmount || 0)}
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Max: {fmtR(selectedInvoice.total - (selectedInvoice.paidAmount || 0))}</p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map(method => (
                      <button
                        key={method.value}
                        onClick={() => setPaymentMethod(method.value)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-colors ${
                          paymentMethod === method.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/30 hover:bg-muted'
                        }`}
                      >
                        <method.icon className="w-4 h-4" />
                        {method.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Reference / Transaction ID</label>
                  <input 
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g., REF-2026-0401"
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                </div>
                
                <div className="flex items-center gap-3 pt-4">
                  <button onClick={() => setShowPaymentModal(false)} className="flex-1 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted">
                    Cancel
                  </button>
                  <button 
                    onClick={handleMarkPaid}
                    disabled={paymentAmount <= 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success text-white rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Record Payment
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ ADD/EDIT TAX MODAL ═══════════════════ */}
      <AnimatePresence>
        {showAddTax && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowAddTax(false); setEditingTax(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-popover border border-border rounded-2xl shadow-overlay"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">{editingTax ? 'Edit Tax Config' : 'Add Tax Config'}</h3>
                <button onClick={() => { setShowAddTax(false); setEditingTax(null); }} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveTax} className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Tax Name *</label>
                  <input type="text" value={taxForm.name} onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
                    placeholder="e.g., VAT, Tourism Levy"
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Rate (%) *</label>
                    <input type="number" step="0.01" min="0.01" value={taxForm.rate || ''} onChange={(e) => setTaxForm({ ...taxForm, rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Type</label>
                    <select value={taxForm.type} onChange={(e) => setTaxForm({ ...taxForm, type: e.target.value as typeof taxForm.type })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm">
                      <option value="vat">VAT</option>
                      <option value="sales_tax">Sales Tax</option>
                      <option value="tourism_levy">Tourism Levy</option>
                      <option value="city_tax">City Tax</option>
                      <option value="service_charge">Service Charge</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={taxForm.active} onChange={(e) => setTaxForm({ ...taxForm, active: e.target.checked })}
                      className="w-4 h-4 rounded border-border/30" />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={taxForm.included} onChange={(e) => setTaxForm({ ...taxForm, included: e.target.checked })}
                      className="w-4 h-4 rounded border-border/30" />
                    <span className="text-sm">Included in price</span>
                  </label>
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <button type="button" onClick={() => { setShowAddTax(false); setEditingTax(null); }} className="flex-1 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
                  <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
                    <Save className="w-4 h-4" />
                    {editingTax ? 'Update' : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ DELETE CONFIRM MODAL ═══════════════════ */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-popover border border-border rounded-2xl shadow-overlay"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-danger/15 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-danger" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Are you sure you want to delete this {deleteType}? This action cannot be undone.
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted">
                    Cancel
                  </button>
                  <button onClick={handleDeleteConfirm} className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl text-sm font-medium">
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
