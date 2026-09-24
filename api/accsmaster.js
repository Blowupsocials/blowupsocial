// AccsZone reseller API proxy — https://accszone.com/api/v1
const BASE       = 'https://accszone.com/api/v1';
const SUPA_URL   = 'https://puutwycvshayqoozwfwv.supabase.co/rest/v1';
const SUPA_AUTH  = 'https://puutwycvshayqoozwfwv.supabase.co/auth/v1';
const USD_TO_NGN = 1600;

const GET_ACTIONS  = new Set(['categories', 'subcategories', 'listings', 'listing', 'orders', 'order', 'balance']);
const POST_ACTIONS = new Set(['purchase']);
const ALL_ALLOWED  = new Set([...GET_ACTIONS, ...POST_ACTIONS]);

function buildPath(action, params) {
  if (action === 'subcategories' && params.id) return `/categories/${params.id}/subcategories`;
  if (action === 'listing'       && params.slug) return `/listings/${params.slug}`;
  if (action === 'order'         && params.id)   return `/orders/${params.id}`;
  if (action === 'balance')    return '/user/balance';
  if (action === 'categories') return '/categories';
  if (action === 'listings')   return '/listings';
  if (action === 'orders')     return '/orders';
  if (action === 'purchase')   return '/purchase';
  return `/${action}`;
}

function supaHdr(key) {
  return { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.ACCSZONE_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'accounts_not_configured' });

  const { action, ...params } = req.body || {};

  /* ── SECURE PURCHASE ──────────────────────────────────────────────────────
     action = 'secure_purchase': verifies JWT, checks wallet server-side,
     deducts BEFORE calling provider, refunds on failure.                  */
  if (action === 'secure_purchase') {
    const svcKey = process.env.SUPABASE_SERVICE_KEY;
    if (!svcKey) return res.status(503).json({ error: 'Server not configured' });

    // Verify JWT
    const userJwt = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
    if (!userJwt) return res.status(401).json({ error: 'Not authenticated' });

    let userId;
    try {
      const userRes  = await fetch(`${SUPA_AUTH}/user`, {
        headers: { 'apikey': svcKey, 'Authorization': `Bearer ${userJwt}` },
      });
      const userData = await userRes.json();
      userId = userData?.id;
      if (!userId) return res.status(401).json({ error: 'Invalid session' });
    } catch {
      return res.status(401).json({ error: 'Could not verify session' });
    }

    const { ad_id, quantity, offer_title, offer_slug, price_usd, price_ngn } = params;
    if (!ad_id || !price_usd) return res.status(400).json({ error: 'Missing purchase fields' });

    const costUSD = parseFloat(price_usd);

    // Read wallet server-side
    const profRes  = await fetch(`${SUPA_URL}/profiles?id=eq.${userId}&select=wallet_balance&limit=1`, {
      headers: supaHdr(svcKey),
    });
    const profiles = await profRes.json();
    if (!Array.isArray(profiles) || !profiles.length) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const currentUSD = parseFloat(profiles[0].wallet_balance) || 0;

    if (costUSD > currentUSD + 0.001) {
      return res.status(402).json({
        error: `Insufficient balance. You need ₦${Math.round(costUSD * USD_TO_NGN).toLocaleString('en-NG')} but have ₦${Math.round(currentUSD * USD_TO_NGN).toLocaleString('en-NG')}.`,
      });
    }

    // Deduct BEFORE calling provider
    const newUSD    = parseFloat(Math.max(0, currentUSD - costUSD).toFixed(6));
    const deductRes = await fetch(`${SUPA_URL}/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...supaHdr(svcKey), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ wallet_balance: newUSD }),
    });
    if (!deductRes.ok) {
      return res.status(502).json({ error: 'Could not update wallet. Please try again.' });
    }

    // Call AccsZone
    let providerData;
    try {
      const upstream = await fetch(`${BASE}/purchase`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ad_id, quantity: quantity || 1 }),
      });
      providerData = await upstream.json();
    } catch {
      // Unreachable — refund
      await fetch(`${SUPA_URL}/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { ...supaHdr(svcKey), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ wallet_balance: currentUSD }),
      });
      return res.status(502).json({ error: 'Could not reach provider. Your balance has been refunded.' });
    }

    if (providerData?.error || providerData?.success === false) {
      // Provider rejected — refund
      await fetch(`${SUPA_URL}/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { ...supaHdr(svcKey), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ wallet_balance: currentUSD }),
      });
      const msg = providerData?.message || (typeof providerData?.error === 'string' ? providerData.error : '') || 'Purchase failed';
      return res.status(400).json({ ...providerData, error: msg + '. Your balance has been refunded.' });
    }

    // Save order record (non-fatal)
    const data        = providerData?.data ?? providerData;
    const orderId     = data?.order_id || data?.id || null;
    const credentials = data?.credentials || data?.account || null;
    const accounts    = Array.isArray(data?.accounts) ? data.accounts : null;

    await fetch(`${SUPA_URL}/account_orders`, {
      method: 'POST',
      headers: { ...supaHdr(svcKey), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id:           userId,
        provider_order_id: String(orderId || ''),
        offer_id:          String(ad_id),
        offer_title:       offer_title || '',
        platform:          params.platform || null,
        offer_slug:        offer_slug || null,
        price_usd:         costUSD,
        price_ngn:         price_ngn || Math.round(costUSD * USD_TO_NGN),
        status:            (credentials || (accounts && accounts.length)) ? 'complete' : 'pending',
        credentials:       credentials || (accounts ? accounts[0] : null) || null,
      }),
    }).catch(() => {});

    return res.status(200).json({ ...providerData, newBalanceUSD: newUSD });
  }

  /* ── STANDARD PROXY ──────────────────────────────────────────────────── */
  if (!action || !ALL_ALLOWED.has(action)) {
    return res.status(400).json({ error: 'Invalid or missing action' });
  }

  const path    = buildPath(action, params);
  const headers = { 'X-API-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };

  try {
    let upstream;
    if (GET_ACTIONS.has(action)) {
      const { id: _id, slug: _slug, ...qParams } = params;
      const qs = Object.keys(qParams).length ? '?' + new URLSearchParams(qParams).toString() : '';
      upstream = await fetch(`${BASE}${path}${qs}`, { headers });
    } else {
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
