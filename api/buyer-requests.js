const {
  allowCors,
  handleError,
  readBody,
  requireServiceRoleEnv,
  requireSupabaseEnv,
  sendJson,
  supabaseServiceFetch,
} = require("./_supabase");
const { enforceRateLimit, verifyTurnstile, getClientIp } = require("./_protect");

const ALLOWED_MESSAGE_ROLES = new Set(["user", "assistant", "system"]);

function cleanText(value, maxLength = 4000) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

function isValidHttpUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

async function readGoogleAppsScriptResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch (_) {
    return text ? { text: text.slice(0, 500) } : null;
  }
}

async function postGoogleAppsScript(url, payload) {
  const initialResponse = await fetch(url, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (initialResponse.status >= 300 && initialResponse.status < 400) {
    const location = initialResponse.headers.get("location");
    if (location) {
      return fetch(location, { method: "GET" });
    }
  }

  return initialResponse;
}

async function syncGoogleSheet(body, requestPayload, request) {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!url) return { ok: false, skipped: true, reason: "GOOGLE_APPS_SCRIPT_URL is not configured." };

  const formType = cleanText(body.google_sheet_form_type || body.formType || body.google_sheet_type || body.type, 80) || "buyer";
  const response = await postGoogleAppsScript(url, {
    ...body,
    ...requestPayload,
    formType,
    type: formType,
    source: "vercel_api",
    supabase_buyer_request_id: request.id,
    supabase_created_at: request.created_at,
    supabase_status: request.status,
  });

  const data = await readGoogleAppsScriptResponse(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data?.error || data?.message || `Google Apps Script returned ${response.status}`,
    };
  }

  return { ok: true, status: response.status, data };
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res, { mode: "public" })) return;
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "POST only." });
  if (!requireSupabaseEnv(res) || !requireServiceRoleEnv(res)) return;
  if (await enforceRateLimit(req, res, sendJson, { scope: "buyer-requests" })) return;

  try {
    const body = await readBody(req);

    // Honeypot field. Real users never see or fill this; bots usually do.
    if (typeof body.website_url_2 === "string" && body.website_url_2.trim().length > 0) {
      return sendJson(res, 200, {
        ok: true,
        data: { id: "honeypot", created_at: new Date().toISOString(), status: "ignored" },
      });
    }

    const rawMessage = cleanText(body.raw_message || body.message);
    const email = cleanText(body.email, 320);
    const companyName = cleanText(body.company_name, 200);
    const website = cleanText(body.website, 500);

    if (!rawMessage || rawMessage.length < 5) {
      return sendJson(res, 400, { ok: false, error: "raw_message is required." });
    }
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { ok: false, error: "email is not a valid address." });
    }
    if (website && !isValidHttpUrl(website)) {
      return sendJson(res, 400, { ok: false, error: "website must be a valid http(s) URL." });
    }

    const captcha = await verifyTurnstile(
      body.turnstile_token || body["cf-turnstile-response"],
      getClientIp(req)
    );
    if (!captcha.ok) {
      return sendJson(res, 403, { ok: false, error: "Captcha verification failed." });
    }

    const requestPayload = {
      company_name: companyName || null,
      email: email || null,
      website: website || null,
      raw_message: rawMessage,
      sourcing_category: cleanText(body.sourcing_category, 160) || null,
      timeline: cleanText(body.timeline, 160) || null,
      nda_requirement: cleanText(body.nda_requirement, 160) || null,
      ai_summary: cleanText(body.ai_summary, 1200) || null,
      source_page: cleanText(body.source_page, 120) || "vercel_site",
      status: "new",
      notes: cleanText(body.notes, 1200) || null,
    };

    const { data: inserted } = await supabaseServiceFetch(
      "/buyer_requests?select=id,created_at,status",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(requestPayload),
      }
    );

    const request = inserted?.[0];
    if (!request?.id) {
      return sendJson(res, 500, { ok: false, error: "Buyer request insert did not return an id." });
    }

    if (Array.isArray(body.messages) && body.messages.length > 0) {
      const messages = body.messages.slice(0, 30).map((message, index) => {
        const role = cleanText(message.role, 40).toLowerCase();
        return {
          buyer_request_id: request.id,
          role: ALLOWED_MESSAGE_ROLES.has(role) ? role : "user",
          message: cleanText(message.message || message.content, 4000),
          message_order: index + 1,
        };
      });
      try {
        await supabaseServiceFetch("/csa_messages", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(messages),
        });
      } catch (error) {
        console.warn("[buyer-requests] csa_messages insert failed:", error.message);
      }
    }

    if (body.consent_text || body.agreed) {
      try {
        await supabaseServiceFetch("/consent_logs", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            buyer_request_id: request.id,
            email: email || null,
            consent_version: cleanText(body.consent_version, 80) || "vercel-v1",
            consent_text: cleanText(body.consent_text, 2000) || "Buyer submitted BLNKK sourcing request.",
            agreed: body.agreed !== false,
            source_page: requestPayload.source_page,
          }),
        });
      } catch (error) {
        console.warn("[buyer-requests] consent_logs insert failed:", error.message);
      }
    }

    let googleSheet = { ok: false, skipped: true, reason: "Not attempted." };
    try {
      googleSheet = await syncGoogleSheet(body, requestPayload, request);
    } catch (error) {
      googleSheet = { ok: false, error: error.message || "Google Sheet sync failed." };
    }

    sendJson(res, 200, { ok: true, data: request, google_sheet: googleSheet });
  } catch (error) {
    handleError(res, error);
  }
};
