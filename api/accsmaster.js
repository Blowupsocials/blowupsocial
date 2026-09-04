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

  // Strip routing fields from forwarded params
  const { id: _id, slug: _slug, ...forwardParams } = params;

  try {
    let upstream;
    if (GET_ACTIONS.has(action)) {
      const qs = Object.keys(forwardParams).length ? '?' + new URLSearchParams(forwardParams).toString() : '';
      upstream = await fetch(`${BASE}${path}${qs}`, { headers });
    } else {
      upstream = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(forwardParams),
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
