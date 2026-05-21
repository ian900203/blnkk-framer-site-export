const {
  allowCors,
  handleError,
  readBody,
  requireAdmin,
  requireServiceRoleEnv,
  requireSupabaseEnv,
  sendJson,
  supabaseFetch,
} = require("./_supabase");

const SETTINGS_ID = "blnkk-admin-v1";

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (!["GET", "POST"].includes(req.method)) {
    return sendJson(res, 405, { ok: false, error: "GET or POST only." });
  }
  if (!requireSupabaseEnv(res) || !requireServiceRoleEnv(res) || !requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const { data } = await supabaseFetch(
        `/site_admin_settings?id=eq.${SETTINGS_ID}&select=id,updated_at,launch_checks,intake_questions,page_status,matching_settings,meeting_settings,notes&limit=1`
      );
      return sendJson(res, 200, { ok: true, data: data?.[0] || null });
    }

    const body = await readBody(req);
    const payload = {
      id: SETTINGS_ID,
      updated_at: new Date().toISOString(),
      launch_checks: body.launch_checks || [],
      intake_questions: body.intake_questions || [],
      page_status: body.page_status || {},
      matching_settings: body.matching_settings || {},
      meeting_settings: body.meeting_settings || {},
      notes: body.notes || null,
    };

    const { data } = await supabaseFetch(
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
