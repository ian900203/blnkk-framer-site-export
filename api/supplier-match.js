const { allowCors, handleError, readBody, requireSupabaseEnv, sendJson, supabaseFetch } = require("./_supabase");

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "POST only." });
  if (!requireSupabaseEnv(res)) return;

  try {
    const body = await readBody(req);
    const searchQuery = String(body.search_query || "").trim();
    if (!searchQuery) {
      return sendJson(res, 400, { ok: false, error: "search_query is required." });
    }

    const limit = Math.max(1, Math.min(Number(body.limit || 12), 24));
    const { data } = await supabaseFetch("/rpc/csa_match_supplier_cards", {
      method: "POST",
      body: JSON.stringify({
        search_query: searchQuery,
        p_limit: limit,
        p_country: body.country || null,
        p_category: body.category || null,
      }),
    });

    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    handleError(res, error);
  }
};
