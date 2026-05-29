const crypto = require("crypto");
const {
  allowCors,
  handleError,
  readBody,
  requireServiceRoleEnv,
  requireSupabaseEnv,
  sendJson,
  supabaseStorageServiceFetch,
} = require("./_supabase");
const { enforceRateLimit, getClientIp, verifyTurnstile } = require("./_protect");

const BUCKET = process.env.NPI_UPLOAD_BUCKET || "npi-intake-files";
const MAX_FILES = 8;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const SIGNED_UPLOAD_EXPIRES_IN_SECONDS = 60 * 60 * 2;

const ALLOWED_EXTENSIONS = new Set([
  "bom",
  "csv",
  "doc",
  "docx",
  "dwg",
  "dxf",
  "gerber",
  "heic",
  "jpeg",
  "jpg",
  "json",
  "md",
  "mov",
  "mp4",
  "pdf",
  "png",
  "ppt",
  "pptx",
  "sch",
  "step",
  "stl",
  "stp",
  "txt",
  "xls",
  "xlsm",
  "xlsx",
  "zip",
]);

function cleanText(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function slug(value, fallback = "buyer") {
  const cleaned = cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function safeFileName(name) {
  const cleaned = cleanText(name, 180)
    .replace(/[^\w.\-+() ]+/g, "-")
    .replace(/\s+/g, "_");
  return cleaned || "upload.bin";
}

function extensionFor(name) {
  const match = safeFileName(name).match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

function encodeStoragePath(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function assertValidFile(file) {
  const name = safeFileName(file.name);
  const size = Number(file.size || 0);
  const ext = extensionFor(name);

  if (!name || name.length > 180) {
    const err = new Error("Invalid file name.");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(size) || size <= 0) {
    const err = new Error(`${name} has an invalid file size.`);
    err.status = 400;
    throw err;
  }
  if (size > MAX_FILE_BYTES) {
    const err = new Error(`${name} is larger than the 25MB preview upload limit.`);
    err.status = 413;
    throw err;
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const err = new Error(`${name} is not an allowed NPI file type.`);
    err.status = 400;
    throw err;
  }
}

async function ensureBucket() {
  try {
    await supabaseStorageServiceFetch(`/bucket/${encodeURIComponent(BUCKET)}`);
    return;
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  await supabaseStorageServiceFetch("/bucket", {
    method: "POST",
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false,
      file_size_limit: MAX_FILE_BYTES,
    }),
  });
}

async function createSignedUpload(file, body) {
  const date = new Date().toISOString().slice(0, 10);
  const buyer = slug(body.company_name || body.companyName || body.email, "buyer");
  const originalName = safeFileName(file.name);
  const nonce = crypto.randomBytes(8).toString("hex");
  const path = `intake/${date}/${buyer}/${Date.now()}-${nonce}-${originalName}`;
  const encodedPath = encodeStoragePath(`${BUCKET}/${path}`);

  const { data } = await supabaseStorageServiceFetch(`/object/upload/sign/${encodedPath}`, {
    method: "POST",
    headers: { "x-upsert": "false" },
    body: JSON.stringify({ expiresIn: SIGNED_UPLOAD_EXPIRES_IN_SECONDS }),
  });

  const relativeUrl = data?.url || data?.signedURL || data?.signedUrl;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const signedUrl = relativeUrl
    ? /^https?:\/\//i.test(relativeUrl)
      ? relativeUrl
      : `${supabaseUrl}/storage/v1${relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`}`
    : null;
  const token = signedUrl ? new URL(signedUrl).searchParams.get("token") : null;

  if (!signedUrl || !token) {
    const err = new Error("Supabase did not return a signed upload URL.");
    err.status = 502;
    err.details = data || null;
    throw err;
  }

  return {
    bucket: BUCKET,
    path,
    signedUrl,
    token,
    originalName,
    size: Number(file.size),
    contentType: cleanText(file.type, 120) || "application/octet-stream",
    expiresIn: SIGNED_UPLOAD_EXPIRES_IN_SECONDS,
  };
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res, { mode: "public" })) return;
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "POST only." });
  if (!requireSupabaseEnv(res) || !requireServiceRoleEnv(res)) return;
  if (await enforceRateLimit(req, res, sendJson, { scope: "npi-upload-url" })) return;

  try {
    const body = await readBody(req);
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) return sendJson(res, 400, { ok: false, error: "files is required." });
    if (files.length > MAX_FILES) {
      return sendJson(res, 400, { ok: false, error: `Upload up to ${MAX_FILES} files per NPI package.` });
    }

    const captcha = await verifyTurnstile(
      body.turnstile_token || body["cf-turnstile-response"],
      getClientIp(req)
    );
    if (!captcha.ok) {
      return sendJson(res, 403, { ok: false, error: "Captcha verification failed." });
    }

    files.forEach(assertValidFile);
    await ensureBucket();

    const uploads = [];
    for (const file of files) {
      uploads.push(await createSignedUpload(file, body));
    }

    sendJson(res, 200, {
      ok: true,
      bucket: BUCKET,
      expiresIn: SIGNED_UPLOAD_EXPIRES_IN_SECONDS,
      maxFileBytes: MAX_FILE_BYTES,
      uploads,
    });
  } catch (error) {
    handleError(res, error);
  }
};
