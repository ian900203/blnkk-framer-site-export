const {
  allowCors,
  handleError,
  readBody,
  requireAdmin,
  requireServiceRoleEnv,
  requireSupabaseEnv,
  sendJson,
  supabaseServiceFetch,
} = require("./_supabase");

const SETTINGS_ID = "blnkk-admin-v1";
const MAX_ARRAY_LENGTH = 100;
const MAX_STRING_LENGTH = 4000;
const MAX_NOTES_LENGTH = 8000;
const MAX_OBJECT_KEYS = 100;
const MAX_DEPTH = 6;

function sanitizeValue(value, depth = 0) {
  if (depth > MAX_DEPTH) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    let count = 0;
    for (const [key, val] of Object.entries(value)) {
      if (count >= MAX_OBJECT_KEYS) break;
      out[String(key).slice(0, 200)] = sanitizeValue(val, depth + 1);
      count += 1;
    }
    return out;
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res, { mode: "admin" })) return;
  if (!["GET", "POST"].includes(req.method)) {
    return sendJson(res, 405, { ok: false, error: "GET or POST only." });
  }
  if (!requireSupabaseEnv(res) || !requireServiceRoleEnv(res) || !requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const { data } = await supabaseServiceFetch(
        `/site_admin_settings?id=eq.${SETTINGS_ID}&select=id,updated_at,launch_checks,intake_questions,page_status,matching_settings,meeting_settings,notes&limit=1`
      );
      return sendJson(res, 200, { ok: true, data: data?.[0] || null });
    }

    const body = await readBody(req);
    const payload = {
      id: SETTINGS_ID,
      updated_at: new Date().toISOString(),
      launch_checks: sanitizeValue(body.launch_checks) || [],
      intake_questions: sanitizeValue(body.intake_questions) || [],
      page_status: sanitizeValue(body.page_status) || {},
      matching_settings: sanitizeValue(body.matching_settings) || {},
      meeting_settings: sanitizeValue(body.meeting_settings) || {},
      notes: typeof body.notes === "string" ? body.notes.slice(0, MAX_NOTES_LENGTH) : null,
    };

    const { data } = await supabaseServiceFetch(
      "/site_admin_settings?on_conflict=id&select=id,updated_at",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(payload),
      }
    );

    return sendJson(res, 200, { ok: true, data: data?.[0] || payload });
  } catch (error) {
    handleError(res, error);
  }
};
