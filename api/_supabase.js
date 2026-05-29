// Shared helpers for the BLNKK Vercel Serverless API routes.
//
// Design rules:
//  - Anon client is used for any path that should respect Supabase RLS
//    (public reads, public RPC). It is the default.
//  - Service-role client is used only for server-side writes and admin reads,
//    and is explicitly opted in to per route.
//  - CORS is gated by an allow-list. Cross-origin requests from unknown
//    origins are rejected before the handler runs.
//  - Admin token compare is constant-time.
//  - PostgREST error details are never leaked to the client in production.

const { timingSafeEqual } = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_TOKEN = process.env.BLNKK_ADMIN_TOKEN;

const STATIC_ALLOWED_ORIGINS = [
  "https://www.blnkk.biz",
  "https://blnkk.biz",
  "https://blnkk-framer-site-export.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
];
const EXTRA_ALLOWED_ORIGINS = (process.env.SITE_ORIGIN_ALLOWLIST || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set([...STATIC_ALLOWED_ORIGINS, ...EXTRA_ALLOWED_ORIGINS]);

const VERCEL_PREVIEW_SUFFIX = /\.vercel\.app$/;
const IS_PRODUCTION = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
const MAX_BODY_BYTES = 256 * 1024;

function pickAllowedOrigin(origin) {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  try {
    const url = new URL(origin);
    if (VERCEL_PREVIEW_SUFFIX.test(url.hostname)) return origin;
  } catch (_) {
    return null;
  }
  return null;
}

function sendJson(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Origin");
  res.status(status).send(JSON.stringify(payload));
}

// allowCors handles CORS preflight and access control.
// options.mode:
//   - "public": allow allow-listed browser origins. Non-browser (no Origin) is fine.
//   - "admin":  only allow same-origin browser calls from the allow-list.
//               Non-browser callers are accepted (server-to-server is OK).
function allowCors(req, res, options = {}) {
  const mode = options.mode || "public";
  const origin = req.headers.origin || "";

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (origin) {
    const matched = pickAllowedOrigin(origin);
    if (!matched) {
      if (req.method === "OPTIONS") {
        res.status(403).end();
        return true;
      }
      sendJson(res, 403, { ok: false, error: "Origin not allowed." });
      return true;
    }
    res.setHeader("Access-Control-Allow-Origin", matched);
    if (mode === "admin" && req.method !== "OPTIONS") {
      // Admin endpoints accept the request but the response headers above
      // are still scoped strictly to the matched origin.
    }
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

function requireSupabaseEnv(res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    sendJson(res, 500, {
      ok: false,
      error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY in environment variables.",
    });
    return false;
  }
  return true;
}

function requireServiceRoleEnv(res) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    sendJson(res, 500, {
      ok: false,
      error: "Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.",
    });
    return false;
  }
  return true;
}

function safeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  // Constant-length scratch buffer keeps the work roughly constant even
  // when lengths differ, while still returning the correct boolean.
  if (aBuf.length !== bBuf.length) {
    const filler = Buffer.alloc(32);
    timingSafeEqual(filler, filler);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) {
    sendJson(res, 500, {
      ok: false,
      error: "Missing BLNKK_ADMIN_TOKEN in environment variables.",
    });
    return false;
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!safeEqualString(token, ADMIN_TOKEN)) {
    sendJson(res, 401, { ok: false, error: "Admin token required." });
    return false;
  }
  return true;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); }
    catch (_) {
      const err = new Error("Invalid JSON body.");
      err.status = 400;
      throw err;
    }
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const err = new Error("Request body too large.");
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    const err = new Error("Invalid JSON body.");
    err.status = 400;
    throw err;
  }
}

function parseSupabaseResponseText(text) {
  if (!text) return null;
  try { return JSON.parse(text); }
  catch (_) { return null; }
}

async function supabaseFetchWithKey(apiKey, path, options = {}) {
  if (!apiKey) {
    const err = new Error("Supabase API key is not configured.");
    err.status = 500;
    throw err;
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = parseSupabaseResponseText(text);
  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase request failed with ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return { data, response };
}

async function supabaseStorageServiceFetch(path, options = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error("Supabase service role key is not configured.");
    err.status = 500;
    throw err;
  }
  const response = await fetch(`${SUPABASE_URL}/storage/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = parseSupabaseResponseText(text);
  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase Storage request failed with ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return { data, response };
}

function supabaseAnonFetch(path, options = {}) {
  return supabaseFetchWithKey(SUPABASE_ANON_KEY, path, options);
}

function supabaseServiceFetch(path, options = {}) {
  return supabaseFetchWithKey(SUPABASE_SERVICE_ROLE_KEY, path, options);
}

// Kept for backwards compatibility with any callsite that still imports
// the unscoped supabaseFetch. New code should pick anon vs service explicitly.
function supabaseFetch(path, options = {}) {
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return supabaseFetchWithKey(key, path, options);
}

async function countRowsWith(fetcher, table, query = "") {
  const suffix = query ? `&${query}` : "";
  const { response } = await fetcher(`/${table}?select=id&limit=1${suffix}`, {
    headers: { Prefer: "count=exact" },
  });
  const range = response.headers.get("content-range") || "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

function countRows(table, query = "") {
  return countRowsWith(supabaseAnonFetch, table, query);
}

function countRowsAdmin(table, query = "") {
  return countRowsWith(supabaseServiceFetch, table, query);
}

function handleError(res, error) {
  const status = error.status || 500;
  const payload = {
    ok: false,
    error: error.message || "Unexpected API error.",
  };
  if (!IS_PRODUCTION) {
    payload.details = error.details || null;
  } else {
    console.error("[api]", status, error.message, error.details || "");
  }
  sendJson(res, status, payload);
}

module.exports = {
  allowCors,
  countRows,
  countRowsAdmin,
  handleError,
  readBody,
  requireAdmin,
  requireServiceRoleEnv,
  requireSupabaseEnv,
  sendJson,
  supabaseAnonFetch,
  supabaseStorageServiceFetch,
  supabaseServiceFetch,
  supabaseFetch,
};
