import { january, send } from './_shared.js';
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, { status: 204, body: {} });
  if (req.method !== 'GET') return send(res, { status: 405, body: { message: 'Method not allowed.' } });
  send(res, await january('/v1.2/credits', req));
}
