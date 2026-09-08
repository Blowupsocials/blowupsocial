const SUPABASE_URL = 'https://puutwycvshayqoozwfwv.supabase.co';
const FROM = 'BlowUpSocials <support@blowupsocials.net>';

export default async function handler(req, res) {
  // Only allow GET/POST, no other methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const apiKey     = process.env.RESEND_API_KEY;

  if (!serviceKey || !apiKey) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const now = new Date().toISOString();
  const qRes = await fetch(
    `${SUPABASE_URL}/rest/v1/email_queue?select=*&sent_at=is.null&send_at=lte.${encodeURIComponent(now)}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!qRes.ok) {
    return res.status(500).json({ error: 'Queue query failed', status: qRes.status });
  }
  const emails = await qRes.json();

  let sent = 0;
  for (const row of emails) {
    try {
      const tpl = buildTemplate(row.type, { name: row.name });
      if (!tpl) continue;

      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [row.to_email], ...tpl }),
      });

      if (sendRes.ok) {
        await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${row.id}`, {
          method: 'PATCH',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ sent_at: new Date().toISOString() }),
        });
        sent++;
      }
    } catch (e) {
      console.error('email_queue error for', row.to_email, e.message);
    }
  }

  return res.status(200).json({ processed: emails.length, sent });
}

function buildTemplate(type, data) {
  if (type === 'welcome') {
    return {
      subject: 'Welcome to BlowUpSocials 🎉',
      html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8eaf0">
        <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:32px 40px">
          <div style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:-0.5px">BlowUpSocials</div>
          <div style="font-size:0.8rem;color:rgba(255,255,255,0.7);margin-top:2px">SMM Panel &amp; Digital Store</div>
        </div>
        <div style="padding:36px 40px">
          <h1 style="font-size:1.3rem;font-weight:700;color:#0f0e1c;margin:0 0 12px">Welcome, ${data.name || 'there'}! 👋</h1>
          <p style="color:#4b5063;font-size:0.9rem;line-height:1.6;margin:0 0 24px">Your BlowUpSocials account is ready. Start growing your social media presence today &mdash; explore our SMM services and digital store.</p>
          <a href="https://blowupsocials.net/dashboard" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;font-weight:700;font-size:0.88rem;padding:13px 28px;border-radius:9px;text-decoration:none">Go to Dashboard &rarr;</a>
        </div>
        <div style="padding:20px 40px;border-top:1px solid #e8eaf0;background:#f8f9fc">
          <p style="font-size:0.75rem;color:#8b8fa8;margin:0">Questions? Reply to this email or visit <a href="https://blowupsocials.net" style="color:#7c3aed">blowupsocials.net</a></p>
        </div>
      </div>`,
    };
  }
  return null;
}
