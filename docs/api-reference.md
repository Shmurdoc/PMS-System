# API Reference — v1

Base route: `/api/v1/<Controller>` (the `Controller` suffix is stripped). Every controller carries `[ApiVersion("1.0")]`, `[ApiController]`, and the route attribute. Responses use the WS3 envelope: `{ success, data, error: { code, message }, requestId, timestamp }` — failures set `error.code` (e.g. `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN`).

Authorization is AND-combined: a class-level `[Authorize(Roles = "admin,manager")]` applies to every action that does not narrow it further. `[Authorize]` with no roles = any valid Bearer token. Roles: `admin`, `manager`, `front_desk`, `housekeeping`, `maintenance`, `auditor`.

Sparse updates: `PUT` bodies treat absent/null fields as "keep current value". Deletes answer 204 No Content. Human-facing ids (`INV-…`, `PAY-…`, `TKT-…`) are generated server-side.

127 endpoints across 25 controllers.

---

## Auth — login and current-user profile. Login is anonymous; `/me` requires a token.

| Method + Route | Roles | Purpose |
|---|---|---|
| `POST /api/v1/Auth/login` | anonymous (`[AllowAnonymous]`, rate-limited `auth` policy) | Authenticate email + password, return a signed JWT |
| `GET /api/v1/Auth/me` | authenticated | Return the profile for the authenticated user |

## Properties — property management.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Properties` | admin, manager, front_desk, housekeeping, maintenance, auditor | List all properties |
| `GET /api/v1/Properties/{id}` | admin, manager, front_desk, housekeeping, maintenance, auditor | Get a property by id |
| `GET /api/v1/Properties/{id}/status` | admin, manager, front_desk, housekeeping, maintenance, auditor | Get property status |
| `POST /api/v1/Properties` | admin, manager | Create a property with optional initial rooms |
| `PUT /api/v1/Properties/{id}` | admin, manager | Update property status |
| `DELETE /api/v1/Properties/{id}` | admin | Delete a property |

## Rooms — room inventory and lifecycle.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Rooms/property/{propertyId}` | admin, manager, front_desk, housekeeping, maintenance, auditor | List rooms for a property (no bare list route) |
| `GET /api/v1/Rooms/{id}` | admin, manager, front_desk, housekeeping, maintenance, auditor | Get a room by id |
| `POST /api/v1/Rooms` | admin, manager | Create a room |
| `PUT /api/v1/Rooms/status` | admin, manager | Update room status |
| `PUT /api/v1/Rooms/price` | admin, manager | Update room price |
| `PUT /api/v1/Rooms/max-occupancy` | admin, manager | Update max occupancy |
| `PUT /api/v1/Rooms/amenities` | admin, manager | Update amenities |
| `PUT /api/v1/Rooms/view` | admin, manager | Update room view |
| `DELETE /api/v1/Rooms/{id}` | admin | Delete a room |

## Guests — guest directory.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Guests?search=` | authenticated | List guests; optional name/email search |
| `GET /api/v1/Guests/{id}` | authenticated | Get a guest by id |
| `POST /api/v1/Guests` | admin, manager, front_desk | Register a guest |
| `PUT /api/v1/Guests/{id}` | admin, manager, front_desk | Edit a guest profile |
| `DELETE /api/v1/Guests/{id}` | admin, manager | Delete (409 if referenced by bookings/invoices/payments) |

## Bookings — booking lifecycle. List is property-scoped (`propertyId` binds non-nullable — absent = empty list).

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Bookings?propertyId=&status=` | authenticated | List bookings for a property |
| `GET /api/v1/Bookings/{id}` | authenticated | Get a booking by id |
| `POST /api/v1/Bookings` | admin, manager, front_desk | Create (checks room availability) |
| `PATCH /api/v1/Bookings/{id}/status` | admin, manager, front_desk | Transition booking status |
| `POST /api/v1/Bookings/{id}/deposit` | admin, manager, front_desk | Record a deposit |
| `DELETE /api/v1/Bookings/{id}` | admin, manager | Delete and free the room |

## Invoices — tax invoices (ZAR, VAT 15%). List is property-scoped (non-nullable `propertyId`).

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Invoices?propertyId=&status=` | authenticated | List invoices for a property |
| `GET /api/v1/Invoices/{id}` | authenticated | Get an invoice with line items |
| `POST /api/v1/Invoices` | admin, manager, front_desk | Create with line items; totals computed server-side |
| `POST /api/v1/Invoices/{id}/items` | admin, manager, front_desk | Add a line item; totals recompute |
| `POST /api/v1/Invoices/{id}/payments` | admin, manager, front_desk | Record a payment; flips to paid when settled |
| `DELETE /api/v1/Invoices/{id}` | admin, manager | Delete; payments detached, not destroyed |

## Payments — payment processing. List is property-scoped (non-nullable `propertyId`).

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Payments?propertyId=&status=` | authenticated | List payments for a property |
| `POST /api/v1/Payments` | admin, manager, front_desk | Create a pending payment |
| `POST /api/v1/Payments/{id}/complete` | admin, manager, front_desk | Complete (optional `transactionId` body) |
| `POST /api/v1/Payments/{id}/refund` | admin, manager | Refund — one-way transition |

## Tickets — maintenance/support tickets. List is property-scoped (non-nullable `propertyId`).

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Tickets?propertyId=&status=&priority=` | authenticated | List tickets for a property |
| `GET /api/v1/Tickets/{id}` | authenticated | Get a ticket with its comment thread |
| `POST /api/v1/Tickets` | admin, manager, front_desk, housekeeping, maintenance | Open a ticket |
| `PATCH /api/v1/Tickets/{id}/status` | admin, manager, front_desk, housekeeping, maintenance | Transition through the workflow |
| `POST /api/v1/Tickets/{id}/assign` | admin, manager | Assign to a staff member |
| `POST /api/v1/Tickets/{id}/comments` | admin, manager, front_desk, housekeeping, maintenance | Add a comment |
| `DELETE /api/v1/Tickets/{id}` | admin, manager | Delete with its comment thread |

## MaintenanceRequests — work orders.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/MaintenanceRequests?propertyId=&status=&priority=` | authenticated | List (optional `int?` filters — absent = all) |
| `GET /api/v1/MaintenanceRequests/{id}` | authenticated | Get by id |
| `POST /api/v1/MaintenanceRequests` | admin, manager, front_desk, maintenance | Create (defaults pending/medium) |
| `PUT /api/v1/MaintenanceRequests/{id}` | admin, manager, front_desk, maintenance | Sparse update |
| `DELETE /api/v1/MaintenanceRequests/{id}` | admin, manager, front_desk, maintenance | Delete |

## Users — staff accounts. Reads for admin/manager, writes admin-only; password hash never returned.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Users?search=` | admin, manager | List accounts; optional name/email/role search |
| `GET /api/v1/Users/{id}` | admin, manager | Get one account |
| `POST /api/v1/Users` | admin | Create with hashed password; 409 on duplicate |
| `PUT /api/v1/Users/{id}` | admin | Update profile / role / password (email immutable) |
| `DELETE /api/v1/Users/{id}` | admin | Delete; 409 protects self, last admin, accounts with dependents |

## Expenses — staff expenses with approval workflow.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Expenses?propertyId=&status=&category=` | authenticated | List (optional filters) |
| `GET /api/v1/Expenses/{id}` | authenticated | Get by id |
| `POST /api/v1/Expenses` | admin, manager, front_desk, housekeeping, maintenance | Submit (submitted-by from JWT) |
| `PUT /api/v1/Expenses/{id}` | admin, manager, front_desk | Edit a pending expense |
| `POST /api/v1/Expenses/{id}/approve` | admin, manager | Approve |
| `POST /api/v1/Expenses/{id}/reject` | admin, manager | Reject |
| `DELETE /api/v1/Expenses/{id}` | admin | Delete |

## RatePlans — pricing plans.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/RatePlans?propertyId=&active=` | authenticated | List (optional filters) |
| `GET /api/v1/RatePlans/{id}` | authenticated | Get by id |
| `POST /api/v1/RatePlans` | admin, manager | Create |
| `PUT /api/v1/RatePlans/{id}` | admin, manager | Edit rate, room types, restrictions, active |
| `DELETE /api/v1/RatePlans/{id}` | admin, manager | Delete |

## InventoryItems — stock items.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/InventoryItems?propertyId=&category=&search=` | authenticated | List (optional filters) |
| `GET /api/v1/InventoryItems/{id}` | authenticated | Get by id |
| `POST /api/v1/InventoryItems` | admin, manager, housekeeping | Add a stock item |
| `PUT /api/v1/InventoryItems/{id}` | admin, manager, housekeeping | Edit details |
| `POST /api/v1/InventoryItems/{id}/adjust` | admin, manager, housekeeping | Signed adjustment (negative = usage) |
| `POST /api/v1/InventoryItems/{id}/restock` | admin, manager, housekeeping | Record a delivery |
| `DELETE /api/v1/InventoryItems/{id}` | admin, manager | Remove |

## Shifts — staff scheduling.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Shifts?propertyId=&userId=&date=&status=` | authenticated | List (optional filters) |
| `GET /api/v1/Shifts/{id}` | authenticated | Get by id |
| `POST /api/v1/Shifts` | admin, manager | Schedule a shift |
| `PUT /api/v1/Shifts/{id}` | admin, manager | Edit break, overtime, notes, department (sparse) |
| `PUT /api/v1/Shifts/{id}/status` | admin, manager | scheduled/completed/cancelled/swapped |
| `PUT /api/v1/Shifts/{id}/swap` | admin, manager | Reassign to another staff member |
| `DELETE /api/v1/Shifts/{id}` | admin, manager | Remove from the roster |

## Attendance — time tracking.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Attendance?propertyId=&userId=&date=&status=` | authenticated | List (optional filters) |
| `GET /api/v1/Attendance/{id}` | authenticated | Get by id |
| `POST /api/v1/Attendance` | admin, manager, front_desk | Clock in (or absent/no-show entry) |
| `PUT /api/v1/Attendance/{id}` | admin, manager, front_desk | Clock out / status transition / notes (sparse) |
| `DELETE /api/v1/Attendance/{id}` | admin, manager | Remove (admin correction) |

## Messages — staff chat.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Messages?propertyId=&recipientId=&channelId=&unreadOnly=` | authenticated | List (optional filters) |
| `GET /api/v1/Messages/{id}` | authenticated | Get by id |
| `POST /api/v1/Messages` | authenticated | Send; sender stamped from the token |
| `PUT /api/v1/Messages/{id}/read` | authenticated | Mark read (drives unread badge) |
| `DELETE /api/v1/Messages/{id}` | admin, manager | Delete |

## AuditLogs — write-once trail; never edited or deleted.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/AuditLogs?propertyId=&entityType=&entityId=&userId=&action=` | authenticated | List, newest first (optional filters) |
| `GET /api/v1/AuditLogs/{id}` | authenticated | Get by id |
| `POST /api/v1/AuditLogs` | admin, manager | Record an entry; actor/IP stamped from claims/request |

## TaxConfigs — tax and levy rules with validity windows. Rate is stored as a fraction (0.15).

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/TaxConfigs?propertyId=&type=&active=` | authenticated | List (optional filters) |
| `GET /api/v1/TaxConfigs/{id}` | authenticated | Get by id |
| `POST /api/v1/TaxConfigs` | admin, manager | Create a rule |
| `PUT /api/v1/TaxConfigs/{id}` | admin, manager | Sparse update (rate, included, window end, deactivation) |
| `DELETE /api/v1/TaxConfigs/{id}` | admin, manager | Delete |

## Electricity — meter readings per zone. List is a bare GET (optional `propertyId`/`zone`).

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Electricity?propertyId=&zone=` | authenticated | List readings |
| `GET /api/v1/Electricity/{id}` | authenticated | Get by id |
| `POST /api/v1/Electricity` | admin, manager, front_desk, housekeeping, maintenance | Record a reading |
| `PUT /api/v1/Electricity/{id}` | admin, manager, front_desk | Edit (sparse) |
| `DELETE /api/v1/Electricity/{id}` | admin | Delete |

## Integrations — third-party connection registry. List is a bare GET (optional `propertyId`/`category`/`status`).

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Integrations?propertyId=&category=&status=` | authenticated | List integrations |
| `GET /api/v1/Integrations/{id}` | authenticated | Get by id |
| `POST /api/v1/Integrations` | admin, manager | Wire up (configured-by stamped from JWT) |
| `PUT /api/v1/Integrations/{id}` | admin, manager | Edit details (sparse) |
| `POST /api/v1/Integrations/{id}/sync` | admin, manager | Stamp LastSync, status → connected |
| `DELETE /api/v1/Integrations/{id}` | admin | Delete |

## RfidTags — dual NFC: staff badges punch attendance, guest tags resolve stay context. List is property-scoped (non-nullable `propertyId`).

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/RfidTags?propertyId=&kind=` | authenticated | List a property's tags |
| `POST /api/v1/RfidTags` | admin, manager | Issue (staff→user, guest→booking); 409 on conflict |
| `POST /api/v1/RfidTags/{id}/revoke` | admin, manager | Mark blocked; taps stop resolving |
| `POST /api/v1/RfidTags/tap/staff` | admin, manager, front_desk, housekeeping, maintenance | Punch today's attendance in/out (3s re-read debounce) |
| `POST /api/v1/RfidTags/tap/guest` | admin, manager, front_desk, housekeeping, maintenance | Resolve guest/room/booking context; no writes |

## AiInsights — revenue nudges, staffing warnings, maintenance flags.

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/AiInsights?propertyId=` | admin, manager | List (optional property filter) |
| `POST /api/v1/AiInsights` | admin, manager | Create |
| `PUT /api/v1/AiInsights/{id}` | admin, manager | Sparse update |
| `DELETE /api/v1/AiInsights/{id}` | admin, manager | Delete |

## Workflows — rules-based automations (class-level admin/manager).

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Workflows` | admin, manager | List, newest first |
| `POST /api/v1/Workflows` | admin, manager | Create |
| `PUT /api/v1/Workflows/{id}` | admin, manager | Edit — absent fields keep current value |
| `DELETE /api/v1/Workflows/{id}` | admin, manager | Delete |

## Agents — the six AI workers (class-level admin/manager).

| Method + Route | Roles | Purpose |
|---|---|---|
| `GET /api/v1/Agents` | admin, manager | List agents with their latest 20 log entries |
| `PATCH /api/v1/Agents/{id}/status` | admin, manager | Pause, resume, or stop |
| `POST /api/v1/Agents/{id}/run` | admin, manager | Run against live data, return the new insight |

## Chat — answers questions about the property (class-level admin/manager).

| Method + Route | Roles | Purpose |
|---|---|---|
| `POST /api/v1/Chat` | admin, manager | Deterministic stats first; LLM only when `AI:ApiKey` is set |

---

## Notes

- Controllers with class-level `admin,manager` restriction: Agents, AiInsights, Chat, Workflows.
- `PATCH` is used only on `Agents/{id}/status`, `Tickets/{id}/status`, and `Bookings/{id}/status`.
- Several resources use action-style `PUT` sub-routes (Shifts status/swap, Messages read, Rooms status/price/max-occupancy/amenities/view).
- All `CreatedAtAction` redirects hardcode `version = "1.0"`.
- Health: `GET /health` (liveness), `GET /health/ready` (includes Postgres check). Swagger at `/swagger`.
