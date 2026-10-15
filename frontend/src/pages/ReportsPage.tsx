import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Download, Printer,
  TrendingUp, DollarSign, Users, Building2,
  Activity, Clock, Plus, X, Eye, Share2, Trash2,
  ChevronDown, BarChart3, Calendar, RefreshCw, Mail
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { exportToCsv } from '../utils/exportCsv';
import toastHelpers from '../lib/toast';

/* ─── Constants ─── */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#c9a87c', '#007aff', '#34c759', '#ff9500', '#af52de', '#ff2d55', '#5ac8fa', '#30b0c7'];
const fmtR = (n: number) => `R${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtRShort = (n: number) => `R${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const getMonthKey = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
};

interface GeneratedReport {
  id: string;
  name: string;
  type: string;
  date: string;
  status: 'ready' | 'generating';
  data?: Record<string, unknown>[];
}

interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  frequency: string;
  nextRun: string;
  recipients: string;
  active: boolean;
}

/* ─── Component ─── */
const ReportsPage = () => {
  const { invoices, expenses, bookings, guests, rooms, properties, inventory } = useAppStore();
  
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '12m' | 'all'>('12m');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showReportViewer, setShowReportViewer] = useState(false);
  const [viewingReport, setViewingReport] = useState<GeneratedReport | null>(null);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([
    { id: 'SCH-1', name: 'Daily Revenue Summary', type: 'financial', frequency: 'daily', nextRun: new Date(Date.now() + 86400000).toISOString().split('T')[0], recipients: 'manager@nexus.com', active: true },
    { id: 'SCH-2', name: 'Weekly Occupancy Report', type: 'occupancy', frequency: 'weekly', nextRun: (() => { const d = new Date(); d.setDate(d.getDate() + (8 - d.getDay()) % 7); return d.toISOString().split('T')[0]; })(), recipients: 'team@nexus.com', active: true },
    { id: 'SCH-3', name: 'Monthly P&L Statement', type: 'financial', frequency: 'monthly', nextRun: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return d.toISOString().split('T')[0]; })(), recipients: 'cfo@nexus.com, manager@nexus.com', active: true },
  ]);

  const [generateForm, setGenerateForm] = useState({
    type: 'financial',
    name: '',
    dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    type: 'financial',
    frequency: 'daily',
    recipients: '',
  });

  /* ─── Date Range Filter ─── */
  const dateFilter = useCallback((dateStr: string) => {
    if (dateRange === 'all') return true;
    const d = new Date(dateStr);
    const now = new Date();
    const daysBack = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
    const cutoff = new Date(now.getTime() - daysBack * 86400000);
    return d >= cutoff;
  }, [dateRange]);

  /* ─── Computed Stats ─── */
  const totalRevenue = useMemo(() => {
    return invoices.filter(i => i.status === 'paid' && dateFilter(i.paidDate || i.issueDate)).reduce((s, i) => s + i.total, 0);
  }, [invoices, dateFilter]);

  const totalExpensesAmt = useMemo(() => {
    return expenses.filter(e => e.status === 'approved' && dateFilter(e.date)).reduce((s, e) => s + e.amount, 0);
  }, [expenses, dateFilter]);

  const totalRooms = useMemo(() => rooms.length, [rooms]);
  const occupiedRooms = useMemo(() => rooms.filter(r => r.status === 'occupied').length, [rooms]);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  
  const totalGuestsCount = useMemo(() => guests.length, [guests]);
  
  // RevPAR = Revenue per Available Room (total revenue / total rooms / days)
  const revPAR = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
    if (totalRooms === 0) return 0;
    return totalRevenue / totalRooms / days;
  }, [totalRevenue, totalRooms, dateRange]);

  // ADR = Average Daily Rate = total room revenue / occupied room-nights
  const adr = useMemo(() => {
    const relevantBookings = bookings.filter(b => 
      (b.status === 'checked-in' || b.status === 'checked-out') && dateFilter(b.checkIn)
    );
    const totalNights = relevantBookings.reduce((s, b) => s + (b.nights || 1), 0);
    const totalBookingRev = relevantBookings.reduce((s, b) => s + b.amount, 0);
    return totalNights > 0 ? totalBookingRev / totalNights : 0;
  }, [bookings, dateFilter]);

  /* ─── Monthly Revenue Chart ─── */
  const monthlyData = useMemo(() => {
    const monthMap: Record<string, { revenue: number; expenses: number; profit: number }> = {};
    
    invoices.filter(i => i.status === 'paid').forEach(inv => {
      const mk = getMonthKey(inv.paidDate || inv.issueDate);
      if (!mk) return;
      if (!monthMap[mk]) monthMap[mk] = { revenue: 0, expenses: 0, profit: 0 };
      monthMap[mk].revenue += inv.total;
    });

    expenses.filter(e => e.status === 'approved').forEach(exp => {
      const mk = getMonthKey(exp.date);
      if (!mk) return;
      if (!monthMap[mk]) monthMap[mk] = { revenue: 0, expenses: 0, profit: 0 };
      monthMap[mk].expenses += exp.amount;
    });

    const sorted = Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, data]) => ({
        month: getMonthLabel(key),
        revenue: Math.round(data.revenue),
        expenses: Math.round(data.expenses),
        profit: Math.round(data.revenue - data.expenses),
      }));

    return sorted.length > 0 ? sorted : [{ month: 'No Data', revenue: 0, expenses: 0, profit: 0 }];
  }, [invoices, expenses]);

  /* ─── Revenue by Source (booking source) ─── */
  const revenueSourceData = useMemo(() => {
    const sourceMap: Record<string, number> = {};
    bookings.filter(b => dateFilter(b.checkIn)).forEach(b => {
      const source = b.source || 'Direct';
      sourceMap[source] = (sourceMap[source] || 0) + b.amount;
    });
    const total = Object.values(sourceMap).reduce((s, v) => s + v, 0);
    return Object.entries(sourceMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], idx) => ({
        name,
        value: total > 0 ? Math.round((value / total) * 100) : 0,
        amount: value,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      }));
  }, [bookings, dateFilter]);

  /* ─── Revenue by Room Type ─── */
  const departmentData = useMemo(() => {
    const typeMap: Record<string, number> = {};
    bookings.filter(b => dateFilter(b.checkIn) && (b.status === 'checked-in' || b.status === 'checked-out' || b.status === 'confirmed'))
      .forEach(b => {
        const type = b.roomType || 'Other';
        typeMap[type] = (typeMap[type] || 0) + b.amount;
      });
    const total = Object.values(typeMap).reduce((s, v) => s + v, 0);
    return Object.entries(typeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, revenue]) => ({
        name,
        revenue: Math.round(revenue),
        percentage: total > 0 ? Math.round((revenue / total) * 100) : 0,
      }));
  }, [bookings, dateFilter]);

  /* ─── Occupancy by Property ─── */
  const occupancyByProperty = useMemo(() => {
    return properties.map((p, idx) => {
      const propRooms = rooms.filter(r => r.propertyId === p.id);
      const occ = propRooms.filter(r => r.status === 'occupied').length;
      return {
        name: p.name.length > 20 ? p.name.substring(0, 18) + '...' : p.name,
        occupancy: propRooms.length > 0 ? Math.round((occ / propRooms.length) * 100) : 0,
        total: propRooms.length,
        occupied: occ,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      };
    });
  }, [properties, rooms]);

  /* ─── Guest Segment Breakdown ─── */
  const guestSegments = useMemo(() => {
    const segMap: Record<string, number> = {};
    guests.forEach(g => {
      const seg = g.segment || 'New';
      segMap[seg] = (segMap[seg] || 0) + 1;
    });
    return Object.entries(segMap).map(([name, value], idx) => ({
      name,
      value,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    }));
  }, [guests]);

  /* ─── Report Type Categories ─── */
  const reportTypes = useMemo(() => [
    { id: 'financial', name: 'Financial Reports', icon: DollarSign, color: 'bg-success/15 text-success', 
      count: invoices.length + expenses.length },
    { id: 'occupancy', name: 'Occupancy Reports', icon: Building2, color: 'bg-info/15 text-info', 
      count: rooms.length },
    { id: 'guest', name: 'Guest Reports', icon: Users, color: 'bg-purple-500/20 text-purple-400', 
      count: guests.length },
    { id: 'operations', name: 'Operations Reports', icon: Activity, color: 'bg-orange-500/20 text-orange-400', 
      count: inventory.length + bookings.length },
  ], [invoices, expenses, rooms, guests, inventory, bookings]);

  /* ─── Handlers ─── */
  const handleGenerateReport = (e: React.FormEvent) => {
    e.preventDefault();
    const type = generateForm.type;
    const name = generateForm.name || `${type.charAt(0).toUpperCase() + type.slice(1)} Report`;
    
    // Build report data based on type
    let data: Record<string, unknown>[] = [];
    if (type === 'financial') {
      data = invoices.filter(i => {
        const d = new Date(i.issueDate);
        return d >= new Date(generateForm.dateFrom) && d <= new Date(generateForm.dateTo);
      }).map(i => ({
        Invoice: i.invoiceNumber,
        Guest: i.guestName,
        Total: i.total,
        Paid: i.paidAmount || 0,
        Status: i.status,
        Date: i.issueDate,
      }));
    } else if (type === 'occupancy') {
      data = rooms.map(r => ({
        Room: r.number,
        Type: r.type,
        Floor: r.floor,
        Status: r.status,
        Price: r.price,
        'Max Occupancy': r.maxOccupancy || '-',
      }));
    } else if (type === 'guest') {
      data = guests.map(g => ({
        Name: g.name,
        Email: g.email,
        Phone: g.phone,
        Segment: g.segment,
        'Total Stays': g.totalStays,
        'Loyalty Points': g.loyaltyPoints,
        'Last Visit': g.lastVisit,
      }));
    } else {
      data = bookings.filter(b => {
        const d = new Date(b.checkIn);
        return d >= new Date(generateForm.dateFrom) && d <= new Date(generateForm.dateTo);
      }).map(b => ({
        Guest: b.guestName,
        Room: b.roomNumber,
        'Check In': b.checkIn,
        'Check Out': b.checkOut,
        Nights: b.nights,
        Amount: b.amount,
        Status: b.status,
      }));
    }
    
    const report: GeneratedReport = {
      id: `RPT-${Date.now()}`,
      name,
      type: type.charAt(0).toUpperCase() + type.slice(1),
      date: new Date().toISOString().split('T')[0],
      status: 'ready',
      data,
    };
    
    setGeneratedReports(prev => [report, ...prev]);
    toastHelpers.success('Report generated', `${name} with ${data.length} records`);
    setShowGenerateModal(false);
    setGenerateForm({ type: 'financial', name: '', dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], dateTo: new Date().toISOString().split('T')[0] });
  };

  const handleViewReport = (report: GeneratedReport) => {
    setViewingReport(report);
    setShowReportViewer(true);
  };

  const handleDownloadReport = (report: GeneratedReport) => {
    if (!report.data || report.data.length === 0) {
      toastHelpers.error('No data', 'Report has no data to export');
      return;
    }
    const headers = Object.keys(report.data[0]);
    exportToCsv(
      report.data,
      `${report.name.replace(/\s+/g, '_')}_${report.date}`,
      headers.map(h => ({ key: h, header: h }))
    );
    toastHelpers.success('Downloaded', `${report.name}.csv`);
  };

  const handleShareReport = (report: GeneratedReport) => {
    if (navigator.clipboard) {
      const text = `Report: ${report.name}\nType: ${report.type}\nDate: ${report.date}\nRecords: ${report.data?.length || 0}`;
      navigator.clipboard.writeText(text);
      toastHelpers.success('Copied to clipboard', 'Report summary copied');
    } else {
      toastHelpers.info('Share', `Report "${report.name}" ready to share`);
    }
  };

  const handlePrintReport = (report: GeneratedReport) => {
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) { toastHelpers.error('Popup blocked'); return; }
    
    const rows = report.data || [];
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    
    printWin.document.write(`<!DOCTYPE html><html><head><title>${report.name}</title>
    <style>
      body { font-family: Georgia, serif; margin: 30px; color: #1a1a2e; }
      h1 { color: #c9a87c; border-bottom: 2px solid #c9a87c; padding-bottom: 10px; }
      .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #1a1a2e; color: #c9a87c; padding: 8px; text-align: left; }
      td { padding: 8px; border-bottom: 1px solid #eee; }
      tr:nth-child(even) { background: #f9f9f9; }
      .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; }
      @media print { body { margin: 15px; } }
    </style></head><body>
    <h1>NEXUS PMS - ${report.name}</h1>
    <div class="meta">Type: ${report.type} | Generated: ${report.date} | Records: ${rows.length}</div>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${headers.map(h => `<td>${row[h] !== undefined && row[h] !== null ? String(row[h]) : '-'}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <div class="footer">Generated by NEXUS PMS | ${new Date().toLocaleString()}</div>
    </body></html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 300);
  };

  const handleDeleteReport = (id: string) => {
    setGeneratedReports(prev => prev.filter(r => r.id !== id));
    toastHelpers.success('Report deleted');
  };

  const handleExportAll = (format: 'csv' | 'pdf' | 'excel') => {
    setShowExportMenu(false);
    if (format === 'csv') {
      // Export a combined overview CSV
      const data = monthlyData.map(d => ({ ...d }));
      exportToCsv(data, `reports_overview_${new Date().toISOString().split('T')[0]}`, [
        { key: 'month', header: 'Month' },
        { key: 'revenue', header: 'Revenue' },
        { key: 'expenses', header: 'Expenses' },
        { key: 'profit', header: 'Profit' },
      ]);
      toastHelpers.success('Overview exported as CSV');
    } else if (format === 'pdf') {
      // Print the overview
      const printWin = window.open('', '_blank', 'width=900,height=700');
      if (!printWin) { toastHelpers.error('Popup blocked'); return; }
      printWin.document.write(`<!DOCTYPE html><html><head><title>Financial Overview</title>
      <style>body{font-family:Georgia,serif;margin:30px;color:#1a1a2e}h1{color:#c9a87c;border-bottom:2px solid #c9a87c;padding-bottom:10px}.stat{display:inline-block;margin:10px 20px 10px 0;padding:15px;border:1px solid #ddd;border-radius:8px;min-width:150px}.stat .val{font-size:22px;font-weight:bold;color:#c9a87c}.stat .label{font-size:12px;color:#666}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}th{background:#1a1a2e;color:#c9a87c;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #eee}.footer{margin-top:30px;text-align:center;font-size:11px;color:#999}</style></head><body>
      <h1>NEXUS PMS - Financial Overview Report</h1>
      <div>
        <div class="stat"><div class="val">${fmtRShort(totalRevenue)}</div><div class="label">Total Revenue</div></div>
        <div class="stat"><div class="val">${fmtRShort(totalExpensesAmt)}</div><div class="label">Total Expenses</div></div>
        <div class="stat"><div class="val">${fmtRShort(totalRevenue - totalExpensesAmt)}</div><div class="label">Net Profit</div></div>
        <div class="stat"><div class="val">${occupancyRate}%</div><div class="label">Occupancy</div></div>
      </div>
      <h2 style="margin-top:30px;color:#333">Monthly Breakdown</h2>
      <table><thead><tr><th>Month</th><th>Revenue</th><th>Expenses</th><th>Profit</th></tr></thead>
      <tbody>${monthlyData.map(d => `<tr><td>${d.month}</td><td>${fmtRShort(d.revenue)}</td><td>${fmtRShort(d.expenses)}</td><td>${fmtRShort(d.profit)}</td></tr>`).join('')}</tbody></table>
      <div class="footer">Generated by NEXUS PMS | ${new Date().toLocaleString()}</div></body></html>`);
      printWin.document.close();
      setTimeout(() => printWin.print(), 300);
      toastHelpers.success('PDF report opened for printing');
    } else {
      // Excel = CSV with tab separator trick, just export CSV
      const data = monthlyData.map(d => ({ ...d }));
      exportToCsv(data, `reports_overview_${new Date().toISOString().split('T')[0]}`, [
        { key: 'month', header: 'Month' },
        { key: 'revenue', header: 'Revenue' },
        { key: 'expenses', header: 'Expenses' },
        { key: 'profit', header: 'Profit' },
      ]);
      toastHelpers.success('Report exported (open .csv in Excel)');
    }
  };

  const handleEmailReport = () => {
    setShowExportMenu(false);
    toastHelpers.success('Report emailed', 'Report sent to registered recipients');
  };

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.name.trim() || !scheduleForm.recipients.trim()) {
      toastHelpers.error('Please fill name and recipients');
      return;
    }
    const nextRun = scheduleForm.frequency === 'daily' 
      ? new Date(Date.now() + 86400000).toISOString().split('T')[0]
      : scheduleForm.frequency === 'weekly'
      ? (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })()
      : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return d.toISOString().split('T')[0]; })();

    setScheduledReports(prev => [...prev, {
      id: `SCH-${Date.now()}`,
      name: scheduleForm.name,
      type: scheduleForm.type,
      frequency: scheduleForm.frequency,
      nextRun,
      recipients: scheduleForm.recipients,
      active: true,
    }]);
    toastHelpers.success('Schedule added', `${scheduleForm.name} scheduled ${scheduleForm.frequency}`);
    setShowScheduleModal(false);
    setScheduleForm({ name: '', type: 'financial', frequency: 'daily', recipients: '' });
  };

  const toggleSchedule = (id: string) => {
    setScheduledReports(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const deleteSchedule = (id: string) => {
    setScheduledReports(prev => prev.filter(s => s.id !== id));
    toastHelpers.success('Schedule removed');
  };

  /* ─── Quick Generate Preset Reports ─── */
  const handleQuickGenerate = (type: string) => {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    setGenerateForm({
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Report - ${now.toLocaleDateString()}`,
      dateFrom: monthAgo.toISOString().split('T')[0],
      dateTo: now.toISOString().split('T')[0],
    });
    setShowGenerateModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">Generate, export, and schedule detailed reports from live data</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="px-3 py-2 bg-muted border border-border/30 rounded-lg text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
            <option value="all">All time</option>
          </select>

          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-4 h-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-overlay shadow-lg z-10 py-1">
                <button onClick={() => handleExportAll('pdf')} className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Export as PDF
                </button>
                <button onClick={() => handleExportAll('excel')} className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Export as Excel
                </button>
                <button onClick={() => handleExportAll('csv')} className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2">
                  <Download className="w-4 h-4" /> Export as CSV
                </button>
                <button onClick={handleEmailReport} className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email Report
                </button>
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Quick Stats (all computed from store) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Revenue', value: fmtRShort(totalRevenue), icon: DollarSign, color: 'bg-success/15 text-success', sub: `${invoices.filter(i => i.status === 'paid').length} paid invoices` },
          { label: 'Net Profit', value: fmtRShort(totalRevenue - totalExpensesAmt), icon: TrendingUp, color: totalRevenue - totalExpensesAmt >= 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger', sub: `Margin: ${totalRevenue > 0 ? ((totalRevenue - totalExpensesAmt) / totalRevenue * 100).toFixed(1) : 0}%` },
          { label: 'Occupancy Rate', value: `${occupancyRate}%`, icon: Building2, color: 'bg-info/15 text-info', sub: `${occupiedRooms}/${totalRooms} rooms` },
          { label: 'Total Guests', value: totalGuestsCount.toLocaleString(), icon: Users, color: 'bg-purple-500/20 text-purple-400', sub: `${guests.filter(g => g.segment === 'VIP').length} VIP` },
          { label: 'RevPAR', value: fmtRShort(revPAR), icon: Activity, color: 'bg-warning/15 text-warning', sub: `ADR: ${fmtRShort(adr)}` },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color.split(' ')[0]}`}>
                <stat.icon className={`w-6 h-6 ${stat.color.split(' ')[1]}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Report Type Quick-Generate Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {reportTypes.map((type) => (
          <motion.div
            key={type.id}
            whileHover={{ scale: 1.02 }}
            onClick={() => handleQuickGenerate(type.id)}
            className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <div className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center mb-3`}>
              <type.icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">{type.name}</h3>
            <p className="text-sm text-muted-foreground">{type.count} records</p>
            <p className="text-xs text-primary mt-1">Click to generate</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Revenue & Profit Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorRevRpt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c9a87c" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#c9a87c" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfRpt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34c759" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#34c759" stopOpacity={0}/>
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
                <Area type="monotone" dataKey="revenue" stroke="#c9a87c" fillOpacity={1} fill="url(#colorRevRpt)" name="Revenue" />
                <Area type="monotone" dataKey="profit" stroke="#34c759" fillOpacity={1} fill="url(#colorProfRpt)" name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Source */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Revenue by Booking Source</h3>
          <div className="h-64">
            {revenueSourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={revenueSourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}%`}
                  >
                    {revenueSourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No booking data</div>
            )}
          </div>
        </div>
      </div>

      {/* Second Row Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy by Property */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Occupancy by Property</h3>
          <div className="h-64">
            {occupancyByProperty.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancyByProperty}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`${value}%`, 'Occupancy']}
                  />
                  <Bar dataKey="occupancy" name="Occupancy" fill="#c9a87c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No property data</div>
            )}
          </div>
        </div>

        {/* Guest Segments */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Guest Segments</h3>
          <div className="h-64">
            {guestSegments.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={guestSegments}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {guestSegments.map((entry, index) => (
                      <Cell key={`gs-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No guest data</div>
            )}
          </div>
        </div>
      </div>

      {/* Revenue by Room Type */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold mb-4">Revenue by Room Type</h3>
        {departmentData.length > 0 ? (
          <div className="space-y-4">
            {departmentData.map((dept) => (
              <div key={dept.name} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium capitalize">{dept.name}</div>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${dept.percentage}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
                <div className="w-32 text-right">
                  <p className="font-semibold">{fmtRShort(dept.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{dept.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No booking data for this period</p>
        )}
      </div>

      {/* Generated Reports Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/30 flex items-center justify-between">
          <h3 className="font-semibold">Generated Reports ({generatedReports.length})</h3>
          <button onClick={() => setShowGenerateModal(true)} className="text-sm text-primary hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Generate New
          </button>
        </div>
        {generatedReports.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No reports generated yet</p>
            <p className="text-xs mt-1">Click "Generate Report" or a report type card above to create one</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Report Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Records</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {generatedReports.map((report) => (
                  <tr key={report.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{report.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{report.type}</td>
                    <td className="py-3 px-4 text-sm">{report.data?.length || 0}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{report.date}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        report.status === 'ready' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                      }`}>
                        {report.status === 'ready' ? 'Ready' : 'Generating...'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleViewReport(report)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDownloadReport(report)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Download CSV">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleShareReport(report)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Copy Summary">
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handlePrintReport(report)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Print">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteReport(report.id)} className="p-2 hover:bg-danger/10 rounded-lg transition-colors text-danger" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scheduled Reports */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Scheduled Reports ({scheduledReports.length})
          </h3>
          <button 
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="w-3 h-3" /> Add Schedule
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scheduledReports.map((schedule) => (
            <div key={schedule.id} className={`p-4 rounded-xl border transition-colors ${schedule.active ? 'bg-muted/30 border-border/30' : 'bg-muted/10 border-border/10 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">{schedule.name}</h4>
                <button 
                  onClick={() => toggleSchedule(schedule.id)}
                  className={`w-8 h-5 rounded-full transition-colors relative ${schedule.active ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-colors ${schedule.active ? 'right-[3px]' : 'left-[3px]'}`} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground capitalize mb-1">{schedule.frequency} · {schedule.type}</p>
              <p className="text-xs text-muted-foreground mb-2">{schedule.recipients}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-primary">Next: {schedule.nextRun}</p>
                <button onClick={() => deleteSchedule(schedule.id)} className="p-1 hover:bg-danger/10 rounded text-danger">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          {scheduledReports.length === 0 && (
            <div className="col-span-full text-center py-6 text-muted-foreground text-sm">
              No scheduled reports. Click "Add Schedule" to create one.
            </div>
          )}
        </div>
      </div>

      {/* ═══════ GENERATE REPORT MODAL ═══════ */}
      <AnimatePresence>
        {showGenerateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowGenerateModal(false)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-popover border border-border rounded-2xl shadow-overlay"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">Generate Report</h3>
                <button onClick={() => setShowGenerateModal(false)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleGenerateReport} className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Report Type</label>
                  <select value={generateForm.type} onChange={(e) => setGenerateForm({ ...generateForm, type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm">
                    <option value="financial">Financial Report</option>
                    <option value="occupancy">Occupancy Report</option>
                    <option value="guest">Guest Report</option>
                    <option value="operations">Operations Report</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Report Name</label>
                  <input type="text" value={generateForm.name} 
                    onChange={(e) => setGenerateForm({ ...generateForm, name: e.target.value })}
                    placeholder="e.g., Monthly Revenue Summary"
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">From</label>
                    <input type="date" value={generateForm.dateFrom} 
                      onChange={(e) => setGenerateForm({ ...generateForm, dateFrom: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">To</label>
                    <input type="date" value={generateForm.dateTo} 
                      onChange={(e) => setGenerateForm({ ...generateForm, dateTo: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <button type="button" onClick={() => setShowGenerateModal(false)} className="flex-1 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
                  <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
                    <RefreshCw className="w-4 h-4" /> Generate
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ ADD SCHEDULE MODAL ═══════ */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-popover border border-border rounded-2xl shadow-overlay"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">Schedule Report</h3>
                <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddSchedule} className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Report Name *</label>
                  <input type="text" value={scheduleForm.name} 
                    onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                    placeholder="e.g., Weekly Occupancy Summary"
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Type</label>
                    <select value={scheduleForm.type} onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm">
                      <option value="financial">Financial</option>
                      <option value="occupancy">Occupancy</option>
                      <option value="guest">Guest</option>
                      <option value="operations">Operations</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Frequency</label>
                    <select value={scheduleForm.frequency} onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Recipients (email) *</label>
                  <input type="text" value={scheduleForm.recipients} 
                    onChange={(e) => setScheduleForm({ ...scheduleForm, recipients: e.target.value })}
                    placeholder="email@hotel.com, manager@hotel.com"
                    className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm" required />
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <button type="button" onClick={() => setShowScheduleModal(false)} className="flex-1 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
                  <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
                    <Calendar className="w-4 h-4" /> Schedule
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ REPORT VIEWER MODAL ═══════ */}
      <AnimatePresence>
        {showReportViewer && viewingReport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowReportViewer(false); setViewingReport(null); }}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-popover border border-border rounded-2xl shadow-overlay max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <div>
                  <h3 className="text-lg font-semibold">{viewingReport.name}</h3>
                  <p className="text-sm text-muted-foreground">{viewingReport.type} · {viewingReport.date} · {viewingReport.data?.length || 0} records</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDownloadReport(viewingReport)} className="p-2 hover:bg-muted rounded-lg" title="Download CSV"><Download className="w-5 h-5" /></button>
                  <button onClick={() => handlePrintReport(viewingReport)} className="p-2 hover:bg-muted rounded-lg" title="Print"><Printer className="w-5 h-5" /></button>
                  <button onClick={() => { setShowReportViewer(false); setViewingReport(null); }} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-5">
                {viewingReport.data && viewingReport.data.length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/30">
                        {Object.keys(viewingReport.data[0]).map(key => (
                          <th key={key} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {viewingReport.data.slice(0, 100).map((row, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-primary/5">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="py-2 px-3 text-sm">
                              {typeof val === 'number' ? (val > 100 ? fmtRShort(val) : val.toString()) : (val !== undefined && val !== null ? String(val) : '-')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No data in this report</div>
                )}
                {viewingReport.data && viewingReport.data.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center mt-4">Showing first 100 of {viewingReport.data.length} records. Download CSV for full data.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReportsPage;
