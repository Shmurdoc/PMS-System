import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Edit, Eye, MapPin, X,
  Users, CheckCircle, Wrench, RefreshCw, Calendar as CalendarIcon,
  DoorOpen, Star, Grid, List, Clock, AlertTriangle, Trash2,
  BedDouble, Maximize2, Building, Save, Phone, Mail,
  ChevronDown
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Room, Property } from '../store/useAppStore';
import { toast } from 'sonner';

// ─── colour maps ──────────────────────────────────────────────────────────────
const roomStatusColors: Record<string, string> = {
  available:   'bg-success/15 text-success',
  occupied:    'bg-info/15 text-info',
  maintenance: 'bg-danger/15 text-danger',
  cleaning:    'bg-warning/15 text-warning',
  reserved:    'bg-cyan-500/20 text-cyan-400',
};

const roomStatusIcons: Record<string, React.ElementType> = {
  available:   CheckCircle,
  occupied:    Users,
  maintenance: Wrench,
  cleaning:    RefreshCw,
  reserved:    CalendarIcon,
};

const ROOM_TYPES = ['Standard', 'Deluxe', 'Executive Suite', 'Presidential Suite', 'Ocean View', 'Beach Villa', 'Garden Suite', 'Penthouse'];
const BED_TYPES = ['King', 'Queen', 'Twin', 'Double', 'Single', 'California King'];
const VIEW_TYPES = ['Ocean', 'Garden', 'City', 'Mountain', 'Pool', 'Courtyard', 'None'];
const ROOM_STATUSES: Room['status'][] = ['available', 'occupied', 'maintenance', 'cleaning', 'reserved'];
const DEFAULT_AMENITIES = ['WiFi', 'TV', 'Mini Bar', 'Air Conditioning', 'Safe', 'Balcony', 'Room Service', 'Coffee Machine', 'Jacuzzi', 'Bathrobes', 'Hair Dryer', 'Iron'];

// ─── empty forms ──────────────────────────────────────────────────────────────
interface PropertyFormData {
  name: string;
  address: string;
  image: string;
  totalRooms: number;
  occupiedRooms: number;
  rating: number;
  phone: string;
  email: string;
  manager: string;
  checkInTime: string;
  checkOutTime: string;
  description: string;
}

const emptyPropertyForm: PropertyFormData = {
  name: '',
  address: '',
  image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
  totalRooms: 0,
  occupiedRooms: 0,
  rating: 4.5,
  phone: '',
  email: '',
  manager: '',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  description: '',
};

interface RoomFormData {
  number: string;
  type: string;
  floor: number;
  status: Room['status'];
  price: number;
  description: string;
  amenities: string[];
  image: string;
  maxOccupancy: number;
  bedType: string;
  size: number;
  view: string;
}

const emptyRoomForm: RoomFormData = {
  number: '',
  type: 'Standard',
  floor: 1,
  status: 'available',
  price: 1500,
  description: '',
  amenities: ['WiFi', 'TV', 'Air Conditioning'],
  image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
  maxOccupancy: 2,
  bedType: 'King',
  size: 30,
  view: 'Garden',
};

// ─── main component ───────────────────────────────────────────────────────────
export default function PropertyManagement() {
  const {
    properties, addProperty, updateProperty, deleteProperty,
    rooms, addRoom, updateRoom, deleteRoom,
    maintenanceTickets, bookings,
    addAuditLog,
  } = useAppStore();
  const me = useAppStore((s) => s.user);
const role = useAppStore((s) => s.user?.role);
  const isAdmin = role === 'admin';
  const canManage = role === 'admin' || role === 'manager';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(me?.propertyId ?? null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showMaintenance, setShowMaintenance] = useState(false);

  // Modals
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [editPropertyId, setEditPropertyId] = useState<string | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [viewRoomId, setViewRoomId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'property' | 'room'; id: string } | null>(null);

  // Forms
  const [propForm, setPropForm] = useState<PropertyFormData>({ ...emptyPropertyForm });
  const [roomForm, setRoomForm] = useState<RoomFormData>({ ...emptyRoomForm });
  const [propErrors, setPropErrors] = useState<Record<string, string>>({});
  const [roomErrors, setRoomErrors] = useState<Record<string, string>>({});

  // ── derived data ──────────────────────────────────────────────────────────
  const currentProperty = selectedPropertyId ? properties.find(p => p.propertyId === selectedPropertyId) : properties[0];
  const visibleProperties = isAdmin ? properties : properties.filter(p => p.propertyId === me?.propertyId);
  const propertyRooms = useMemo(
    () => currentProperty ? rooms.filter(r => r.propertyId === currentProperty.propertyId) : [],
    [currentProperty, rooms]
  );

  const filteredRooms = useMemo(() => {
    return propertyRooms.filter(room => {
      const matchesSearch = room.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            room.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (room.bedType ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [propertyRooms, searchQuery, statusFilter]);

  const roomStats = useMemo(() => ({
    total: propertyRooms.length,
    available: propertyRooms.filter(r => r.status === 'available').length,
    occupied: propertyRooms.filter(r => r.status === 'occupied').length,
    maintenance: propertyRooms.filter(r => r.status === 'maintenance').length,
    cleaning: propertyRooms.filter(r => r.status === 'cleaning').length,
    reserved: propertyRooms.filter(r => r.status === 'reserved').length,
  }), [propertyRooms]);

  const propertyMaintenanceTickets = useMemo(() => {
    if (!currentProperty) return [];
    const propertyRoomIds = new Set(propertyRooms.map(r => r.id));
    return maintenanceTickets.filter(t => t.roomId !== undefined && propertyRoomIds.has(t.roomId));
  }, [currentProperty, propertyRooms, maintenanceTickets]);

  // Current occupant for a room
  const getRoomOccupant = (roomId: string) => {
    return bookings.find(b => b.roomId === roomId && b.status === 'checked-in');
  };

  // ── Property CRUD ─────────────────────────────────────────────────────────
  const openNewProperty = () => {
    setPropForm({ ...emptyPropertyForm });
    setPropErrors({});
    setEditPropertyId(null);
    setShowPropertyModal(true);
  };

  const openEditProperty = (prop: Property) => {
    setPropForm({
      name: prop.name,
      address: prop.address,
      image: prop.image,
      totalRooms: prop.totalRooms,
      occupiedRooms: prop.occupiedRooms,
      rating: prop.rating,
      phone: prop.phone ?? '',
      email: prop.email ?? '',
      manager: prop.manager ?? '',
      checkInTime: prop.checkInTime ?? '14:00',
      checkOutTime: prop.checkOutTime ?? '11:00',
      description: prop.description ?? '',
    });
    setPropErrors({});
    setEditPropertyId(prop.id);
    setShowPropertyModal(true);
  };

  const handlePropertySubmit = () => {
    const errors: Record<string, string> = {};
    if (!propForm.name.trim()) errors.name = 'Property name is required';
    if (!propForm.address.trim()) errors.address = 'Address is required';
    if (propForm.rating < 0 || propForm.rating > 5) errors.rating = 'Rating must be 0-5';
    setPropErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const now = new Date().toISOString();
    if (editPropertyId) {
      updateProperty(editPropertyId, {
        name: propForm.name.trim(),
        address: propForm.address.trim(),
        image: propForm.image,
        totalRooms: propForm.totalRooms,
        occupiedRooms: propForm.occupiedRooms,
        rating: propForm.rating,
        phone: propForm.phone || undefined,
        email: propForm.email || undefined,
        manager: propForm.manager || undefined,
        checkInTime: propForm.checkInTime || undefined,
        checkOutTime: propForm.checkOutTime || undefined,
        description: propForm.description || undefined,
      });
      toast.success(`Property "${propForm.name}" updated`);
    } else {
      const newId = 'PROP' + Date.now().toString(36).toUpperCase();
      addProperty({
        id: newId,
        propertyId: newId,
        name: propForm.name.trim(),
        address: propForm.address.trim(),
        image: propForm.image,
        status: 'operational',
        totalRooms: propForm.totalRooms,
        occupiedRooms: propForm.occupiedRooms,
        rating: propForm.rating,
        phone: propForm.phone || undefined,
        email: propForm.email || undefined,
        manager: propForm.manager || undefined,
        checkInTime: propForm.checkInTime || undefined,
        checkOutTime: propForm.checkOutTime || undefined,
        description: propForm.description || undefined,
      });
      addAuditLog({
        id: 'AL' + Date.now(), action: 'create_property', userId: me?.id ?? '', userName: me?.name ?? 'You', userRole: me?.role ?? '',
        entityName: propForm.name, details: `Created property "${propForm.name}"`, timestamp: now, entityType: 'property', entityId: newId,
      });
      toast.success(`Property "${propForm.name}" created`);
    }
    setShowPropertyModal(false);
    setEditPropertyId(null);
  };

  // ── Room CRUD ─────────────────────────────────────────────────────────────
  const openNewRoom = () => {
    if (!currentProperty) { toast.error('Select a property first'); return; }
    setRoomForm({ ...emptyRoomForm });
    setRoomErrors({});
    setEditRoomId(null);
    setShowRoomModal(true);
  };

  const openEditRoom = (room: Room) => {
    setRoomForm({
      number: room.number,
      type: room.type,
      floor: room.floor,
      status: room.status,
      price: room.price,
      description: room.description,
      amenities: [...room.amenities],
      image: room.image,
      maxOccupancy: room.maxOccupancy ?? 2,
      bedType: room.bedType ?? 'King',
      size: room.size ?? 30,
      view: room.view ?? 'None',
    });
    setRoomErrors({});
    setEditRoomId(room.id);
    setShowRoomModal(true);
  };

  const handleRoomSubmit = () => {
    if (!currentProperty && !editRoomId) { toast.error('Select a property first'); return; }
    const errors: Record<string, string> = {};
    if (!roomForm.number.trim()) errors.number = 'Room number is required';
    if (roomForm.price <= 0) errors.price = 'Price must be positive';
    if (roomForm.maxOccupancy < 1) errors.maxOccupancy = 'At least 1 occupant required';
    // Check duplicate room number within same property
    const propId = editRoomId ? rooms.find(r => r.id === editRoomId)?.propertyId : currentProperty?.id;
    if (propId) {
      const dup = rooms.find(r => r.propertyId === propId && r.number === roomForm.number.trim() && r.id !== editRoomId);
      if (dup) errors.number = `Room ${roomForm.number} already exists in this property`;
    }
    setRoomErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const now = new Date().toISOString();
    if (editRoomId) {
      updateRoom(editRoomId, {
        number: roomForm.number.trim(),
        type: roomForm.type,
        floor: roomForm.floor,
        status: roomForm.status,
        price: roomForm.price,
        description: roomForm.description,
        amenities: roomForm.amenities,
        image: roomForm.image,
        maxOccupancy: roomForm.maxOccupancy,
        bedType: roomForm.bedType,
        size: roomForm.size,
        view: roomForm.view,
      });
      toast.success(`Room ${roomForm.number} updated`);
    } else {
      const newId = 'RM' + Date.now().toString(36).toUpperCase();
      addRoom({
        id: newId,
        propertyId: currentProperty!.propertyId,
        number: roomForm.number.trim(),
        type: roomForm.type,
        floor: roomForm.floor,
        status: roomForm.status,
        price: roomForm.price,
        description: roomForm.description,
        amenities: roomForm.amenities,
        image: roomForm.image,
        maxOccupancy: roomForm.maxOccupancy,
        bedType: roomForm.bedType,
        size: roomForm.size,
        view: roomForm.view,
      });
      // Update property total rooms count
      if (currentProperty) {
        updateProperty(currentProperty.id, { totalRooms: propertyRooms.length + 1 });
      }
      addAuditLog({
        id: 'AL' + Date.now(), action: 'create_room', userId: me?.id ?? '', userName: me?.name ?? 'You', userRole: me?.role ?? '',
        entityName: `Room ${roomForm.number}`, details: `Created room ${roomForm.number} at ${currentProperty?.name}`, timestamp: now,
        entityType: 'room', entityId: newId,
      });
      toast.success(`Room ${roomForm.number} created`);
    }
    setShowRoomModal(false);
    setEditRoomId(null);
  };

  const handleQuickStatusChange = (roomId: string, newStatus: Room['status']) => {
    updateRoom(roomId, { status: newStatus });
    const room = rooms.find(r => r.id === roomId);
    toast.success(`Room ${room?.number ?? roomId} → ${newStatus}`);
  };

  const handleDeleteConfirm = () => {
    if (!showDeleteConfirm) return;
    if (showDeleteConfirm.type === 'property') {
      const prop = properties.find(p => p.id === showDeleteConfirm.id);
      // Delete all rooms for this property
      const propRooms = prop ? rooms.filter(r => r.propertyId === prop.propertyId) : [];
      propRooms.forEach(r => deleteRoom(r.id));
      deleteProperty(showDeleteConfirm.id);
      if (prop && selectedPropertyId === prop.propertyId) setSelectedPropertyId(null);
      toast.success('Property and all its rooms deleted');
    } else {
      deleteRoom(showDeleteConfirm.id);
      if (currentProperty) {
        updateProperty(currentProperty.id, { totalRooms: Math.max(0, propertyRooms.length - 1) });
      }
      toast.success('Room deleted');
    }
    setShowDeleteConfirm(null);
  };

  // Toggle amenity in room form
  const toggleAmenity = (amenity: string) => {
    setRoomForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  // ── viewed room ───────────────────────────────────────────────────────────
  const viewedRoom = viewRoomId ? rooms.find(r => r.id === viewRoomId) : null;
  const viewedRoomOccupant = viewedRoom ? getRoomOccupant(viewedRoom.id) : null;
  const viewedRoomTickets = viewedRoom ? maintenanceTickets.filter(t => t.roomId === viewedRoom.id) : [];

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Property Management</h1>
          <p className="text-muted-foreground">Manage properties, rooms, and maintenance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMaintenance(!showMaintenance)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showMaintenance ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
          >
            <Wrench className="w-4 h-4" />
            Maintenance ({propertyMaintenanceTickets.length})
          </button>
          {canManage && (
            <button
              onClick={openNewRoom}
              className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            >
              <BedDouble className="w-4 h-4" />
              Add Room
            </button>
          )}
          {canManage && (
            <button
              onClick={openNewProperty}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Property
            </button>
          )}
        </div>
      </div>

      {/* Property Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleProperties.map((property) => {
          const isSelected = selectedPropertyId === property.propertyId || (!selectedPropertyId && properties[0]?.propertyId === property.propertyId);
          const propRoomCount = rooms.filter(r => r.propertyId === property.propertyId).length;
          const propOccupied = rooms.filter(r => r.propertyId === property.propertyId && r.status === 'occupied').length;
          return (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-card border border-border rounded-xl p-4 cursor-pointer transition-colors hover:border-primary/50 ${isSelected ? 'border-primary ring-2 ring-primary/20' : ''}`}
              onClick={() => setSelectedPropertyId(property.propertyId)}
            >
              <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden">
                <img src={property.image} alt={property.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-semibold truncate flex-1">{property.name}</h3>
                {canManage && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditProperty(property); }}
                    className="p-1 hover:bg-muted rounded transition-colors ml-1"
                    title="Edit Property"
                  >
                    <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {property.address}
              </p>
              {property.manager && (
                <p className="text-xs text-muted-foreground mt-1">Manager: {property.manager}</p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                <div className="flex items-center gap-1 text-sm">
                  <DoorOpen className="w-4 h-4 text-muted-foreground" />
                  <span>{propOccupied}/{propRoomCount}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-warning">
                  <Star className="w-4 h-4 fill-current" />
                  <span>{property.rating}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Room Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Total Rooms', value: roomStats.total, color: '', border: '' },
          { label: 'Available', value: roomStats.available, color: 'text-success', border: 'border-success/30' },
          { label: 'Occupied', value: roomStats.occupied, color: 'text-info', border: 'border-info/30' },
          { label: 'Reserved', value: roomStats.reserved, color: 'text-cyan-400', border: 'border-cyan-500/30' },
          { label: 'Cleaning', value: roomStats.cleaning, color: 'text-warning', border: 'border-warning/30' },
          { label: 'Maintenance', value: roomStats.maintenance, color: 'text-danger', border: 'border-danger/30' },
        ].map(s => (
          <div key={s.label} className={`bg-card border border-border rounded-xl p-4 text-center ${s.border ? `border ${s.border}` : ''}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Room Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search rooms by number, type, bed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="reserved">Reserved</option>
            <option value="cleaning">Cleaning</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Maintenance Panel */}
      <AnimatePresence>
        {showMaintenance && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Maintenance Tickets — {currentProperty?.name ?? 'All'}
            </h3>
            {propertyMaintenanceTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No maintenance tickets for this property</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {propertyMaintenanceTickets.map((ticket) => {
                  const StatusIcon = ticket.status === 'completed' ? CheckCircle : ticket.status === 'in_progress' ? Clock : AlertTriangle;
                  const statusColor = ticket.status === 'completed' ? 'text-success' : ticket.status === 'in_progress' ? 'text-warning' : 'text-danger';
                  const room = rooms.find(r => r.id === ticket.roomId);
                  return (
                    <div key={ticket.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                        <div>
                          <p className="font-medium text-sm">{ticket.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {room ? `Room ${room.number}` : ''} · {ticket.description?.slice(0, 60)}{(ticket.description?.length ?? 0) > 60 ? '...' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          ticket.priority === 'urgent' ? 'bg-danger/15 text-danger' :
                          ticket.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          ticket.priority === 'medium' ? 'bg-warning/15 text-warning' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {ticket.priority}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          ticket.status === 'completed' ? 'bg-success/15 text-success' :
                          ticket.status === 'in_progress' ? 'bg-warning/15 text-warning' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        {ticket.assignedTo && (
                          <span className="text-xs text-muted-foreground">{ticket.assignedTo}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ROOM GRID ── */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            const StatusIcon = roomStatusIcons[room.status] ?? CheckCircle;
            const occupant = getRoomOccupant(room.id);
            const roomTickets = maintenanceTickets.filter(t => t.roomId === room.id && t.status !== 'completed');
            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
              >
                <div className="aspect-video bg-muted relative">
                  <img src={room.image} alt={`Room ${room.number}`} className="w-full h-full object-cover" />
                  <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs flex items-center gap-1 ${roomStatusColors[room.status]}`}>
                    <StatusIcon className="w-3 h-3" />
                    {room.status}
                  </div>
                  {occupant && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full text-xs bg-black/60 text-white backdrop-blur-sm">
                      {occupant.guestName}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold">Room {room.number}</h3>
                    <span className="text-sm font-medium">R{room.price.toLocaleString()}/n</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span>{room.type}</span>
                    {room.bedType && <span>· {room.bedType}</span>}
                    {room.view && room.view !== 'None' && <span>· {room.view} view</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Max {room.maxOccupancy ?? 2}</span>
                    {room.size && <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3" /> {room.size}m²</span>}
                    <span>Floor {room.floor}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {room.amenities.slice(0, 3).map((amenity, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-muted rounded-full">{amenity}</span>
                    ))}
                    {room.amenities.length > 3 && (
                      <span className="text-xs px-2 py-0.5 bg-muted rounded-full">+{room.amenities.length - 3}</span>
                    )}
                  </div>
                  {roomTickets.length > 0 && (
                    <div className="pb-3">
                      <p className="text-xs text-warning flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {roomTickets.length} open ticket{roomTickets.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewRoomId(room.id)}
                      className="flex-1 py-2 text-sm bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    {canManage && (
                      <button
                        onClick={() => openEditRoom(room)}
                        className="flex-1 py-2 text-sm bg-muted rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {/* Quick status change */}
                    {canManage && (
                      <div className="relative group">
                        <button className="py-2 px-2 text-sm bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-colors z-20 min-w-[140px]">
                          {ROOM_STATUSES.filter(s => s !== room.status).map(s => (
                            <button
                              key={s}
                              onClick={() => handleQuickStatusChange(room.id, s)}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 ${roomStatusColors[s]}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filteredRooms.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <BedDouble className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No rooms found</p>
            </div>
          )}
        </div>
      ) : (
        /* ── ROOM TABLE ── */
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border/30">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type / Bed</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Floor</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Occupant</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room) => {
                  const StatusIcon = roomStatusIcons[room.status] ?? CheckCircle;
                  const occupant = getRoomOccupant(room.id);
                  return (
                    <tr key={room.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden">
                            <img src={room.image} alt={room.number} className="w-full h-full object-cover" />
                          </div>
                          <span className="font-medium">Room {room.number}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <p>{room.type}</p>
                        <p className="text-xs text-muted-foreground">{room.bedType ?? '—'} · {room.view ?? '—'} view</p>
                      </td>
                      <td className="py-3 px-4 text-sm">Floor {room.floor}</td>
                      <td className="py-3 px-4 text-sm font-medium">R{room.price.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${roomStatusColors[room.status]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {room.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {occupant ? (
                          <div>
                            <p className="font-medium">{occupant.guestName}</p>
                            <p className="text-xs text-muted-foreground">→ {occupant.checkOut}</p>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewRoomId(room.id)} className="p-1.5 hover:bg-muted rounded transition-colors" title="View">
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </button>
                          {canManage && (
                            <button onClick={() => openEditRoom(room)} className="p-1.5 hover:bg-muted rounded transition-colors" title="Edit">
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => setShowDeleteConfirm({ type: 'room', id: room.id })} className="p-1.5 hover:bg-danger/15 rounded transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4 text-danger" />
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
          {filteredRooms.length === 0 && (
            <div className="py-12 text-center">
              <BedDouble className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No rooms found</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ROOM DETAIL (VIEW) MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {viewedRoom && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewRoomId(null)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative z-10 bg-popover border border-border rounded-xl shadow-overlay w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">Room {viewedRoom.number}</h2>
                    <p className="text-muted-foreground">{currentProperty?.name}</p>
                  </div>
                  <button onClick={() => setViewRoomId(null)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                {/* Room Image */}
                <div className="aspect-video bg-muted rounded-xl mb-4 overflow-hidden">
                  <img src={viewedRoom.image} alt={`Room ${viewedRoom.number}`} className="w-full h-full object-cover" />
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Type</p>
                    <p className="font-semibold text-sm">{viewedRoom.type}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Bed</p>
                    <p className="font-semibold text-sm">{viewedRoom.bedType ?? '—'}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">View</p>
                    <p className="font-semibold text-sm">{viewedRoom.view ?? '—'}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Floor</p>
                    <p className="font-semibold text-sm">{viewedRoom.floor}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Price/Night</p>
                    <p className="font-semibold text-sm">R{viewedRoom.price.toLocaleString()}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Max Occupancy</p>
                    <p className="font-semibold text-sm">{viewedRoom.maxOccupancy ?? 2} guests</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Size</p>
                    <p className="font-semibold text-sm">{viewedRoom.size ?? '—'} m²</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${roomStatusColors[viewedRoom.status]}`}>
                      {viewedRoom.status}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {viewedRoom.description && (
                  <div className="bg-muted/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{viewedRoom.description}</p>
                  </div>
                )}

                {/* Amenities */}
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {viewedRoom.amenities.map((a, i) => (
                      <span key={i} className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full">{a}</span>
                    ))}
                  </div>
                </div>

                {/* Cleaning / Inspection info */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Last Cleaned</p>
                    <p className="text-sm">{viewedRoom.lastCleaned ? viewedRoom.lastCleaned.split('T')[0] : 'Not recorded'}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Last Inspected</p>
                    <p className="text-sm">{viewedRoom.lastInspected ? viewedRoom.lastInspected.split('T')[0] : 'Not recorded'}</p>
                  </div>
                </div>

                {/* Current Occupant */}
                {viewedRoomOccupant && (
                  <div className="bg-info/10 border border-info/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-info mb-1">Current Occupant</p>
                    <p className="font-medium">{viewedRoomOccupant.guestName}</p>
                    <p className="text-xs text-muted-foreground">
                      {viewedRoomOccupant.checkIn} → {viewedRoomOccupant.checkOut} ({viewedRoomOccupant.nights} nights)
                    </p>
                  </div>
                )}

                {/* Maintenance Tickets */}
                {viewedRoomTickets.length > 0 && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-warning mb-2">Maintenance Tickets ({viewedRoomTickets.length})</p>
                    {viewedRoomTickets.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-sm mb-1">
                        <span>{t.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          t.status === 'completed' ? 'bg-success/15 text-success' :
                          t.status === 'in_progress' ? 'bg-warning/15 text-warning' :
                          'bg-danger/15 text-danger'
                        }`}>{t.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {canManage && (
                    <button
                      onClick={() => { openEditRoom(viewedRoom); setViewRoomId(null); }}
                      className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" /> Edit Room
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => { setShowDeleteConfirm({ type: 'room', id: viewedRoom.id }); setViewRoomId(null); }}
                      className="py-2.5 px-4 bg-danger/15 text-danger rounded-lg hover:bg-danger/30 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          PROPERTY ADD/EDIT MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showPropertyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowPropertyModal(false); setEditPropertyId(null); }} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative z-10 bg-popover border border-border rounded-xl shadow-overlay w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Building className="w-5 h-5 text-primary" />
                    {editPropertyId ? 'Edit Property' : 'Add Property'}
                  </h2>
                  <button onClick={() => { setShowPropertyModal(false); setEditPropertyId(null); }} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-2 block">Property Name <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        value={propForm.name}
                        onChange={(e) => setPropForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Nexus Grand Hotel"
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${propErrors.name ? 'border-danger/50' : 'border-border/30'}`}
                      />
                      {propErrors.name && <p className="text-xs text-danger mt-1">{propErrors.name}</p>}
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-2 block">Address <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        value={propForm.address}
                        onChange={(e) => setPropForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="123 Luxury Ave, Cape Town"
                        className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${propErrors.address ? 'border-danger/50' : 'border-border/30'}`}
                      />
                      {propErrors.address && <p className="text-xs text-danger mt-1">{propErrors.address}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Manager</label>
                      <input type="text" value={propForm.manager} onChange={(e) => setPropForm(f => ({ ...f, manager: e.target.value }))} placeholder="John Smith" className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Rating (0-5)</label>
                      <input type="number" value={propForm.rating} min={0} max={5} step={0.1} onChange={(e) => setPropForm(f => ({ ...f, rating: parseFloat(e.target.value) || 0 }))} className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${propErrors.rating ? 'border-danger/50' : 'border-border/30'}`} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</label>
                      <input type="tel" value={propForm.phone} onChange={(e) => setPropForm(f => ({ ...f, phone: e.target.value }))} placeholder="+27 21 555 0000" className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
                      <input type="email" value={propForm.email} onChange={(e) => setPropForm(f => ({ ...f, email: e.target.value }))} placeholder="info@property.com" className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Check-in Time</label>
                      <input type="time" value={propForm.checkInTime} onChange={(e) => setPropForm(f => ({ ...f, checkInTime: e.target.value }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Check-out Time</label>
                      <input type="time" value={propForm.checkOutTime} onChange={(e) => setPropForm(f => ({ ...f, checkOutTime: e.target.value }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-2 block">Image URL</label>
                      <input type="url" value={propForm.image} onChange={(e) => setPropForm(f => ({ ...f, image: e.target.value }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-2 block">Description</label>
                      <textarea value={propForm.description} onChange={(e) => setPropForm(f => ({ ...f, description: e.target.value }))} placeholder="A brief description of the property..." className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors min-h-[60px]" />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button onClick={() => { setShowPropertyModal(false); setEditPropertyId(null); }} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                    <button onClick={handlePropertySubmit} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors flex items-center justify-center gap-2">
                      <Save className="w-4 h-4" /> {editPropertyId ? 'Update Property' : 'Create Property'}
                    </button>
                  </div>

                  {editPropertyId && isAdmin && (
                    <button
                      onClick={() => { setShowDeleteConfirm({ type: 'property', id: editPropertyId }); setShowPropertyModal(false); }}
                      className="w-full py-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/15 transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Property
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          ROOM ADD/EDIT MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showRoomModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowRoomModal(false); setEditRoomId(null); }} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative z-10 bg-popover border border-border rounded-xl shadow-overlay w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <BedDouble className="w-5 h-5 text-primary" />
                    {editRoomId ? `Edit Room ${roomForm.number}` : 'Add Room'}
                    {currentProperty && !editRoomId && <span className="text-sm font-normal text-muted-foreground ml-2">at {currentProperty.name}</span>}
                  </h2>
                  <button onClick={() => { setShowRoomModal(false); setEditRoomId(null); }} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Room Number <span className="text-danger">*</span></label>
                      <input type="text" value={roomForm.number} onChange={(e) => setRoomForm(f => ({ ...f, number: e.target.value }))} placeholder="101" className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${roomErrors.number ? 'border-danger/50' : 'border-border/30'}`} />
                      {roomErrors.number && <p className="text-xs text-danger mt-1">{roomErrors.number}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Type</label>
                      <select value={roomForm.type} onChange={(e) => setRoomForm(f => ({ ...f, type: e.target.value }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                        {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <select value={roomForm.status} onChange={(e) => setRoomForm(f => ({ ...f, status: e.target.value as Room['status'] }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                        {ROOM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Floor</label>
                      <input type="number" value={roomForm.floor} min={0} max={50} onChange={(e) => setRoomForm(f => ({ ...f, floor: parseInt(e.target.value) || 1 }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Price/Night (R) <span className="text-danger">*</span></label>
                      <input type="number" value={roomForm.price} min={0} step={100} onChange={(e) => setRoomForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className={`w-full px-4 py-2.5 bg-muted border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${roomErrors.price ? 'border-danger/50' : 'border-border/30'}`} />
                      {roomErrors.price && <p className="text-xs text-danger mt-1">{roomErrors.price}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Max Guests</label>
                      <input type="number" value={roomForm.maxOccupancy} min={1} max={20} onChange={(e) => setRoomForm(f => ({ ...f, maxOccupancy: parseInt(e.target.value) || 2 }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Size (m²)</label>
                      <input type="number" value={roomForm.size} min={0} onChange={(e) => setRoomForm(f => ({ ...f, size: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Bed Type</label>
                      <select value={roomForm.bedType} onChange={(e) => setRoomForm(f => ({ ...f, bedType: e.target.value }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                        {BED_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">View</label>
                      <select value={roomForm.view} onChange={(e) => setRoomForm(f => ({ ...f, view: e.target.value }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors">
                        {VIEW_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <textarea value={roomForm.description} onChange={(e) => setRoomForm(f => ({ ...f, description: e.target.value }))} placeholder="Spacious room with luxury finishes..." className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors min-h-[60px]" />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Image URL</label>
                    <input type="url" value={roomForm.image} onChange={(e) => setRoomForm(f => ({ ...f, image: e.target.value }))} className="w-full px-4 py-2.5 bg-muted border border-border/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors" />
                  </div>

                  {/* Amenities */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Amenities</label>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_AMENITIES.map(a => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => toggleAmenity(a)}
                          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                            roomForm.amenities.includes(a)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button onClick={() => { setShowRoomModal(false); setEditRoomId(null); }} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                    <button onClick={handleRoomSubmit} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 hover:shadow-lg transition-colors flex items-center justify-center gap-2">
                      <Save className="w-4 h-4" /> {editRoomId ? 'Update Room' : 'Create Room'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION
         ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative z-10 bg-popover border border-border rounded-xl shadow-overlay w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-danger/15 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <h3 className="font-bold">Delete {showDeleteConfirm.type === 'property' ? 'Property' : 'Room'}</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm mb-6">
                {showDeleteConfirm.type === 'property'
                  ? `Delete "${properties.find(p => p.id === showDeleteConfirm.id)?.name}" and all its rooms?`
                  : `Delete room ${rooms.find(r => r.id === showDeleteConfirm.id)?.number}?`}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-muted rounded-lg hover:bg-muted/80 transition-colors">Cancel</button>
                <button onClick={handleDeleteConfirm} className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-danger/90 hover:shadow-lg transition-colors">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
