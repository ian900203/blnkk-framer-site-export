# Framer buyer-intake replacement

`framer-buyer-intake.js` replaces the legacy "Home restore request emergency" snippet on the Framer site. The legacy snippet hard-coded the Supabase anon JWT and posted directly to the Supabase REST endpoint. The replacement forwards every submission to the Vercel API route `/api/buyer-requests`, which adds:

- CORS allow-list
- Sliding-window rate limit (when Upstash is configured)
- Cloudflare Turnstile verification (when configured)
- Email / URL / length validation
- Honeypot trap
- Supabase + Google Sheet writes happen in one place, with service-role on the server

## Before you paste

1. Decide which Vercel domain the Framer site should talk to.
   - **Current state** (domain still on Framer): use `https://blnkk-framer-site-export.vercel.app`.
   - **After DNS switch** to Vercel: change to `https://www.blnkk.biz` (or whatever final domain), or simply make the path relative (`""`).
2. (Optional) Cloudflare Turnstile.
   - Create a site at https://dash.cloudflare.com → Turnstile → Add site.
   - Copy the **site key** into `BLNKK_TURNSTILE_SITEKEY` in `framer-buyer-intake.js`.
   - Copy the **secret key** into the Vercel `TURNSTILE_SECRET` env var.
   - If you skip Turnstile, leave `BLNKK_TURNSTILE_SITEKEY = ""`. The script auto-skips, the API skips with a warning.
3. Open `framer-buyer-intake.js`, set the two constants near the top:
   ```js
   const BLNKK_API_BASE = "https://blnkk-framer-site-export.vercel.app";
   const BLNKK_TURNSTILE_SITEKEY = "";
   ```

## Paste into Framer

1. Open Framer dashboard for the live BLNKK project.
2. Site settings → Custom code → **End of <body>**.
3. Find the existing snippets named "Home scroll unlock emergency" and "Home restore request visibility final" / "Home restore request emergency". Disable or remove them.
4. Paste the entire contents of `framer-buyer-intake.js` between `<script>` and `</script>` tags.
5. Save. Publish to a Framer preview channel first if available.

## Verify

1. Open the Framer preview URL.
2. Submit the buyer intake form on the home page (`/`). Watch the network tab.
3. Expected:
   - A single POST to `${BLNKK_API_BASE}/api/buyer-requests`.
   - Response `{ "ok": true, "data": { "id": "...", "created_at": "...", "status": "new" } }`.
   - Supabase Dashboard → `buyer_requests` shows the new row with `source_page = "home_protocol_form"`.
   - Google Sheet (if `GOOGLE_APPS_SCRIPT_URL` is set in Vercel) shows the mirrored row.
4. Re-submit the form 12 times in a row to confirm the 11th or 12th attempt returns HTTP 429 once Upstash is wired.

## Rollback

If anything misbehaves on the Framer side, the rollback is to delete the new snippet from Framer custom code; the old emergency snippet was already disabled in the historical fix (`framer-custom-code-notes.md`). Worst case, paste back the previous `home_restore_request_form_emergency.html` snippet, then debug.

## Why we keep this file in the repo

The Framer snippet is the only place this code currently runs, but having the canonical source in git means:

- Diffs are visible in PR review.
- Anyone can recreate the form quickly after a Framer wipe.
- When the BLNKK site fully migrates off Framer, this file becomes the spec for the equivalent React component.
