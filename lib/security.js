// Shared security helpers for /api routes.
//
// Lives at the repo root in /lib/ (NOT inside api/) so Vercel's serverless
// function builder doesn't try to deploy it as its own route. The API
// handlers in /api/ import this via `require('../lib/security')`.
//
// Everything in here is designed to be safe-by-default: if an env var is
// missing the check either fails open with a logged warning (rate limiter,
// Turnstile when configured opt-in) or fails closed (origin allowlist).

const DEFAULT_ALLOWED_ORIGINS = [
  'https://oasisofchange.com',
  'https://www.oasisofchange.com',
];

// Restrictive default: only allow the project's own Vercel preview/production
// deployments, not any random *.vercel.app subdomain (which anyone can spin
// up). Override via the ALLOWED_PREVIEW_PATTERN env var if your project
// slug differs.
const DEFAULT_PREVIEW_PATTERN = /^oasis(?:-of-change|ofchange|-redesign)[a-z0-9-]*\.vercel\.app$/;

function getAllowedOrigins() {
  const env = process.env.ALLOWED_ORIGINS;
  if (env && env.trim()) {
    return env.split(',').map(s => s.trim()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

function getPreviewPattern() {
  const env = process.env.ALLOWED_PREVIEW_PATTERN;
  if (env && env.trim()) {
    try { return new RegExp(env.trim()); } catch (e) {
      console.warn('Invalid ALLOWED_PREVIEW_PATTERN regex, falling back to default');
    }
  }
  return DEFAULT_PREVIEW_PATTERN;
}

// `strict`: when true, missing Origin headers are rejected. Use this for
// state-changing endpoints (uploads). When false, missing Origin is
// allowed through — non-browser clients (curl, automated probes) often omit
// it, and we can't reliably distinguish them from same-origin browser POSTs.
function originAllowed(origin, { strict = false } = {}) {
  if (!origin) return !strict;
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (getPreviewPattern().test(host)) return true;
  } catch (e) {
    return false;
  }
  return false;
}

// Short, unguessable per-request ID. Used in the X-Request-Id response
// header and in any log lines emitted from the handler. Not a secret — its
// only purpose is letting the support team grep logs for one specific
// failing submission.
function makeRequestId() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return 'req_' + s;
}

// Best-effort client IP. Trusts Vercel's x-forwarded-for / x-real-ip
// headers, falling back to socket address. Used only as a rate-limit key;
// not a security boundary on its own.
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  const xri = req.headers['x-real-ip'];
  if (xri) return String(xri).trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Upstash Redis REST rate limiter — sliding fixed-window per (route, key).
// Returns { ok: boolean, remaining: number, limit: number } on success, or
// { ok: true, skipped: true } if Upstash is not configured (so the site
// keeps working before the user finishes account setup).
//
// Implementation: INCR a bucket key with a windowSeconds TTL. First request
// in a window gets count=1 and we set the expiry; subsequent ones just
// increment. If count > limit, reject. The check is best-effort and fails
// open on network errors — we'd rather accept a few extra requests than
// reject legitimate users when Upstash is down.
async function rateLimit(route, key, { limit, windowSeconds }) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return { ok: true, skipped: true };
  }

  const bucket = `rl:${route}:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
  try {
    // Pipelined INCR + EXPIRE so we set the TTL exactly once per window.
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', bucket],
        ['EXPIRE', bucket, String(windowSeconds), 'NX'],
      ]),
    });
    if (!res.ok) {
      console.warn('Rate-limit upstream non-OK:', res.status);
      return { ok: true, skipped: true };
    }
    const body = await res.json();
    const count = body && body[0] && typeof body[0].result === 'number' ? body[0].result : 0;
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
    };
  } catch (e) {
    console.warn('Rate-limit error (failing open):', e && e.message);
    return { ok: true, skipped: true };
  }
}

// Verifies a Cloudflare Turnstile token via Cloudflare's siteverify endpoint.
// Returns { ok: true, skipped: true } if no secret is configured, so the
// site keeps working before the env var is set.
//
// We deliberately do NOT pass remoteip to Cloudflare — adding it is optional
// per Cloudflare's docs and avoids unnecessary IP egress. We also bound the
// fetch with a 5s AbortController so a slow Cloudflare doesn't hang the
// whole form submission.
async function verifyTurnstile(token, { ip } = {}) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing-token' };

  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token);
  if (ip) params.set('remoteip', ip);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: ac.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (body && body.success === true) return { ok: true };
    return { ok: false, reason: (body && body['error-codes'] && body['error-codes'].join(',')) || 'failed' };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, reason: 'timeout' };
    return { ok: false, reason: 'network-error' };
  } finally {
    clearTimeout(timer);
  }
}

// Adds the standard set of API security headers in one place. Returns the
// request ID so the caller can include it in log lines.
function startApiResponse(res) {
  const id = makeRequestId();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Request-Id', id);
  return id;
}

// Submission dedupe: returns true if this is the first time we've seen
// `key` within `windowSeconds`, false if we've seen it before. Uses Redis
// SET key … NX EX so it's a single atomic check-and-set.
//
// Used to collapse accidental double-submissions (back button, retry click)
// into one Slack notification. Fails open (returns true) when Upstash is
// unavailable — better to send a duplicate than to silently drop a real
// submission.
async function isFirstSeen(scope, key, { windowSeconds }) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;

  const redisKey = `dedupe:${scope}:${key}`;
  try {
    const res = await fetch(`${url}/set/${encodeURIComponent(redisKey)}/1?NX=true&EX=${windowSeconds}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return true;
    const body = await res.json();
    // Upstash returns { result: 'OK' } on success, { result: null } if NX failed.
    return body && body.result === 'OK';
  } catch (e) {
    console.warn('Dedupe error (failing open):', e && e.message);
    return true;
  }
}

// SHA-256 of an arbitrary string, returned as the first `bytes` bytes of
// the hex digest. Used for dedupe keys (we don't need full collision
// resistance, just enough uniqueness to bucket submissions over 60s).
async function shortHash(text, bytes = 16) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, bytes * 2);
}

module.exports = {
  originAllowed,
  makeRequestId,
  clientIp,
  rateLimit,
  verifyTurnstile,
  startApiResponse,
  isFirstSeen,
  shortHash,
};
