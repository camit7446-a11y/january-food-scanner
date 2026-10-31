import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.JANUARY_BASE_URL || 'https://partners.january.ai').replace(/\/$/, '');
const KEY = process.env.JANUARY_API_KEY;
const PORT = Number(process.env.PORT || 8787);
const SCAN_LIMIT = Number(process.env.SCAN_LIMIT_PER_HOUR || 20);

const app = express();
app.disable('x-powered-by');
// Expo native/web clients call this API from a different origin. No cookies are used.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-user');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
// January rejects request bodies over 5 MB. The browser resizes photos to ~1024px first.
app.use(express.json({ limit: '6mb' }));

class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// --- tiny in-memory limiter so one visitor cannot burn your credits (a scan costs 10) ---
const hits = new Map();
function limitScans(req, _res, next) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const ip = req.ip || 'unknown';
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (recent.length >= SCAN_LIMIT) {
    const wait = Math.ceil((windowMs - (now - recent[0])) / 1000);
    return next(new HttpError(429, 'app_scan_limit', `Scan limit reached (${SCAN_LIMIT} per hour). Try again later.`, { retry_after: wait }));
  }
  recent.push(now);
  hits.set(ip, recent);
  next();
}

function endUser(req) {
  const id = String(req.get('x-app-user') || 'demo-user');
  return /^[\w-]{1,64}$/.test(id) ? id : 'demo-user';
}

async function january(pathAndQuery, { method = 'GET', body, userId, timeoutMs = 120000 } = {}) {
  if (!KEY) throw new HttpError(500, 'missing_api_key', 'JANUARY_API_KEY is not set. Copy .env.example to .env and add your key.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { Authorization: `Bearer ${KEY}`, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (userId) headers['January-End-User-ID'] = userId;

  let res;
  try {
    res = await fetch(`${BASE}${pathAndQuery}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new HttpError(504, 'upstream_timeout', 'January took too long to answer. Try again, or use fast mode.');
    throw new HttpError(502, 'upstream_unreachable', `Could not reach January: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }

  if (!res.ok) {
    const retryAfter = res.headers.get('retry-after');
    throw new HttpError(res.status, data?.code || data?.error?.code || 'upstream_error', data?.message || data?.error?.message || `January returned HTTP ${res.status}`, {
      retry_after: retryAfter ? Number(retryAfter) : undefined,
    });
  }
  return data;
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

app.get('/api/health', (_req, res) => res.json({ ok: true, keyConfigured: Boolean(KEY) }));

// Free call: shows how many credits are left this billing period.
app.get('/api/credits', wrap(async (_req, res) => {
  res.json(await january('/v1.2/credits'));
}));

// 2 credits per call. Searches the January food database by name.
app.get('/api/foods', wrap(async (req, res) => {
  const query = String(req.query.query || '').trim();
  if (!query) throw new HttpError(400, 'invalid_request', 'Enter a food name to search for.');
  const params = new URLSearchParams({ query: query.slice(0, 256) });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  params.set('limit', String(limit));
  if (['generic', 'branded', 'recipe'].includes(req.query.type)) params.set('type', req.query.type);
  res.json(await january(`/v1.2/foods?${params}`, { userId: endUser(req) }));
}));

// 10 credits per call. Body: { image: "data:image/jpeg;base64,..." | "https://...", context?, fast? }
app.post('/api/analyze', limitScans, wrap(async (req, res) => {
  const { image, context, fast } = req.body || {};
  const okImage = typeof image === 'string' && (/^data:image\/(jpeg|png|webp);base64,/.test(image) || /^https?:\/\//.test(image));
  if (!okImage) throw new HttpError(400, 'invalid_request', 'Send a JPEG, PNG or WebP photo (data URI) or an http(s) image URL.');

  const payload = { image };
  // January's current photo-scan endpoint accepts the image as a data URI.
  // `fast` is kept in the app interface for future provider-side options.
  void fast;
  if (typeof context === 'string' && context.trim()) payload.context = context.trim().slice(0, 500);

  //res.json(await january('/v1.2/food-scans/photo', { method: 'POST', body: payload, userId: endUser(req) }));

  res.json(await january('/v1.2/food-analysis/image', {
  method: 'POST',
  body: payload,
  userId: endUser(req)
}));
}));

// --- serve the built React app in production ---
const dist = path.resolve(__dirname, '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') err = new HttpError(413, 'image_too_large', 'That photo is too large. Use a smaller photo.');
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  if (err.extra?.retry_after) res.set('Retry-After', String(err.extra.retry_after));
  res.status(status).json({ code: err.code || 'server_error', message: err.message || 'Something went wrong.', retry_after: err.extra?.retry_after });
});

app.listen(PORT, () => {
  console.log(`API server on http://localhost:${PORT}  (January key ${KEY ? 'found' : 'MISSING'})`);
});
