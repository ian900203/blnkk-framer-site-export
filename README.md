# BLNKK Framer Site Export

This repository is a migration snapshot of the current BLNKK Framer website.

## Quick Preview Links

Vercel shows the project/deployment URL, but it does not list every page route automatically. Use these direct links for review.

Production preview from `main`:

- [Home](https://blnkk-framer-site-export.vercel.app/)
- [TW](https://blnkk-framer-site-export.vercel.app/tw)
- [CSA](https://blnkk-framer-site-export.vercel.app/csa)
- [Protocol](https://blnkk-framer-site-export.vercel.app/protocol)

Admin PR preview from `admin-preview`:

- [Admin](https://blnkk-framer-site-expor-git-ac79e6-ian900203-gmailcoms-projects.vercel.app/admin)
- [Pull Request #1](https://github.com/ian900203/blnkk-framer-site-export/pull/1)

After PR #1 is merged, Admin should be reviewed at:

- [Admin on production preview](https://blnkk-framer-site-export.vercel.app/admin)

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

## Recommended Next Step

Build a clean app from this snapshot, likely with:

- `home` as `/`
- `tw` as `/tw`
- `csa` as `/csa`
- `protocol` as `/protocol`
- `admin` as `/admin`

During the rebuild, do not copy old Framer custom-code patches blindly. Recreate only the current intended behavior in source-controlled components.
