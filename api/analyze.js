import { january, send } from './_shared.js';
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, { status: 204, body: {} });
  if (req.method !== 'POST') return send(res, { status: 405, body: { message: 'Method not allowed.' } });
  const { image, context } = req.body || {};
  const valid = typeof image === 'string' && (/^data:image\/(jpeg|png|webp);base64,/.test(image) || /^https?:\/\//.test(image));
  if (!valid) return send(res, { status: 400, body: { code: 'invalid_request', message: 'Send a JPEG, PNG or WebP image.' } });
  if (image.length > 5_500_000) return send(res, { status: 413, body: { code: 'image_too_large', message: 'Photo is too large. Please choose a smaller image.' } });
  const body = { image };
  if (typeof context === 'string' && context.trim()) body.context = context.trim().slice(0, 500);
 // send(res, await january('/v1.2/food-scans/photo', req, { method: 'POST', body }));
 send(res, await january('/v1.2/food-analysis/image', req, {
  method: 'POST',
  body
}));
}
