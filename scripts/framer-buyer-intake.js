/*
 * BLNKK Framer buyer intake replacement
 * ----------------------------------------------------------------
 * Drop-in replacement for:
 *   Interface/home-restore-request-forms/source/home_restore_request_form_emergency.html
 *   Interface/home-restore-request-forms/source/home_restore_request_form_emergency_compact.html
 *
 * What it changes:
 *   - Removes the hard-coded Supabase anon JWT.
 *   - Stops POSTing directly to https://<project>.supabase.co/rest/v1/buyer_requests.
 *   - Forwards the form submission to the Vercel API at
 *     `${BLNKK_API_BASE}/api/buyer-requests` instead, which enforces rate
 *     limit, CORS allow-list, captcha (when configured), input validation,
 *     and Google Sheet mirror in one place.
 *
 * Where to paste this:
 *   Framer dashboard → Site settings → Custom code → End of <body>.
 *   Replace the previous "Home restore request emergency" snippet with this file.
 *
 * Required customisation:
 *   - Set BLNKK_API_BASE below to your Vercel domain. Use the production
 *     domain after the DNS switch; before the switch, use the canonical
 *     Vercel URL.
 *   - (Optional) Set BLNKK_TURNSTILE_SITEKEY if you wired Cloudflare
 *     Turnstile into the page. The script will mount an invisible widget
 *     and attach the token to each submission.
 */
(() => {
  if (location.pathname !== "/" && location.pathname !== "") return;
  if (window.__blnkkHomeIntakeReplacement) return;
  window.__blnkkHomeIntakeReplacement = 1;

  // ============================================================
  // Configure these two constants before pasting into Framer.
  // ============================================================
  const BLNKK_API_BASE = "https://blnkk-framer-site-export.vercel.app";
  const BLNKK_TURNSTILE_SITEKEY = ""; // e.g. "0x4AAAAAA..." (leave empty to disable)

  // ============================================================
  // Styles for the injected form.
  // ============================================================
  const css = `
    html.blnkk-home-request-restored,
    html.blnkk-home-request-restored body {
      overflow: auto !important;
      height: auto !important;
    }
    html.blnkk-home-request-restored #request {
      display: block !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      width: 100% !important;
    }
    #request .brf {
      background: #070b12;
      color: #f8fafc;
      padding: 72px 20px;
      border-top: 1px solid rgba(148, 163, 184, 0.22);
      font-family: Inter, Arial, sans-serif;
    }
    #request .brf * { box-sizing: border-box; }
    #request .brf-in {
      max-width: 1120px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr);
      gap: 28px;
      align-items: start;
    }
    #request .brf-k {
      color: #38bdf8;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      margin: 0 0 14px;
    }
    #request .brf h2 {
      font-size: clamp(30px, 5vw, 56px);
      line-height: 1;
      margin: 0 0 16px;
    }
    #request .brf p {
      color: #b6c2d1;
      line-height: 1.65;
      margin: 0 0 18px;
      font-size: 16px;
    }
    #request .brf-card {
      background: #0d1420;
      border: 1px solid rgba(148, 163, 184, .24);
      border-radius: 8px;
      padding: 22px;
      box-shadow: 0 20px 55px rgba(0, 0, 0, .28);
    }
    #request .brf-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    #request .brf label {
      display: flex;
      flex-direction: column;
      gap: 7px;
      color: #dbeafe;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    #request .brf input,
    #request .brf select,
    #request .brf textarea {
      width: 100%;
      border: 1px solid rgba(148, 163, 184, .34);
      border-radius: 7px;
      background: #050914;
      color: #fff;
      padding: 13px 12px;
      font: 500 14px/1.3 Inter, Arial, sans-serif;
      outline: none;
    }
    #request .brf textarea { min-height: 132px; resize: vertical; }
    #request .brf .wide { grid-column: 1 / -1; }
    #request .brf button {
      border: 0;
      border-radius: 7px;
      background: #f8fafc;
      color: #020617;
      padding: 14px 18px;
      font-weight: 900;
      cursor: pointer;
    }
    #request .brf button[disabled] { opacity: .55; cursor: not-allowed; }
    #request .brf small {
      display: block;
      color: #94a3b8;
      line-height: 1.5;
      margin-top: 12px;
    }
    .brf-ok { color: #7dd3fc !important; font-weight: 700; }
    .brf-honeypot {
      position: absolute !important;
      left: -10000px !important;
      width: 1px !important;
      height: 1px !important;
      overflow: hidden !important;
    }
    @media (max-width: 800px) {
      #request .brf { padding: 52px 16px; }
      #request .brf-in { grid-template-columns: 1fr; }
      #request .brf-grid { grid-template-columns: 1fr; }
    }
  `;

  const html = `
    <section class="brf">
      <div class="brf-in">
        <div>
          <div class="brf-k">Buyer protocol intake</div>
          <h2>Start a sourcing request.</h2>
          <p>Share the detailed requirement BLNKK needs to screen Taiwan / Non-PRC suppliers, prepare a reviewed shortlist, and move into review / NDA when the fit is real.</p>
          <p>Use this for UAS subsystems, PCBA, RF / data-link, battery / BMS, rugged computing, machining, assemblies, or adjacent manufacturing needs.</p>
        </div>
        <form id="blnkk-home-request-form" class="brf-card" novalidate>
          <div class="brf-grid">
            <label>Company Name<input name="company_name" autocomplete="organization" required></label>
            <label>Work Email<input name="email" type="email" autocomplete="email" required></label>
            <label>LinkedIn Profile URL<input name="linkedin" inputmode="url"></label>
            <label>Critical Subsystem<input name="subsystem" placeholder="Flight controller PCBA, RF module, battery pack..." required></label>
            <label>Dev Stage
              <select name="stage">
                <option>Prototype</option>
                <option>Early feasibility</option>
                <option>Sample build</option>
                <option>Low-volume production</option>
                <option>Production sourcing</option>
              </select>
            </label>
            <label>Lead Time<input name="lead_time" placeholder="Example: sample build in 6-8 weeks"></label>
            <label>Target NRE / Dev Budget<input name="budget" placeholder="Optional range"></label>
            <label>Non-PRC / NDAA Need
              <select name="non_prc">
                <option>Non-PRC / Taiwan-first required</option>
                <option>Preferred, but mixed origin can be reviewed</option>
                <option>Need BLNKK guidance</option>
              </select>
            </label>
            <label class="wide">Boundaries / Specs
              <textarea name="details" placeholder="Key specs, volumes, constraints, documents available, qualification needs, and what BLNKK should verify first." required></textarea>
            </label>
            <div class="brf-honeypot" aria-hidden="true">
              <label>Leave this empty<input name="website_url_2" tabindex="-1" autocomplete="off"></label>
            </div>
            <div class="wide" data-turnstile-mount></div>
            <div class="wide">
              <button type="submit">Submit sourcing request</button>
              <small data-status>BLNKK will use this to prepare screening signals, qualification gaps, and the next review / NDA step.</small>
            </div>
          </div>
        </form>
      </div>
    </section>
  `;

  function injectStyle() {
    if (document.getElementById("blnkk-home-request-restore-css")) return;
    const style = document.createElement("style");
    style.id = "blnkk-home-request-restore-css";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function mountTurnstile(form) {
    if (!BLNKK_TURNSTILE_SITEKEY) return;
    const mount = form.querySelector("[data-turnstile-mount]");
    if (!mount) return;
    if (!document.getElementById("blnkk-turnstile-loader")) {
      const loader = document.createElement("script");
      loader.id = "blnkk-turnstile-loader";
      loader.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      loader.async = true;
      loader.defer = true;
      loader.onload = renderWidget;
      document.head.appendChild(loader);
    } else if (window.turnstile) {
      renderWidget();
    }
    function renderWidget() {
      try {
        window.turnstile.render(mount, {
          sitekey: BLNKK_TURNSTILE_SITEKEY,
          size: "flexible",
          appearance: "interaction-only",
        });
      } catch (error) {
        console.warn("[BLNKK home intake] Turnstile render failed", error);
      }
    }
  }

  async function submitToVercel(form, status) {
    const data = Object.fromEntries(new FormData(form).entries());
    const notes = [
      `LinkedIn: ${data.linkedin || ""}`,
      `Critical subsystem: ${data.subsystem || ""}`,
      `Dev stage: ${data.stage || ""}`,
      `Lead time: ${data.lead_time || ""}`,
      `Budget: ${data.budget || ""}`,
      `Non-PRC / NDAA need: ${data.non_prc || ""}`,
      `Specs: ${data.details || ""}`,
    ].join("\n");

    const turnstileToken = (form.querySelector("[name=cf-turnstile-response]") || {}).value || "";

    const payload = {
      raw_message: notes.slice(0, 4000),
      company_name: data.company_name || null,
      email: data.email || null,
      website: data.linkedin || null,
      sourcing_category: data.subsystem || null,
      timeline: data.lead_time || null,
      nda_requirement: data.non_prc || null,
      notes: notes.slice(0, 1200),
      source_page: "home_protocol_form",
      consent_text: "Buyer submitted BLNKK home buyer-intake form.",
      consent_version: "framer-home-v2",
      agreed: true,
      google_sheet_form_type: "buyer",
      turnstile_token: turnstileToken || undefined,
      website_url_2: data.website_url_2 || "",
    };

    status.textContent = "Submitting request...";
    status.className = "";

    try {
      const response = await fetch(`${BLNKK_API_BASE}/api/buyer-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        const msg = body.error || `Submission failed (${response.status}).`;
        throw new Error(msg);
      }
      status.textContent = "Submitted. BLNKK received this sourcing request for review.";
      status.className = "brf-ok";
      form.reset();
      if (window.turnstile) {
        try { window.turnstile.reset(); } catch (_) {}
      }
    } catch (error) {
      console.warn("[BLNKK home intake]", error);
      status.textContent = "Submission did not complete. Please email ops@blnkk.biz with these details.";
      status.className = "brf-ok";
    }
  }

  function mount() {
    document.documentElement.classList.add("blnkk-home-request-restored");
    injectStyle();
    document.documentElement.style.setProperty("overflow", "auto", "important");
    document.body.style.setProperty("overflow", "auto", "important");
    document.body.style.setProperty("height", "auto", "important");

    const root = document.getElementById("request");
    if (!root) return;
    ["display:block", "height:auto", "min-height:0", "overflow:visible"].forEach((rule) => {
      const [prop, value] = rule.split(":");
      root.style.setProperty(prop, value, "important");
    });
    if (!root.querySelector("#blnkk-home-request-form")) {
      root.innerHTML = html;
    }

    const form = root.querySelector("#blnkk-home-request-form");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    mountTurnstile(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const status = form.querySelector("[data-status]");
      if (form.dataset.submitting === "1") return;
      form.dataset.submitting = "1";
      const button = form.querySelector("button[type=submit]");
      if (button) button.disabled = true;
      submitToVercel(form, status).finally(() => {
        form.dataset.submitting = "";
        if (button) button.disabled = false;
      });
    });
  }

  mount();
  addEventListener("load", mount);
  addEventListener("resize", mount);
  let attempts = 0;
  const interval = setInterval(() => {
    mount();
    if (++attempts > 60) clearInterval(interval);
  }, 250);
})();
