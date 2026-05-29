const {
  allowCors,
  handleError,
  readBody,
  requireSupabaseEnv,
  sendJson,
  supabaseAnonFetch,
} = require("./_supabase");
const { enforceRateLimit } = require("./_protect");

module.exports = async function handler(req, res) {
  if (allowCors(req, res, { mode: "public" })) return;
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "POST only." });
  if (!requireSupabaseEnv(res)) return;
  if (await enforceRateLimit(req, res, sendJson, { scope: "supplier-match" })) return;

  try {
    const body = await readBody(req);
    const searchQuery = String(body.search_query || "").trim().slice(0, 1000);
    if (!searchQuery) {
      return sendJson(res, 400, { ok: false, error: "search_query is required." });
    }

    const limit = Math.max(1, Math.min(Number(body.limit || 12), 24));
    const country = body.country ? String(body.country).trim().slice(0, 80) : null;
    const category = body.category ? String(body.category).trim().slice(0, 160) : null;

    const { data } = await supabaseAnonFetch("/rpc/csa_match_supplier_cards", {
      method: "POST",
      body: JSON.stringify({
        search_query: searchQuery,
        p_limit: limit,
        p_country: country,
        p_category: category,
      }),
    });

    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    handleError(res, error);
  }
};
