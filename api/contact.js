const {
  originAllowed,
  clientIp,
  rateLimit,
  verifyTurnstile,
  startApiResponse,
  isFirstSeen,
  shortHash,
} = require('../lib/security');

const MIN_FORM_TIME_MS = 3000;
const MAX_MESSAGE_LEN = 5000;
const MAX_FIELD_LEN = 1000;
const MAX_OTHER_LEN = 500;
const MAX_REQUEST_BYTES = 64 * 1024;
const ALLOWED_BLOB_HOST = 'blob.vercel-storage.com';

// Per-IP rate limits. Generous enough that a real user filling out the form
// across multiple inquiry types in one session won't hit them, but tight
// enough that a bot loop is bounded to ~5/hour from any one address.
const RATE_LIMIT_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

const INQUIRY_META = {
  'general':       { emoji: '💬', color: '#6b7280', label: 'General Inquiry' },
  'volunteer':     { emoji: '🙌', color: '#16a34a', label: 'Volunteer' },
  'partnership':   { emoji: '🤝', color: '#2563eb', label: 'Partnership' },
  'media':         { emoji: '📰', color: '#dc2626', label: 'Press & Media' },
  'speaking':      { emoji: '🎤', color: '#7c3aed', label: 'Speaking Engagement' },
  'web-ready':     { emoji: '🌐', color: '#0891b2', label: 'Web-Ready Services' },
  'wra-platform':  { emoji: '🧰', color: '#0d9488', label: 'WRA Platform' },
  'stw':           { emoji: '📅', color: '#059669', label: 'Sustainable Technology Week' },
  'vcasse':        { emoji: '🧠', color: '#7c3aed', label: 'VCASSE' },
  'tree-planting': { emoji: '🌱', color: '#16a34a', label: 'Tree Planting' },
};

const FIELD_LABELS = {
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  phone: 'Phone',
  organization: 'Organization',
  organization_type: 'Org type',
  website: 'Website',
  linkedin: 'LinkedIn',
  role: 'Role',
  employees: 'Team size',
  volunteer_interest: 'Areas of interest',
  volunteer_availability: 'Availability',
  volunteer_skills: 'Skills / experience',
  partnership_type: 'Partnership type',
  partnership_mission: 'Organization mission',
  partnership_goals: 'Goals',
  media_outlet: 'Outlet',
  media_request_type: 'Request type',
  media_deadline: 'Deadline',
  media_angle: 'Story angle',
  attachment_url: 'Attached file',
  speaking_event: 'Event name',
  speaking_date: 'Event date',
  speaking_format: 'Format',
  speaking_audience_size: 'Audience size',
  speaking_topic: 'Topics',
  speaking_details: 'Additional details',
  webready_service: 'Services needed',
  webready_url: 'Current URL',
  webready_goals: 'Goals',
  wra_budget: 'Annual budget',
  wra_referral: 'How they heard about WRA',
  wra_support: 'Support needed',
  stw_interest: 'Participation type',
  stw_topic: 'Proposed topic',
  vcasse_interest: 'Areas of interest',
  vcasse_description: 'Description',
  tree_interest: 'Interest',
  message: 'Message',
  referral_source: 'Referral source',
};

const SECTION_FIELDS = {
  'volunteer':     ['volunteer_interest', 'volunteer_availability', 'volunteer_skills'],
  'partnership':   ['partnership_type', 'partnership_mission', 'partnership_goals'],
  'media':         ['media_outlet', 'media_request_type', 'media_deadline', 'media_angle'],
  'speaking':      ['speaking_event', 'speaking_date', 'speaking_format', 'speaking_audience_size', 'speaking_topic', 'speaking_details'],
  'web-ready':     ['webready_service', 'webready_url', 'webready_goals'],
  'wra-platform':  ['wra_budget', 'wra_referral', 'wra_support'],
  'stw':           ['stw_interest', 'stw_topic'],
  'vcasse':        ['vcasse_interest', 'vcasse_description'],
  'tree-planting': ['tree_interest'],
};

const URL_FIELDS = new Set(['website', 'linkedin', 'attachment_url', 'webready_url']);

// Slack mrkdwn requires escaping &, <, > (per Slack docs). We additionally
// strip the URL-syntax pipe character so user input cannot break out of the
// `<url|text>` link-construction pattern below.
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// For values used inside a Slack `<url|text>` construction the `|` separator
// must also be neutralised, otherwise an attacker can inject a forged link
// label or URL.
function escForLink(s) {
  return esc(s).replace(/\|/g, '%7C');
}

function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let u;
  try { u = new URL(trimmed); } catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return u.toString();
}

function isFilled(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== '';
}

function truncate(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// Defensive: shrink each scalar value down to MAX_FIELD_LEN before any
// formatting work. Prevents a malicious client from blowing up the Slack
// payload size or using extremely long single-line strings to evade pattern
// checks.
function clampValue(v, max) {
  if (v == null) return v;
  if (Array.isArray(v)) {
    return v.slice(0, 50).map(item => typeof item === 'string' ? truncate(item, max) : item);
  }
  if (typeof v === 'string') return truncate(v, max);
  return v;
}

function clampPayload(data) {
  const out = {};
  for (const key of Object.keys(data)) {
    if (typeof key !== 'string' || key.length > 80) continue;
    const v = data[key];
    if (key === 'message') {
      out[key] = typeof v === 'string' ? truncate(v, MAX_MESSAGE_LEN) : v;
    } else if (key.endsWith('_other')) {
      out[key] = clampValue(v, MAX_OTHER_LEN);
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      out[key] = v;
    } else {
      out[key] = clampValue(v, MAX_FIELD_LEN);
    }
  }
  return out;
}

// Render a field's value for Slack. If the field is "other" and the user
// specified something in the paired `_other` text input, render as
// "Other — <their text>" instead of just "Other".
function displayValue(data, key) {
  const v = data[key];
  const other = data[key + '_other'];
  const hasOther = isFilled(other);

  if (Array.isArray(v)) {
    return v.map(item => {
      if (item === 'other' && hasOther) return 'Other — ' + other;
      return item;
    }).map(esc).join(', ');
  }
  if (v === 'other' && hasOther) return esc('Other — ' + other);
  if (URL_FIELDS.has(key) && isFilled(v)) {
    const url = safeHttpUrl(String(v));
    if (!url) return esc(String(v));
    const safeUrl = escForLink(url);
    return `<${safeUrl}|${safeUrl}>`;
  }
  return esc(v);
}

// Short, human-readable submission ID. Unambiguous alphabet (no 0/O/I/1/L).
function genSubmissionId() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return 'S-' + s;
}

function buildBlocks(data, submissionId) {
  const inquiry = data.inquiry_type || 'general';
  const meta = INQUIRY_META[inquiry] || INQUIRY_META['general'];
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Unknown';
  const blocks = [];

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `${meta.emoji} ${meta.label}`, emoji: true },
  });

  // encodeURIComponent (not encodeURI) ensures any reserved URL chars in the
  // address don't break out into the surrounding `?subject=…&body=…` query
  // string further down.
  const safeMailto = encodeURIComponent(String(data.email));
  const contactFields = [
    `*Name:*\n${esc(name)}`,
    `*Email:*\n<mailto:${safeMailto}|${escForLink(String(data.email))}>`,
  ];
  if (isFilled(data.phone)) contactFields.push(`*Phone:*\n${esc(data.phone)}`);

  blocks.push({
    type: 'section',
    fields: contactFields.map(t => ({ type: 'mrkdwn', text: t })),
  });

  const orgKeys = ['organization', 'organization_type', 'website', 'linkedin', 'role', 'employees'];
  const orgFilled = orgKeys.filter(k => isFilled(data[k]));
  if (orgFilled.length) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*🏢 Organization*' },
    });
    blocks.push({
      type: 'section',
      fields: orgFilled.map(k => ({
        type: 'mrkdwn',
        text: `*${FIELD_LABELS[k]}:*\n${displayValue(data, k)}`,
      })),
    });
  }

  const sectionKeys = SECTION_FIELDS[inquiry] || [];
  const typeFilled = sectionKeys.filter(k => isFilled(data[k]));
  if (typeFilled.length) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${meta.emoji} ${meta.label} details*` },
    });
    // Short scalars go in a 2-column fields layout; longer text gets its own
    // section block so it renders in full.
    const shortFields = [];
    const longFields = [];
    for (const k of typeFilled) {
      const val = data[k];
      const strVal = Array.isArray(val) ? val.join(', ') : String(val);
      if (!Array.isArray(val) && strVal.length > 80) longFields.push(k);
      else shortFields.push(k);
    }
    if (shortFields.length) {
      for (let i = 0; i < shortFields.length; i += 10) {
        const chunk = shortFields.slice(i, i + 10);
        blocks.push({
          type: 'section',
          fields: chunk.map(k => ({
            type: 'mrkdwn',
            text: `*${FIELD_LABELS[k]}:*\n${displayValue(data, k)}`,
          })),
        });
      }
    }
    for (const k of longFields) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*${FIELD_LABELS[k]}:*\n${displayValue(data, k)}` },
      });
    }
  }

  if (isFilled(data.message)) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*✉️ Message*\n>${esc(truncate(data.message, 2800)).replace(/\n/g, '\n>')}` },
    });
  }

  // Only render the attachment link if it parses as an http(s) URL pointing
  // at our blob host. Any other URL is shown as plain text so the channel
  // can't be tricked into linking to attacker-controlled content.
  if (isFilled(data.attachment_url)) {
    const raw = String(data.attachment_url);
    const url = safeHttpUrl(raw);
    let host = '';
    try { host = url ? new URL(url).hostname : ''; } catch (e) {}
    if (url && (host === ALLOWED_BLOB_HOST || host.endsWith('.' + ALLOWED_BLOB_HOST))) {
      const safeUrl = escForLink(url);
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*📎 Attachment*\n<${safeUrl}|Download file>` },
      });
    } else {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*📎 Attachment (untrusted host, not linked):*\n${esc(raw)}` },
      });
    }
  }

  if (isFilled(data.email)) {
    const subject = 'Re: Your ' + meta.label + ' inquiry';
    const body = 'Hi ' + (data.first_name || 'there') + ',\n\nThanks for reaching out to Oasis of Change.\n\n';
    // encodeURIComponent throughout — encodeURI would leave ?, &, # alone in
    // the address part and let it bleed into the query string.
    const mailto = 'mailto:' + encodeURIComponent(String(data.email))
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: '✉️ Reply via email', emoji: true },
        url: mailto,
        style: 'primary',
      }],
    });
  }

  const footer = [];
  footer.push(`*ID:* \`${submissionId}\``);
  if (isFilled(data.referral_source)) {
    footer.push(`Heard about us: ${displayValue(data, 'referral_source')}`);
  }
  if (data.newsletter === 'on' || data.newsletter === true || data.newsletter === 'true') {
    footer.push('✉️ Newsletter opt-in');
  }
  footer.push(new Date().toISOString());

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: footer.join(' · ') }],
  });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: '💬 _Reply in thread to track follow-up_' }],
  });

  return { blocks, color: meta.color, label: meta.label, name };
}

module.exports = async (req, res) => {
  const requestId = startApiResponse(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed', requestId });
  }

  if (!originAllowed(req.headers.origin)) {
    return res.status(403).json({ ok: false, error: 'Origin not allowed', requestId });
  }

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    console.error(`[${requestId}] SLACK_WEBHOOK_URL is not set`);
    return res.status(500).json({ ok: false, error: 'Server misconfigured', requestId });
  }

  // Rate limit before doing any payload work. Honest users won't notice;
  // a bot looping through inquiry types will get cut off after 5/hour.
  const ip = clientIp(req);
  const rl = await rateLimit('contact', ip, {
    limit: RATE_LIMIT_PER_HOUR,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(RATE_LIMIT_WINDOW_SECONDS));
    return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.', requestId });
  }

  let data = req.body;
  if (typeof data === 'string') {
    if (data.length > MAX_REQUEST_BYTES) {
      return res.status(413).json({ ok: false, error: 'Payload too large', requestId });
    }
    try { data = JSON.parse(data); } catch (e) { data = {}; }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ ok: false, error: 'Invalid payload', requestId });
  }

  // Verify Cloudflare Turnstile token (if configured). The token field is
  // set client-side after the widget completes its challenge. We pull it
  // out *before* clampPayload so it doesn't get trimmed by length limits.
  const turnstileToken = typeof data['cf-turnstile-response'] === 'string'
    ? data['cf-turnstile-response']
    : (typeof data.turnstile_token === 'string' ? data.turnstile_token : '');
  const turnstile = await verifyTurnstile(turnstileToken, { ip });
  if (!turnstile.ok) {
    console.warn(`[${requestId}] Turnstile rejected: ${turnstile.reason}`);
    return res.status(403).json({ ok: false, error: 'Verification failed. Please reload the page and try again.', requestId });
  }

  data = clampPayload(data);

  if (isFilled(data.website_url)) {
    return res.status(200).json({ ok: true, requestId });
  }
  const loadedAt = Number(data.form_loaded_at);
  if (loadedAt && (Date.now() - loadedAt) < MIN_FORM_TIME_MS) {
    return res.status(200).json({ ok: true, requestId });
  }

  const missing = [];
  if (!isFilled(data.inquiry_type)) missing.push('inquiry_type');
  if (!isFilled(data.first_name))   missing.push('first_name');
  if (!isFilled(data.last_name))    missing.push('last_name');
  if (!isFilled(data.email))        missing.push('email');
  if (!isFilled(data.message))      missing.push('message');
  if (!data.privacy_consent)        missing.push('privacy_consent');

  if (missing.length) {
    return res.status(400).json({ ok: false, error: 'Missing required fields', fields: missing, requestId });
  }
  if (!/^[^\s@<>"'`,;:|\\]+@[^\s@<>"'`,;:|\\]+\.[^\s@<>"'`,;:|\\]+$/.test(String(data.email))
      || String(data.email).length > 254) {
    return res.status(400).json({ ok: false, error: 'Invalid email address', requestId });
  }
  if (String(data.message).length > MAX_MESSAGE_LEN) {
    return res.status(400).json({ ok: false, error: 'Message too long', requestId });
  }
  if (!INQUIRY_META[data.inquiry_type]) {
    return res.status(400).json({ ok: false, error: 'Invalid inquiry type', requestId });
  }

  // Collapse accidental double-submissions (back-button, retry click,
  // network-flake re-fire) so the Slack channel sees one alert per real
  // inquiry instead of two within a 60s window.
  const dedupeKey = await shortHash(
    String(data.email).toLowerCase() + ':' + String(data.message)
  );
  const firstSeen = await isFirstSeen('contact', dedupeKey, { windowSeconds: 60 });
  if (!firstSeen) {
    console.info(`[${requestId}] Duplicate submission suppressed (dedupe hit)`);
    return res.status(200).json({ ok: true, requestId, deduplicated: true });
  }

  const submissionId = genSubmissionId();
  const { blocks, color, label, name } = buildBlocks(data, submissionId);

  // The `attachments` wrapper gives us the colored accent bar on the left of
  // the Slack message — the easiest way to visually distinguish inquiry types
  // at a glance in the channel.
  const slackPayload = {
    text: `New ${label} inquiry from ${name} (${submissionId})`,
    attachments: [{ color, blocks }],
  };

  try {
    const slackRes = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!slackRes.ok) {
      const body = await slackRes.text();
      console.error(`[${requestId}] Slack webhook failed:`, slackRes.status, body);
      return res.status(502).json({ ok: false, error: 'Upstream error', requestId });
    }

    return res.status(200).json({ ok: true, id: submissionId, requestId });
  } catch (err) {
    console.error(`[${requestId}] Slack fetch error:`, err);
    return res.status(500).json({ ok: false, error: 'Failed to send', requestId });
  }
};
