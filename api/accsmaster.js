// AccsZone reseller API proxy — https://accszone.com/api/v1
const BASE = 'https://accszone.com/api/v1';

const GET_ACTIONS = new Set(['categories', 'subcategories', 'listings', 'listing', 'orders', 'order', 'balance']);
const POST_ACTIONS = new Set(['purchase']);
const ALL_ALLOWED  = new Set([...GET_ACTIONS, ...POST_ACTIONS]);

function buildPath(action, params) {
  if (action === 'subcategories' && params.id) return `/categories/${params.id}/subcategories`;
  if (action === 'listing'       && params.slug) return `/listings/${params.slug}`;
  if (action === 'order'         && params.id)   return `/orders/${params.id}`;
  if (action === 'balance')   return '/user/balance';
  if (action === 'categories') return '/categories';
  if (action === 'listings')   return '/listings';
  if (action === 'orders')     return '/orders';
  if (action === 'purchase')   return '/purchase';
  return `/${action}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.ACCSZONE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'accounts_not_configured' });

  const { action, ...params } = req.body || {};
  if (!action || !ALL_ALLOWED.has(action)) {
    return res.status(400).json({ error: 'Invalid or missing action' });
  }

  const path    = buildPath(action, params);
  const headers = { 'X-API-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };

  try {
    let upstream;
    if (GET_ACTIONS.has(action)) {
      // Strip URL-routing fields (id, slug) from query params — they're already in the path
      const { id: _id, slug: _slug, ...qParams } = params;
      const qs = Object.keys(qParams).length ? '?' + new URLSearchParams(qParams).toString() : '';
      upstream = await fetch(`${BASE}${path}${qs}`, { headers });
    } else {
      // For POST actions (e.g. purchase), send all params as-is — slug belongs in the body
      upstream = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
    }

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      return res.status(502).json({ error: `Provider returned ${upstream.status}`, detail: body });
    }

    const data = await upstream.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Request failed', detail: err.message });
  }
}
