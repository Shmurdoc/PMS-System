# WS4 — AI Agent Layer Tasks

Status: **SHIPPED** (plan: `ai-agent-layer-plan.md`; T1–T19 complete, 448/448 tests)
Order = dependency order. TDD: write/extend the test file first (red), implement (green), run full suite.

Conventions for every backend task: full-suite green required (`$env:TEMP="C:\Temp"; $env:TMP="C:\Temp"; dotnet test Aquri.sln`), `dotnet build Aquri.sln` zero warnings (TreatWarningsAsErrors).

## Backend

- [x] **T1: Domain entities**
  - Acceptance: `AiInsight` (PropertyId int? FK, Type, Title, Description, Recommendation, Impact, Dismissed bool?, CreatedAt), `Workflow` (PropertyId int?, Name, Description?, Trigger, Actions as string, Status, LastRun?, CreatedBy?, CreatedAt), `Agent` (Key unique, Name, Description, Status, LastRun?, TotalRuns), `AgentLog` (AgentId FK, Time, Message) — plain POCOs matching existing entity style (e.g. `AuditLog`).
  - Verify: `dotnet build Aquri.sln`
  - Files: `Aquri.Domain\Entities\{AiInsight,Workflow,Agent,AgentLog}.cs`

- [x] **T2: Persistence + migration (CP1)**
  - Acceptance: DbSets + fluent config in `OnModelCreating` (FKs to Property/Agent, `Actions` as text column, unique index on `Agent.Key`); migration `AddAiAgentLayer` scaffolded (not applied — env-blocked); InMemory suite unaffected.
  - Verify: build + full test suite green
  - Files: `Aquri.Infrastructure\Persistence\AquriDbContext.cs`, `Aquri.Infrastructure\Persistence\Migrations\*` (generated)

- [x] **T3: AiInsights read + delete slice (red→green)**
  - Acceptance: `GET /api/v1/aiInsights?propertyId(int?)` (nullable = all), `DELETE /{id}` → 204/404; tests cover 401 no-token, 403 front_desk, envelope shape, propertyId filter.
  - Verify: full suite
  - Files: `Aquri.Application\AiInsights\{GetAiInsightsQuery,DeleteAiInsightCommand}.cs`, `Aquri.API\Controllers\AiInsightsController.cs`, `Aquri.Tests\Api\AiInsightsApiTests.cs`, `Aquri.Application\MappingProfiles\MappingProfile.cs`

- [x] **T4: AiInsights create + update slice (CP2)**
  - Acceptance: `POST` → 201 with int id; `PUT /{id}` sparse semantics identical to existing update handlers (absent = unchanged; `dismissed` tri-state preserved: absent=unchanged, false=acknowledged, true=dismissed); invalid vocab → 400; validation + authz tests green.
  - Verify: full suite
  - Files: `Aquri.Application\AiInsights\{CreateAiInsightCommand,UpdateAiInsightCommand}.cs`, `AiInsightsController.cs` (extend), `AiInsightsApiTests.cs` (extend)

- [x] **T5: AiWorkflows read + delete slice**
  - Acceptance: `GET /api/v1/workflows`, `DELETE /{id}` → 204/404; `Actions` string→`string[]` in DTO; authz + envelope + filter tests.
  - Verify: full suite
  - Files: `Aquri.Application\AiWorkflows\{GetWorkflowsQuery,DeleteWorkflowCommand}.cs`, `Aquri.API\Controllers\WorkflowsController.cs`, `Aquri.Tests\Api\AiWorkflowsApiTests.cs`, `MappingProfile.cs`

- [x] **T6: AiWorkflows create + update slice (CP3)**
  - Acceptance: `POST` 201 (actions array serialized server-side), `PUT` sparse (status `active|inactive` vocab), tests green.
  - Verify: full suite
  - Files: `Aquri.Application\AiWorkflows\{CreateWorkflowCommand,UpdateWorkflowCommand}.cs`, `WorkflowsController.cs` (extend), `AiWorkflowsApiTests.cs` (extend)

- [x] **T7: AiChat deterministic core (CP4a)**
  - Acceptance: `ChatStatsProvider` computes occupancy/revenue/bookings/rooms/guests/invoice aggregates from DbContext (mirrors AIEnhancements L141–158); `DeterministicChatClient` covers all 11 intents (incl. default) against seeded data; `POST /api/v1/chat` → `{reply, source:"deterministic", intent}`; empty message 400; 401/403; envelope.
  - Verify: full suite
  - Files: `Aquri.Application\AiChat\{ChatStatsProvider,DeterministicChatClient,SendChatCommand}.cs`, `Aquri.API\Controllers\ChatController.cs`, `Aquri.Tests\Api\ChatApiTests.cs`, `MappingProfile.cs` (if needed)

- [x] **T8: AiChat hybrid + LLM client (CP4b)**
  - Acceptance: `AiChatOptions` (BaseUrl/Model/ApiKey/TimeoutSeconds, defaults when `AI` section missing); `OpenAiCompatibleClient` posts to `{BaseUrl}/chat/completions` via named HttpClient `"ai"`; `HybridChatClient`: empty key → deterministic without HTTP; LLM success → `source:"llm"`; timeout/5xx/malformed → deterministic fallback; unit tests use **fake HttpMessageHandler only** (success, timeout, 5xx, malformed JSON, empty-key); key never appears in response payloads or logs; `Program.cs` binds options + registers HttpClient.
  - Verify: full suite (zero real network)
  - Files: `Aquri.Application\AiChat\{AiChatOptions,OpenAiCompatibleClient,HybridChatClient}.cs`, `Aquri.API\Program.cs`, `Aquri.Tests\AiChat\HybridChatClientTests.cs`, `appsettings.json` (AI section, empty key)

- [x] **T9: AiAgents read + status slice**
  - Acceptance: `GET /api/v1/agents` returns dto incl. `key` + `logs` (top 20 desc); `PATCH /{id}/status` validates `running|paused|stopped`; 401/403/envelope tests.
  - Verify: full suite
  - Files: `Aquri.Application\AiAgents\{GetAgentsQuery,UpdateAgentStatusCommand}.cs`, `Aquri.API\Controllers\AgentsController.cs`, `Aquri.Tests\Api\AiAgentsApiTests.cs`, `MappingProfile.cs`

- [x] **T10: RunAgentCommand + generators (CP5)**
  - Acceptance: run creates AiInsight + AgentLog from live data per key (spec §6 table), increments TotalRuns, sets LastRun; `stopped` agent → 400 via envelope; response `{agent, insight}`; tests green.
  - Verify: full suite
  - Files: `Aquri.Application\AiAgents\{RunAgentCommand,AgentInsightGenerator}.cs`, `AgentsController.cs` (extend), `AiAgentsApiTests.cs` (extend)

- [x] **T11: DbSeeder AI blocks (CP6 prep)**
  - Acceptance: granular idempotent guards (users/agents/insights/workflows independent — fixes the single early-return); seeds 6 agents (spec §6 keys) + sample insights/workflows mirroring store mocks; running `SeedAsync` twice yields identical counts; existing demo-user seeding unchanged.
  - Verify: full suite (incl. new idempotency test)
  - Files: `Aquri.Infrastructure\Persistence\DbSeeder.cs`, `Aquri.Tests\Seeding\DbSeederAiTests.cs`

- [x] **T12: Backend gate (CP6)**
  - Acceptance: `dotnet build Aquri.sln` 0 warnings; full suite **347 + N green**; smoke: API boots, `GET /health` ok, `POST /api/v1/chat` returns deterministic reply from seeded data with empty key.
  - Verify: build + full test + manual boot smoke
  - Files: none (checkpoint)

## Frontend

- [x] **T13: DTOs, mappers, services**
  - Acceptance: DTO interfaces + entity mappers (int→string id, tri-state `dismissed` preserved) for AiInsight/Workflow/Agent(+logs); services for all 13 endpoints incl. `sendChat(message)` → `{reply, source}`; uses existing `request`/envelope helpers; type-only imports (verbatimModuleSyntax-safe).
  - Verify: `npm run build` ✓ (0 errors)
  - Files: `src/lib/api/mappers.ts`, `src/lib/api/services.ts`

- [x] **T14: Hydrate wave**
  - Acceptance: `GET /aiInsights` + `GET /workflows` added to the token-gated parallel wave; per-source `failed[]` entries on failure, mocks kept; zero-rows success replaces; demo path (no token) still zero requests.
  - Verify: `npm run build` ✓ (0 errors)
  - Files: `src/lib/api/hydrate.ts` (+ `setAiInsights` setter in the store — every other hydrated collection has one; aiInsights had none)

- [x] **T15: Store local-first sync + reconcile**
  - Acceptance: `addAiInsight/updateAiInsight/deleteAiInsight/addWorkflow/updateWorkflow/deleteWorkflow` fire-and-forget via existing `syncToApi`/`toNumericId` (no token → skip); new `reconcileAiInsight`/`reconcileWorkflow` actions swap local id for server id on POST success; store model shapes unchanged; hydrate unchanged contract.
  - Verify: `npm run build` ✓ (0 errors)
  - Files: `src/store/useAppStore.ts`

- [x] **T16: AIEnhancements wiring**
  - Acceptance: chat tab calls `sendChat()` with local `getAIResponse` fallback (no token / error), no fake delay; agents tab seeded from `fetchAgents()` when token, `FALLBACK_AGENTS` (renamed INITIAL_AGENTS) when no token/error; run/pause/stop hit API, run response appends created insight to store; insights/workflows tabs keep current UI, mutations flow through synced actions; insights hydrate replaces store mock on success.
  - Verify: `npm run build` ✓ (0 errors) + `npx eslint src/pages/AIEnhancements.tsx` ✓ (0 problems — the purity rule already fails Messaging/AdminPanel on `Date.now`; this file got module-scope `localId`/`elapsedMs` helpers instead of disables)
  - Files: `src/pages/AIEnhancements.tsx`

- [x] **T17: Drawer wiring (CP7)**
  - Acceptance: App.tsx AIAssistant drawer calls `sendChat()` with canned responses as fallback only; "Powered by GPT-4" → neutral "AI Assistant"; hydrate call sites unchanged.
  - Verify: `npm run build` ✓ (0 errors) + `npx eslint src/lib/api/ src/store/useAppStore.ts src/pages/AIEnhancements.tsx src/App.tsx` ✓ (0 problems — also dropped the 1500ms fake typing delay, canned reply now only covers no-token/failed-call)
  - Files: `src/App.tsx`

- [x] **T18: Manual smoke (CP8)**
  - Acceptance: API boots (empty AI key), frontend dev: all 4 tabs live (insights/workflows from API, agents fetched, chat deterministic answers citing seeded data), drawer chat works, demo session makes zero AI requests, mutations appear server-side after refresh.
  - Verify: manual run-through, screenshot/log evidence in session notes
  - Verify ✓: 18/18 HTTP checks (`t18-smoke.ps1`, empty AI key ⇒ zero outbound AI calls) + browser run-through on :5173 — 4 tabs render API data (8 insights / 4 workflows / 6 agents, `Revenue Optimizer` still shows the smoke run's `Total runs 2`), chat answers "Current Occupancy: 0%…" from live data, drawer hits `POST /v1/chat` then falls back to canned text with no token; demo login (fetch forced offline) lands with `aquri_token` unset and the AI page fires zero requests; screenshots in `%TEMP%\aquri-t18-*.png`
  - Files: none (checkpoint)

- [x] **T19: Docs + spec upkeep (CP9)**
  - Acceptance: roadmap AI section marked shipped (347+N tests), getting-started documents `AI` config + provider options (DeepSeek default / Nemotron alt), architecture notes the AI layer, spec status → shipped, plan/tasks status → shipped.
  - Verify: read-through; `npm run build` + full `dotnet test` still green as final gate
  - Verify ✓: roadmap gained the shipped AI section (periphery note now defers to it), getting-started documents `AI` config + DeepSeek/Nemotron table (stale 252-test count → 424), architecture has the AI-layer section, spec/plan/tasks status → SHIPPED; gates green — `npm run build` ✓, `dotnet test Aquri.sln` 424/424
  - Files: `docs\roadmap.md`, `docs\getting-started.md`, `docs\architecture.md`, `docs\ai-agent-layer-spec.md`
