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

Preview branch from `admin-preview`:

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
- `supply-search/index.html`: Supply Search landing and buyer entry route.
- `api/*`: Vercel API routes for Supabase health, supplier matching, buyer requests, and protected Admin data.

## Supabase / Vercel Environment

Set these in Vercel before treating Admin or form submission as production-ready:

- `SUPABASE_URL`: `https://wldesafdtscwvaikpmkq.supabase.co`
- `SUPABASE_ANON_KEY`: public Supabase anon/publishable key for public read/RPC paths.
- `SUPABASE_SERVICE_ROLE_KEY`: private server-only key for Admin summaries and buyer request inserts.
- `BLNKK_ADMIN_TOKEN`: private password-like token entered in `/admin` before loading protected Admin data.
- `GOOGLE_APPS_SCRIPT_URL`: private server-only Google Apps Script Web App URL used to mirror buyer intake submissions into Google Sheets.

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or committed files.
Never commit `GOOGLE_APPS_SCRIPT_URL`; keep it in Vercel Environment Variables.

Current API routes:

- `/api/health`: public Supabase connectivity check and safe public counts.
- `/api/supplier-match`: public POST endpoint for supplier shortlist results.
- `/api/buyer-requests`: public POST endpoint for CSA/Protocol intake submissions; server-side only. Inserts into Supabase first, then mirrors to Google Sheets when `GOOGLE_APPS_SCRIPT_URL` is configured.
- `/api/admin-summary`: protected Admin summary; requires `Authorization: Bearer <BLNKK_ADMIN_TOKEN>`.
- `/api/admin-settings`: protected Admin settings load/save; requires `Authorization: Bearer <BLNKK_ADMIN_TOKEN>`.

## Recommended Next Step

Build a clean app from this snapshot, likely with:

- `home` as `/`
- `tw` as `/tw`
- `csa` as `/csa`
- `protocol` as `/protocol`
- `supply-search` as `/supply-search`
- `admin` as `/admin`

During the rebuild, do not copy old Framer custom-code patches blindly. Recreate only the current intended behavior in source-controlled components.
