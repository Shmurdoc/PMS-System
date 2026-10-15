# NEXUS PMS - Unified System Design Blueprint

## Enterprise Hospitality Management Platform

**Document Version:** 1.0  
**Date:** March 26, 2026  
**Classification:** Production Architecture  
**Author:** Systems Integrator & Solution Architect

---

## EXECUTIVE SUMMARY

NEXUS PMS is a comprehensive Property Management System designed for boutique to enterprise hospitality properties. Built with React, TypeScript, and Zustand state management, the platform provides end-to-end hotel operations including booking management, guest profiles, room inventory, staff scheduling, financial tracking, and multi-property support.

**Key Capabilities:**
- Multi-role dashboard (Owner/Manager/Reception/Staff)
- Real-time room status and conflict detection
- Integrated POS and inventory management
- Workflow automation engine
- 3D property visualization
- AI-powered assistant
- Visual workflow builder
- RBAC with hierarchical permissions

**Current Production Readiness Score: 7.0/10**

---

## SYSTEM ARCHITECTURE

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NEXUS PMS ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│  PRESENTATION LAYER                                                     │
│  ├── Dashboards                                                          │
│  │   ├── Owner Dashboard (Company-wide analytics)                      │
│  │   ├── Manager Dashboard (Property operations)                        │
│  │   ├── Reception Dashboard (Front desk workflow)                     │
│  │   └── Staff Dashboard (Task management)                              │
│  ├── Page Components                                                     │
│  │   ├── Bookings, Guests, Rooms, Staff, Finances                      │
│  │   ├── Inventory, Integrations, Settings, Analytics                   │
│  │   └── Workflows, Reports, 3D View, Visual Builder                    │
│  └── Shared UI Components (Radix + Custom)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  BUSINESS LOGIC LAYER                                                   │
│  ├── Booking Engine                                                      │
│  │   ├── Availability checking                                          │
│  │   ├── Conflict detection algorithm                                  │
│  │   ├── Rate calculation                                               │
│  │   └── Source management (OTA/Direct)                                │
│  ├── Folio Manager                                                       │
│  │   ├── Charge posting                                                 │
│  │   ├── Payment processing                                             │
│  │   └── Invoice generation                                            │
│  ├── Inventory Controller                                                │
│  │   ├── Stock tracking                                                 │
│  │   ├── Reorder automation                                             │
│  │   └── Category management                                            │
│  ├── Staff Scheduler                                                    │
│  │   ├── Shift management                                               │
│  │   ├── Task assignment                                                │
│  │   └── Availability management                                         │
│  ├── Workflow Engine                                                    │
│  │   ├── Trigger system                                                 │
│  │   ├── Condition branching                                           │
│  │   └── Action execution                                               │
│  └── Permission Manager                                                 │
│       ├── Role hierarchy                                                │
│       ├── Permission matrix                                             │
│       └── Department structure                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                             │
│  ├── State Management (Zustand)                                        │
│  │   ├── Global stores (bookings, guests, rooms, staff, etc.)         │
│  │   ├── UI state (sidebar, modals, theme)                              │
│  │   └── Derived state via selectors                                   │
│  ├── Local Storage Persistence                                          │
│  │   └── IndexedDB for large datasets                                   │
│  └── API Integration Points                                             │
│       └── Webhook support for external systems                          │
├─────────────────────────────────────────────────────────────────────────┤
│  INTEGRATION LAYER                                                      │
│  ├── PMS Connectors                                                     │
│  │   ├── Micros Fidelio                                                 │
│  │   ├── Opera (Oracle)                                                 │
│  │   ├── Cloudbeds                                                     │
│  │   └── Mews                                                           │
│  ├── Payment Gateways                                                  │
│  │   ├── Stripe                                                         │
│  │   ├── PayFast (SA)                                                   │
│  │   ├── Adyen                                                          │
│  │   └── Square Payments                                               │
│  ├── OTA Channel Managers                                               │
│  │   ├── Booking.com                                                   │
│  │   ├── Expedia                                                       │
│  │   ├── Airbnb                                                        │
│  │   └── Direct Booking API                                            │
│  └── POS Systems                                                        │
│       ├── Square                                                        │
│       ├── Lightspeed                                                    │
│       ├── Toast                                                        │
│       └── Custom kitchen displays                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## MODULE SPECIFICATIONS

### Phase 1: Foundation (Weeks 1-4)

#### 1.1 Booking Engine

**Purpose:** Core reservation management with real-time availability

**Dependencies:**
- Zustand store (`useBookingStore`)
- Date-fns for date manipulation
- Calendar component (custom + Radix)

**Data Model:**
```typescript
interface Booking {
  id: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amount: number;
  status: BookingStatus;
  source: BookingSource;
  specialRequests?: string[];
  createdAt: string;
  updatedAt: string;
}

type BookingStatus = 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
type BookingSource = 'direct' | 'booking.com' | 'expedia' | 'airbnb' | 'other';
```

**Conflict Detection Algorithm:**
```typescript
function checkAvailability(roomId: string, checkIn: string, checkOut: string, existingBookings: Booking[]): boolean {
  return !existingBookings.some(booking => 
    booking.roomId === roomId &&
    booking.status !== 'cancelled' &&
    !(checkOut <= booking.checkIn || checkIn >= booking.checkOut)
  );
}
```

**API Contracts:**
- `GET /api/bookings` - List all bookings
- `POST /api/bookings` - Create new booking
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking
- `GET /api/bookings/availability` - Check room availability

#### 1.2 Guest Management

**Purpose:** Guest profiles, preferences, and loyalty tracking

**Data Model:**
```typescript
interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  nationality: string;
  segment: 'VIP' | 'Frequent' | 'New' | 'Corporate';
  stays: number;
  points: number;
  lastVisit: string;
  preferences: string[];
  avatar?: string;
}
```

#### 1.3 Room Management

**Purpose:** Room inventory, status tracking, and rate management

**Data Model:**
```typescript
interface Room {
  id: string;
  num: string;
  type: string;
  floor: number;
  capacity: number;
  status: RoomStatus;
  rate: number;
  rfid: boolean;
  amenities: string[];
  images: string[];
}

type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'reserved';
```

#### 1.4 Check-in/Check-out Workflow

**Purpose:** Front desk operations with validation

**Workflow Steps:**
1. Verify booking confirmation
2. Validate guest ID
3. Process payment/folio setup
4. Generate room keys (RFID)
5. Update room status to occupied
6. Notify housekeeping

---

### Phase 2: Operations (Weeks 5-8)

#### 2.1 Folio Management

**Data Model:**
```typescript
interface Folio {
  id: string;
  bookingId: string;
  transactions: Transaction[];
  balance: number;
  status: 'open' | 'closed';
}

interface Transaction {
  id: string;
  folioId: string;
  type: 'charge' | 'payment' | 'adjustment';
  department: Department;
  amount: number;
  description: string;
  timestamp: string;
}

type Department = 'room' | 'restaurant' | 'spa' | 'bar' | 'minibar' | 'parking' | 'laundry' | 'other';
```

#### 2.2 POS Integration

**Purpose:** Restaurant/bar point of sale integration

**Data Model:**
```typescript
interface POSTransaction {
  id: string;
  item: string;
  quantity: number;
  total: number;
  time: string;
  staff: string;
  linkedFolioId?: string;
}
```

**Integration Points:**
- Square POS API
- Lightspeed API
- Toast API
- Webhook for custom solutions

#### 2.3 Housekeeping Interface

**Purpose:** Mobile-optimized room cleaning management

**Features:**
- Room task assignment
- Status updates (dirty, cleaning, inspected, ready)
- Maintenance requests
- Inventory requests

#### 2.4 Maintenance Work Orders

**Data Model:**
```typescript
interface WorkOrder {
  id: string;
  roomId: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'other';
  priority: 'low' | 'medium' | 'high' | 'emergency';
  description: string;
  assignedTo: string;
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: string;
  completedAt?: string;
}
```

---

### Phase 3: Revenue (Weeks 9-12)

#### 3.1 Spa & Wellness Booking

**Features:**
- Treatment menu management
- Staff availability
- Resource scheduling (treatment rooms, equipment)
- Package deals

#### 3.2 Events & Banqueting

**Features:**
- Event space inventory
- Catering menu management
- Function sheet generation
- Audio-visual equipment tracking

#### 3.3 Revenue Management

**Features:**
- Dynamic pricing rules
- Rate shopper integration
- Demand forecasting
- Competitive set analysis
- OTA rate parity management

#### 3.4 Accounting Module

**Features:**
- General ledger
- Accounts payable
- Financial reporting
- Bank reconciliation
- Tax compliance

---

### Phase 4: Intelligence (Weeks 13-16)

#### 4.1 CRM & Loyalty

**Features:**
- Guest profile enrichment
- Loyalty program management
- Preference tracking
- Marketing segmentation

#### 4.2 Marketing Automation

**Features:**
- Email campaign management
- SMS notifications
- Automated follow-ups
- Review request automation

#### 4.3 Predictive Analytics

**Features:**
- Occupancy forecasting
- No-show prediction
- RevPAR optimization suggestions
- Guest lifetime value scoring

#### 4.4 API Hub

**Features:**
- RESTful API documentation
- Webhook configuration
- Rate limiting
- API key management

---

## INTEGRATION BLUEPRINT

### PMS Connectors

| System | Method | Data Flow | Error Handling | Fallback |
|--------|--------|-----------|----------------|----------|
| Micros Fidelio | REST API | Bidirectional | Retry 3x, queue | Local cache |
| Opera (Oracle) | OTA Standard | Inbound only | Retry 3x | Manual entry |
| Cloudbeds | API v2 | Bidirectional | Retry 3x, queue | Local cache |
| Mews | Webhooks | Inbound only | Queue, alert | Email notification |

### Payment Gateways

| Gateway | Method | Features | Settlement |
|---------|--------|----------|------------|
| Stripe | Elements API | Cards, wallets | Daily |
| PayFast | Redirect | Credit cards (ZAR) | Daily |
| Adyen | API | Multi-currency | Daily |
| Square | SDK | Cards, wallets | Daily |

### Booking Channels

| Channel | Method | Data | Sync Frequency |
|--------|--------|------|----------------|
| Booking.com | API | Reservations | Real-time |
| Expedia | API | Reservations | Real-time |
| Airbnb | API | Reservations | Real-time |
| Direct | Web Form | Reservations | Immediate |

### POS Systems

| System | Integration | Sync | Features |
|--------|-------------|------|----------|
| Square | REST API | 5 min | Orders, menu |
| Lightspeed | API | 5 min | Orders, inventory |
| Toast | Webhooks | Real-time | Orders, staff |
| Custom | Webhooks | Real-time | Full control |

---

## SCALABILITY MATRIX

### Deployment Tiers

| Tier | Properties | Rooms | Users | Data Volume | Infrastructure |
|------|------------|-------|-------|--------------|----------------|
| Boutique | 1 | 10 | 5 | <1GB | Single server |
| Mid-size | 1-3 | 50-100 | 25 | <10GB | Load balancer |
| Large | 5-20 | 200+ | 100 | <100GB | Multi-region |
| Enterprise | 50+ | 500+ | 500 | >100GB | Distributed |

### Scaling Strategy

**Horizontal Scaling:**
- Stateless API servers behind load balancer
- Session storage in Redis
- CDN for static assets

**Vertical Scaling:**
- Database clustering (PostgreSQL)
- Read replicas for reporting
- Caching layer (Redis)

**Data Partitioning:**
- Property-based sharding for multi-property
- Time-based partitioning for logs
- Archive strategy for historical data

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-4)

| Week | Sprint | Deliverables | Dependencies |
|------|--------|--------------|---------------|
| 1 | Sprint 1 | Booking CRUD, availability check | Zustand, React |
| 2 | Sprint 2 | Guest profiles, preferences | - |
| 3 | Sprint 3 | Room inventory, status tracking | - |
| 4 | Sprint 4 | Check-in/check-out workflow | Phase 1 tasks |

**Resource Requirements:**
- Frontend: 2 React developers
- Backend: 1 Node.js/Express developer
- QA: 1 tester

### Phase 2: Operations (Weeks 5-8)

| Week | Sprint | Deliverables | Dependencies |
|------|--------|--------------|---------------|
| 5 | Sprint 5 | Folio management, charges | Phase 1 complete |
| 6 | Sprint 6 | POS integration | Stripe/Square API |
| 7 | Sprint 7 | Housekeeping mobile UI | - |
| 8 | Sprint 8 | Maintenance work orders | - |

**Resource Requirements:**
- Frontend: 2 React developers (1 mobile)
- Backend: 2 Node.js developers
- QA: 1 tester

### Phase 3: Revenue (Weeks 9-12)

| Week | Sprint | Deliverables | Dependencies |
|------|--------|--------------|---------------|
| 9 | Sprint 9 | Spa booking system | - |
| 10 | Sprint 10 | Events & banqueting | - |
| 11 | Sprint 11 | Revenue management | Analytics data |
| 12 | Sprint 12 | Accounting module | Ledger API |

### Phase 4: Intelligence (Weeks 13-16)

| Week | Sprint | Deliverables | Dependencies |
|------|--------|--------------|---------------|
| 13 | Sprint 13 | CRM & loyalty program | Guest data |
| 14 | Sprint 14 | Marketing automation | Email API |
| 15 | Sprint 15 | Predictive analytics | ML pipeline |
| 16 | Sprint 16 | API hub & documentation | All modules |

---

## PRODUCTION READINESS CHECKLIST

### Pre-Launch Validation

- [ ] All Phase 1 features implemented
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] E2E tests for critical paths
- [ ] Performance: <3s page load
- [ ] Security: XSS, CSRF, SQLi mitigated
- [ ] Accessibility: WCAG 2.1 AA compliant
- [ ] Browser support: Chrome, Firefox, Safari, Edge

### Infrastructure

- [ ] Database backup strategy
- [ ] CDN configured
- [ ] SSL certificates valid
- [ ] Monitoring/alerting active
- [ ] Log aggregation working

### Operations

- [ ] Runbook documented
- [ ] On-call rotation defined
- [ ] Escalation procedures
- [ ] Rollback plan tested

### Compliance

- [ ] GDPR data handling
- [ ] PCI-DSS compliance (payments)
- [ ] Data retention policy

---

## RISK REGISTER

### Identified Risks

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R1 | OTA API changes | Medium | High | Version pinning, abstraction layer |
| R2 | Payment gateway downtime | Low | High | Multi-gateway fallback |
| R3 | Performance at scale | Medium | Medium | Load testing, optimization |
| R4 | Data migration issues | Medium | High | Phased migration, validation |
| R5 | Integration failures | Medium | Medium | Retry logic, queue system |
| R6 | Security vulnerabilities | Low | Critical | Regular audits, dependency updates |
| R7 | Staff adoption | Medium | Medium | Training, UX improvements |
| R8 | Vendor lock-in | Low | Medium | Abstraction, standard APIs |

### Mitigation Strategies

**R1 - OTA API Changes:**
- Abstract OTA integrations behind adapter pattern
- Maintain API version pins where possible
- Implement comprehensive logging

**R2 - Payment Gateway Downtime:**
- Implement retry with exponential backoff
- Queue transactions for later processing
- Maintain fallback gateway capability

**R3 - Performance at Scale:**
- Implement database indexing strategy
- Add caching layer (Redis)
- Code splitting and lazy loading

**R4 - Data Migration:**
- Parallel running period
- Validation scripts
- Rollback capability

---

## APPENDIX: TECHNICAL RECOMMENDATIONS

### Code Splitting Strategy

```typescript
// Lazy load features
const BookingsPage = lazy(() => import('./pages/Bookings'));
const AnalyticsPage = lazy(() => import('./pages/Analytics'));
const SettingsPage = lazy(() => import('./pages/Settings'));

// Route-based splitting
<Route path="/bookings" element={<BookingsPage />} />
```

### State Management Best Practices

1. Use Zustand for global state
2. Keep UI state in components
3. Implement selectors for derived state
4. Persist critical data to localStorage/IndexedDB

### Performance Optimization

- Virtual scrolling for large lists
- Image optimization with lazy loading
- Memoization with React.memo/useMemo
- Debounce search inputs

### Security Hardening

- Input sanitization
- XSS prevention
- CSRF tokens
- Rate limiting on API
- Audit logging
- Regular dependency updates

---

**Document Approved For:** Production Implementation

**Next Steps:**
1. Initialize Phase 1 development
2. Set up CI/CD pipeline
3. Configure staging environment
4. Begin integration testing
