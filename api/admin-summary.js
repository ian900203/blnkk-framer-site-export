const {
  allowCors,
  countRows,
  handleError,
  requireAdmin,
  requireServiceRoleEnv,
  requireSupabaseEnv,
  sendJson,
  supabaseFetch,
} = require("./_supabase");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "GET only." });
  if (!requireSupabaseEnv(res) || !requireServiceRoleEnv(res) || !requireAdmin(req, res)) return;

  try {
    const [supplierCards, buyerRequests, supplierReplies, intakeSubmissions] = await Promise.all([
      countRows("public_supplier_directory_cards", "status=eq.active&visibility_tier=eq.public"),
      countRows("buyer_requests"),
      countRows("supplier_replies"),
      countRows("supplier_intake_submissions"),
    ]);

    const { data: recentRequests } = await supabaseFetch(
      "/buyer_requests?select=id,created_at,company_name,email,sourcing_category,status,source_page&order=created_at.desc&limit=5"
    );

    sendJson(res, 200, {
      ok: true,
      data: {
        counts: {
          public_supplier_cards: supplierCards,
          buyer_requests: buyerRequests,
          supplier_replies: supplierReplies,
          supplier_intake_submissions: intakeSubmissions,
        },
        recent_buyer_requests: recentRequests || [],
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
