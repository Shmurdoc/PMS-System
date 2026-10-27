import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BadgeCheck, Ban, CalendarRange, CheckCircle2, ChevronRight,
  Loader2, Plus, RefreshCw, Wallet, X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  approvePayrollRun, cancelPayrollRun, createPayrollRun, fetchCompensations,
  fetchPayrollRun, fetchPayrollRuns, payPayrollRun, upsertCompensation,
} from '../lib/api/services';
import type { ApiCompensation, ApiPayrollRun, ApiPayslip } from '../lib/api/payrollTypes';
import toastHelpers from '../lib/toast';

const money = (value: number, currency = 'ZAR') =>
  `${currency === 'ZAR' ? 'R' : currency + ' '}${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const monthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
};

const monthEnd = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  approved: 'bg-info/15 text-info',
  paid: 'bg-success/15 text-success',
  cancelled: 'bg-danger/15 text-danger',
};

const PayrollPage = () => {
  const { properties, users, user } = useAppStore();
  const role = user?.role ?? '';
  const canManage = role === 'admin' || role === 'manager';
  const canSignOff = role === 'admin';

  const defaultProperty = user?.propertyId ?? properties[0]?.propertyId ?? '';
  const [propertyId, setPropertyId] = useState(defaultProperty);
  const [runs, setRuns] = useState<ApiPayrollRun[]>([]);
  const [compensations, setCompensations] = useState<ApiCompensation[]>([]);
  const [selectedRun, setSelectedRun] = useState<ApiPayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [showRunModal, setShowRunModal] = useState(false);
  const [periodStart, setPeriodStart] = useState(monthStart());
  const [periodEnd, setPeriodEnd] = useState(monthEnd());
  const [rebuild, setRebuild] = useState(false);

  const [editingComp, setEditingComp] = useState<ApiCompensation | 'new' | null>(null);
  const [compUserId, setCompUserId] = useState('');
  const [compPayType, setCompPayType] = useState<'salary' | 'hourly'>('salary');
  const [compBase, setCompBase] = useState('15000');
  const [compMultiplier, setCompMultiplier] = useState('1.5');
  const [compHours, setCompHours] = useState('173.33');
  const [compAllowances, setCompAllowances] = useState('0');
  const [compDeductions, setCompDeductions] = useState('0');

  const numericProperty = propertyId ? Number(propertyId) : null;

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [runRows, compRows] = await Promise.all([
        fetchPayrollRuns(numericProperty),
        fetchCompensations(numericProperty),
      ]);
      setRuns(runRows);
      setCompensations(compRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load payroll.');
    } finally {
      setLoading(false);
    }
  }, [canManage, numericProperty]);

  useEffect(() => { void load(); }, [load]);

  const openRun = async (run: ApiPayrollRun) => {
    setBusy(`open-${run.id}`);
    try {
      const detail = await fetchPayrollRun(run.id);
      setSelectedRun(detail);
    } catch (err) {
      toastHelpers.error(err instanceof Error ? err.message : 'Could not load the run.');
    } finally {
      setBusy(null);
    }
  };

  const submitRun = async () => {
    if (!numericProperty) {
      toastHelpers.error('Pick a property first.');
      return;
    }
    setBusy('create-run');
    try {
      const run = await createPayrollRun({
        propertyId: numericProperty,
        periodStart,
        periodEnd,
        rebuildExisting: rebuild,
      });
      toastHelpers.success(`Run for ${run.periodStart.slice(0, 10)} to ${run.periodEnd.slice(0, 10)} generated`);
      setShowRunModal(false);
      setSelectedRun(run);
      await load();
    } catch (err) {
      toastHelpers.error(err instanceof Error ? err.message : 'Could not create the run.');
    } finally {
      setBusy(null);
    }
  };

  const approve = async (run: ApiPayrollRun) => {
    setBusy(`approve-${run.id}`);
    try {
      const updated = await approvePayrollRun(run.id);
      setSelectedRun(updated);
      toastHelpers.success('Payroll approved and locked');
      await load();
    } catch (err) {
      toastHelpers.error(err instanceof Error ? err.message : 'Could not approve.');
    } finally {
      setBusy(null);
    }
  };

  const pay = async (run: ApiPayrollRun) => {
    setBusy(`pay-${run.id}`);
    try {
      const updated = await payPayrollRun(run.id);
      setSelectedRun(updated);
      toastHelpers.success('Marked as paid');
      await load();
    } catch (err) {
      toastHelpers.error(err instanceof Error ? err.message : 'Could not mark as paid.');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (run: ApiPayrollRun) => {
    const reason = window.prompt('Why is this run being cancelled? This goes on the record.');
    if (!reason) return;
    setBusy(`cancel-${run.id}`);
    try {
      const updated = await cancelPayrollRun(run.id, reason);
      setSelectedRun(updated);
      toastHelpers.success('Run cancelled');
      await load();
    } catch (err) {
      toastHelpers.error(err instanceof Error ? err.message : 'Could not cancel.');
    } finally {
      setBusy(null);
    }
  };

  const startComp = (existing?: ApiCompensation) => {
    if (existing) {
      setCompUserId(String(existing.userId));
      setCompPayType(existing.payType);
      setCompBase(String(existing.baseAmount));
      setCompMultiplier(String(existing.overtimeMultiplier));
      setCompHours(String(existing.standardHours));
      setCompAllowances(String(existing.allowances));
      setCompDeductions(String(existing.otherDeductions));
      setEditingComp(existing);
      return;
    }
    setCompUserId(String(users[0]?.id ?? ''));
    setCompPayType('salary');
    setCompBase('15000');
    setCompMultiplier('1.5');
    setCompHours('173.33');
    setCompAllowances('0');
    setCompDeductions('0');
    setEditingComp('new');
  };

  const saveComp = async () => {
    if (!numericProperty) return;
    if (!compUserId) {
      toastHelpers.error('Pick a staff member.');
      return;
    }
    setBusy('save-comp');
    try {
      await upsertCompensation({
        propertyId: numericProperty,
        userId: Number(compUserId),
        payType: compPayType,
        baseAmount: Number(compBase),
        overtimeMultiplier: Number(compMultiplier),
        standardHours: Number(compHours),
        allowances: Number(compAllowances),
        otherDeductions: Number(compDeductions),
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
      toastHelpers.success('Pay package saved');
      setEditingComp(null);
      await load();
    } catch (err) {
      toastHelpers.error(err instanceof Error ? err.message : 'Could not save the package.');
    } finally {
      setBusy(null);
    }
  };

  const latest = runs[0];
  const pending = runs.filter((r) => r.status === 'draft').length;
  const yearNet = useMemo(
    () => runs.filter((r) => r.status === 'paid').reduce((sum, r) => sum + r.totalNet, 0),
    [runs],
  );

  const staffWithoutPackage = useMemo(() => {
    const covered = new Set(compensations.filter((c) => c.active).map((c) => c.userId));
    return users.filter((u) => u.status === 'active' && !covered.has(Number(u.id)));
  }, [compensations, users]);

  if (!canManage) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 text-center">
        <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">Payroll is restricted</p>
        <p className="text-sm text-muted-foreground mt-1">Your own payslips are available from your profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-muted-foreground">Generate, approve, and pay staff from clocked hours and agreed packages</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            aria-label="Payroll property"
            className="px-3 py-2 bg-muted border border-border rounded-lg text-sm"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.propertyId}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => void load()}
            className="px-3 py-2 bg-muted rounded-lg text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => {
              setPeriodStart(monthStart());
              setPeriodEnd(monthEnd());
              setRebuild(false);
              setShowRunModal(true);
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Payroll Run
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 text-danger mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Latest Run Net', value: latest ? money(latest.totalNet, latest.currency) : 'No runs yet', hint: latest ? latest.status : '' },
          { label: 'Paid This Year', value: money(yearNet), hint: 'only settled runs count' },
          { label: 'Draft Runs', value: String(pending), hint: 'awaiting sign-off' },
          { label: 'Active Packages', value: String(compensations.filter((c) => c.active).length), hint: `${staffWithoutPackage.length} staff unconfigured` },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Runs</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No payroll has been run for this property yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Period</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Staff</th>
                <th className="text-right p-3">Gross</th>
                <th className="text-right p-3">Deductions</th>
                <th className="text-right p-3">Net</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-border/60">
                  <td className="p-3">
                    {run.periodStart.slice(0, 10)} to {run.periodEnd.slice(0, 10)}
                    <div className="text-xs text-muted-foreground">by {run.createdBy}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[run.status] ?? 'bg-muted'}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">{run.employeeCount}</td>
                  <td className="p-3 text-right">{money(run.totalGross, run.currency)}</td>
                  <td className="p-3 text-right">{money(run.totalDeductions, run.currency)}</td>
                  <td className="p-3 text-right font-medium">{money(run.totalNet, run.currency)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {run.status === 'draft' && canSignOff && run.createdBy !== user?.name && (
                        <button
                          onClick={() => void approve(run)}
                          disabled={busy === `approve-${run.id}`}
                          className="px-2 py-1 bg-info/15 text-info rounded text-xs flex items-center gap-1"
                        >
                          <BadgeCheck className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {run.status === 'draft' && canSignOff && run.createdBy === user?.name && (
                        <span className="text-xs text-muted-foreground">Needs a second admin</span>
                      )}
                      {run.status === 'draft' && !canSignOff && (
                        <span className="text-xs text-muted-foreground">Awaiting admin</span>
                      )}
                      {run.status === 'approved' && canSignOff && (
                        <button
                          onClick={() => void pay(run)}
                          disabled={busy === `pay-${run.id}`}
                          className="px-2 py-1 bg-success/15 text-success rounded text-xs flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Mark paid
                        </button>
                      )}
                      {(run.status === 'draft' || run.status === 'approved') && (
                        <button
                          onClick={() => void cancel(run)}
                          disabled={busy === `cancel-${run.id}`}
                          className="px-2 py-1 bg-danger/10 text-danger rounded text-xs flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" /> Cancel
                        </button>
                      )}
                      <button
                        onClick={() => void openRun(run)}
                        disabled={busy === `open-${run.id}`}
                        className="px-2 py-1 bg-muted rounded text-xs flex items-center gap-1"
                      >
                        Payslips <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Pay packages</h2>
            <p className="text-xs text-muted-foreground">A new package retires the old one. Historic payslips keep the rate they were priced at.</p>
          </div>
          <button
            onClick={() => startComp()}
            className="px-3 py-2 bg-muted rounded-lg text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Set package
          </button>
        </div>
        {compensations.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nobody has a pay package yet. Payroll cannot run until at least one exists.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Staff</th>
                <th className="text-left p-3">Type</th>
                <th className="text-right p-3">Base</th>
                <th className="text-right p-3">Overtime</th>
                <th className="text-right p-3">Allowances</th>
                <th className="text-right p-3">Deductions</th>
                <th className="text-left p-3">From</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {compensations.filter((c) => c.active).map((comp) => (
                <tr key={comp.id} className="border-t border-border/60">
                  <td className="p-3">{comp.userName}</td>
                  <td className="p-3">{comp.payType}</td>
                  <td className="p-3 text-right">
                    {comp.payType === 'hourly' ? `${money(comp.baseAmount, comp.currency)}/h` : `${money(comp.baseAmount, comp.currency)}/month`}
                  </td>
                  <td className="p-3 text-right">{comp.overtimeMultiplier}x</td>
                  <td className="p-3 text-right">{money(comp.allowances, comp.currency)}</td>
                  <td className="p-3 text-right">{money(comp.otherDeductions, comp.currency)}</td>
                  <td className="p-3">{comp.effectiveFrom.slice(0, 10)}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => startComp(comp)} className="text-xs px-2 py-1 bg-muted rounded">
                      Change
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowRunModal(false)} />
          <div className="relative z-10 bg-popover border border-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">New payroll run</h2>
              <button onClick={() => setShowRunModal(false)} aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <label className="block text-sm">
              Period start
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-lg" />
            </label>
            <label className="block text-sm">
              Period end
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-lg" />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={rebuild} onChange={(e) => setRebuild(e.target.checked)} className="mt-1" />
              <span>
                Rebuild if this exact period already has a draft
                <span className="block text-xs text-muted-foreground">Approved or paid runs are never rebuilt.</span>
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              Hours come from attendance records in this period. Salaried staff are paid their package; hourly staff are paid for clocked hours only.
            </p>
            <button
              onClick={() => void submitRun()}
              disabled={busy === 'create-run'}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg flex items-center justify-center gap-2"
            >
              {busy === 'create-run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generate run
            </button>
          </div>
        </div>
      )}

      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedRun(null)} />
          <div className="relative z-10 bg-popover border border-border rounded-2xl w-full max-w-4xl max-h-[88vh] overflow-y-auto">
            <div className="p-5 border-b border-border flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  Payslips {selectedRun.periodStart.slice(0, 10)} to {selectedRun.periodEnd.slice(0, 10)}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedRun.status} · created by {selectedRun.createdBy}
                  {selectedRun.approvedBy ? ` · approved by ${selectedRun.approvedBy}` : ''}
                  {selectedRun.paidBy ? ` · paid by ${selectedRun.paidBy}` : ''}
                </p>
              </div>
              <button onClick={() => setSelectedRun(null)} aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Staff</th>
                  <th className="text-right p-3">Hours</th>
                  <th className="text-right p-3">Base</th>
                  <th className="text-right p-3">Overtime</th>
                  <th className="text-right p-3">Allowances</th>
                  <th className="text-right p-3">Gross</th>
                  <th className="text-right p-3">PAYE</th>
                  <th className="text-right p-3">UIF</th>
                  <th className="text-right p-3">Other</th>
                  <th className="text-right p-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {(selectedRun.payslips ?? []).map((slip: ApiPayslip) => (
                  <tr key={slip.id} className="border-t border-border/60">
                    <td className="p-3">{slip.userName}<div className="text-xs text-muted-foreground">{slip.payType} · {slip.taxYear}</div></td>
                    <td className="p-3 text-right">{slip.hoursWorked}{slip.overtimeHours ? ` (+${slip.overtimeHours} OT)` : ''}</td>
                    <td className="p-3 text-right">{money(slip.baseAmount, slip.currency)}</td>
                    <td className="p-3 text-right">{money(slip.overtimeAmount, slip.currency)}</td>
                    <td className="p-3 text-right">{money(slip.allowances, slip.currency)}</td>
                    <td className="p-3 text-right">{money(slip.grossPay, slip.currency)}</td>
                    <td className="p-3 text-right">{money(slip.paye, slip.currency)}</td>
                    <td className="p-3 text-right">{money(slip.uif, slip.currency)}</td>
                    <td className="p-3 text-right">{money(slip.otherDeductions, slip.currency)}</td>
                    <td className="p-3 text-right font-medium">{money(slip.netPay, slip.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td className="p-3" colSpan={5}>Totals ({selectedRun.employeeCount} staff)</td>
                  <td className="p-3 text-right">{money(selectedRun.totalGross, selectedRun.currency)}</td>
                  <td className="p-3" colSpan={3} />
                  <td className="p-3 text-right">{money(selectedRun.totalNet, selectedRun.currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {editingComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditingComp(null)} />
          <div className="relative z-10 bg-popover border border-border rounded-2xl w-full max-w-lg p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingComp === 'new' ? 'Set pay package' : 'Change pay package'}</h2>
              <button onClick={() => setEditingComp(null)} aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <label className="block text-sm">
              Staff member
              <select
                value={compUserId}
                onChange={(e) => setCompUserId(e.target.value)}
                disabled={editingComp !== 'new'}
                className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-lg disabled:opacity-60"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Pay type
                <select
                  value={compPayType}
                  onChange={(e) => setCompPayType(e.target.value as 'salary' | 'hourly')}
                  className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-lg"
                >
                  <option value="salary">Monthly salary</option>
                  <option value="hourly">Hourly</option>
                </select>
              </label>
              <label className="block text-sm">
                {compPayType === 'hourly' ? 'Rate per hour' : 'Monthly salary'}
                <input value={compBase} onChange={(e) => setCompBase(e.target.value)} inputMode="decimal" className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-lg" />
              </label>
              <label className="block text-sm">
                Overtime multiplier
                <input value={compMultiplier} onChange={(e) => setCompMultiplier(e.target.value)} inputMode="decimal" className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-lg" />
              </label>
              <label className="block text-sm">
                Contracted hours / month
                <input value={compHours} onChange={(e) => setCompHours(e.target.value)} inputMode="decimal" className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-lg" />
              </label>
              <label className="block text-sm">
                Monthly allowances
                <input value={compAllowances} onChange={(e) => setCompAllowances(e.target.value)} inputMode="decimal" className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-lg" />
              </label>
              <label className="block text-sm">
                Other deductions
                <input value={compDeductions} onChange={(e) => setCompDeductions(e.target.value)} inputMode="decimal" className="mt-1 w-full px-3 py-2 bg-muted border border-border rounded-lg" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              PAYE and UIF are calculated on gross using the statutory tables in the payroll engine. A new package starts today and retires the previous one.
            </p>
            <button
              onClick={() => void saveComp()}
              disabled={busy === 'save-comp'}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg flex items-center justify-center gap-2"
            >
              {busy === 'save-comp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
              Save package
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollPage;
