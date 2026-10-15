import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Tag, Plus, Search, Edit, Trash2, X, 
  Calendar, DollarSign, TrendingUp,
  ChevronLeft, ChevronRight, Copy, ToggleLeft, ToggleRight
} from 'lucide-react';

interface RatePlan {
  id: string;
  name: string;
  description: string;
  roomType: string;
  baseRate: number;
  weekendRate: number;
  peakRate: number;
  status: 'active' | 'inactive';
  minStay: number;
  maxStay: number;
  validFrom: string;
  validTo: string;
  mealPlan: string;
  cancellation: string;
  bookings: number;
  revenue: number;
}

const mockRatePlans: RatePlan[] = [
  { id: 'RP001', name: 'Standard Rate', description: 'Best available rate', roomType: 'Standard', baseRate: 850, weekendRate: 1050, peakRate: 1200, status: 'active', minStay: 1, maxStay: 30, validFrom: '2026-01-01', validTo: '2026-12-31', mealPlan: 'Room Only', cancellation: 'Free cancellation 24h before', bookings: 145, revenue: 123250 },
  { id: 'RP002', name: 'Weekend Special', description: 'Special rate for Fri-Sun', roomType: 'All', baseRate: 950, weekendRate: 950, peakRate: 1100, status: 'active', minStay: 2, maxStay: 14, validFrom: '2026-01-01', validTo: '2026-12-31', mealPlan: 'Breakfast Included', cancellation: 'Free cancellation 48h before', bookings: 89, revenue: 84550 },
  { id: 'RP003', name: 'Corporate Rate', description: 'For business travelers', roomType: 'Deluxe', baseRate: 1200, weekendRate: 1400, peakRate: 1600, status: 'active', minStay: 1, maxStay: 90, validFrom: '2026-01-01', validTo: '2026-12-31', mealPlan: 'Breakfast Included', cancellation: 'Free cancellation 72h before', bookings: 67, revenue: 80400 },
  { id: 'RP004', name: 'VIP Package', description: 'Premium experience', roomType: 'Suite', baseRate: 2500, weekendRate: 3000, peakRate: 3500, status: 'active', minStay: 2, maxStay: 30, validFrom: '2026-01-01', validTo: '2026-12-31', mealPlan: 'All Inclusive', cancellation: 'Free cancellation anytime', bookings: 34, revenue: 85000 },
  { id: 'RP005', name: 'Early Bird', description: 'Book 30 days ahead', roomType: 'Standard', baseRate: 700, weekendRate: 850, peakRate: 950, status: 'active', minStay: 1, maxStay: 14, validFrom: '2026-01-01', validTo: '2026-06-30', mealPlan: 'Room Only', cancellation: 'Non-refundable', bookings: 56, revenue: 39200 },
  { id: 'RP006', name: 'Holiday Season', description: 'Peak season rates', roomType: 'All', baseRate: 1500, weekendRate: 1800, peakRate: 2200, status: 'inactive', minStay: 3, maxStay: 14, validFrom: '2026-12-15', validTo: '2027-01-05', mealPlan: 'Breakfast Included', cancellation: 'Free cancellation 14 days before', bookings: 0, revenue: 0 },
];

const RateManagementPage = () => {
  const [ratePlans, setRatePlans] = useState<RatePlan[]>(mockRatePlans);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState<RatePlan | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredRates = useMemo(() => {
    return ratePlans.filter(rate => {
      const matchesSearch = rate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           rate.roomType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || rate.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [ratePlans, searchQuery, statusFilter]);

  const totalRevenue = ratePlans.reduce((sum, r) => sum + r.revenue, 0);
  const totalBookings = ratePlans.reduce((sum, r) => sum + r.bookings, 0);
  const avgRate = ratePlans.filter(r => r.status === 'active').reduce((sum, r) => sum + r.baseRate, 0) / ratePlans.filter(r => r.status === 'active').length || 0;

  const toggleStatus = (id: string) => {
    setRatePlans(prev => prev.map(r => 
      r.id === id ? { ...r, status: r.status === 'active' ? 'inactive' : 'active' } : r
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rate Management</h1>
          <p className="text-muted-foreground">Manage room rates, seasonal pricing, and rate plans</p>
        </div>
        <button 
          onClick={() => { setEditingRate(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Rate Plan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">R{avgRate.toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Avg Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border border-success/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/15 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">R{totalRevenue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border border-info/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info/15 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalBookings}</p>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border border-warning/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning/15 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ratePlans.filter(r => r.status === 'active').length}</p>
              <p className="text-sm text-muted-foreground">Active Plans</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRates.map((rate) => (
          <motion.div
            key={rate.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
          >
            {/* Header */}
            <div className={`p-4 ${rate.status === 'active' ? 'border-b border-border/30' : 'bg-muted/30 border-b border-border/30'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{rate.name}</h3>
                  <p className="text-sm text-muted-foreground">{rate.description}</p>
                </div>
                <button
                  onClick={() => toggleStatus(rate.id)}
                  className={`p-1 rounded ${rate.status === 'active' ? 'text-success' : 'text-gray-400'}`}
                >
                  {rate.status === 'active' ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>
            </div>

            {/* Pricing */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Weekday</p>
                  <p className="font-bold">R{rate.baseRate}</p>
                </div>
                <div className="text-center p-2 bg-info/10 rounded-lg">
                  <p className="text-xs text-info">Weekend</p>
                  <p className="font-bold">R{rate.weekendRate}</p>
                </div>
                <div className="text-center p-2 bg-warning/10 rounded-lg">
                  <p className="text-xs text-warning">Peak</p>
                  <p className="font-bold">R{rate.peakRate}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Room Type</span>
                <span className="font-medium">{rate.roomType}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Meal Plan</span>
                <span className="font-medium">{rate.mealPlan}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Min Stay</span>
                <span className="font-medium">{rate.minStay} night(s)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bookings</span>
                <span className="font-medium">{rate.bookings}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-medium text-success">R{rate.revenue.toLocaleString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-border/30 flex gap-2">
              <button 
                onClick={() => { setEditingRate(rate); setShowModal(true); }}
                className="flex-1 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              <button className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <Copy className="w-4 h-4" />
              </button>
              <button className="p-2 bg-danger/15 text-danger rounded-lg hover:bg-danger/30 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Rate Calendar Preview */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Rate Calendar Preview
          </h3>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-muted rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-muted border border-border rounded-lg text-sm"
            />
            <button className="p-2 hover:bg-muted rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-sm text-muted-foreground py-2">{day}</div>
          ))}
          {Array.from({ length: 28 }, (_, i) => {
            const date = new Date(2026, 2, i + 1);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday = i + 1 === 27;
            return (
              <div 
                key={i}
                className={`p-2 rounded-lg text-center text-sm cursor-pointer transition-colors ${
                  isToday ? 'bg-primary text-primary-foreground' :
                  isWeekend ? 'bg-info/15 hover:bg-info/30' : 
                  'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <p className="font-medium">{i + 1}</p>
                <p className="text-xs opacity-70">R{isWeekend ? '1050' : '850'}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 bg-popover border border-border rounded-2xl shadow-overlay w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{editingRate ? 'Edit Rate Plan' : 'New Rate Plan'}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Plan Name</label>
                  <input type="text" defaultValue={editingRate?.name} placeholder="e.g., Weekend Special" className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <input type="text" defaultValue={editingRate?.description} placeholder="Brief description" className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Room Type</label>
                    <select defaultValue={editingRate?.roomType} className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors">
                      <option value="Standard">Standard</option>
                      <option value="Deluxe">Deluxe</option>
                      <option value="Suite">Suite</option>
                      <option value="All">All Types</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Meal Plan</label>
                    <select defaultValue={editingRate?.mealPlan} className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors">
                      <option value="Room Only">Room Only</option>
                      <option value="Breakfast Included">Breakfast Included</option>
                      <option value="Half Board">Half Board</option>
                      <option value="All Inclusive">All Inclusive</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Weekday Rate (R)</label>
                    <input type="number" defaultValue={editingRate?.baseRate} className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Weekend Rate (R)</label>
                    <input type="number" defaultValue={editingRate?.weekendRate} className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Peak Rate (R)</label>
                    <input type="number" defaultValue={editingRate?.peakRate} className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Min Stay (nights)</label>
                    <input type="number" defaultValue={editingRate?.minStay || 1} className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Max Stay (nights)</label>
                    <input type="number" defaultValue={editingRate?.maxStay || 30} className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Valid From</label>
                    <input type="date" defaultValue={editingRate?.validFrom} className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Valid To</label>
                    <input type="date" defaultValue={editingRate?.validTo} className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Cancellation Policy</label>
                  <input type="text" defaultValue={editingRate?.cancellation} placeholder="e.g., Free cancellation 24h before" className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors">
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