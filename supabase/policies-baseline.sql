-- BLNKK Supabase RLS baseline policies
-- ---------------------------------------------------------------
-- DO NOT auto-run this file. It is a TEMPLATE for the policies the
-- application expects. After running supabase/inspect.sql, compare
-- the existing policies against this baseline, then apply the diff
-- by hand in the Supabase SQL Editor (or land it as the next
-- migration in supabase/migrations/).
--
-- Why a template instead of a migration: applying these blindly may
-- conflict with whatever you already have in production. Diff first,
-- then apply.

-- ===============================================================
-- buyer_requests
-- Public table: anon may INSERT (one path from the website),
-- no one with anon role may SELECT, UPDATE, or DELETE.
-- ===============================================================
alter table public.buyer_requests enable row level security;

revoke all on public.buyer_requests from anon, authenticated, public;
grant insert on public.buyer_requests to anon;

drop policy if exists "buyer_requests_anon_insert" on public.buyer_requests;
create policy "buyer_requests_anon_insert"
  on public.buyer_requests
  for insert
  to anon
  with check (
    status = 'new'
    and length(coalesce(raw_message, '')) between 5 and 4000
    and (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  );

-- ===============================================================
-- csa_messages
-- anon may INSERT, but only attached to a buyer_request created
-- within the last 5 minutes. No SELECT for anon.
-- ===============================================================
alter table public.csa_messages enable row level security;

revoke all on public.csa_messages from anon, authenticated, public;
grant insert on public.csa_messages to anon;

drop policy if exists "csa_messages_anon_insert" on public.csa_messages;
create policy "csa_messages_anon_insert"
  on public.csa_messages
  for insert
  to anon
  with check (
    role in ('user', 'assistant', 'system')
    and length(coalesce(message, '')) between 1 and 4000
    and exists (
      select 1
      from public.buyer_requests br
      where br.id = csa_messages.buyer_request_id
        and br.created_at > now() - interval '15 minutes'
    )
  );

-- ===============================================================
-- consent_logs
-- anon may INSERT only when the parent buyer_request was just created.
-- ===============================================================
alter table public.consent_logs enable row level security;

revoke all on public.consent_logs from anon, authenticated, public;
grant insert on public.consent_logs to anon;

drop policy if exists "consent_logs_anon_insert" on public.consent_logs;
create policy "consent_logs_anon_insert"
  on public.consent_logs
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.buyer_requests br
      where br.id = consent_logs.buyer_request_id
        and br.created_at > now() - interval '15 minutes'
    )
  );

-- ===============================================================
-- public_supplier_directory_cards
-- anon and authenticated may SELECT only rows that are explicitly
-- flagged as publicly visible.
-- ===============================================================
alter table public.public_supplier_directory_cards enable row level security;

revoke all on public.public_supplier_directory_cards from anon, authenticated, public;
grant select on public.public_supplier_directory_cards to anon, authenticated;

drop policy if exists "supplier_cards_public_select" on public.public_supplier_directory_cards;
create policy "supplier_cards_public_select"
  on public.public_supplier_directory_cards
  for select
  to anon, authenticated
  using (
    status = 'active'
    and visibility_tier = 'public'
  );

-- ===============================================================
-- suppliers (the underlying table behind the cards view/table)
-- Strictly admin-only.
-- ===============================================================
alter table public.suppliers enable row level security;
revoke all on public.suppliers from anon, authenticated, public;
-- No anon/authenticated policy. Only service_role bypasses RLS.

-- ===============================================================
-- supplier_capability_lines
-- ===============================================================
alter table public.supplier_capability_lines enable row level security;
revoke all on public.supplier_capability_lines from anon, authenticated, public;

-- ===============================================================
-- supplier_replies / supplier_intake_submissions
-- TODO: confirm what the writer path is (Framer form? Admin import?)
-- before opening any anon access. For now, keep them admin-only.
-- ===============================================================
alter table public.supplier_replies enable row level security;
revoke all on public.supplier_replies from anon, authenticated, public;

alter table public.supplier_intake_submissions enable row level security;
revoke all on public.supplier_intake_submissions from anon, authenticated, public;

-- ===============================================================
-- site_admin_settings
-- Service-role only.
-- ===============================================================
alter table public.site_admin_settings enable row level security;
revoke all on public.site_admin_settings from anon, authenticated, public;

-- ===============================================================
-- npi_shop_candidates
-- The Vercel /api/npi-candidates route still reads from the JSON
-- bundle, but the table exists. Keep it locked until used.
-- ===============================================================
alter table public.npi_shop_candidates enable row level security;
revoke all on public.npi_shop_candidates from anon, authenticated, public;

-- ===============================================================
-- csa_match_supplier_cards RPC
-- This is what /api/supplier-match (anon mode) calls.
-- ===============================================================
revoke execute on function public.csa_match_supplier_cards(text, integer, text, text) from public;
grant execute on function public.csa_match_supplier_cards(text, integer, text, text)
  to anon, authenticated;

-- ===============================================================
-- After applying:
-- 1. From a fresh browser window, call POST /rest/v1/buyer_requests
--    with apikey = anon JWT. Should succeed (INSERT). Then call
--    GET /rest/v1/buyer_requests. Should return [] or 401.
-- 2. Call POST /rest/v1/rpc/csa_match_supplier_cards with anon key.
--    Should succeed and return only public cards.
-- 3. Call GET /rest/v1/suppliers with anon key. Should return [] or 401.
-- ===============================================================
