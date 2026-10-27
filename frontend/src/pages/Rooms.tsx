import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DoorOpen, Plus, Search, Edit, Trash2, Eye, 
  Grid, List, 
  X, Save, Wrench, CheckCircle, BedDouble,
  Bath, Tv, Wifi, Wind, Coffee, Building,
  Calendar, Users, DollarSign, Fingerprint
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import toastHelpers from '../lib/toast';
import { newId } from '../utils/id';

const statusColors = {
  available: { bg: 'bg-success/15', text: 'text-success', border: 'border-success/30', icon: CheckCircle },
  occupied: { bg: 'bg-info/15', text: 'text-info', border: 'border-info/30', icon: Users },
  maintenance: { bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/30', icon: Wrench },
  cleaning: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', icon: CheckCircle },
  reserved: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', icon: Calendar },
};

const roomTypes = ['Standard Suite', 'Deluxe Room', 'Executive Suite', 'Presidential Suite', 'Ocean View', 'Beach Villa', 'Standard'];

const amenitiesList = [
  { id: 'wifi', name: 'WiFi', icon: Wifi },
  { id: 'tv', name: 'TV', icon: Tv },
  { id: 'ac', name: 'Air Conditioning', icon: Wind },
  { id: 'minibar', name: 'Mini Bar', icon: Coffee },
  { id: 'balcony', name: 'Balcony', icon: Building },
  { id: 'bathroom', name: 'Private Bathroom', icon: Bath },
  { id: 'kingbed', name: 'King Bed', icon: BedDouble },
  { id: 'kitchenette', name: 'Kitchenette', icon: Coffee },
  { id: 'jacuzzi', name: 'Jacuzzi', icon: Bath },
  { id: 'room_service', name: 'Room Service', icon: Coffee },
];

export default function Rooms() {
  const { rooms, properties, bookings, addRoom, updateRoom, deleteRoom } = useAppStore();
  const role = useAppStore((s) => s.user?.role);
  const me = useAppStore((s) => s.user);
  const isAdmin = role === 'admin';
  const canManage = role === 'admin' || role === 'manager';
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<typeof rooms[0] | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    propertyId: '1',
    number: '',
    type: 'Standard Suite',
    floor: 1,
    status: 'available' as typeof rooms[0]['status'],
    price: 1500,
    description: '',
    amenities: [] as string[],
  });

  const stats = useMemo(() => {
    return {
      total: rooms.length,
      available: rooms.filter(r => r.status === 'available').length,
      occupied: rooms.filter(r => r.status === 'occupied').length,
      maintenance: rooms.filter(r => r.status === 'maintenance').length,
      cleaning: rooms.filter(r => r.status === 'cleaning').length,
      avgPrice: Math.round(rooms.reduce((s, r) => s + r.price, 0) / rooms.length),
    };
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    let filtered = [...rooms];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.number.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.type === typeFilter);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    if (propertyFilter !== 'all') {
      filtered = filtered.filter(r => r.propertyId === propertyFilter);
    }
    
    return filtered;
  }, [rooms, searchQuery, typeFilter, statusFilter, propertyFilter]);

  const getRoomBookings = (roomId: string) => {
    return bookings.filter(b => b.roomId === roomId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditing && selectedRoom) {
      updateRoom(selectedRoom.id, formData);
      toastHelpers.room.updated();
    } else {
      const newRoom = {
        ...formData,
        id: newId('ROOM'),
        image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400',
      };
      addRoom(newRoom);
      toastHelpers.room.created();
    }
    
    setShowModal(false);
    resetForm();
  };

  const handleEdit = (room: typeof rooms[0]) => {
    setSelectedRoom(room);
    setFormData({
      propertyId: room.propertyId,
      number: room.number,
      type: room.type,
      floor: room.floor,
      status: room.status,
      price: room.price,
      description: room.description,
      amenities: room.amenities,
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = (roomId: string) => {
    if (confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      deleteRoom(roomId);
      toastHelpers.room.deleted();
    }
  };

  const handleViewDetails = (room: typeof rooms[0]) => {
    setSelectedRoom(room);
    setShowDetailModal(true);
  };

  const handleStatusChange = (roomId: string, newStatus: typeof rooms[0]['status']) => {
    updateRoom(roomId, { status: newStatus });
    toastHelpers.room.statusChanged();
  };

  const resetForm = () => {
    setFormData({
      propertyId: me?.propertyId ?? properties[0]?.propertyId ?? '1',
      number: '',
      type: 'Standard Suite',
      floor: 1,
      status: 'available',
      price: 1500,
      description: '',
      amenities: [],
    });
    setSelectedRoom(null);
    setIsEditing(false);
  };

  const openNewRoomModal = () => {
    resetForm();
    setShowModal(true);
  };

  const toggleAmenity = (amenityId: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter(a => a !== amenityId)
        : [...prev.amenities, amenityId]
    }));
  };

  const getAmenityIcon = (amenityId: string) => {
    const amenity = amenitiesList.find(a => a.id === amenityId);
    return amenity ? amenity.icon : DoorOpen;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <DoorOpen className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total Rooms</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-success/10 rounded-lg">
              <CheckCircle className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.available}</p>
              <p className="text-[10px] text-muted-foreground">Available</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-info/10 rounded-lg">
              <Users className="w-4 h-4 text-info" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.occupied}</p>
              <p className="text-[10px] text-muted-foreground">Occupied</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-warning/10 rounded-lg">
              <Wrench className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.maintenance}</p>
              <p className="text-[10px] text-muted-foreground">Maintenance</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-purple-500/10 rounded-lg">
              <CheckCircle className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.cleaning}</p>
              <p className="text-[10px] text-muted-foreground">Cleaning</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-cyan-500/10 rounded-lg">
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <p className="text-lg font-bold">R{stats.avgPrice.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Avg Price</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
            />
          </div>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
          >
            <option value="all">All Types</option>
            {roomTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
            <option value="cleaning">Cleaning</option>
            <option value="reserved">Reserved</option>
          </select>

          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
          >
            <option value="all">All Properties</option>
            {properties.map(p => (
              <option key={p.id} value={p.propertyId}>{p.name}</option>
            ))}
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
          {canManage && (
            <button onClick={openNewRoomModal} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Add Room
            </button>
          )}
        </div>
      </div>

      {/* Room Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          <AnimatePresence>
            {filteredRooms.map((room, index) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleViewDetails(room)}
                  className={`bg-card p-4 rounded-xl border-2 cursor-pointer transition-colors hover:shadow-md ${
                    room.status === 'available' ? 'border-success/30 bg-success/5' :
                    room.status === 'occupied' ? 'border-info/30 bg-info/5' :
                    room.status === 'maintenance' ? 'border-warning/30 bg-warning/5' :
                    room.status === 'cleaning' ? 'border-muted-foreground/30 bg-muted/30' :
                    'border-border bg-muted/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-bold">{room.number}</span>
                    <div className={`w-3 h-3 rounded-full ${
                      room.status === 'available' ? 'bg-success' :
                      room.status === 'occupied' ? 'bg-info' :
                      room.status === 'maintenance' ? 'bg-warning' :
                      room.status === 'cleaning' ? 'bg-purple-500' :
                      'bg-cyan-500'
                    }`} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1 truncate">{room.type}</p>
                  <p className="text-sm font-bold mb-3">R{room.price.toLocaleString()}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {room.amenities.includes('wifi') && <Wifi className="w-3 h-3 text-muted-foreground" />}
                      {room.amenities.includes('rfid') && <Fingerprint className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <span className="text-xs text-muted-foreground">Floor {room.floor}</span>
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Property</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Floor</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amenities</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => (
                <tr key={room.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                  <td className="py-3 px-4 font-medium">{room.number}</td>
                  <td className="py-3 px-4 text-sm">{properties.find(p => p.propertyId === room.propertyId)?.name || '-'}</td>
                  <td className="py-3 px-4 text-sm">{room.type}</td>
                  <td className="py-3 px-4 text-sm">{room.floor}</td>
                  <td className="py-3 px-4 font-medium">R{room.price.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[room.status].bg} ${statusColors[room.status].text}`}>
                      {room.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      {room.amenities.slice(0, 3).map((a, i) => {
                        const Icon = getAmenityIcon(a);
                        return <Icon key={i} className="w-3 h-3 text-muted-foreground" />;
                      })}
                      {room.amenities.length > 3 && <span className="text-xs text-muted-foreground">+{room.amenities.length - 3}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleViewDetails(room)} className="p-1.5 hover:bg-muted rounded-lg">
                        <Eye className="w-4 h-4" />
                      </button>
                      {canManage && (
                        <button onClick={() => handleEdit(room)} className="p-1.5 hover:bg-muted rounded-lg">
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDelete(room.id)} className="p-1.5 hover:bg-danger/10 rounded-lg text-danger">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
                <h3 className="text-lg font-semibold">{isEditing ? 'Edit Room' : 'Add New Room'}</h3>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Property</label>
                    <select
                      value={formData.propertyId}
                      onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      {properties.map(p => (
              <option key={p.id} value={p.propertyId}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Room Number</label>
                    <input
                      type="text"
                      required
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                      placeholder="101"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Room Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      {roomTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Floor</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={20}
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof formData.status })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    >
                      <option value="available">Available</option>
                      <option value="occupied">Occupied</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="cleaning">Cleaning</option>
                      <option value="reserved">Reserved</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Price (R)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors resize-none"
                      placeholder="Room description..."
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-2 block">Amenities</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-muted border border-border/30 rounded-xl max-h-32 overflow-y-auto">
                      {amenitiesList.map((amenity) => {
                        const Icon = amenity.icon;
                        return (
                          <button
                            key={amenity.id}
                            type="button"
                            onClick={() => toggleAmenity(amenity.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              formData.amenities.includes(amenity.id)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card border border-border/30 hover:bg-muted'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            {amenity.name}
                          </button>
                        );
                      })}
                    </div>
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
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {isEditing ? 'Update Room' : 'Add Room'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowDetailModal(false); setSelectedRoom(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-popover border border-border rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/30">
                <h3 className="text-lg font-semibold">Room {selectedRoom.number}</h3>
                <button onClick={() => { setShowDetailModal(false); setSelectedRoom(null); }} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-5 space-y-6">
                {/* Room Image Placeholder */}
                <div className="h-48 bg-gradient-to-br from-muted to-muted/50 rounded-xl flex items-center justify-center">
                  <DoorOpen className="w-16 h-16 text-muted-foreground/50" />
                </div>

                {/* Room Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-2xl font-bold">{selectedRoom.type}</h4>
                    <p className="text-muted-foreground">{properties.find(p => p.propertyId === selectedRoom.propertyId)?.name}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[selectedRoom.status].bg} ${statusColors[selectedRoom.status].text}`}>
                    {selectedRoom.status}
                  </span>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted rounded-xl">
                    <p className="text-2xl font-bold">R{selectedRoom.price.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Per Night</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-xl">
                    <p className="text-2xl font-bold">{selectedRoom.floor}</p>
                    <p className="text-xs text-muted-foreground">Floor</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-xl">
                    <p className="text-2xl font-bold">{getRoomBookings(selectedRoom.id).length}</p>
                    <p className="text-xs text-muted-foreground">Bookings</p>
                  </div>
                </div>

                {/* Description */}
                {selectedRoom.description && (
                  <div className="space-y-2">
                    <h5 className="font-medium">Description</h5>
                    <p className="text-sm text-muted-foreground">{selectedRoom.description}</p>
                  </div>
                )}

                {/* Amenities */}
                <div className="space-y-2">
                  <h5 className="font-medium">Amenities</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoom.amenities.map((a, i) => {
                      const amenity = amenitiesList.find(am => am.id === a);
                      const Icon = amenity ? amenity.icon : DoorOpen;
                      return (
                        <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm">
                          <Icon className="w-4 h-4" />
                          {amenity?.name || a}
                        </span>
                      );
                    })}
                    {selectedRoom.amenities.length === 0 && (
                      <p className="text-muted-foreground">No amenities listed</p>
                    )}
                  </div>
                </div>

                {/* Recent Bookings */}
                <div className="space-y-2">
                  <h5 className="font-medium">Recent Bookings</h5>
                  <div className="space-y-2">
                    {getRoomBookings(selectedRoom.id).slice(0, 3).map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                        <div>
                          <p className="font-medium">{booking.guestName}</p>
                          <p className="text-sm text-muted-foreground">{booking.checkIn} to {booking.checkOut}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          booking.status === 'checked-in' ? 'bg-success/15 text-success' :
                          booking.status === 'confirmed' ? 'bg-info/15 text-info' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    ))}
                    {getRoomBookings(selectedRoom.id).length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No bookings found</p>
                    )}
                  </div>
                </div>

                {/* Quick Status Change */}
                {canManage && (
                  <div className="space-y-2">
                    <h5 className="font-medium">Quick Status Change</h5>
                    <div className="flex flex-wrap gap-2">
                      {(['available', 'occupied', 'maintenance', 'cleaning', 'reserved'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(selectedRoom.id, status)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedRoom.status === status
                              ? `${statusColors[status].bg} ${statusColors[status].text}`
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                  {canManage && (
                    <button
                      onClick={() => { setShowDetailModal(false); handleEdit(selectedRoom); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border/30 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Room
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => { 
                        setShowDetailModal(false); 
                        handleDelete(selectedRoom.id); 
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-danger/10 text-danger rounded-xl text-sm font-medium hover:bg-danger/15 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Room
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
