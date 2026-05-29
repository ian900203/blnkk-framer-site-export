// Public-API protection: Upstash rate limit + Cloudflare Turnstile.
//
// Both layers auto-disable when their environment variables are missing,
// and print a single warning so the operator notices the protection is off.
// This lets the route code stay simple while remaining safe to deploy
// before the operator has finished wiring the protection.

let ratelimitInstance = null;
let ratelimitInitPromise = null;
let ratelimitWarned = false;
let turnstileWarned = false;

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.length) return real;
  return req.socket?.remoteAddress || "unknown";
}

async function loadRatelimit() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!ratelimitWarned) {
      console.warn("[protect] Upstash env vars missing; rate limit disabled.");
      ratelimitWarned = true;
    }
    return null;
  }
  try {
    const [{ Redis }, { Ratelimit }] = await Promise.all([
      import("@upstash/redis"),
      import("@upstash/ratelimit"),
    ]);
    const redis = new Redis({ url, token });
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 m"),
      analytics: false,
      prefix: "blnkk-api",
    });
  } catch (error) {
    console.warn("[protect] Failed to load Upstash ratelimit:", error.message);
    return null;
  }
}

function getRatelimit() {
  if (ratelimitInstance) return Promise.resolve(ratelimitInstance);
  if (!ratelimitInitPromise) {
    ratelimitInitPromise = loadRatelimit().then((instance) => {
      ratelimitInstance = instance;
      return instance;
    });
  }
  return ratelimitInitPromise;
}

// Returns true if the request was rejected. The caller should return immediately.
async function enforceRateLimit(req, res, sendJson, options = {}) {
  const ratelimit = await getRatelimit();
  if (!ratelimit) return false;
  const ip = getClientIp(req);
  const scope = options.scope || "default";
  let result;
  try {
    result = await ratelimit.limit(`${scope}:${ip}`);
  } catch (error) {
    console.warn("[protect] Rate limit check failed; allowing request:", error.message);
    return false;
  }
  res.setHeader("X-RateLimit-Limit", String(result.limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));
  res.setHeader("X-RateLimit-Reset", String(result.reset));
  if (!result.success) {
    const retryAfterSec = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    sendJson(res, 429, {
      ok: false,
      error: "Too many requests. Please slow down and try again later.",
    });
    return true;
  }
  return false;
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    if (!turnstileWarned) {
      console.warn("[protect] TURNSTILE_SECRET missing; captcha disabled.");
      turnstileWarned = true;
    }
    return { ok: true, skipped: true };
  }
  if (!token) {
    return { ok: false, reason: "captcha_required" };
  }
  try {
    const params = new URLSearchParams();
    params.set("secret", secret);
    params.set("response", String(token));
    if (ip) params.set("remoteip", String(ip));
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await response.json().catch(() => ({}));
    if (!data?.success) {
      return { ok: false, reason: "captcha_failed", codes: data?.["error-codes"] || [] };
    }
    return { ok: true, skipped: false };
  } catch (error) {
    console.warn("[protect] Turnstile verify failed:", error.message);
    return { ok: false, reason: "captcha_verify_failed" };
  }
}

module.exports = { enforceRateLimit, verifyTurnstile, getClientIp };
