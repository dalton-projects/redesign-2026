# Environment Variables & Backend Setup

This file lists every environment variable the production site reads, where to set each one, and the account-creation steps for the third-party services we depend on. **Every variable except `SLACK_WEBHOOK_URL` is optional** — if it's missing the relevant feature is skipped, and the site keeps working in a degraded-but-safe mode. That makes it easy to ship the code first and turn on each feature as you create the corresponding account.

All variables go in **Vercel Project → Settings → Environment Variables**. Set them for `Production` and `Preview` (use `Development` only if you run `vercel dev` locally).

---

## Quick reference

| Variable | Required? | What it enables | Where to get it |
| --- | --- | --- | --- |
| `SLACK_WEBHOOK_URL` | **Yes** | Contact-form submissions get posted to Slack | Slack → Apps → Incoming Webhooks |
| `BLOB_READ_WRITE_TOKEN` | Yes (auto) | File-upload endpoint can write to Vercel Blob | Auto-provisioned by Vercel when you enable Blob storage |
| `ALLOWED_ORIGINS` | No | Override the production-origin allowlist | You set this manually — comma-separated list of `https://…` |
| `ALLOWED_PREVIEW_PATTERN` | No | Regex for which `*.vercel.app` preview hosts can call the API | You set this manually — see below |
| `TURNSTILE_SECRET_KEY` | No | Server-side verification of the Turnstile bot challenge | Cloudflare dashboard (see step 1) |
| `UPSTASH_REDIS_REST_URL` | No | Per-IP rate limiting + Slack duplicate collapse | Upstash dashboard (see step 2) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Same as above | Upstash dashboard (see step 2) |
| `SEMGREP_APP_TOKEN` | No | Managed Semgrep features in CI (otherwise runs in OSS mode) | semgrep.dev → Settings → Tokens |

---

## Step 1 — Cloudflare Turnstile (invisible bot challenge)

Turnstile is Cloudflare's free, privacy-respecting alternative to reCAPTCHA. It runs invisibly for most users and only shows a challenge when its risk model is uncertain.

1. Sign in at <https://dash.cloudflare.com/> (the free plan is sufficient).
2. In the left nav, click **Turnstile** → **Add site**.
3. Configure:
   - **Site name:** Oasis of Change Contact Form
   - **Hostname:** `oasisofchange.com` (Cloudflare also accepts subdomains and `*.vercel.app` for previews — add both if you want Turnstile active on preview deployments).
   - **Widget mode:** Managed (recommended)
   - **Pre-clearance:** No (not needed)
4. Click **Create**. You now see two keys:
   - **Site Key** — public, goes in the HTML.
   - **Secret Key** — confidential, goes in Vercel.
5. In Vercel: add `TURNSTILE_SECRET_KEY` with the Secret Key value.
6. In this repo, edit **two files** (the build step copies `src/` → `public/`, so update both until you re-run `build.py`):
   - `src/pages/contact.html`
   - `public/contact.html`

   Find this line:
   ```html
   <meta name="turnstile-site-key" content="">
   ```
   Replace `content=""` with `content="0x4AAAAAAA…"` using your Site Key.
7. Deploy. The widget renders inside the contact form just above the submit button. If verification fails or the env var is missing, the form returns a `403` with `requestId` for traceability.

**Testing keys:** Cloudflare publishes always-pass / always-fail test keys at <https://developers.cloudflare.com/turnstile/troubleshooting/testing/>. Useful for verifying the integration before going live.

---

## Step 2 — Upstash Redis (rate limit + dedupe)

Upstash provides serverless Redis over HTTPS — perfect for Vercel functions because there's no persistent connection to manage. The free tier (10,000 commands per day) is more than enough for this site's volume.

1. Sign up at <https://console.upstash.com/> with GitHub or email.
2. Click **Create Database**.
   - **Type:** Regional (latency matters less than cost for our use case)
   - **Region:** Closest to your Vercel deployment region (US-West for Vancouver users)
   - **Eviction:** Enabled (defaults are fine)
3. On the database page, scroll to **REST API** and copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Add both to Vercel as env vars.
5. Deploy. From now on:
   - `/api/contact` rate-limits each IP to **5 submissions per hour**.
   - `/api/upload` rate-limits each IP to **10 uploads per hour**.
   - Duplicate contact submissions (same email + message hash within 60 seconds) are collapsed into one Slack alert.

You can monitor usage from the Upstash console — under **Data Browser**, search for keys matching `rl:*` (rate-limit buckets) or `dedupe:*` (dedupe markers).

---

## Step 3 — Origin allowlist tightening (optional)

By default, the API endpoints accept requests from:
- `https://oasisofchange.com`
- `https://www.oasisofchange.com`
- `localhost` / `127.0.0.1` (for local dev)
- Any host matching `^oasis(?:-of-change|ofchange|-redesign)[a-z0-9-]*\.vercel\.app$` (your Vercel previews)

If your Vercel project slug is different (or you want to lock previews down further), set:

```
ALLOWED_PREVIEW_PATTERN=^your-project-slug-[a-z0-9-]+\.vercel\.app$
```

This is a JavaScript regex string — test it at <https://regex101.com/> with flavor "ECMAScript".

To replace the full origin allowlist (e.g. you're hosting on a different domain), set:

```
ALLOWED_ORIGINS=https://newdomain.com,https://www.newdomain.com
```

Comma-separated. Each entry must be an origin (scheme + host, no path).

---

## Step 4 — Verify the deploy

After your first deploy with the new env vars:

1. **CSP** — open the site in Chrome DevTools → Network → click the document → Response Headers. Confirm:
   - `Content-Security-Policy` is present. Note: `script-src` / `script-src-elem` intentionally include `'unsafe-inline'` — Google Translate renders its UI inside `about:srcdoc` iframes that inherit the page CSP and contain an inline bootstrap script, so removing `'unsafe-inline'` silently breaks all machine translation (this happened on 2026-05-17 and was reverted on 2026-06-10). If you tighten this again, verify FR/ES translation still works on a content page first.
   - `Cross-Origin-Resource-Policy: same-origin`.
2. **Turnstile** — visit `/contact`, scroll to the form, confirm the small Turnstile widget appears below the consent checkboxes. If it doesn't appear, check the meta tag and the browser console.
3. **Request ID** — submit the contact form. Inspect the response — `X-Request-Id` header and `requestId` in the JSON body should both be present.
4. **Rate limit** — submit 6 times quickly from the same browser. The 6th should return `429 Too Many Requests`.
5. **CI** — open a test PR. GitHub Actions should run `Security scan` → three jobs: npm audit, Semgrep, Gitleaks. All should pass on a clean PR.

---

## Local development (`vercel dev`)

To test API endpoints locally:

1. Install the Vercel CLI: `npm i -g vercel`.
2. Create `.env.local` in the repo root (already gitignored). Add the same env vars listed above.
3. Run `vercel dev` from the repo root.

Rate limiting and Turnstile will fail open in dev because you typically won't bother setting up Upstash/Turnstile env vars for local work. That's intentional — set them in dev only if you specifically want to test those code paths.

---

## Rotating secrets

Best practice: rotate secrets every 12 months, or immediately if anything is exposed in logs, screenshots, or accidentally committed.

| Secret | How to rotate |
| --- | --- |
| `SLACK_WEBHOOK_URL` | Slack → App management → revoke + regenerate the webhook |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob → Reset access token |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → Settings → Roll secret key |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash → Database → REST API → Roll token |

After rotating, update the Vercel env var and trigger a new deploy. Rotating does **not** break the production deploy — Vercel reads env vars at function cold-start, so old function instances will fail their next invocation and the new ones will pick up the fresh secret.
