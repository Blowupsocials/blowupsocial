const PIXEL_ID = 'DAGMGFJC77UC8FLJUHS0';
const ACCESS_TOKEN = 'a81f5ce4344e83deb89edcc9aeb96eb22e5d4e89';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { event, user = {}, properties = {}, event_id, page_url } = req.body || {};
  if (!event) return res.status(400).json({ error: 'Missing event' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '';
  const ua  = req.headers['user-agent'] || '';

  const payload = {
    pixel_code: PIXEL_ID,
    event,
    event_time: Math.floor(Date.now() / 1000),
    event_id:   event_id || `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user: {
      ...(user.email       && { email:        user.email }),
      ...(user.phone       && { phone_number: user.phone }),
      ...(user.external_id && { external_id:  user.external_id }),
      ip,
      user_agent: ua,
      ...(user.ttclid && { ttclid: user.ttclid }),
      ...(user.ttp    && { ttp:    user.ttp }),
    },
    page:       { url: page_url || '' },
    properties: properties || {},
  };

  try {
    const r    = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method:  'POST',
      headers: { 'Access-Token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
