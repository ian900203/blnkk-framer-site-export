const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PUBLIC_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_API_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_PUBLIC_KEY;
const ADMIN_TOKEN = process.env.BLNKK_ADMIN_TOKEN;

function sendJson(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(payload));
}

function allowCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

function requireSupabaseEnv(res) {
  if (!SUPABASE_URL || !SUPABASE_API_KEY) {
    sendJson(res, 500, {
      ok: false,
      error: "Missing SUPABASE_URL and Supabase API key in Vercel environment variables.",
    });
    return false;
  }
  return true;
}

function requireServiceRoleEnv(res) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    sendJson(res, 500, {
      ok: false,
      error: "Missing SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.",
    });
    return false;
  }
  return true;
}

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) {
    sendJson(res, 500, {
      ok: false,
      error: "Missing BLNKK_ADMIN_TOKEN in Vercel environment variables.",
    });
    return false;
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== ADMIN_TOKEN) {
    sendJson(res, 401, { ok: false, error: "Admin token required." });
    return false;
  }

  return true;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_API_KEY,
      Authorization: `Bearer ${SUPABASE_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return { data, response };
}

async function countRows(table, query = "") {
  const suffix = query ? `&${query}` : "";
  const { response } = await supabaseFetch(`/${table}?select=id&limit=1${suffix}`, {
    headers: { Prefer: "count=exact" },
  });
  const range = response.headers.get("content-range") || "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

function handleError(res, error) {
  sendJson(res, error.status || 500, {
    ok: false,
    error: error.message || "Unexpected API error.",
    details: error.details || null,
  });
}

module.exports = {
  allowCors,
  countRows,
  handleError,
  readBody,
  requireAdmin,
  requireServiceRoleEnv,
  requireSupabaseEnv,
  sendJson,
  supabaseFetch,
};
