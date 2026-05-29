# BLNKK Framer Site Export

This repository is a migration snapshot of the current BLNKK Framer website.

## Quick Preview Links

Vercel shows the project/deployment URL, but it does not list every page route automatically. Use these direct links for review.

Production preview from `main`:

- [Home](https://blnkk-framer-site-export.vercel.app/)
- [TW](https://blnkk-framer-site-export.vercel.app/tw)
- [CSA](https://blnkk-framer-site-export.vercel.app/csa)
- [Protocol](https://blnkk-framer-site-export.vercel.app/protocol)
- [Supply Search](https://blnkk-framer-site-export.vercel.app/supply-search)
- [Admin](https://blnkk-framer-site-export.vercel.app/admin)

Active card-intake preview branch from `tinder-intake-preview`:

- [Home](https://blnkk-framer-site-expor-git-fdb1ba-ian900203-gmailcoms-projects.vercel.app/)
- [TW](https://blnkk-framer-site-expor-git-fdb1ba-ian900203-gmailcoms-projects.vercel.app/tw)
- [CSA](https://blnkk-framer-site-expor-git-fdb1ba-ian900203-gmailcoms-projects.vercel.app/csa)
- [Protocol](https://blnkk-framer-site-expor-git-fdb1ba-ian900203-gmailcoms-projects.vercel.app/protocol)
- [Supply Search](https://blnkk-framer-site-expor-git-fdb1ba-ian900203-gmailcoms-projects.vercel.app/supply-search)
- [Card Intake](https://blnkk-framer-site-expor-git-fdb1ba-ian900203-gmailcoms-projects.vercel.app/sourcing-profile)
- [Admin](https://blnkk-framer-site-expor-git-fdb1ba-ian900203-gmailcoms-projects.vercel.app/admin)

Active NPI-to-PVT Terminal preview branch from `npi-sprint-preview`:

- [NPI-to-PVT Landing](https://blnkk-framer-site-expor-git-b1e0dc-ian900203-gmailcoms-projects.vercel.app/supply-search)
- [NPI-to-PVT Terminal](https://blnkk-framer-site-expor-git-b1e0dc-ian900203-gmailcoms-projects.vercel.app/npi-sprint)
- [NPI Candidate API](https://blnkk-framer-site-expor-git-b1e0dc-ian900203-gmailcoms-projects.vercel.app/api/npi-candidates)
- [NPI Candidate Google Sheet](https://docs.google.com/spreadsheets/d/114n04Nu6lRYz5pd5S68JvxvKgzMgdWV2jOAlHbH7L0M/edit)

Legacy preview branch from `admin-preview`:

- [Home](https://blnkk-framer-site-expor-git-ac79e6-ian900203-gmailcoms-projects.vercel.app/)
- [TW](https://blnkk-framer-site-expor-git-ac79e6-ian900203-gmailcoms-projects.vercel.app/tw)
- [CSA](https://blnkk-framer-site-expor-git-ac79e6-ian900203-gmailcoms-projects.vercel.app/csa)
- [Protocol](https://blnkk-framer-site-expor-git-ac79e6-ian900203-gmailcoms-projects.vercel.app/protocol)
- [Supply Search](https://blnkk-framer-site-expor-git-ac79e6-ian900203-gmailcoms-projects.vercel.app/supply-search)
- [Admin](https://blnkk-framer-site-expor-git-ac79e6-ian900203-gmailcoms-projects.vercel.app/admin)

## Captured Pages

This snapshot preserves the live Framer-rendered HTML for the first four priority pages:

- `home.html` from `https://www.blnkk.biz/`
- `tw.html` from `https://www.blnkk.biz/tw`
- `csa.html` from `https://www.blnkk.biz/csa`
- `protocol.html` from `https://www.blnkk.biz/protocol`

The original local export also keeps a folder-based layout under `pages/*/index.html`; `pages/home/index.html` has already been added on GitHub as a nested example.

## Purpose

Use this as the source snapshot before moving the site from Framer to a GitHub-managed codebase.

This is not yet a rebuilt app. The exported files are live-site captures that preserve Framer markup, linked Framer assets, and current custom-code behavior so the next migration step can compare against the working production site.

## Snapshot Files

- `manifest.json`: URL, local capture path, byte size, SHA-256, and key marker counts for each page.
- `home.html`, `tw.html`, `csa.html`, `protocol.html`: raw captured HTML for each live page.
- `framer-custom-code-notes.md`: notes about the Home/CSA custom-code issue fixed before this export.
- `admin/index.html`: Admin v0 preview for launch readiness, CSA intake, matching review, and meeting pipeline planning.
- `supply-search/index.html`: NPI-to-PVT landing and buyer entry route.
- `npi-sprint/index.html`: NPI-to-PVT Terminal preview with Factory-Ready Package intake, private build-file upload, S0-S3 risk map, Supplier Pod routing, and PVT/MPI readiness track.
- `api/*`: Vercel API routes for Supabase health, supplier matching, buyer requests, and protected Admin data.

## Supabase / Vercel Environment

Set these in Vercel before treating Admin or form submission as production-ready. **Scope every secret to Production only** unless explicitly noted; Preview and Development should use a separate Supabase project so PR previews never touch real buyer data.

### Required

- `SUPABASE_URL`: `https://wldesafdtscwvaikpmkq.supabase.co`
- `SUPABASE_ANON_KEY`: public Supabase anon/publishable key. Used by `/api/health` and `/api/supplier-match` (RLS-respecting paths).
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key. **Production only.** Used by `/api/buyer-requests` (writes) and the Admin endpoints. Never expose in browser code or committed files.
- `BLNKK_ADMIN_TOKEN`: server-side token compared with `crypto.timingSafeEqual` in `requireAdmin`. Sent as `Authorization: Bearer <token>` from `/admin`.

### Required for forms / abuse protection

- `GOOGLE_APPS_SCRIPT_URL`: server-only Google Apps Script Web App URL used to mirror buyer intake into Google Sheets.
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`: enables sliding-window rate limiting on `/api/buyer-requests`, `/api/supplier-match`, `/api/google-sheet-buyer`, `/api/npi-candidates`. When missing, the rate limit auto-disables and prints a warning.
- `TURNSTILE_SECRET`: Cloudflare Turnstile secret key. When missing, captcha verification auto-disables and prints a warning. The client should send the token as `turnstile_token` or `cf-turnstile-response` in the JSON body.

### Optional

- `SITE_ORIGIN_ALLOWLIST`: comma-separated extra origins permitted by the API CORS layer. Defaults already allow `https://www.blnkk.biz`, `https://blnkk.biz`, the canonical Vercel domain, `*.vercel.app` preview URLs, and `localhost`.
- `NPI_UPLOAD_BUCKET`: private Supabase Storage bucket for NPI package uploads. Defaults to `npi-intake-files`; `/api/npi-upload-url` will create the bucket if it does not exist.

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `BLNKK_ADMIN_TOKEN`, `GOOGLE_APPS_SCRIPT_URL`, `UPSTASH_REDIS_REST_TOKEN`, or `TURNSTILE_SECRET` in browser code or committed files. The Supabase **anon** JWT and the project URL are designed to be public.

## API Routes

- `/api/health` — public GET. Anon-key probe + safe public counts. Used by `/admin` to surface "supabase connected".
- `/api/supplier-match` — public POST. Anon-key RPC call to `csa_match_supplier_cards`. Rate-limited.
- `/api/buyer-requests` — public POST. Server-side validation, honeypot, rate limit, Turnstile, then service-role insert into `buyer_requests` / `csa_messages` / `consent_logs` and Google Sheet mirror.
- `/api/google-sheet-buyer` — public POST. Thin proxy to the Google Apps Script bridge. Rate-limited.
- `/api/npi-candidates` — public POST. Reads `data/npi-shop-candidates-v2.json` and returns scored matches. Rate-limited.
- `/api/npi-upload-url` — public POST. Service-role route that validates NPI file metadata and returns short-lived signed upload URLs for a private Supabase Storage bucket. Rate-limited; never exposes the service-role key.
- `/api/admin-summary` — admin-only GET. Requires `Authorization: Bearer <BLNKK_ADMIN_TOKEN>` and origin allow-list.
- `/api/admin-settings` — admin-only GET/POST. Same auth model; POST body is shape-validated and length-capped.

## Domain switch checklist (Framer → Vercel)

Before pointing `www.blnkk.biz` at Vercel:

1. **Verify Supabase RLS on `buyer_requests`** (most important):
   - `ENABLE ROW LEVEL SECURITY` is on.
   - `anon` role has **only** an INSERT policy with a `WITH CHECK` constraint that forces `status='new'` and reasonable length bounds; no SELECT/UPDATE/DELETE policy for anon.
   - Same audit for `csa_messages`, `consent_logs`, `public_supplier_directory_cards`, `site_admin_settings`, `suppliers`, `supplier_replies`, `supplier_intake_submissions`.
2. Set Production env vars listed above. Confirm Preview / Development env vars point at a **staging** Supabase project (or are empty).
3. Provision Upstash Redis (free tier) and Cloudflare Turnstile, paste their secrets into Vercel Production env vars.
4. Test end-to-end on the Vercel preview URL: `/`, `/tw`, `/csa`, `/protocol`, `/supply-search`, `/npi-sprint`, `/admin`, and at least one buyer-form submission per flow.
5. Save the current Framer DNS values somewhere durable for rollback.
6. After switching DNS, keep Framer published for at least 48 hours so rollback is one DNS change away.

## Recommended Next Step

Build a clean app from this snapshot, likely with:

- `home` as `/`
- `tw` as `/tw`
- `csa` as `/csa`
- `protocol` as `/protocol`
- `supply-search` as `/supply-search`
- `admin` as `/admin`

During the rebuild, do not copy old Framer custom-code patches blindly. Recreate only the current intended behavior in source-controlled components.
