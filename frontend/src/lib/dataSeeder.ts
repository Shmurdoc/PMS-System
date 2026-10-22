import { useAppStore } from '../store/useAppStore';
import type { Room, Booking } from '../store/useAppStore';
import { resolveTaxRatePercent } from './tax';

const GUEST_NAMES = [
  'Sarah Johnson', 'Michael Chen', 'Emma Williams', 'David Martinez', 'Lisa Anderson',
  'James Brown', 'Amy Taylor', 'Robert Kim', 'Jennifer Davis', 'William Wilson',
  'Maria Garcia', 'John Smith', 'Patricia Moore', 'Robert Taylor', 'Linda Anderson',
  'Barbara Thomas', 'Elizabeth Jackson', 'Jessica White', 'Daniel Harris', 'Susan Martin',
  'Mark Thompson', 'Karen Robinson', 'Steven Clark', 'Nancy Lewis', 'Paul Lee',
  'Betty Walker', 'George Hall', 'Helen Allen', 'Edward Young', 'Christine King',
  'Anthony Wright', 'Michelle Scott', 'Kevin Green', 'Laura Baker', 'Jason Adams',
  'Rebecca Nelson', 'Jeffrey Hill', 'Sharon Campbell', 'Ryan Mitchell', 'Dorothy Roberts',
  'Jacob Carter', 'Kimberly Phillips', 'Tyler Evans', 'Catherine Turner', 'Brandon Phillips',
  'Amber Campbell', 'Austin Parker', 'Megan Edwards', 'Jordan Collins', 'Rachel Stewart',
];

const GUEST_EMAILS = GUEST_NAMES.map(n => `${n.toLowerCase().replace(' ', '.')}@email.com`);
const NATIONALITIES = ['USA', 'UK', 'Germany', 'France', 'Italy', 'Spain', 'Australia', 'Canada', 'South Africa', 'Brazil', 'Japan', 'China', 'India', 'UAE', 'Netherlands'];
const SEGMENTS = ['VIP', 'Frequent', 'New', 'Corporate'] as const;
const VIP_LEVELS = ['standard', 'gold', 'platinum', 'diamond'] as const;
const PREFERENCES = [
  'Ocean view', 'Mountain view', 'High floor', 'Low floor', 'Quiet room', 'Near elevator',
  'Late checkout', 'Early check-in', 'Extra pillows', 'Extra blankets', 'King bed', 'Twin beds',
  'Balcony', 'Jacuzzi', 'Breakfast included', 'Half board', 'Full board', 'Spa access',
  'Gym access', 'Pool access', 'Airport transfer', 'Rental car', 'Business center', 'WiFi',
];

const ROOM_TYPES = ['Standard Suite', 'Deluxe Room', 'Executive Suite', 'Presidential Suite', 'Ocean View', 'Beach Villa', 'Garden Room', 'Family Suite'];
const ROOM_STATUSES = ['available', 'occupied', 'maintenance', 'cleaning', 'reserved'] as const;
const BED_TYPES = ['Single', 'Double', 'Queen', 'King', 'Twin', 'Bunk'];
const VIEWS = ['City', 'Garden', 'Ocean', 'Mountain', 'Pool', 'Courtyard', 'Beach', 'Panoramic'];

const STAFF_NAMES = [
  { name: 'James Mkhize', role: 'Housekeeping Manager', dept: 'Housekeeping' },
  { name: 'Maria Santos', role: 'Front Desk Manager', dept: 'Front Desk' },
  { name: 'Thabo Mokoena', role: 'Maintenance Technician', dept: 'Maintenance' },
  { name: 'Priya Patel', role: 'Concierge', dept: 'Guest Services' },
  { name: 'John Abrahams', role: 'Executive Chef', dept: 'F&B' },
  { name: 'Fatima Isaacs', role: 'Housekeeping Staff', dept: 'Housekeeping' },
  { name: 'Sipho Dlamini', role: 'Maintenance Staff', dept: 'Maintenance' },
  { name: 'Anna Smith', role: 'Front Desk Agent', dept: 'Front Desk' },
  { name: 'David van der Merwe', role: 'Bar Manager', dept: 'F&B' },
  { name: 'Lungile Ndlovu', role: 'Receptionist', dept: 'Front Desk' },
  { name: 'Carla Coetzee', role: 'Room Attendant', dept: 'Housekeeping' },
  { name: 'Mike O\'Connor', role: 'Security Officer', dept: 'Security' },
  { name: 'Zanele Khumalo', role: 'Spa Therapist', dept: 'Spa' },
  { name: 'Pieter Rossouw', role: 'Waiter', dept: 'F&B' },
  { name: 'Nomvula Mbeki', role: 'Laundry Attendant', dept: 'Housekeeping' },
];

const MAINTENANCE_TITLES = [
  'AC Unit Repair', 'Plumbing Issue', 'Electrical Fault', 'Furniture Repair',
  'Lock Replacement', 'Window Repair', 'TV Not Working', 'Mini Bar Malfunction',
  'Hot Water Issue', 'Door Lock Fault', 'WiFi Extender', 'Light Fixture',
  'Bathroom Fan', 'Safe Malfunction', 'Balcony Inspection',
];

const INVENTORY_ITEMS = [
  { name: 'Bath Towels', category: 'Linen', unit: 'pieces' },
  { name: 'Hand Towels', category: 'Linen', unit: 'pieces' },
  { name: 'Bath Mats', category: 'Linen', unit: 'pieces' },
  { name: 'Bed Sheets (King)', category: 'Linen', unit: 'sets' },
  { name: 'Bed Sheets (Queen)', category: 'Linen', unit: 'sets' },
  { name: 'Pillowcases', category: 'Linen', unit: 'pieces' },
  { name: 'Duvet Covers', category: 'Linen', unit: 'pieces' },
  { name: 'Shampoo', category: 'Amenities', unit: 'bottles' },
  { name: 'Conditioner', category: 'Amenities', unit: 'bottles' },
  { name: 'Body Lotion', category: 'Amenities', unit: 'bottles' },
  { name: 'Soap Bars', category: 'Amenities', unit: 'pieces' },
  { name: 'Coffee Pods', category: 'F&B', unit: 'boxes' },
  { name: 'Tea Bags', category: 'F&B', unit: 'boxes' },
  { name: 'Sugar Packets', category: 'F&B', unit: 'packets' },
  { name: 'Creamer', category: 'F&B', unit: 'packets' },
  { name: 'Minibar Snacks', category: 'F&B', unit: 'items' },
  { name: 'Soft Drinks', category: 'F&B', unit: 'cans' },
  { name: 'Beers', category: 'F&B', unit: 'cans' },
  { name: 'House Wine', category: 'F&B', unit: 'bottles' },
  { name: 'Spirits', category: 'F&B', unit: 'bottles' },
  { name: 'Cleaning Solution', category: 'Maintenance', unit: 'liters' },
  { name: 'Paper Towels', category: 'Maintenance', unit: 'rolls' },
  { name: 'Toilet Paper', category: 'Maintenance', unit: 'rolls' },
  { name: 'Light Bulbs', category: 'Maintenance', unit: 'pieces' },
  { name: 'Batteries', category: 'Maintenance', unit: 'packs' },
];

const EXPENSE_CATEGORIES = ['Supplies', 'Maintenance', 'Food & Beverage', 'Utilities', 'Marketing', 'Staff', 'Equipment', 'Other'];

const TICKET_CATEGORIES = ['front_desk', 'housekeeping', 'maintenance', 'food_beverage', 'security', 'it', 'guest_service', 'other'] as const;
const TICKET_TYPES = ['issue', 'task', 'request', 'incident'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent', 'critical'] as const;
const TICKET_STATUSES = ['open', 'in_progress', 'pending', 'resolved', 'closed'] as const;

const TICKET_TITLES = [
  'Guest noise complaint', 'Missing minibar items', 'Room service delay', 'Towel replacement needed',
  'Wi-Fi not connecting', 'TV remote missing', 'Key card not working', 'Extra pillows requested',
  'Room temperature issue', 'Bathroom needs cleaning', 'Lost luggage assistance', 'Airport transfer requested',
  'Late checkout request', 'Spa appointment booking', 'Restaurant reservation needed', 'Room upgrade request',
  'Baby cot needed', 'Iron and board request', 'Plumbing leak reported', 'Parking spot needed',
];

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

function randomDateTime(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString();
}

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: readonly T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateId(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(4, '0')}`;
}

export function seedDatabase(): void {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const twoMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  // ============================================
  // PROPERTIES
  // ============================================
  const properties = [
    {
      id: '1',
      propertyId: '1',
      name: 'Nexus Grand Hotel',
      address: '1 Luxury Lane, Cape Town, 8001, South Africa',
      totalRooms: 50,
      occupiedRooms: Math.floor(50 * 0.72),
      rating: 4.8,
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
      status: 'operational' as const,
      phone: '+27 21 555 0100',
      email: 'grand@nexuspms.co.za',
      manager: 'Sarah Johnson',
      checkInTime: '14:00',
      checkOutTime: '11:00',
    },
    {
      id: '2',
      propertyId: '2',
      name: 'Nexus Beach Resort',
      address: '100 Beach Road, Durban, 4056, South Africa',
      totalRooms: 30,
      occupiedRooms: Math.floor(30 * 0.65),
      rating: 4.6,
      image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800',
      status: 'operational' as const,
      phone: '+27 31 555 0200',
      email: 'beach@nexuspms.co.za',
      manager: 'Mike Chen',
      checkInTime: '15:00',
      checkOutTime: '10:00',
    },
    {
      id: '3',
      propertyId: '3',
      name: 'Nexus City Lodge',
      address: '50 Urban Street, Johannesburg, 2001, South Africa',
      totalRooms: 20,
      occupiedRooms: Math.floor(20 * 0.8),
      rating: 4.3,
      image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800',
      status: 'operational' as const,
      phone: '+27 11 555 0300',
      email: 'city@nexuspms.co.za',
      manager: 'Lisa Anderson',
      checkInTime: '14:00',
      checkOutTime: '11:00',
    },
  ];
  useAppStore.setState({ properties });

  // ============================================
  // ROOMS (100 rooms across 3 properties)
  // ============================================
  const rooms: Room[] = [];
  let roomId = 1;
  properties.forEach(property => {
    for (let i = 1; i <= property.totalRooms; i++) {
      const type = randomElement(ROOM_TYPES);
      const basePrice = type === 'Presidential Suite' ? 8500 :
                       type === 'Beach Villa' ? 6500 :
                       type === 'Executive Suite' ? 4500 :
                       type === 'Ocean View' ? 3500 :
                       type === 'Deluxe Room' ? 2500 :
                       type === 'Family Suite' ? 3200 :
                       type === 'Standard Suite' ? 1800 : 1500;
      const maxOcc = type === 'Presidential Suite' ? 4 :
                     type === 'Family Suite' ? 5 :
                     type === 'Beach Villa' ? 4 : 2;
      const size = type === 'Presidential Suite' ? 120 :
                   type === 'Beach Villa' ? 85 :
                   type === 'Executive Suite' ? 55 :
                   type === 'Family Suite' ? 50 :
                   type === 'Deluxe Room' ? 35 : 28;

      rooms.push({
        id: `RM-${String(roomId++).padStart(3, '0')}`,
        propertyId: property.propertyId,
        number: `${Math.floor((i - 1) / 10 + 1)}${String(((i - 1) % 10) + 1).padStart(2, '0')}`,
        type,
        floor: Math.floor((i - 1) / 10) + 1,
        status: randomElement([...ROOM_STATUSES]),
        price: basePrice,
        description: `Beautiful ${type.toLowerCase()} with stunning views`,
        amenities: randomElements(PREFERENCES, 5),
        image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
        maxOccupancy: maxOcc,
        bedType: randomElement(BED_TYPES),
        size,
        view: randomElement(VIEWS),
        lastCleaned: randomDate(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), now),
        lastInspected: randomDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now),
      });
    }
  });
  useAppStore.setState({ rooms });

  // ============================================
  // GUESTS (50 guests)
  // ============================================
  const guests = GUEST_NAMES.map((name, idx) => ({
    id: `GUEST-${String(idx + 1).padStart(4, '0')}`,
    name,
    email: GUEST_EMAILS[idx],
    phone: `+27 82 ${String(Math.floor(Math.random() * 9000000 + 1000000))}`,
    idNumber: String(Math.floor(Math.random() * 9000000000000 + 1000000000000)),
    nationality: randomElement(NATIONALITIES),
    segment: randomElement([...SEGMENTS]),
    totalStays: Math.floor(Math.random() * 15) + 1,
    loyaltyPoints: Math.floor(Math.random() * 10000),
    preferences: randomElements(PREFERENCES, Math.floor(Math.random() * 5) + 1),
    notes: Math.random() > 0.7 ? 'Regular guest with specific requirements' : '',
    createdAt: randomDate(sixMonthsAgo, now),
    lastVisit: randomDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now),
    vipLevel: randomElement([...VIP_LEVELS]),
    address: Math.random() > 0.5 ? `${Math.floor(Math.random() * 200) + 1} Main Street, City` : undefined,
    companyName: Math.random() > 0.7 ? randomElement(['Tech Corp', 'Global Industries', 'Sunrise Holdings', 'Blue Ocean Ltd']) : undefined,
  }));
  useAppStore.setState({ guests });

  // ============================================
  // BOOKINGS (120+ bookings)
  // ============================================
  const bookingStatuses = ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'] as const;
  const paymentStatuses = ['pending', 'partial', 'paid', 'refunded'] as const;
  const bookingSources = ['Direct', 'Booking.com', 'Expedia', 'Airbnb', 'Corporate'];
  const bookings: Booking[] = [];

  for (let i = 0; i < 120; i++) {
    const guest = randomElement(guests);
    const room = randomElement(rooms);
    const checkIn = randomDate(sixMonthsAgo, twoMonthsFromNow);
    const nightCount = Math.floor(Math.random() * 7) + 1;
    const checkOutDate = new Date(checkIn);
    checkOutDate.setDate(checkOutDate.getDate() + nightCount);
    const checkOut = checkOutDate.toISOString().split('T')[0];
    const status = randomElement([...bookingStatuses]);
    const amount = room.price * nightCount;
    const adults = Math.floor(Math.random() * 2) + 1;
    const children = Math.floor(Math.random() * 3);

    bookings.push({
      id: generateId('BK', i + 1),
      guestId: guest.id,
      guestName: guest.name,
      guestEmail: guest.email,
      guestPhone: guest.phone,
      guestSegment: guest.segment,
      propertyId: room.propertyId,
      propertyName: properties.find(p => p.propertyId === room.propertyId)?.name || '',
      roomId: room.id,
      roomNumber: room.number,
      roomType: room.type,
      checkIn,
      checkOut,
      nights: nightCount,
      guests: adults + children,
      adults,
      children,
      status,
      paymentStatus: status === 'cancelled' ? 'refunded' : randomElement([...paymentStatuses]),
      amount,
      ratePerNight: room.price,
      depositPaid: status === 'checked-in' || status === 'checked-out' ? amount : Math.random() > 0.5 ? Math.floor(amount * 0.5) : 0,
      balanceDue: status === 'checked-out' || status === 'cancelled' ? 0 : undefined,
      source: randomElement(bookingSources),
      specialRequests: Math.random() > 0.7 ? randomElement(PREFERENCES) : undefined,
      notes: Math.random() > 0.9 ? 'Special handling required' : undefined,
      createdAt: randomDate(sixMonthsAgo, new Date(checkIn)),
    });
  }
  useAppStore.setState({ bookings });

  // ============================================
  // STAFF / USERS (15 staff members)
  // ============================================
  const staff = STAFF_NAMES.map((staffMember, idx) => ({
    id: generateId('STF', idx + 1),
    name: staffMember.name,
    email: `${staffMember.name.toLowerCase().replace(/[' ]/g, '.')}@nexus.com`,
    role: staffMember.role,
    department: staffMember.dept,
    phone: `+27 82 ${String(Math.floor(Math.random() * 9000000 + 1000000))}`,
    hireDate: randomDate(new Date(now.getTime() - 365 * 3 * 24 * 60 * 60 * 1000), now),
    status: Math.random() > 0.1 ? 'active' as const : Math.random() > 0.5 ? 'inactive' as const : 'on_leave' as const,
    avatar: undefined,
  }));
  useAppStore.setState({ users: staff });

  // ============================================
  // RFID TAGS
  // ============================================
  const rfidTags = staff.map((s, idx) => ({
    id: generateId('RFID', idx + 1),
    propertyId: '1',
    kind: 'staff' as const,
    tagNumber: `NFC-${String(Math.floor(Math.random() * 900000) + 100000)}`,
    userId: s.id,
    userName: s.name,
    status: 'active' as const,
    accessLevel: s.department === 'Security' ? 'all' : s.department.toLowerCase().replace(' ', '_'),
    createdAt: s.hireDate,
    lastUsed: randomDateTime(new Date(now.getTime() - 24 * 60 * 60 * 1000), now),
  }));
  useAppStore.setState({ rfidTags });

  // ============================================
  // SHIFTS
  // ============================================
  const shiftRoles = ['Front Desk', 'Housekeeping', 'Kitchen', 'Maintenance', 'Security', 'F&B', 'Spa'];
  const shifts = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    const dateStr = day.toISOString().split('T')[0];
    for (let s = 0; s < 6; s++) {
      const staffMember = staff[s % staff.length];
      const shiftTimes = [['06:00', '14:00'], ['14:00', '22:00'], ['22:00', '06:00']];
      const [startTime, endTime] = shiftTimes[s % 3];
      shifts.push({
        id: generateId('SHF', d * 6 + s + 1),
        userId: staffMember.id,
        userName: staffMember.name,
        startTime,
        endTime,
        date: dateStr,
        role: randomElement(shiftRoles),
        status: d > 0 ? 'completed' as const : 'scheduled' as const,
        department: staffMember.department,
        notes: Math.random() > 0.8 ? 'Cover shift' : undefined,
      });
    }
  }
  useAppStore.setState({ shifts });

  // ============================================
  // ATTENDANCE
  // ============================================
  const attendance = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    const dateStr = day.toISOString().split('T')[0];
    for (const s of staff) {
      if (Math.random() > 0.05) {
        const hour = 6 + Math.floor(Math.random() * 3);
        const minute = Math.floor(Math.random() * 60);
        const checkInTime = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
        const checkOutHour = hour + 8 + Math.floor(Math.random() * 2);
        const checkOutTime = d > 0 ? `${dateStr}T${String(Math.min(checkOutHour, 23)).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00` : undefined;
        attendance.push({
          id: generateId('ATT', attendance.length + 1),
          userId: s.id,
          userName: s.name,
          checkIn: checkInTime,
          checkOut: checkOutTime,
          date: dateStr,
          status: hour > 8 ? 'late' as const : 'present' as const,
          hoursWorked: checkOutTime ? Math.round((checkOutHour - hour) * 10) / 10 : undefined,
        });
      }
    }
  }
  useAppStore.setState({ attendance });

  // ============================================
  // INVENTORY
  // ============================================
  const inventory = INVENTORY_ITEMS.map((item, idx) => ({
    id: generateId('INV', idx + 1),
    name: item.name,
    category: item.category,
    quantity: Math.floor(Math.random() * 200) + 20,
    unit: item.unit,
    reorderLevel: Math.floor(Math.random() * 30) + 10,
    price: Math.floor(Math.random() * 500) + 50,
    supplier: randomElement(['Supplier A', 'Supplier B', 'Supplier C', 'Direct']),
    sku: `SKU-${item.category.substring(0, 3).toUpperCase()}-${String(idx + 1).padStart(3, '0')}`,
    location: randomElement(['Main Store', 'Kitchen Store', 'Amenity Room', 'Maintenance Store', 'F&B Store']),
    lastRestocked: randomDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now),
  }));
  useAppStore.setState({ inventory });

  // ============================================
  // MAINTENANCE TICKETS
  // ============================================
  const maintenanceTickets = [];
  for (let i = 0; i < 25; i++) {
    const room = randomElement(rooms);
    const statuses = ['pending', 'in_progress', 'completed', 'scheduled'] as const;
    const priorities = ['low', 'medium', 'high', 'urgent'] as const;
    const status = randomElement([...statuses]);
    const createdAt = randomDateTime(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), now);

    maintenanceTickets.push({
      id: generateId('MT', i + 1),
      roomId: room.number,
      title: randomElement(MAINTENANCE_TITLES),
      description: `Issue reported in ${room.type} - requires immediate attention`,
      priority: randomElement([...priorities]),
      status,
      assignedTo: Math.random() > 0.3 ? randomElement(staff).name : undefined,
      createdAt,
      completedAt: status === 'completed' ? randomDateTime(new Date(createdAt), now) : undefined,
      propertyId: room.propertyId,
      estimatedCost: Math.floor(Math.random() * 5000) + 500,
      actualCost: status === 'completed' ? Math.floor(Math.random() * 5000) + 300 : undefined,
    });
  }
  useAppStore.setState({ maintenanceTickets });

  // ============================================
  // EXPENSES (30 expenses)
  // ============================================
  const expenses = [];
  for (let i = 0; i < 30; i++) {
    const statuses = ['pending', 'approved', 'rejected'] as const;
    const expenseStatus = randomElement([...statuses]);
    const submitter = randomElement(staff);
    const approver = randomElement(staff);
    expenses.push({
      id: generateId('EXP', i + 1),
      category: randomElement(EXPENSE_CATEGORIES),
      amount: Math.floor(Math.random() * 15000) + 500,
      description: `${randomElement(EXPENSE_CATEGORIES)} expense - ${randomElement(['monthly', 'weekly', 'one-time', 'recurring'])}`,
      date: randomDate(new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), now),
      status: expenseStatus,
      submittedBy: submitter.name,
      approvedBy: expenseStatus === 'approved' ? approver.name : undefined,
      approvedAt: expenseStatus === 'approved' ? randomDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now) : undefined,
      propertyId: randomElement(properties).id,
      vendor: randomElement(['Supplier A', 'Supplier B', 'Local Vendor', 'Service Co']),
    });
  }
  useAppStore.setState({ expenses });

  // ============================================
  // ELECTRICITY RECORDS
  // ============================================
  const zones = ['Main Building', 'Annex', 'Kitchen', 'Pool', 'Spa', 'Parking'];
  const electricity = [];
  for (let d = 0; d < 30; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    const dateStr = day.toISOString().split('T')[0];
    for (const zone of zones.slice(0, Math.floor(Math.random() * 3) + 2)) {
      const consumption = Math.floor(Math.random() * 800) + 400;
      electricity.push({
        id: generateId('ELEC', electricity.length + 1),
        date: dateStr,
        consumption,
        cost: Math.floor(consumption * 2.5),
        peakDemand: Math.floor(consumption * 0.15),
        zone,
      });
    }
  }
  useAppStore.setState({ electricity });

  // ============================================
  // TICKETS (20 support tickets)
  // ============================================
  const tickets = [];
  for (let i = 0; i < 20; i++) {
    const guest = randomElement(guests);
    const room = randomElement(rooms);
    const assignee = randomElement(staff);
    const reporter = randomElement(staff);
    const status = randomElement([...TICKET_STATUSES]);
    const createdAt = randomDateTime(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), now);

    const comments = [];
    const commentCount = Math.floor(Math.random() * 3);
    for (let c = 0; c < commentCount; c++) {
      const commenter = randomElement(staff);
      comments.push({
        id: `c-${i}-${c}`,
        ticketId: generateId('TKT', i + 1),
        userId: commenter.id,
        userName: commenter.name,
        content: randomElement([
          'Investigating the issue now.',
          'Technician has been dispatched.',
          'Guest has been contacted.',
          'Parts ordered, ETA 2 hours.',
          'Issue resolved, awaiting guest confirmation.',
          'Escalated to management.',
        ]),
        isInternal: Math.random() > 0.5,
        createdAt: randomDateTime(new Date(createdAt), now),
      });
    }

    tickets.push({
      id: generateId('TKT', i + 1),
      ticketNumber: generateId('TKT', i + 1),
      title: randomElement(TICKET_TITLES),
      description: `Reported issue requiring attention - ${randomElement(['urgent response needed', 'standard priority', 'scheduled for review'])}`,
      type: randomElement([...TICKET_TYPES]),
      category: randomElement([...TICKET_CATEGORIES]),
      priority: randomElement([...TICKET_PRIORITIES]),
      status,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      reporterId: reporter.id,
      reporterName: reporter.name,
      propertyId: room.propertyId,
      roomId: Math.random() > 0.3 ? room.id : undefined,
      guestId: Math.random() > 0.3 ? guest.id : undefined,
      guestName: Math.random() > 0.3 ? guest.name : undefined,
      dueDate: randomDate(now, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
      tags: randomElements(['urgent', 'maintenance', 'guest', 'housekeeping', 'fnb', 'it', 'security'], Math.floor(Math.random() * 3) + 1),
      attachments: [],
      comments,
      createdAt,
      updatedAt: randomDateTime(new Date(createdAt), now),
      resolvedAt: status === 'resolved' || status === 'closed' ? randomDateTime(new Date(createdAt), now) : undefined,
      closedAt: status === 'closed' ? randomDateTime(new Date(createdAt), now) : undefined,
    });
  }
  useAppStore.setState({ tickets });

  // ============================================
  // INVOICES (one per paid/checked-out booking, up to 40)
  // ============================================
  const paidBookings = bookings.filter(b => b.paymentStatus === 'paid' || b.status === 'checked-out' || b.status === 'checked-in').slice(0, 40);
  const seededTaxConfigs = useAppStore.getState().taxConfigs;
  const invoices = paidBookings.map((booking, idx) => {
    const date = booking.createdAt;
    const vatRate = resolveTaxRatePercent(seededTaxConfigs, 'room', date, 15);
    const subtotal = booking.amount;
    const taxAmount = Math.floor(subtotal * vatRate / 100);
    const discount = Math.random() > 0.8 ? Math.floor(subtotal * 0.1) : 0;
    const total = subtotal + taxAmount - discount;
    const isPaid = booking.paymentStatus === 'paid';

    return {
      id: `INV-${now.getFullYear()}-${String(idx + 1).padStart(3, '0')}`,
      invoiceNumber: `INV-${now.getFullYear()}-${String(idx + 1).padStart(3, '0')}`,
      type: 'booking' as const,
      bookingId: booking.id,
      guestId: booking.guestId,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      propertyId: booking.propertyId,
      items: [{
        id: `item-${idx}-1`,
        description: `${booking.roomType} - ${booking.nights} night${booking.nights > 1 ? 's' : ''}`,
        quantity: booking.nights,
        unitPrice: booking.ratePerNight || Math.floor(booking.amount / booking.nights),
        taxRate: vatRate,
        amount: subtotal,
        category: 'room',
      }],
      subtotal,
      taxAmount,
      discountAmount: discount,
      total,
      currency: 'ZAR',
      status: isPaid ? 'paid' as const : 'pending' as const,
      issueDate: booking.createdAt,
      dueDate: booking.checkIn,
      paidDate: isPaid ? booking.createdAt : undefined,
      paidAmount: isPaid ? total : undefined,
      paymentMethod: isPaid ? randomElement(['card', 'eft', 'cash']) : undefined,
      createdAt: booking.createdAt + 'T10:00:00',
      createdBy: randomElement(staff).name,
    };
  });
  useAppStore.setState({ invoices });

  // ============================================
  // PAYMENTS (one per paid invoice)
  // ============================================
  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  const payments = paidInvoices.map((invoice, idx) => ({
    id: `PAY-${String(idx + 1).padStart(3, '0')}`,
    paymentNumber: `PAY-${String(idx + 1).padStart(3, '0')}`,
    invoiceId: invoice.id,
    bookingId: invoice.bookingId,
    guestId: invoice.guestId,
    guestName: invoice.guestName,
    propertyId: invoice.propertyId,
    amount: invoice.total,
    currency: 'ZAR',
    method: (invoice.paymentMethod || 'card') as 'cash' | 'card' | 'eft' | 'wire_transfer' | 'mobile_money' | 'voucher',
    status: 'completed' as const,
    reference: `TXN-${String(Math.floor(Math.random() * 900000) + 100000)}`,
    transactionId: `tx_${Math.random().toString(36).substring(7)}`,
    processedBy: randomElement(staff).name,
    processedAt: invoice.paidDate ? invoice.paidDate + 'T10:05:00' : undefined,
    createdAt: invoice.paidDate ? invoice.paidDate + 'T10:00:00' : invoice.createdAt,
  }));
  useAppStore.setState({ payments });

  // ============================================
  // AUDIT LOGS (one per major action)
  // ============================================
  const auditLogs = [];
  let logIdx = 0;

  // Booking creation logs
  for (const booking of bookings.slice(0, 15)) {
    const user = randomElement(staff);
    auditLogs.push({
      id: `LOG-${String(++logIdx).padStart(3, '0')}`,
      action: 'create',
      entityType: 'booking' as const,
      entityId: booking.id,
      entityName: `Booking ${booking.id}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `New booking created for ${booking.guestName} - ${booking.roomType}`,
      timestamp: booking.createdAt + 'T10:00:00',
    });
  }

  // Payment logs
  for (const payment of payments.slice(0, 10)) {
    const user = randomElement(staff);
    auditLogs.push({
      id: `LOG-${String(++logIdx).padStart(3, '0')}`,
      action: 'payment',
      entityType: 'payment' as const,
      entityId: payment.id,
      entityName: `Payment ${payment.id}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Payment received: R${payment.amount.toLocaleString()} via ${payment.method}`,
      timestamp: payment.createdAt,
    });
  }

  // Ticket logs
  for (const ticket of tickets.slice(0, 8)) {
    const user = randomElement(staff);
    auditLogs.push({
      id: `LOG-${String(++logIdx).padStart(3, '0')}`,
      action: 'create',
      entityType: 'ticket' as const,
      entityId: ticket.id,
      entityName: `Ticket ${ticket.ticketNumber}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Ticket created: ${ticket.title}`,
      timestamp: ticket.createdAt,
    });
  }

  useAppStore.setState({ auditLogs });

  console.log(`Database seeded: ${guests.length} guests, ${bookings.length} bookings, ${rooms.length} rooms, ${invoices.length} invoices, ${payments.length} payments, ${tickets.length} tickets`);
}

export function resetDatabase(): void {
  // Clear ALL state via setState (not direct mutation)
  useAppStore.setState({
    bookings: [],
    guests: [],
    rooms: [],
    users: [],
    properties: [],
    invoices: [],
    payments: [],
    tickets: [],
    auditLogs: [],
    rfidTags: [],
    attendance: [],
    shifts: [],
    expenses: [],
    inventory: [],
    electricity: [],
    maintenanceTickets: [],
    workflows: [],
    messages: [],
    aiInsights: [],
    taxConfigs: [],
    integrations: [],
  });

  // Clear persisted storage
  localStorage.removeItem('nexus-pms-storage');

  // Re-seed with fresh data
  seedDatabase();
}
