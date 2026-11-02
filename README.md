# Delish Jordan Bakery — Delish Cake & Bake

Mobile-first bilingual (Arabic default RTL, English LTR) luxury bakery ordering web app for Delish Cake & Bake in Amman, Jordan.

## Architecture & Technology Stack
- **Frontend & Routing:** React 18, TanStack Router, TanStack Start (SSR), Tailwind CSS.
- **Backend & Database:** Supabase (PostgreSQL 15+), Row-Level Security (RLS), Optimistic Concurrency Control, Atomic SECURITY DEFINER RPCs.
- **Build & Server Engine:** Vite, Nitro (supporting Cloudflare Pages/Workers & standalone Node.js server targets).

---

## Database Setup & SQL Scripts (Strict Execution Order)

When provisioning a fresh Supabase project, execute the SQL files located in `supabase/` in the following sequence:

1. **`supabase/standalone_complete_schema.sql`**: Full standalone schema, roles, custom types, audit triggers, RLS policies, and atomic transaction RPCs.
2. **`supabase/seed_initial_store.sql`**: Initial boutique catalogue, categories, and storefront banner.
3. **`supabase/delish_api_permissions.sql`**: Explicit PostgREST Data API permissions enforcing least-privilege access (public read for catalogue, strict 401 isolation for orders, payments, tokens, and staff tables).

For step-by-step instructions on setting up the initial admin user and environment variables, consult [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md).

---

## Local Development

```sh
# Clean install locked dependencies
npm ci

# Start development server
npm run dev -- --port 3000 --strictPort
```

---

## Production Build

```sh
# Build for Cloudflare Pages / Edge
npm run build

# Build for standalone Node.js container (Docker / VPS)
npm run build:node
```
