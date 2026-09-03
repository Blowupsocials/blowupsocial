const BASE = 'https://accsmaster.com/api/v1';

// Module-level token cache — persists across warm Vercel invocations
let _token  = null;
let _expiry = 0;

async function getToken() {
  if (_token && Date.now() < _expiry) return _token;

  const email    = process.env.ACCSMASTER_EMAIL;
  const password = process.env.ACCSMASTER_PASSWORD;
  if (!email || !password) throw new Error('NOT_CONFIGURED');

  const r = await fetch(`${BASE}/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Auth failed (${r.status}): ${body}`);
  }

  const data = await r.json();
  if (!data.token) throw new Error('No token in auth response');

  _token  = data.token;
  _expiry = Date.now() + 22 * 60 * 60 * 1000; // 22 h — refresh before 24 h expiry
  return _token;
}

const GET_ACTIONS  = new Set(['categories', 'offers', 'offer', 'orders', 'order']);
const POST_ACTIONS = new Set(['buy']);
const ALL_ALLOWED  = new Set([...GET_ACTIONS, ...POST_ACTIONS]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { action, ...params } = req.body || {};
  if (!action || !ALL_ALLOWED.has(action)) {
    return res.status(400).json({ error: 'Invalid or missing action' });
  }

  try {
    const token = await getToken();

    let upstream;
    if (GET_ACTIONS.has(action)) {
      const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
      upstream = await fetch(`${BASE}/${action}${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      upstream = await fetch(`${BASE}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(params),
      });
    }

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      return res.status(502).json({ error: `Upstream returned ${upstream.status}`, detail: body });
    }

    const data = await upstream.json();
    res.status(200).json(data);
  } catch (err) {
    if (err.message === 'NOT_CONFIGURED') {
      return res.status(503).json({ error: 'accounts_not_configured' });
    }
    res.status(500).json({ error: 'Request failed', detail: err.message });
  }
}
