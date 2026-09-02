const PEAKERR_URL = 'https://peakerr.com/api/v2';

const ALLOWED_ACTIONS = ['services', 'balance', 'add', 'status', 'refill', 'refill_status', 'cancel'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.PEAKERR_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'API key not configured on server' }); return; }

  const { action, ...params } = req.body || {};

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    res.status(400).json({ error: 'Invalid or missing action' });
    return;
  }

  const form = new URLSearchParams();
  form.append('key', apiKey);
  form.append('action', action);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') form.append(k, String(v));
  }

  try {
    const r = await fetch(PEAKERR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });

    if (!r.ok) {
      res.status(502).json({ error: `Peakerr returned ${r.status}` });
      return;
    }

    const data = await r.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach Peakerr', detail: err.message });
  }
}
