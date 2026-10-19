# AI Agent Layer Specification

Status: **Shipped.** Chat is deterministic-first with an optional LLM; workflows are CRUD-only; demo seeding is on.
Provider: **DeepSeek** (default) / **Nemotron 3.5** (drop-in alternative) — both OpenAI-compatible.

---

## 1. Objective

Build the AI agent layer end-to-end: a backend vertical feature set (insights, workflows, agents, chat)
persisted in Postgres, served behind the WS3 envelope + role gates, and wired to the three existing
frontend AI surfaces (AIEnhancements page's 4 tabs, AIAssistant drawer in App.tsx, store CRUD):

1. All AI data becomes real (entities, endpoints, migration, seeding) — frontend local mocks remain
   only as offline/demo fallback per the WS5 hydrate semantics.
2. Chat is hybrid: deterministic, data-grounded answers always work; an LLM improves answers only
   when explicitly configured. **No AI dependency is ever required for the app to pass tests or run.**

## 2. Assumptions (accepted with approach decision)

- `AiInsight`, `Workflow`, `Agent`, `AgentLog` become persisted Postgres entities (roadmap's
  AiInsight deferral is superseded by this approved spec).
- Backend endpoints serve all four AIEnhancements tabs + chat; frontend is wired to the live API and
  kills hardcoded state (`INITIAL_AGENTS`, canned drawer responses, keyword-only chat).
- Frontend store types remain the contract: `AiInsight`/`Workflow` models are unchanged
  (string ids via WS5 mapper convention: int PK → `String(id)`). Agents have no store model today —
  they stay component-local state, hydrated from the API (no store expansion).
- WS3/WS1/WS2 invariants apply unchanged (see §11).

## 3. Provider design

Both providers speak the OpenAI chat-completions protocol → **one implementation**, config-selected:

| | DeepSeek (default) | Nemotron 3.5 (alternative) |
|---|---|---|
| BaseUrl | `https://api.deepseek.com` | `https://integrate.api.nvidia.com/v1` |
| Model | `deepseek-flash` | `nvidia/nemotron-3.5-lightning-30b-a3b` |
| Auth | `Authorization: Bearer <key>` | same |

- Transport: `IHttpClientFactory` named client `"ai"` (framework-provided; **zero new NuGet packages** —
  `HttpClient` + `System.Net.Http.Json` are BCL). `AI:TimeoutSeconds` bounds every call.
- Config (appsettings, env override `AI__ApiKey`):

```json
"AI": { "BaseUrl": "https://api.deepseek.com", "Model": "deepseek-flash", "ApiKey": "", "TimeoutSeconds": 15 }
```

- `ApiKey` empty (default) → LLM disabled, deterministic path only. Key is never logged, never
  serialized into DTOs, never sent to the frontend.

### Hybrid chat flow (`IAiChatClient` → `HybridChatClient`)

```
POST /api/v1/chat {message}
  ├─ compute ChatStats server-side (occupancy, revenue, bookings, rooms, guests, invoices — mirrors
  │  the frontend's computed stats in AIEnhancements.tsx L141–158, from DbContext)
  ├─ AI:ApiKey empty? ──────────────────────────────► DeterministicChatClient
  ├─ else POST {BaseUrl}/chat/completions
  │    { model, messages: [system(stats+rules), user(message)], max_tokens }
  │    ├─ success, non-empty content ───────────────► { reply, source: "llm" }
  │    └─ timeout / non-2xx / parse error ──────────► DeterministicChatClient  (never 5xx)
  └─ DeterministicChatClient: intent router ported from getAIResponse (AIEnhancements.tsx L163–204)
       occupancy | revenue | guest | booking | room | staff | price | forecast | invoice | help | default
       answers computed from ChatStats ─────────────► { reply, source: "deterministic", intent }
```

Prompt rules: system message carries role instructions + stats JSON; user message is a separate
user-role message (never interpolated into system). LLM output is **display-only** (§11.7).

## 4. Data model (Domain entities, one migration)

| Entity | Fields |
|---|---|
| `AiInsight` | Id (PK), PropertyId (int?, FK → Property, null = global), Type, Title, Description, Recommendation, Impact, Dismissed (bool?), CreatedAt |
| `Workflow` | Id (PK), PropertyId (int?, FK), Name, Description?, Trigger, Actions (JSON string column → `string[]` in DTO), Status, LastRun?, CreatedBy?, CreatedAt |
| `Agent` | Id (PK), Key (slug, unique), Name, Description, Status, LastRun?, TotalRuns |
| `AgentLog` | Id (PK), AgentId (FK → Agent), Time, Message |

Vocab unions match the store exactly: Type = `revenue|occupancy|staffing|maintenance|guest|operational`;
Impact = `high|medium|low`; Workflow.Status = `active|inactive`; Agent.Status = `running|paused|stopped`;
`Dismissed` tri-state preserved (absent = new, `false` = acknowledged, `true` = dismissed).

**Seeding (DbSeeder, idempotent):** the 6 agents (keys `revenue-optimizer`, `guest-predictor`,
`maintenance-scheduler`, `rate-analyzer`, `staffing-optimizer`, `inventory-monitor` — matching
`INITIAL_AGENTS` names/descriptions), plus sample insights/workflows mirroring the frontend mock seeds
(`mockAiInsights` L724, `mockWorkflows` L732) so a fresh DB shows non-empty tabs after hydrate —
same demo-data rationale as the already-seeded demo users. Real API data replaces store mocks on
hydration success (WS5 semantics: zero rows replaces).

Migration: one scaffolded migration `AddAiAgentLayer` (Postgres apply remains env-blocked; tests use
InMemory — consistent with WS2).

## 5. API surface

All routes follow existing controller convention (`api/v1/<Controller>`), WS3 envelope, camelCase +
ISO-8601 via global middleware/JSON options. **All endpoints `[Authorize(Roles = "admin,manager")]`**
(matches frontend RBAC: `viewAIInsights` is true for admin+manager only — rbac.ts L65/L97).

### AiInsightsController
- `GET  /api/v1/aiInsights?propertyId(int?)` — nullable query = all (maintenanceRequests/ratePlans pattern)
- `POST /api/v1/aiInsights` — `{type,title,description,recommendation,impact,propertyId?}` → 201
- `PUT  /api/v1/aiInsights/{id}` — `{id, type?, title?, description?, recommendation?, impact?, dismissed?}`;
  absent field = unchanged (semantics verified against existing PUT handlers during implementation)
- `DELETE /api/v1/aiInsights/{id}` → 204 (deleteBooking/users precedent)

### WorkflowsController
- `GET /api/v1/workflows`, `POST`, `PUT /{id}` (same partial semantics), `DELETE /{id}` → 204

### AgentsController
- `GET /api/v1/agents` — `AgentDto[]` incl. `logs` inline (top 20 per agent) + `key` (frontend maps key→icon)
- `PATCH /api/v1/agents/{id}/status` — `{status: running|paused|stopped}` → dto
- `POST /api/v1/agents/{id}/run` — executes the agent (§6) → `{agent, insight}`

### ChatController
- `POST /api/v1/chat` — `{message}` (non-empty, validated) → `{reply, source, intent?}`

### Vertical slices (conventions.md)

```
Aquri.Application\AiInsights\   CreateAiInsightCommand, UpdateAiInsightCommand, DeleteAiInsightCommand, GetAiInsightsQuery, Dtos
Aquri.Application\AiWorkflows\  CreateWorkflowCommand, UpdateWorkflowCommand, DeleteWorkflowCommand, GetWorkflowsQuery, Dtos
Aquri.Application\AiAgents\     GetAgentsQuery, UpdateAgentStatusCommand, RunAgentCommand, Dtos
Aquri.Application\AiChat\       SendChatCommand, IAiChatClient, HybridChatClient, DeterministicChatClient,
                                OpenAiCompatibleClient, ChatStatsProvider, Dtos
```

Controllers stay thin (HTTP → command/query → envelope result). AutoMapper `MappingProfile` for
entity→DTO (Mapster untouched, per conventions.md L157).

## 6. Agent execution (deterministic v1)

`POST /agents/{id}/run` computes real data → creates an `AiInsight` + `AgentLog`, increments
`TotalRuns`, sets `LastRun = now`, returns both:

| Key | Insight type | Source data |
|---|---|---|
| revenue-optimizer | revenue | bookings vs revenue totals → rate adjustment recommendation |
| guest-predictor | guest | guest segments/VIP counts → satisfaction forecast |
| maintenance-scheduler | maintenance | open high/urgent MaintenanceRequests → schedule recommendation |
| rate-analyzer | revenue | avg room rate vs occupancy → pricing positioning |
| staffing-optimizer | staffing | occupancy > 80% → housekeeping staffing advice |
| inventory-monitor | operational | InventoryItem below reorder level → reorder alert |

Log messages embed the same live figures. Runs are blocked while agent `status = stopped` →
validation error through envelope. LLM involvement in runs is **out of scope for v1** (offline-testable).

## 7. Frontend wiring

1. `lib/api/services.ts`: `fetchAiInsights`, `fetchWorkflows`, `fetchAgents`, `createAiInsight`,
   `updateAiInsight`, `deleteAiInsight`, `createWorkflow`, `updateWorkflow`, `deleteWorkflow`,
   `updateAgentStatus`, `runAgent`, `sendChat(message)`.
2. `mappers.ts`: DTO→store mappers for AiInsight/Workflow/Agent (int→string id, ISO strings pass through).
3. `hydrate.ts`: add `GET /aiInsights` + `GET /workflows` to the parallel wave (global, single fetch each);
   failures add to `failed[]`, keep mocks. Agents are NOT in the store → fetched by the page.
4. Store local-first sync (WS5 `syncToApi` + `toNumericId` guard): `addAiInsight`, `updateAiInsight`,
   `deleteAiInsight`, `addWorkflow`, `updateWorkflow`, `deleteWorkflow` fire-and-forget when a token
   exists; demo sessions stay zero-network. Store model shapes unchanged.
5. `AIEnhancements.tsx`:
   - Chat tab → `sendChat()`; fallback to existing local `getAIResponse` when no token or on error
     (demo/offline parity). 500 ms fake delay removed.
   - Agents tab → `INITIAL_AGENTS` renamed to `FALLBACK_AGENTS`: state fetched from `fetchAgents()`
     on mount when a token exists; `FALLBACK_AGENTS` used when no token or fetch fails (mirrors the
     WS5 mock-fallback semantics); run/pause/stop call the API; run response appends the created
     insight to the store.
   - Insights/Workflows tabs unchanged UI — data now hydrates from API; mutations go through
     synced store actions (acknowledge/implement/dismiss + audit log keep current behavior).
6. `App.tsx` AIAssistant drawer → same `sendChat()`; canned responses become the fallback only.
7. Config-gated label: "Powered by GPT-4" replaced with a neutral "AI Assistant" (provider-agnostic).

## 8. Testing strategy (offline, TDD)

All tests must pass with **no network** (LLM paths via a fake `HttpMessageHandler`):

- CRUD happy paths + 401 (no token) + 403 (front_desk/maintenance) + envelope shape on every new endpoint.
- 204 deletes; `?propertyId` filtering; partial PUT semantics (absent = unchanged).
- Chat: deterministic intents against seeded stats (11 intents incl. default); `source` assertions;
  empty-message validation.
- LLM path: fake handler success → `source: "llm"`; timeout/5xx/malformed → deterministic fallback;
  empty `AI:ApiKey` → deterministic without any HTTP call; key never appears in response payloads.
- Agent run: insight + log created, counters updated, `stopped` → validation error.
- DbSeeder idempotency (runs twice → same row counts).
- Regression: existing **347 tests stay green**; new tests warning-free (`TreatWarningsAsErrors`).
- Frontend: `npm run build` 0 errors; `eslint` on touched files 0 problems (60 pre-existing errors in
  untouched files remain the documented baseline).

## 9. Out of scope

- LLM tool-use loops / function calling; LLM-generated insights inside agent runs (v1 deterministic).
- Workflow execution engine/trigger runtime (workflows are persisted CRUD data only).
- Streaming responses, embeddings/RAG, vector stores, multi-provider routing/failover chains.
- Removing the duplicate AIAssistant drawer (wired, not redesigned).
- Store model changes; frontend pre-existing lint debt; applying the Postgres migration (env-blocked).

## 10. Success criteria

1. New tests green offline; full suite ≥ 347 + N green; build/lint gates as in §8.
2. All four AIEnhancements tabs + drawer chat operate against the live API (mocks only as fallback).
3. Deterministic chat answers are derived from real seeded DB data; LLM activates only with a key.
4. Zero new NuGet/npm dependencies; zero secrets leaked (logs/DTOs/client).
5. Docs updated: roadmap (AI section now shipped), getting-started (`AI` config), architecture, conventions.

## 11. Invariant checklist (addressed in this spec)

1. **WS3 envelope** on every new endpoint (global middleware; handlers return results/errors uniformly).
2. **AuthZ**: 401 without token; 403 for roles lacking `viewAIInsights`; role gate `admin,manager`.
3. **camelCase + ISO-8601** — global JSON options; no per-endpoint exceptions.
4. **int PK → string id** on the wire via frontend mappers (store contract untouched).
5. **No network in tests** — fake handler only; deterministic path fully covered without config.
6. **LLM never required**: empty key, timeout, or 5xx never fails the request (always envelope success
   with deterministic reply); chat/validation errors still use the error envelope.
7. **Prompt safety**: stats only in system prompt; user text isolated in user role; LLM output
   display-only (never executed, no tools); `AI:ApiKey` never logged/serialized/exposed.
8. **Multi-tenancy**: `PropertyId` FK (nullable = global) on AiInsight/Workflow; nullable query = all.
9. **Vocab unions** match store exactly (§4); status strings per conventions.md L165.
10. **Migration** scaffolded only; InMemory tests; graceful degrade if DB lacks new tables? No —
    hydrate `failed[]` covers it (WS5 semantics).
11. **Local-first mutations** skip network without token (demo = zero requests).
12. **DbSeeder idempotent**; real rows replace store mocks on hydrate success.
13. **Agents stay component-local** (no store expansion); icons mapped client-side by `key`.
14. **No new packages**; `TreatWarningsAsErrors` respected; scope discipline (untouched files stay untouched).

## 12. Execution order (spec-approved → PLAN → TASKS → IMPLEMENT)

1. Backend: entities → migration scaffold → slices (AiInsights → AiWorkflows → AiAgents → AiChat)
   → seeding → tests per slice (red→green, keep 347 green).
2. Frontend: services/mappers → hydrate additions → store sync → AIEnhancements → drawer.
3. Verify: dotnet build + full test run, npm build + scoped eslint, manual API smoke via `/health`.
4. Docs: roadmap, getting-started, architecture, conventions, this spec → Status: shipped.

## 13. Later adjustments (post-ship)

A few things in the plan above changed after the layer was live:

- **No fallback agent list.** The `FALLBACK_AGENTS` rename in §7.5 happened, then went further: the
  canned list is deleted outright. The Agents tab fetches on mount and shows an empty state when
  the call fails or a property has no agents. The only local fallback left is the chat drawer's
  offline reply path, and it no longer pretends to have run any analysis.
- **Demo seeding default flipped.** Seeded insights/workflows still ship, but `Seed:DemoUsers` is
  off by default for `dotnet run` (compose still defaults on) — fresh DB + flag off = no demo rows.
- **Migration blocker gone.** The env issue in §9 is resolved; `dotnet ef database update` applies
  all migrations against local Postgres cleanly.
