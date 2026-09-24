const OWLET_URL  = 'https://therealowlet.com/api/v2';
const SUPA_URL   = 'https://puutwycvshayqoozwfwv.supabase.co/rest/v1';
const SUPA_AUTH  = 'https://puutwycvshayqoozwfwv.supabase.co/auth/v1';
const USD_TO_NGN = 1600;

const ALLOWED_ACTIONS = ['services', 'balance', 'add', 'status', 'refill', 'refill_status', 'cancel'];

function supaHdr(key) {
  return { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function owletCall(apiKey, action, params) {
  const form = new URLSearchParams();
  form.append('key', apiKey);
  form.append('action', action);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') form.append(k, String(v));
  }
  const r = await fetch(OWLET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!r.ok) throw new Error(`Owlet returned ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.OWLET_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

  const { action, ...params } = req.body || {};

  /* ── SECURE ORDER PLACEMENT ──────────────────────────────────────────────
     action = 'place_order': verifies auth server-side, checks balance in
     Supabase, deducts BEFORE calling Owlet, refunds if Owlet rejects.
     Prevents free orders when the client session expires mid-flow.        */
  if (action === 'place_order') {
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

    const { service, serviceName, link, quantity, costNGN } = params;
    if (!service || !link || !quantity || !costNGN) {
      return res.status(400).json({ error: 'Missing order fields' });
    }
    const costUSD = parseFloat((Number(costNGN) / USD_TO_NGN).toFixed(6));

    // Read wallet balance
    const profRes  = await fetch(`${SUPA_URL}/profiles?id=eq.${userId}&select=wallet_balance&limit=1`, {
      headers: supaHdr(svcKey),
    });
    const profiles = await profRes.json();
    if (!Array.isArray(profiles) || !profiles.length) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const currentUSD = parseFloat(profiles[0].wallet_balance) || 0;
    const currentNGN = currentUSD * USD_TO_NGN;

    if (Number(costNGN) > currentNGN + 1) { // +1 for rounding tolerance
      return res.status(402).json({
        error: `Insufficient balance. You need ₦${Math.round(costNGN).toLocaleString('en-NG')} but have ₦${Math.round(currentNGN).toLocaleString('en-NG')}.`,
      });
    }

    // Deduct BEFORE placing (prevents race conditions / free orders)
    const newUSD = parseFloat(Math.max(0, currentUSD - costUSD).toFixed(6));
    const deductRes = await fetch(`${SUPA_URL}/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...supaHdr(svcKey), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ wallet_balance: newUSD }),
    });
    if (!deductRes.ok) {
      return res.status(502).json({ error: 'Could not update wallet. Please try again.' });
    }

    // Place on Owlet
    let owletData;
    try {
      owletData = await owletCall(apiKey, 'add', { service, link, quantity });
    } catch {
      // Unreachable — refund
      await fetch(`${SUPA_URL}/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { ...supaHdr(svcKey), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ wallet_balance: currentUSD }),
      });
      return res.status(502).json({ error: 'Could not reach order provider. Your balance has been refunded.' });
    }

    if (owletData.error || !owletData.order) {
      // Rejected — refund
      await fetch(`${SUPA_URL}/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { ...supaHdr(svcKey), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ wallet_balance: currentUSD }),
      });
      return res.status(400).json({ error: owletData.error || 'Order was rejected by provider. Your balance has been refunded.' });
    }

    // Save order record (non-fatal)
    await fetch(`${SUPA_URL}/orders`, {
      method: 'POST',
      headers: { ...supaHdr(svcKey), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id:   userId,
        order_ref: `BUS-${owletData.order}`,
        service:   serviceName || 'Social Boost',
        link,
        quantity:  Number(quantity),
        amount:    costUSD,
        status:    'Pending',
      }),
    }).catch(() => {});

    return res.status(200).json({
      order:         owletData.order,
      newBalanceNGN: parseFloat((newUSD * USD_TO_NGN).toFixed(2)),
    });
  }

  /* ── STANDARD OWLET PROXY ────────────────────────────────────────────── */
  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return res.status(400).json({ error: 'Invalid or missing action' });
  }

  try {
    const data = await owletCall(apiKey, action, params);
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Owlet', detail: err.message });
  }
}
