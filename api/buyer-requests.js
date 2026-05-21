const {
  allowCors,
  handleError,
  readBody,
  requireServiceRoleEnv,
  requireSupabaseEnv,
  sendJson,
  supabaseFetch,
} = require("./_supabase");

function cleanText(value, maxLength = 4000) {
  return String(value || "").trim().slice(0, maxLength);
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "POST only." });
  if (!requireSupabaseEnv(res) || !requireServiceRoleEnv(res)) return;

  try {
    const body = await readBody(req);
    const rawMessage = cleanText(body.raw_message || body.message);
    const email = cleanText(body.email, 320);
    const companyName = cleanText(body.company_name, 200);

    if (!rawMessage) {
      return sendJson(res, 400, { ok: false, error: "raw_message is required." });
    }

    const requestPayload = {
      company_name: companyName || null,
      email: email || null,
      website: cleanText(body.website, 500) || null,
      raw_message: rawMessage,
      sourcing_category: cleanText(body.sourcing_category, 160) || null,
      timeline: cleanText(body.timeline, 160) || null,
      nda_requirement: cleanText(body.nda_requirement, 160) || null,
      ai_summary: cleanText(body.ai_summary, 1200) || null,
      source_page: cleanText(body.source_page, 120) || "vercel_site",
      status: "new",
      notes: cleanText(body.notes, 1200) || null,
    };

    const { data: inserted } = await supabaseFetch("/buyer_requests?select=id,created_at,status", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(requestPayload),
    });

    const request = inserted?.[0];
    if (!request?.id) {
      return sendJson(res, 500, { ok: false, error: "Buyer request insert did not return an id." });
    }

    if (Array.isArray(body.messages) && body.messages.length > 0) {
      const messages = body.messages.slice(0, 30).map((message, index) => ({
        buyer_request_id: request.id,
        role: cleanText(message.role, 40) || "user",
        message: cleanText(message.message || message.content, 4000),
        message_order: Number.isFinite(Number(message.message_order)) ? Number(message.message_order) : index + 1,
      }));

      await supabaseFetch("/csa_messages", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(messages),
      });
    }

    if (body.consent_text || body.agreed) {
      await supabaseFetch("/consent_logs", {
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
    }

    sendJson(res, 200, { ok: true, data: request });
  } catch (error) {
    handleError(res, error);
  }
};
