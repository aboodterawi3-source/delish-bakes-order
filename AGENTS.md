# Delish Cake & Bake — Project Guidelines

Welcome to **Delish Cake & Bake** (`delish-bakes-order`).

## Architectural Invariants

- **Stack:** React 19 + TanStack Start (`1.169.4`) + Vite (`8.3.5`) + Nitro SSR.
- **Language & Layout:** Full Arabic localization with native RTL layout. English available via language toggle.
- **Data & Concurrency:** PostgreSQL Atomic RPCs, Row-Level Security (RLS), Optimistic Concurrency Control (OCC) with row-version locks, and an immutable financial ledger for all transactions, payments, and refunds.
- **Styling:** Tailwind CSS v4 with semantic design tokens defined in `src/styles.css`.
- **Quality Gates:** All pull requests and commits must pass `tsc --noEmit`, `npm test`, and `npm run build:node`.
