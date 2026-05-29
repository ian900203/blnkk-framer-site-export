-- BLNKK Supabase schema inspection
-- ---------------------------------------------------------------
-- Paste the entire file into the Supabase SQL Editor and click Run.
-- Each block returns a result set you can export as CSV.
-- Nothing in this file modifies data or schema; everything is SELECT-only.

-- ===============================================================
-- 1. Public-schema tables: row counts and RLS status.
-- ===============================================================
with t as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    n.nspname as schema_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')  -- ordinary or partitioned tables
)
select
  schema_name,
  table_name,
  rls_enabled,
  rls_forced,
  (xpath('/row/c/text()',
    query_to_xml(format('select count(*) as c from %I.%I', schema_name, table_name),
                 true, true, '')))[1]::text::bigint as row_count
from t
order by table_name;

-- ===============================================================
-- 2. Row-level security policies on every public table.
-- ===============================================================
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- ===============================================================
-- 3. Table-level privileges granted to anon / authenticated / service_role.
-- ===============================================================
select
  grantee,
  table_schema,
  table_name,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
group by grantee, table_schema, table_name
order by table_name, grantee;

-- ===============================================================
-- 4. Functions in public schema and their execute grants.
-- ===============================================================
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as signature,
  case p.prosecdef when true then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security,
  p.proconfig as config,
  pg_catalog.array_to_string(p.proacl, E'\n') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- ===============================================================
-- 5. Realtime publications: which tables are broadcast to clients?
-- ===============================================================
select
  pubname,
  schemaname,
  tablename
from pg_publication_tables
where pubname like 'supabase_realtime%'
order by pubname, schemaname, tablename;

-- ===============================================================
-- 6. Column-level overview for the highest-risk tables.
--    Useful when designing strict SELECT policies.
-- ===============================================================
select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'buyer_requests',
    'csa_messages',
    'consent_logs',
    'public_supplier_directory_cards',
    'suppliers',
    'supplier_capability_lines',
    'supplier_replies',
    'supplier_intake_submissions',
    'site_admin_settings',
    'npi_shop_candidates'
  )
order by table_name, ordinal_position;
