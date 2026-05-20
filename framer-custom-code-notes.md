# Framer Custom Code Notes

## 2026-05-21 Home Rendering Fix

The Home page issue was caused by Framer custom code, not by the page content itself.

The important behavior:

- The new `TTT` page rendered correctly while it stayed at `/ttt`.
- When `TTT` was assigned as Home (`/`), the page broke and the buyer intake disappeared.
- That confirmed the problem was path-specific custom code running only on `/`.

## Fixes Applied In Framer

The following old Home-specific snippets were disabled by replacing their body with harmless disabled comments:

- `Home scroll unlock emergency`
- `Home restore request visibility final`

The more important fix:

- `CSA current quick replies v27` was changed from `All` pages to `/csa` only.

That snippet contained Home-path logic that added `blnkk-home-hide-csa` and injected CSS hiding `#request`. When the new Home page used the same `#request` intake section, the custom code hid the form.

## Export Verification

The Home and TTT live HTML were checked after publishing:

- `BLNKK BUYER INTAKE` exists.
- `Non-PRC / NDAA-Aware Supplier Matching` exists.
- `blnkk-home-hide-csa` does not appear on Home.
- `html.blnkk-home-hide-csa #request` does not appear on Home.
- The old `display:none` / `height:0` request-hiding patterns do not appear on Home.

CSA still contains CSA-specific code. That is expected because the CSA quick reply snippet now runs only on `/csa`.
