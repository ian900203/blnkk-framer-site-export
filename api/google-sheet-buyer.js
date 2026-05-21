const { allowCors, handleError, readBody, sendJson } = require("./_supabase");

function cleanText(value, maxLength = 4000) {
  return String(value || "").trim().slice(0, maxLength);
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "POST only." });

  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!url) {
    return sendJson(res, 500, {
      ok: false,
      error: "Missing GOOGLE_APPS_SCRIPT_URL in Vercel environment variables.",
    });
  }

  try {
    const body = await readBody(req);
    const rawMessage = cleanText(body.raw_message || body.message);
    if (!rawMessage) {
      return sendJson(res, 400, { ok: false, error: "raw_message is required." });
    }

    const gasResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        type: cleanText(body.google_sheet_type || body.type, 80) || "buyer",
        raw_message: rawMessage,
        message: rawMessage,
        source: "vercel_google_sheet_bridge",
        source_page: cleanText(body.source_page, 120) || "vercel_site",
      }),
    });

    const text = await gasResponse.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = text ? { text: text.slice(0, 500) } : null;
    }

    if (!gasResponse.ok || data?.status === "error") {
      return sendJson(res, 502, {
        ok: false,
        error: data?.message || data?.error || `Google Apps Script returned ${gasResponse.status}`,
        data,
      });
    }

    sendJson(res, 200, { ok: true, data });
  } catch (error) {
    handleError(res, error);
  }
};
