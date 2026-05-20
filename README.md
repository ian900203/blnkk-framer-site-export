# BLNKK Framer Site Export

This repository is a migration snapshot of the current BLNKK Framer website.

It preserves the live Framer-rendered HTML for the first four priority pages:

- `pages/home/index.html` from `https://www.blnkk.biz/`
- `pages/tw/index.html` from `https://www.blnkk.biz/tw`
- `pages/csa/index.html` from `https://www.blnkk.biz/csa`
- `pages/protocol/index.html` from `https://www.blnkk.biz/protocol`

## Purpose

Use this as the source snapshot before moving the site from Framer to a GitHub-managed codebase.

This is not yet a rebuilt app. The exported files are live-site captures that preserve Framer markup, linked Framer assets, and current custom-code behavior so the next migration step can compare against the working production site.

## Snapshot Files

- `manifest.json`: URL, local file path, byte size, SHA-256, and key marker counts for each page.
- `pages/*/index.html`: raw captured HTML for each live page.
- `docs/framer-custom-code-notes.md`: notes about the Home/CSA custom-code issue fixed before this export.

## Recommended Next Step

Build a clean app from this snapshot, likely with:

- `home` as `/`
- `tw` as `/tw`
- `csa` as `/csa`
- `protocol` as `/protocol`

During the rebuild, do not copy old Framer custom-code patches blindly. Recreate only the current intended behavior in source-controlled components.
