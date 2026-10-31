const BASE = (process.env.JANUARY_BASE_URL || 'https://partners.january.ai').replace(/\/$/, '');

export async function january(path, req, options = {}) {
  const key = process.env.JANUARY_API_KEY;
  if (!key) return { status: 500, body: { code: 'missing_api_key', message: 'JANUARY_API_KEY is not configured in the deployment environment.' } };
  const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
  if (options.body) headers['Content-Type'] = 'application/json';
  const userId = String(req.headers['x-app-user'] || 'demo-user');
  if (/^[\w-]{1,64}$/.test(userId)) headers['January-End-User-ID'] = userId;
  try {
    const upstream = await fetch(`${BASE}${path}`, {
      method: options.method || 'GET', headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(120000),
    });
    const raw = await upstream.text();
    let data; try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw || 'January returned an unreadable response.' }; }
    return { status: upstream.status, body: data };
  } catch (error) {
    return { status: 502, body: { code: 'upstream_unreachable', message: error.name === 'TimeoutError' ? 'January took too long to answer. Please try again.' : 'Could not reach January AI.' } };
  }
}

export function send(res, result) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-user');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.status(result.status).json(result.body);
}
