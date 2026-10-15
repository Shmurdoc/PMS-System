# WS4 — AI Agent Layer Implementation Plan

Status: **SHIPPED** (spec: `ai-agent-layer-spec.md`; components C1–C12 all delivered)

## 1. Major components & dependencies

| # | Component | Depends on | Scope |
|---|---|---|---|
| C1 | Domain entities | — | `AiInsight`, `Workflow`, `Agent`, `AgentLog` in `Aquri.Domain\Entities\` |
| C2 | Persistence | C1 | DbSets + fluent config in `AquriDbContext.OnModelCreating` (no `IEntityTypeConfiguration` classes exist — fluent is the codebase pattern); migration `AddAiAgentLayer` |
| C3 | Application slices | C2 | `AiInsights\`, `AiWorkflows\`, `AiChat\`, `AiAgents\` (MediatR commands/queries + DTOs + AutoMapper profile entries) |
| C4 | API controllers + DI | C3 | 4 controllers (`[ApiVersion("1.0")]`, route `api/v{version:apiVersion}/[controller]`, Result<T> handling), `Program.cs`: `AiChatOptions` binding + named HttpClient `"ai"` |
| C5 | Seeding | C1–C2 | `DbSeeder` granular idempotent blocks: 6 agents + sample insights/workflows |
| C6 | Backend tests | per-slice | `Aquri.Tests\Api\*ApiTests.cs` via `AquriApiFactory`/`ApiTestBase`; LLM unit tests with fake `HttpMessageHandler` |
| C7 | Frontend services/mappers | C4 contract | `lib/api/services.ts`, `lib/api/mappers.ts` |
| C8 | Hydrate + store sync | C7 | `lib/api/hydrate.ts` wave + 6 local-first actions + 2 reconcile actions |
| C9 | AIEnhancements wiring | C7–C8 | chat tab → `sendChat()`, agents tab → API with fallback |
| C10 | App.tsx drawer | C7 | `sendChat()` + neutral label |
| C11 | Verification | all | dotnet build/test, npm build, scoped eslint |
| C12 | Docs | all | roadmap, getting-started, architecture, spec → shipped |

## 2. Implementation order (sequential backbone; TDD per slice)

```
C1 entities ──► C2 context+migration ──► CP1
   └─► AiInsights slice (GET/DELETE → POST/PUT) ──► CP2
   └─► AiWorkflows slice (GET/DELETE → POST/PUT) ──► CP3
   └─► AiChat deterministic (stats + router + controller) ──► CP4a
   └─► AiChat LLM (OpenAi-compatible + hybrid + DI wiring) ──► CP4b
   └─► AiAgents (GET/PATCH → RUN generators) ──► CP5
   └─► DbSeeder AI blocks + idempotency tests ──► CP6 (full backend gate)
   └─► C7 services/mappers ──► C8 hydrate/store ──► C9/C10 pages ──► CP7
   └─► C11 full verify ──► C12 docs
```

Rationale: chat before agents (agent logs/generators reuse `ChatStatsProvider` data); workflows before agents is independent — order chosen to reach a testable endpoint earliest (insights is the store-contract core).

## 3. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **R1** `DbSeeder` early-returns when users exist → AI seeds never run on existing dev DBs | Restructure to per-entity `AnyAsync` guards (users/agents/insights/workflows independent); idempotency test runs `SeedAsync` twice |
| **R2** Local-first creates diverge (local `ai-${Date.now()}` id vs server int id) | Additive store actions `reconcileAiInsight`/`reconcileWorkflow`: POST success with different id replaces the local row; deletes/updates with non-numeric ids skip via `toNumericId` (WS5 semantics) |
| **R3** Missing `AI` config section breaks test host | Options class with defaults; empty/missing key → deterministic path; add `AI` section (empty key) to `appsettings.json` |
| **R4** Tests accidentally hitting the network | Factory never sets a key; LLM paths covered by unit tests with fake `HttpMessageHandler` injected directly; zero real HTTP in suite |
| **R5** `Workflow.Actions` list column vs EF InMemory | Store as serialized **string** column (handlers serialize/deserialize); DTO exposes `string[]`; no jsonb/array types |
| **R6** AutoMapper profile drift | Add mappings alongside each slice; `dotnet build` (warnings-as-errors) is the gate |
| **R7** 347-test regression | Full `dotnet test` at every checkpoint CP1–CP6 |
| **R8** Hydrate semantics drift | Insights/workflows fetched only when token present (demo = zero network, unchanged); each failure adds a `failed[]` entry, keeps mocks; success-with-zero-rows replaces |
| **R9** Agents tab empty when API down / demo mode | Keep `INITIAL_AGENTS` as renamed `FALLBACK_AGENTS` used when fetch fails or no token (mirrors WS5 mock-fallback); spec §7 updated accordingly |
| **R10** Route casing (`AiInsights` vs `aiInsights`) | ASP.NET route matching is case-insensitive; frontend uses camelCase URLs like all WS5 endpoints |

## 4. Verification checkpoints

| CP | Gate | Command |
|---|---|---|
| CP1 | Entities+context+migration compile, suite still green | `dotnet build Aquri.sln` + full `dotnet test` |
| CP2–CP5 | Each slice: new tests green + suite green | full `dotnet test` ($env:TEMP/TMP=C:\Temp) |
| CP6 | Backend complete: 347 + N green, 0 warnings | `dotnet build` + `dotnet test Aquri.sln` |
| CP7 | Frontend wired: build 0 errors, touched files lint 0 | `npm run build`; `npx eslint src/lib/api/ src/store/useAppStore.ts src/pages/AIEnhancements.tsx src/App.tsx` |
| CP8 | Manual smoke: API boots, `/health` ok, 4 tabs live, deterministic chat answers from seeded data, LLM stays off (empty key) | run API + frontend dev |
| CP9 | Docs synced, spec status → shipped | read-through |

## 5. Parallelism

One developer, so: sequential. (C7 could start against the frozen endpoint table in spec §5 while backend slices land, but writing frontend against a moving handler contract risks rework; sequential is chosen deliberately.)

## 6. Explicit non-goals (carried from spec §9)

No tool-use loops, no workflow execution engine, no streaming, no store model reshapes, no removal of the drawer, no frontend legacy-lint fixes, no applying the Postgres migration (env-blocked).
