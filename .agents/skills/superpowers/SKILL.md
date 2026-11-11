---
name: superpowers
description: The rigorous engineering and quality constitution for Delish Bakes — enforces structured planning, Test-Driven Development (TDD), and security/architectural review before every commit and merge.
---

# Superpowers: Delish Engineering & Quality Constitution

## Overview

This skill establishes the unbending development constitution for **Delish Cake & Bake**. It extracts and synthesizes the core disciplines of **Planning**, **Test-Driven Development (TDD)**, and **Security & Engineering Code Review** (derived from `obra/superpowers` and `addyosmani/agent-skills`).

Every engineer and autonomous agent operating on this repository is bound by this constitution.

---

## The Three Pillars

```
+-------------------------------------------------------------+
|                     THE IRON WORKFLOW                       |
|                                                             |
|  [1] Bite-Sized Plan  -->  [2] TDD (Red-Green-Refactor)    |
|            |                                |               |
|            v                                v               |
|  [3] Security Audit   -->  [4] Quality Gate Verification   |
+-------------------------------------------------------------+
```

### Pillar 1: Rigorous Planning & Task Breakdown

Before touching production code:

1. **Deconstruct Scope:** Break every feature or refactoring task into bite-sized, independently verifiable slices (1-2 files per task).
2. **Explicit Interfaces:** Define exact TypeScript signatures, input validation schemas, RPC arguments, and return types before implementation.
3. **DRY & Reuse Scan:** Mandatory check of `@/lib` (currency, whatsapp, order-status, date-filter, server-shared) and `@/components/delish` to avoid reinventing established modules.
4. **Plan Storage:** Document plans in `docs/plans/` or task worklogs before beginning execution.

### Pillar 2: Test-Driven Development (TDD)

**The Iron Law:** `NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.`

1. **Red Phase:** Write a unit, integration, or contract test in `test/` or alongside the component. Run the test suite and explicitly observe it fail for the expected reason.
2. **Green Phase:** Write the absolute minimal production code necessary to make the test pass. Do not write anticipatory or speculative code.
3. **Refactor Phase:** Clean up duplication, enforce design tokens, extract helpers, and re-run tests to ensure 100% green status.
4. **No Suppressions:** Never bypass failing tests with `.skip`, `test.todo`, `@ts-ignore`, or `eslint-disable`.

### Pillar 3: Security & Architectural Review

Before committing or creating a pull request:

1. **Input Hardening & OWASP:** Validate all external inputs, enforce authentication via `getStaffCodeForUser` / `ServerAuthContext`, and verify RLS policies on Supabase tables.
2. **Immutable Ledger & Financial Safety:** All price alterations, payments, and refunds must write to the immutable transaction ledger. Never perform un-versioned updates on financial rows.
3. **Mutation Hardening:** Validate critical business logic (`src/lib/confirmation-message.ts`, `src/lib/role-guard.ts`, `src/lib/username.ts`) against mutation testing thresholds specified in `stryker.config.json` (threshold break: 50%).

---

## Delish Quality Gates Checklist (Mandatory Pre-Commit Verification)

Before confirming any work or staging a commit, execute and verify all project quality gates:

1. **TypeScript Type Safety:**

   ```bash
   npx tsc --noEmit
   ```

   _Requirement:_ Zero errors, strict type safety, no implicit `any` on domain entities.

2. **Full Lifecycle Test Suites (`quality-gate.yml`):**

   ```bash
   npm test
   ```

   _Requirement:_ All unit, integration, and contract tests must pass (J2, J3, J5, Acceptance Hardening, V6 Engine).

3. **Database Migration Linting (`.squawk.toml`):**
   When altering SQL or Supabase migrations, run Squawk to verify PostgreSQL 15 compliance:
   - Ensure transactional safety (`assume_in_transaction = true`).
   - Validate foreign keys, index additions without table locks, and RLS policy rules.

4. **Architectural Dependency Boundaries (`.dependency-cruiser.cjs`):**

   ```bash
   npx depcruise --config .dependency-cruiser.cjs src
   ```

   _Requirement:_ No illegal cyclic dependencies, no deprecated Node core modules, clean architectural layering.

5. **Production Build Integrity:**
   ```bash
   npm run build
   ```
   _Requirement:_ Clean compilation with Vite and Nitro SSR without missing asset references.
