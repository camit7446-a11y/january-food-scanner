import { january, send } from './_shared.js';
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, { status: 204, body: {} });
  if (req.method !== 'GET') return send(res, { status: 405, body: { message: 'Method not allowed.' } });
  const query = String(req.query.query || '').trim();
  if (!query) return send(res, { status: 400, body: { code: 'invalid_request', message: 'Enter a food name to search for.' } });
  const params = new URLSearchParams({ query: query.slice(0, 256), limit: String(Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)) });
  if (['generic', 'branded', 'recipe'].includes(req.query.type)) params.set('type', req.query.type);
  send(res, await january(`/v1.2/foods?${params}`, req));
}
