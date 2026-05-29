# Supabase schema management

The runtime DB lives at `https://wldesafdtscwvaikpmkq.supabase.co`. This folder is the source of truth for **what the schema should look like**. Anything that runs in production should be checked in here, including:

- Table definitions (`CREATE TABLE`).
- Row-level security policies.
- Grants (`anon`, `authenticated`, `service_role`).
- Functions / RPCs.

## Why we need this

Today none of the application tables (`buyer_requests`, `csa_messages`, `consent_logs`, `public_supplier_directory_cards`, `site_admin_settings`, `suppliers`, `supplier_replies`, `supplier_intake_submissions`) have their CREATE statements or RLS policies in the repo. That means:

- We cannot rebuild staging from scratch.
- PR review cannot catch RLS regressions.
- Anyone with dashboard access can quietly change policies and nobody else sees it.

Fix this in two phases.

## Phase 1 — Inspect (no DB changes)

Run `inspect.sql` in the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run). It prints:

1. Every table in `public` schema with row counts and whether RLS is enabled.
2. Every `pg_policy` attached to those tables.
3. Every grant on those tables for `anon`, `authenticated`, `service_role`.
4. Every `public.*` function and the roles that can execute it.

Save the four result sets as CSV. Send them back so we can decide which policies need tightening.

## Phase 2 — Export and commit (one-time)

Use the Supabase CLI to dump the live schema into a migration file:

```bash
# Install once: https://supabase.com/docs/guides/cli
brew install supabase/tap/supabase

# Link the local CLI to the BLNKK project. Run from the repo root.
supabase link --project-ref wldesafdtscwvaikpmkq

# Export schema only (no data) into the migrations folder.
supabase db dump --schema public --role postgres -f supabase/migrations/0001_initial_schema.sql
```

After `supabase db dump` writes the file:

1. Open `supabase/migrations/0001_initial_schema.sql` and read it. Confirm there are no surprises (no row data, no extra schemas).
2. Commit it. From now on, every schema change goes through a new migration file in `supabase/migrations/`.

## Phase 3 — Tighten policies (only after Phase 1 review)

`policies-baseline.sql` is a **template**, not auto-applied. After Phase 1 we know what policies already exist; we then diff against `policies-baseline.sql` and apply the missing pieces by hand in the SQL Editor or as a follow-up migration.

The baseline assumes:

- `anon` can INSERT into `buyer_requests`, `csa_messages`, `consent_logs` (with strict `WITH CHECK`) and can SELECT `public_supplier_directory_cards` filtered to public rows.
- `anon` has no access to `site_admin_settings`, `suppliers`, `supplier_capability_lines`, `supplier_replies`, `supplier_intake_submissions`.
- `authenticated` (future admin role) has read access to admin-only tables only when a `is_admin()` helper returns true.
- `service_role` continues to bypass RLS for the Vercel API routes.

## Future

Once the schema is in repo and CI is wired, every PR that touches DB structure should add a new file `supabase/migrations/000N_<change>.sql`. Reviews catch missing policies before they hit production.
