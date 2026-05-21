const { allowCors, countRows, handleError, requireSupabaseEnv, sendJson } = require("./_supabase");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "GET only." });
  if (!requireSupabaseEnv(res)) return;

  try {
    const supplierCards = await countRows(
      "public_supplier_directory_cards",
      "status=eq.active&visibility_tier=eq.public"
    );

    sendJson(res, 200, {
      ok: true,
      data: {
        supabase: "connected",
        public_supplier_cards: supplierCards,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
