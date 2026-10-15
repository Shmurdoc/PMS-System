import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Plus, Search, Edit, Trash2, Eye, 
  MoreHorizontal, Crown, Star, Phone, 
  MapPin, Calendar, CreditCard, Grid, List,
  X, Save, RefreshCw, Award
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import toastHelpers from '../lib/toast';

const segmentColors = {
  VIP: { bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/30' },
  Corporate: { bg: 'bg-info/15', text: 'text-info', border: 'border-info/30' },
  Frequent: { bg: 'bg-success/15', text: 'text-success', border: 'border-success/30' },
  New: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
};

const preferencesList = [
  'Ocean view', 'City view', 'High floor', 'Low floor', 'Quiet room',
  'Near elevator', 'Extra pillows', 'Extra blankets', 'Late checkout',
  'Early check-in', 'Breakfast included', 'Airport transfer', 'Spa access',
  'Gym access', 'Pool access', 'Balcony', 'Kitchenette', 'Pet friendly'
];

export default function Guests() {
  const { guests, bookings, addGuest, updateGuest, deleteGuest } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<typeof guests[0] | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    idNumber: '',
    nationality: '',
    segment: 'New' as 'VIP' | 'Frequent' | 'New' | 'Corporate',
    preferences: [] as string[],
    notes: '',
  });

  const stats = useMemo(() => {
    return {
      total: guests.length,
      vip: guests.filter(g => g.segment === 'VIP').length,
      frequent: guests.filter(g => g.segment === 'Frequent').length,
      newGuests: guests.filter(g => g.segment === 'New').length,
      totalPoints: guests.reduce((s, g) => s + g.loyaltyPoints, 0),
    };
  }, [guests]);

  const filteredGuests = useMemo(() => {
    let filtered = [...guests];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(g => 
        g.name.toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q) ||
        g.phone.includes(q) ||
        g.idNumber.includes(q)
      );
    }
    
    if (segmentFilter !== 'all') {
      filtered = filtered.filter(g => g.segment === segmentFilter);
    }
    
    return filtered;
  }, [guests, searchQuery, segmentFilter]);

  const getGuestBookings = (guestId: string) => {
    return bookings.filter(b => b.guestId === guestId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditing && selectedGuest) {
      updateGuest(selectedGuest.id, {
        ...formData,
        lastVisit: selectedGuest.lastVisit,
        createdAt: selectedGuest.createdAt,
      });
      toastHelpers.guest.updated();
    } else {
      const newGuest = {
        ...formData,
        id: `G${Date.now()}`,
        totalStays: 0,
        loyaltyPoints: 0,
        createdAt: new Date().toISOString().split('T')[0],
        lastVisit: '-',
      };
      addGuest(newGuest);
      toastHelpers.guest.created();
    }
    
    setShowModal(false);
    resetForm();
  };

  const handleEdit = (guest: typeof guests[0]) => {
    setSelectedGuest(guest);
    setFormData({
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      idNumber: guest.idNumber,
      nationality: guest.nationality,
      segment: guest.segment,
      preferences: guest.preferences,
      notes: guest.notes,
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = (guestId: string) => {
    if (confirm('Are you sure you want to delete this guest? This action cannot be undone.')) {
      deleteGuest(guestId);
      toastHelpers.guest.deleted();
    }
  };

  const handleViewDetails = (guest: typeof guests[0]) => {
    setSelectedGuest(guest);
    setShowDetailModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      idNumber: '',
      nationality: '',
      segment: 'New',
      preferences: [],
      notes: '',
    });
    setSelectedGuest(null);
    setIsEditing(false);
  };

  const openNewGuestModal = () => {
    resetForm();
    setShowModal(true);
  };

  const togglePreference = (pref: string) => {
    setFormData(prev => ({
      ...prev,
      preferences: prev.preferences.includes(pref)
        ? prev.preferences.filter(p => p !== pref)
        : [...prev.preferences, pref]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total Guests</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-warning/10 rounded-lg">
              <Crown className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.vip}</p>
              <p className="text-[10px] text-muted-foreground">VIP Guests</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-success/10 rounded-lg">
              <RefreshCw className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.frequent}</p>
              <p className="text-[10px] text-muted-foreground">Frequent</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-purple-500/10 rounded-lg">
              <Star className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.newGuests}</p>
              <p className="text-[10px] text-muted-foreground">New This Month</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-info/10 rounded-lg">
              <Award className="w-4 h-4 text-info" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.totalPoints.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total Points</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search guests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
            />
          </div>
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
          >
            <option value="all">All Segments</option>
            <option value="VIP">VIP</option>
            <option value="Frequent">Frequent</option>
            <option value="Corporate">Corporate</option>
            <option value="New">New</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg p-0.5">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={openNewGuestModal} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add Guest
          </button>
        </div>
      </div>

      {/* Guest Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredGuests.map((guest, index) => (
              <motion.div
                key={guest.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border rounded-xl p-5 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-primary-foreground font-semibold ${
                      guest.segment === 'VIP' ? 'bg-warning' :
                      guest.segment === 'Corporate' ? 'bg-info' :
                      guest.segment === 'Frequent' ? 'bg-success' :
                      'bg-primary'
                    }`}>
                      {guest.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="font-semibold">{guest.name}</h4>
                      <p className="text-sm text-muted-foreground">{guest.email}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <button className="p-1.5 rounded-lg hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium mb-4 ${segmentColors[guest.segment].bg} ${segmentColors[guest.segment].text}`}>
                  {guest.segment === 'VIP' && <Crown className="w-3 h-3 mr-1" />}
                  {guest.segment}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <p className="text-lg font-semibold">{guest.totalStays}</p>
                    <p className="text-xs text-muted-foreground">Stays</p>
                  </div>
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <p className="text-lg font-semibold">{guest.loyaltyPoints.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Points</p>
                  </div>
                  <div className="text-center p-2 bg-muted rounded-lg">
                    <p className="text-lg font-semibold">{guest.lastVisit}</p>
                    <p className="text-xs text-muted-foreground">Last</p>
                  </div>
                </div>

                {guest.preferences.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {guest.preferences.slice(0, 3).map((pref, i) => (
                      <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                        {pref}
                      </span>
                    ))}
                    {guest.preferences.length > 3 && (
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                        +{guest.preferences.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-border/30">
                  <button
                    onClick={() => handleViewDetails(guest)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm hover:bg-muted rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button
                    onClick={() => handleEdit(guest)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm hover:bg-muted rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(guest.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-danger hover:bg-danger/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Guest</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Segment</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stays</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Points</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Visit</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.map((guest) => (
                <tr key={guest.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-primary-foreground font-semibold ${
                        guest.segment === 'VIP' ? 'bg-warning' :
                        guest.segment === 'Corporate' ? 'bg-info' :
                        guest.segment === 'Frequent' ? 'bg-success' : 'bg-purple-500'
                      }`}>
                        {guest.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-medium">{guest.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">{guest.email}</span>
                      <span className="text-muted-foreground text-xs">{guest.phone}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${segmentColors[guest.segment].bg} ${segmentColors[guest.segment].text}`}>
                      {guest.segment}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium">{guest.totalStays}</td>
                  <td className="py-3 px-4 font-medium">{guest.loyaltyPoints.toLocaleString()}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{guest.lastVisit}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleViewDetails(guest)} className="p-1.5 hover:bg-muted rounded-lg">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(guest)} className="p-1.5 hover:bg-muted rounded-lg">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(guest.id)} className="p-1.5 hover:bg-danger/10 rounded-lg text-danger">
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

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowModal(false); resetForm(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">{isEditing ? 'Edit Guest' : 'Add New Guest'}</h3>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-2 block">Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      placeholder="John Doe"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      placeholder="john@example.com"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Phone</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      placeholder="+27 82 123 4567"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">ID Number</label>
                    <input
                      type="text"
                      value={formData.idNumber}
                      onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      placeholder="1234567890"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Nationality</label>
                    <input
                      type="text"
                      value={formData.nationality}
                      onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      placeholder="South Africa"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-2 block">Segment</label>
                    <select
                      value={formData.segment}
                      onChange={(e) => setFormData({ ...formData, segment: e.target.value as any })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="New">New Guest</option>
                      <option value="Frequent">Frequent</option>
                      <option value="VIP">VIP</option>
                      <option value="Corporate">Corporate</option>
                    </select>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-2 block">Preferences</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-muted border border-border/30 rounded-xl max-h-32 overflow-y-auto">
                      {preferencesList.map((pref) => (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => togglePreference(pref)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            formData.preferences.includes(pref)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          {pref}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-2 block">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors resize-none"
                      placeholder="Additional notes about this guest..."
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="flex-1 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 hover:shadow-lg transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {isEditing ? 'Update Guest' : 'Add Guest'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guest Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedGuest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowDetailModal(false); setSelectedGuest(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">Guest Details</h3>
                <button onClick={() => { setShowDetailModal(false); setSelectedGuest(null); }} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-5 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl text-primary-foreground font-semibold ${
                    selectedGuest.segment === 'VIP' ? 'bg-warning' :
                    selectedGuest.segment === 'Corporate' ? 'bg-info' :
                    selectedGuest.segment === 'Frequent' ? 'bg-success' :
                    'bg-primary'
                  }`}>
                    {selectedGuest.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold">{selectedGuest.name}</h4>
                    <p className="text-muted-foreground">{selectedGuest.email}</p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium mt-1 ${segmentColors[selectedGuest.segment].bg} ${segmentColors[selectedGuest.segment].text}`}>
                      {selectedGuest.segment}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-xl">
                    <p className="text-2xl font-bold">{selectedGuest.totalStays}</p>
                    <p className="text-xs text-muted-foreground">Total Stays</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-xl">
                    <p className="text-2xl font-bold">{selectedGuest.loyaltyPoints.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Loyalty Points</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-xl">
                    <p className="text-2xl font-bold">{getGuestBookings(selectedGuest.id).length}</p>
                    <p className="text-xs text-muted-foreground">Bookings</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-xl">
                    <p className="text-2xl font-bold">{selectedGuest.lastVisit}</p>
                    <p className="text-xs text-muted-foreground">Last Visit</p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <h5 className="font-medium">Contact Information</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{selectedGuest.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{selectedGuest.nationality || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{selectedGuest.idNumber || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Member since {selectedGuest.createdAt}</span>
                    </div>
                  </div>
                </div>

                {/* Preferences */}
                {selectedGuest.preferences.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="font-medium">Preferences</h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedGuest.preferences.map((pref, i) => (
                        <span key={i} className="px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-full">
                          {pref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedGuest.notes && (
                  <div className="space-y-3">
                    <h5 className="font-medium">Notes</h5>
                    <p className="text-sm text-muted-foreground p-4 bg-muted rounded-xl">
                      {selectedGuest.notes}
                    </p>
                  </div>
                )}

                {/* Recent Bookings */}
                <div className="space-y-3">
                  <h5 className="font-medium">Recent Bookings</h5>
                  <div className="space-y-2">
                    {getGuestBookings(selectedGuest.id).slice(0, 5).map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                        <div>
                          <p className="font-medium">{booking.propertyName} - Room {booking.roomNumber}</p>
                          <p className="text-sm text-muted-foreground">{booking.checkIn} to {booking.checkOut}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          booking.status === 'checked-in' ? 'bg-success/15 text-success' :
                          booking.status === 'confirmed' ? 'bg-info/15 text-info' :
                          booking.status === 'checked-out' ? 'bg-slate-500/20 text-slate-400' :
                          'bg-warning/15 text-warning'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    ))}
                    {getGuestBookings(selectedGuest.id).length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No bookings found</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                  <button
                    onClick={() => { setShowDetailModal(false); handleEdit(selectedGuest); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Guest
                  </button>
                  <button
                    onClick={() => { 
                      setShowDetailModal(false); 
                      handleDelete(selectedGuest.id); 
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-danger/10 text-danger rounded-xl text-sm font-medium hover:bg-danger/15 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Guest
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
