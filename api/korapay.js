// Korapay payment handler — bank transfer only
// userId is embedded in metadata so no DB schema change is needed.
const KORA_BASE  = 'https://api.korapay.com/merchant/api/v1';
const SUPA_URL   = 'https://puutwycvshayqoozwfwv.supabase.co/rest/v1';
const USD_TO_NGN = 1600;

function supaHdr(key) {
  return { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function supaGet(key, path) {
  const r = await fetch(`${SUPA_URL}${path}`, { headers: supaHdr(key) });
  return r.json();
}
async function supaPost(key, path, body, prefer = 'return=minimal') {
  return fetch(`${SUPA_URL}${path}`, {
    method: 'POST',
    headers: { ...supaHdr(key), 'Prefer': prefer },
    body: JSON.stringify(body),
  });
}
async function supaPatch(key, path, body) {
  return fetch(`${SUPA_URL}${path}`, {
    method: 'PATCH',
    headers: { ...supaHdr(key), 'Prefer': 'return=minimal' },
    body: JSON.stringify(body),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  const secretKey = process.env.KORAPAY_SECRET_KEY;
  if (!secretKey) return res.status(503).json({ error: 'Payment gateway not configured' });

  const { action, ...params } = req.body || {};

  /* ─── INITIALIZE ─────────────────────────────────────── */
  if (action === 'initialize') {
    const { amount, email, name, userId } = params;
    if (!amount || amount < 3000) return res.status(400).json({ error: 'Minimum amount is ₦3,000' });
    if (!email || !userId)        return res.status(400).json({ error: 'Missing email or userId' });

    const reference = `BNS-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const appUrl    = 'https://blowupsocial.vercel.app';

    const koraBody = {
      reference,
      amount,
      currency: 'NGN',
      customer: { email, name: name || email },
      channels: ['bank_transfer'],
      notification_url: `${appUrl}/api/korapay-webhook`,
      metadata: { user_id: userId, amount_ngn: amount }, // comes back in webhook
    };

    let koraRes;
    try {
      koraRes = await fetch(`${KORA_BASE}/charges/initialize`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(koraBody),
      });
    } catch (e) {
      return res.status(502).json({ error: 'Could not reach Korapay', detail: e.message });
    }

    const kd = await koraRes.json();
    if (!kd.status) return res.status(502).json({ error: kd.message || 'Korapay rejected the request' });

    // Log pending fund_request (non-fatal — works with existing schema)
    const svcKey = process.env.SUPABASE_SERVICE_KEY;
    if (svcKey) {
      await supaPost(svcKey, '/fund_requests', {
        user_id: userId, amount, method: 'Bank Transfer', status: 'pending',
      }).catch(() => {});
    }

    return res.status(200).json({
      reference,
      checkoutUrl: kd.data?.checkout_url,
    });
  }

  /* ─── VERIFY (polling) ───────────────────────────────── */
  if (action === 'verify') {
    const { reference, userId, amount } = params;
    if (!reference) return res.status(400).json({ error: 'Missing reference' });

    let verifyRes;
    try {
      verifyRes = await fetch(`${KORA_BASE}/charges/${reference}`, {
        headers: { 'Authorization': `Bearer ${secretKey}` },
      });
    } catch (e) {
      return res.status(502).json({ error: 'Could not reach Korapay', detail: e.message });
    }

    const vd = await verifyRes.json();
    const status = vd.data?.status;

    if (status === 'success' && userId) {
      const svcKey = process.env.SUPABASE_SERVICE_KEY;
      if (svcKey) await creditWallet(svcKey, userId, amount || vd.data?.amount, reference);
    }

    return res.status(200).json({ status, amount: vd.data?.amount });
  }

  return res.status(400).json({ error: 'Invalid action' });
}

// Credit wallet — idempotent: marks oldest pending fund_request completed then adds balance
export async function creditWallet(svcKey, userId, amountNGN, reference) {
  // Find the oldest pending Bank Transfer request for this user
  const frs = await supaGet(
    svcKey,
    `/fund_requests?user_id=eq.${userId}&status=eq.pending&method=eq.Bank%20Transfer&order=created_at.asc&limit=1&select=id,amount`
  );

  const addUSD = (amountNGN || 0) / USD_TO_NGN;

  if (Array.isArray(frs) && frs.length > 0) {
    const fr = frs[0];
    // Mark this fund_request completed
    await supaPatch(svcKey, `/fund_requests?id=eq.${fr.id}`, { status: 'completed' });
  } else {
    // No pending request found — insert a completed one for the record
    await supaPost(svcKey, '/fund_requests', {
      user_id: userId, amount: amountNGN, method: 'Bank Transfer', status: 'completed',
    }).catch(() => {});
  }

  // Credit wallet
  const profiles = await supaGet(svcKey, `/profiles?id=eq.${userId}&select=wallet_balance&limit=1`);
  if (Array.isArray(profiles) && profiles.length > 0) {
    const current = parseFloat(profiles[0].wallet_balance) || 0;
    await supaPatch(svcKey, `/profiles?id=eq.${userId}`, { wallet_balance: current + addUSD });
  }
}
