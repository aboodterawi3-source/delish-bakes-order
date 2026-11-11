# Delish Cake & Bake — Project Guidelines & Agent Protocol

Welcome to **Delish Cake & Bake** (`delish-bakes-order`).

---

## 1. Architectural Invariants

- **Stack:** React 19 + TanStack Start (`1.169.4`) + Vite (`8.3.5`) + Nitro SSR.
- **Language & Layout:** Full Arabic localization with native RTL layout. English available via language toggle.
- **Data & Concurrency:** PostgreSQL Atomic RPCs, Row-Level Security (RLS), Optimistic Concurrency Control (OCC) with row-version locks, and an immutable financial ledger for all transactions, payments, and refunds.
- **Styling:** Tailwind CSS v4 with semantic design tokens defined in `src/styles.css`.
- **Quality Gates:** All pull requests and commits must pass `tsc --noEmit`, `npm test`, and `npm run build:node`.

---

## 2. Autonomous Agent Skills Protocol & Execution Lifecycle

All agents operating in this workspace must adhere to the structured execution lifecycle governed by `.agents/skills/` and tracked in `skills-lock.json`.

```
+---------------------------------------------------------------------------------------------------+
|                                  DELISH AGENT LIFECYCLE                                           |
|                                                                                                   |
|  [Phase 1: Pre-Code]           --> [Phase 2: Development]        --> [Phase 3: Post-Code Verify]  |
|  grill-me                          superpowers                       playwright-cli               |
|  - OCC & Race Conditions           - Bite-Sized Planning             - Storefront Customer Flow   |
|  - Toxiproxy Network Drops         - TDD (Red-Green-Refactor)        - Realtime KDS Verification  |
|  - Financial Ledger & Refunds      - Quality Gate Compliance         - Zero Console Exceptions    |
+---------------------------------------------------------------------------------------------------+
```

### Priority 1: The Core Trio (Immediate & Mandatory)

#### 1. Logic & Edge-Case Interrogation: `grill-me`

- **Location:** `.agents/skills/grill-me/`
- **Trigger:** Before writing any code for a new feature, table alteration, or critical order/KDS workflow.
- **Protocol:**
  - Adopt the persona of a relentless technical interrogator.
  - Conduct round-by-round design-tree interviews targeting critical failure modes:
    - **OCC Concurrency:** Concurrent cart additions of limited items (e.g. Croissant / Cheesecake) and version mismatch handling.
    - **Network Chaos (`docker-compose.toxiproxy.yml`):** Network partitions and reconnection buffering between storefront, Nitro RPC, and Supabase.
    - **Ledger Invariants:** Append-only transaction logging, idempotency keys, and payment/refund failure rollback safety.
    - **KDS Real-Time Synchronization:** WebSocket state drops, fallback polling, and kitchen ticket status consistency.
  - **Rule:** Do not write code until all frontier questions are answered and edge cases are closed.

#### 2. Engineering Constitution & Quality Gates: `superpowers`

- **Location:** `.agents/skills/superpowers/` (supported by `obra/superpowers` and `addyosmani/agent-skills`)
- **Trigger:** Before implementation and before staging any git commit.
- **Protocol:**
  - **Planning:** Break tasks into bite-sized units with explicit interfaces before implementation. Scan `@/lib` and `@/components/delish` to preserve DRY principles.
  - **TDD (The Iron Law):** `NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.` Write the test, verify failure, write minimal code to pass, then refactor.
  - **Security & Quality Gates Verification:** Verify compliance with all project quality gates:
    - `quality-gate.yml` (TypeScript strict checking, unit/contract suites, production build).
    - `stryker.config.json` (mutation testing thresholds for confirmation messages, role guards, and username helpers).
    - `.squawk.toml` (PostgreSQL migration linting for Supabase).
    - `.dependency-cruiser.cjs` (architectural boundary and circular dependency verification).

#### 3. Automated End-to-End Verification: `playwright-cli`

- **Location:** `.agents/skills/playwright-cli/`
- **Trigger:** After any modification to UI components, cart calculations, checkout flows, or kitchen order processing.
- **Protocol:**
  - Ensure local environment is ready (`vite.config.ts`, `testcontainers.config.json` / PGlite fallback).
  - Launch browser via `playwright-cli` and simulate the complete customer journey:
    1. Open homepage and navigate catalog (`/discover`).
    2. Add bakery items (croissants, macarons, cakes) to cart.
    3. Validate cart prices (JOD format), quantities, and subtotal.
    4. Fill delivery zone (`<DeliveryZoneSelect />`) and Jordanian phone (`@/lib/whatsapp`).
    5. Place order and verify zero browser console errors.
    6. Navigate to `/kitchen` (KDS) and confirm the order immediately reflects with correct line items, status badge, and notes without inventory collision.

---

### Priority 2: Supporting Specialized Skills (On-Demand Activation)

These skills are activated modularly depending on the specific phase of work:

#### A. Frontend & UI/UX Enhancement

- **Installed Foundation:** `design-taste-frontend` (`.agents/skills/design-taste-frontend/`). _Note: Do not install `taste-skill` as it is already present under this name._
- **Supporting Tooling:**
  - `pbakaus/impeccable` & `nextlevelbuilder/ui-ux-pro-max-skill`: Micro-interactions, typography rhythm, and mobile checkout fluidity.
  - `voltagent/awesome-design-md`: Maintaining and updating the project's standard `DESIGN.md` for boutique bakery aesthetics.

#### B. Stack Best Practices

- **Sources:** `vercel-labs/skills` and `anthropics/skills`.
- **Scope:** Tailored for React 19, TypeScript, Vite, Supabase RPCs, and PostgreSQL Row-Level Security (RLS).
- **Usage:** Consulted when authoring complex database queries, security policies, and client state optimizations.

#### C. Codebase Graph & Architecture Documentation

- **Sources:** `Egonex-AI/Understand-Anything`, `Graphify-Labs/graphify`, `tt-a1i/archify`, `cathrynlavery/diagram-design`.
- **Scope:** Generating localized knowledge graphs between UI routes and Supabase tables (saving context tokens) and maintaining system flow diagrams in `DEPLOYMENT_RUNBOOK.md` (Storefront -> Supabase -> `metabase/`).

#### D. Marketing, CRO & Natural Localization

- **Sources:** `coreyhaines31/marketingskills` and `blader/humanizer`.
- **Scope:** Optimizing storefront hero messaging, SEO, and checkout conversion rate (CRO), and refining `locales/ar.json` / `locales/en.json` bakery descriptions to eliminate robotic AI phrasing in favor of natural, appetizing artisan bakery copy.
