---
name: grill-me
description: Relentlessly stress-test and interrogate logic, edge cases, data concurrency, network drops, and failure states before writing code.
---

# Grill-Me: Relentless Logic & Edge-Case Interrogation

## Overview

Assume the role of a strict, unyielding technical interrogator and system architect. Before writing any implementation code for a new feature, table alteration, or critical workflow (Storefront, KDS kitchen display, Supabase schema, or Nitro server RPC), conduct a structured, round-by-round interrogation to uncover all hidden edge cases, failure states, and concurrency pitfalls.

**The Golden Rule:** Never write a single line of production code until all logical ambiguities, edge cases, and architectural loopholes are systematically closed and agreed upon.

---

## When to Invoke

**Mandatory Trigger Conditions:**

1. Proposing or implementing any new feature in Delish Bakes (Storefront, KDS, Admin, Driver portal).
2. Modifying database tables, Supabase migrations, RLS policies, or RPC functions.
3. Altering inventory, cart calculation, checkout, or payment/refund flows.
4. Modifying real-time sync between customer orders and the Kitchen Display System (KDS).
5. When the user explicitly triggers `/grill-me`, "grill me", "interview me", or "are we sure?".

---

## Delish-Specific Core Interrogation Vectors

During interrogation, aggressively probe the following Delish domain invariants:

1. **Optimistic Concurrency Control (OCC) & Stock Races:**
   - What happens when two customers add the last available slice of Strawberry Cheesecake or Chocolate Croissant simultaneously?
   - How does the system handle OCC version mismatch (`row_version` increment)? Does it gracefully abort, retry, or alert the customer with real-time stock feedback?
   - How does KDS reflect inventory deductions without double-booking?

2. **Network Partitions & Chaos Resilience (`docker-compose.toxiproxy.yml`):**
   - What happens if the connection to Supabase or Nitro drops mid-checkout (simulated via `docker-compose.toxiproxy.yml` on port 54320/8474)?
   - Is client state idempotent? Can a retry result in duplicate ledger transactions or orphan orders?
   - How does the offline/reconnect buffer behave on the KDS tablet in the kitchen?

3. **Financial Ledger Integrity & Payment/Refund Failures:**
   - Every financial transaction must write to an immutable append-only ledger.
   - What happens if payment fails after ledger entry? Or if refund RPC fails halfway?
   - How are partial voids, tip additions, and delivery fee adjustments recorded without destructive `UPDATE` statements on ledger records?

4. **KDS Real-Time Synchronization & Kitchen Escalation:**
   - If a kitchen staff marks an order "In Oven", does the storefront customer status update in real-time without polling storms?
   - What happens if WebSocket / Supabase Realtime disconnects on the kitchen tablet? Is there fallback polling and deduplication?

---

## Interrogation Protocol (The Design Tree)

Conduct the interview in structured **rounds**. Model the decision space as a **design tree** where every decision branches into dependencies.

### 1. Identify the Frontier

The **frontier** comprises every pending architectural or business decision whose prerequisites are already settled.

- Formulate all frontier questions in the current round.
- Provide a recommended, battle-tested answer prefixed with `➡️`.
- Phrase questions so that replying "yes" confirms the recommended default.

### 2. Format of Each Round

```markdown
### ❓ Q1 - [Decision Title]: [Concise explanation of the edge case and options]

➡️ **Recommended Answer:** [Your specific, robust architectural recommendation]

---

### ❓ Q2 - [Decision Title]: [Concise explanation of the edge case and options]

➡️ **Recommended Answer:** [Your specific, robust architectural recommendation]
```

### 3. Fact Finding vs. User Decisions

- **Fact Finding is Your Job:** Never ask the user about existing schemas, file paths, or current helper functions. Inspect the codebase directly.
- **Decisions are the User's:** Put design trade-offs, business rules, and error recovery choices to the user.

### 4. Convergence & Sign-Off

When all branches of the design tree have been explored and no assumptions remain unverified:

- Present a unified **Edge-Case Resolution Summary**.
- Await the user's explicit confirmation before proceeding to planning and implementation (via `superpowers`).
