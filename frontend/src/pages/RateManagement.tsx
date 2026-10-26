import { useState, useMemo, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Tag, Plus, Search, Edit, Trash2, X,
  DollarSign, Calendar, Copy, ToggleLeft, ToggleRight, Layers, Lock,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { RatePlan } from '../store/useAppStore';
import { newId } from '../utils/id';
import toastHelpers from '../lib/toast';

const ROOM_TYPE_OPTIONS = ['Standard', 'Deluxe', 'Suite', 'All'];

const SEASON_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'high', label: 'High' },
  { value: 'peak', label: 'Peak' },
];

const RESTRICTION_OPTIONS = ['Non-refundable', 'Advance purchase', 'Minimum 2 nights', 'Blackout dates', 'Members only'];

const SEASON_LABEL: Record<string, string> = { low: 'Low', shoulder: 'Shoulder', high: 'High', peak: 'Peak' };

const emptyForm = {
  name: '',
  season: 'low',
  baseRate: 850,
  minStay: 1,
  roomTypes: ['Standard'] as string[],
  restrictions: [] as string[],
};

const RateManagementPage = () => {
  const { ratePlans, addRatePlan, updateRatePlan, deleteRatePlan, addAuditLog } = useAppStore();
  const me = useAppStore((s) => s.user);
  const canManage = me?.role === 'admin' || me?.role === 'manager';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState<RatePlan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredRates = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return ratePlans.filter((rate) => {
      const matchesSearch = rate.name.toLowerCase().includes(q) ||
        rate.roomTypes.some((t) => t.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' ? rate.active : !rate.active);
      return matchesSearch && matchesStatus;
    });
  }, [ratePlans, searchQuery, statusFilter]);

  const activePlans = ratePlans.filter((r) => r.active);
  const avgRate = activePlans.length
    ? activePlans.reduce((sum, r) => sum + r.baseRate, 0) / activePlans.length
    : 0;
  const avgMinStay = ratePlans.length
    ? ratePlans.reduce((sum, r) => sum + r.minStay, 0) / ratePlans.length
    : 0;

  const audit = (action: string, plan: RatePlan, details: string) => addAuditLog({
    id: newId('LOG'),
    action,
    entityType: 'rate_plan',
    entityId: plan.id,
    entityName: plan.name,
    userId: me?.id ?? '',
    userName: me?.name ?? 'You',
    userRole: me?.role ?? '',
    details,
    timestamp: new Date().toISOString(),
  });

  const openCreate = () => {
    setEditingRate(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (rate: RatePlan) => {
    setEditingRate(rate);
    setForm({
      name: rate.name,
      season: rate.season,
      baseRate: rate.baseRate,
      minStay: rate.minStay,
      roomTypes: [...rate.roomTypes],
      restrictions: [...rate.restrictions],
    });
    setConfirmDeleteId(null);
    setShowModal(true);
  };

  const toggleStatus = (rate: RatePlan) => {
    const active = !rate.active;
    updateRatePlan(rate.id, { active });
    audit(active ? 'activate' : 'deactivate', rate, `Rate plan "${rate.name}" ${active ? 'activated' : 'deactivated'}`);
    toastHelpers.success(`Rate plan "${rate.name}" ${active ? 'activated' : 'deactivated'}`);
  };

  const handleCopy = (rate: RatePlan) => {
    const copy: RatePlan = { ...rate, id: newId('RP'), name: `${rate.name} (Copy)` };
    addRatePlan(copy);
    audit('create', copy, `Rate plan duplicated from "${rate.name}"`);
    toastHelpers.success(`Copied to "${copy.name}"`);
  };

  const handleDelete = (rate: RatePlan) => {
    deleteRatePlan(rate.id);
    audit('delete', rate, `Rate plan "${rate.name}" deleted`);
    setConfirmDeleteId(null);
    toastHelpers.success(`Rate plan "${rate.name}" deleted`);
  };

  const toggleListValue = (field: 'roomTypes' | 'restrictions', value: string) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((v) => v !== value) : [...f[field], value],
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingRate) {
      updateRatePlan(editingRate.id, {
        baseRate: form.baseRate,
        roomTypes: form.roomTypes,
        restrictions: form.restrictions,
      });
      audit('update', editingRate, `Rate plan "${editingRate.name}" updated`);
      toastHelpers.success(`Rate plan "${editingRate.name}" updated`);
      setShowModal(false);
      return;
    }
    if (!form.name.trim()) {
      toastHelpers.error('Plan name is required');
      return;
    }
    if (form.baseRate <= 0) {
      toastHelpers.error('Base rate must be greater than 0');
      return;
    }
    const plan: RatePlan = {
      id: newId('RP'),
      name: form.name.trim(),
      roomTypes: form.roomTypes,
      baseRate: form.baseRate,
      season: form.season,
      minStay: Math.max(1, form.minStay),
      active: true,
      restrictions: form.restrictions,
    };
    addRatePlan(plan);
    audit('create', plan, `Rate plan "${plan.name}" created`);
    toastHelpers.success(`Rate plan "${plan.name}" created`);
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rate Management</h1>
          <p className="text-muted-foreground">Manage room rates, seasonal pricing, and rate plans</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Rate Plan
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">R{avgRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-sm text-muted-foreground">Avg Active Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info/15 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ratePlans.length}</p>
              <p className="text-sm text-muted-foreground">Total Plans</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activePlans.length}</p>
              <p className="text-sm text-muted-foreground">Active Plans</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/15 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgMinStay.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">nights</span></p>
              <p className="text-sm text-muted-foreground">Avg Min Stay</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search rate plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'inactive'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as typeof statusFilter)}
              className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Rate Plans Grid */}
      {filteredRates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRates.map((rate) => (
            <motion.div
              key={rate.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
            >
              {/* Header */}
              <div className={`p-4 border-b border-border/30 ${rate.active ? '' : 'bg-muted/30'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{rate.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                        {SEASON_LABEL[rate.season] ?? rate.season}
                      </span>
                      <span className={`text-xs ${rate.active ? 'text-success' : 'text-muted-foreground'}`}>
                        {rate.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleStatus(rate)}
                    aria-label={`${rate.active ? 'Deactivate' : 'Activate'} ${rate.name}`}
                    className={`p-1 rounded ${rate.active ? 'text-success' : 'text-gray-400'}`}
                  >
                    {rate.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                </div>
              </div>

              {/* Pricing */}
              <div className="p-4 space-y-3">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Base Rate</p>
                  <p className="text-xl font-bold">
                    R{rate.baseRate.toLocaleString()}
                    <span className="text-xs font-normal text-muted-foreground"> /night</span>
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-muted-foreground shrink-0">Room Types</span>
                  <span className="font-medium text-right">{rate.roomTypes.length ? rate.roomTypes.join(', ') : 'All types'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Min Stay</span>
                  <span className="font-medium">{rate.minStay} night(s)</span>
                </div>
                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-muted-foreground shrink-0">Restrictions</span>
                  <span className="font-medium text-right">{rate.restrictions.length ? rate.restrictions.join(', ') : 'None'}</span>
                </div>
              </div>

              {/* Actions */}
              {canManage && (
                <div className="p-4 border-t border-border/30 flex gap-2">
                  {confirmDeleteId === rate.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(rate)}
                        className="flex-1 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Confirm delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openEdit(rate)}
                        className="flex-1 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleCopy(rate)}
                        aria-label={`Duplicate ${rate.name}`}
                        className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(rate.id)}
                        aria-label={`Delete ${rate.name}`}
                        className="p-2 bg-danger/15 text-danger rounded-lg hover:bg-danger/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Tag className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No rate plans found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {ratePlans.length ? 'Try a different search or filter.' : canManage ? 'Create your first plan to get started.' : 'Rate plan templates are set up by admin or a manager.'}
          </p>
          {!ratePlans.length && canManage && (
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New Rate Plan
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{editingRate ? 'Edit Rate Plan' : 'New Rate Plan'}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form className="space-y-4" onSubmit={handleSubmit}>
                {editingRate ? (
                  <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Plan Name</span>
                      <span className="font-medium">{editingRate.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Season</span>
                      <span className="font-medium">{SEASON_LABEL[editingRate.season] ?? editingRate.season}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Min Stay</span>
                      <span className="font-medium">{editingRate.minStay} night(s)</span>
                    </div>
                    <p className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      Name, season and minimum stay are set when the plan is created.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Plan Name</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g., Weekend Special"
                        className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Season</label>
                        <select
                          value={form.season}
                          onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        >
                          {SEASON_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Min Stay (nights)</label>
                        <input
                          type="number"
                          min={1}
                          value={form.minStay}
                          onChange={(e) => setForm((f) => ({ ...f, minStay: Number(e.target.value) }))}
                          className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="text-sm font-medium mb-2 block">Base Rate (R)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.baseRate}
                    onChange={(e) => setForm((f) => ({ ...f, baseRate: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <span className="text-sm font-medium mb-2 block">Room Types</span>
                  <div className="flex flex-wrap gap-2">
                    {ROOM_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleListValue('roomTypes', opt)}
                        className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                          form.roomTypes.includes(opt)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium mb-2 block">Restrictions</span>
                  <div className="flex flex-wrap gap-2">
                    {RESTRICTION_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleListValue('restrictions', opt)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          form.restrictions.includes(opt)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
                  >
                    {editingRate ? 'Save Changes' : 'Create Plan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RateManagementPage;
