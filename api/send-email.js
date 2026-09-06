// Resend email proxy — all transactional emails go through here
const FROM = 'BlowUpSocials <support@blowupsocials.net>';

const TEMPLATES = {

  welcome: (data) => ({
    subject: 'Welcome to BlowUpSocials 🎉',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8eaf0">
        <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:32px 40px">
          <div style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:-0.5px">BlowUpSocials</div>
          <div style="font-size:0.8rem;color:rgba(255,255,255,0.7);margin-top:2px">SMM Panel &amp; Digital Store</div>
        </div>
        <div style="padding:36px 40px">
          <h1 style="font-size:1.3rem;font-weight:700;color:#0f0e1c;margin:0 0 12px">Welcome, ${data.name || 'there'}! 👋</h1>
          <p style="color:#4b5063;font-size:0.9rem;line-height:1.6;margin:0 0 24px">Your BlowUpSocials account is ready. Start growing your social media presence today — explore our SMM services and digital store.</p>
          <a href="https://blowupsocials.net/dashboard.html" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;font-weight:700;font-size:0.88rem;padding:13px 28px;border-radius:9px;text-decoration:none">Go to Dashboard →</a>
        </div>
        <div style="padding:20px 40px;border-top:1px solid #e8eaf0;background:#f8f9fc">
          <p style="font-size:0.75rem;color:#8b8fa8;margin:0">Questions? Reply to this email or visit <a href="https://blowupsocials.net" style="color:#7c3aed">blowupsocials.net</a></p>
        </div>
      </div>`,
  }),

  order_placed: (data) => ({
    subject: `Order Confirmed — #${(data.orderId || '').toString().slice(0,8).toUpperCase()}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8eaf0">
        <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:32px 40px">
          <div style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:-0.5px">BlowUpSocials</div>
        </div>
        <div style="padding:36px 40px">
          <h1 style="font-size:1.2rem;font-weight:700;color:#0f0e1c;margin:0 0 8px">Order Received ✅</h1>
          <p style="color:#4b5063;font-size:0.88rem;line-height:1.6;margin:0 0 24px">We've received your order and it's being processed. You'll get another update when it's completed.</p>
          <div style="background:#f8f9fc;border-radius:10px;padding:20px;margin-bottom:24px">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-size:0.8rem;color:#8b8fa8">Order ID</span><span style="font-size:0.8rem;font-weight:700;color:#0f0e1c">#${(data.orderId || '').toString().slice(0,8).toUpperCase()}</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-size:0.8rem;color:#8b8fa8">Service</span><span style="font-size:0.8rem;font-weight:600;color:#0f0e1c">${data.service || '—'}</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-size:0.8rem;color:#8b8fa8">Quantity</span><span style="font-size:0.8rem;font-weight:600;color:#0f0e1c">${Number(data.quantity || 0).toLocaleString()}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="font-size:0.8rem;color:#8b8fa8">Amount</span><span style="font-size:0.85rem;font-weight:800;color:#7c3aed">${data.amount || '—'}</span></div>
          </div>
          <a href="https://blowupsocials.net/dashboard.html" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;font-weight:700;font-size:0.88rem;padding:13px 28px;border-radius:9px;text-decoration:none">View Dashboard →</a>
        </div>
        <div style="padding:20px 40px;border-top:1px solid #e8eaf0;background:#f8f9fc">
          <p style="font-size:0.75rem;color:#8b8fa8;margin:0">Need help? Email <a href="mailto:support@blowupsocials.net" style="color:#7c3aed">support@blowupsocials.net</a></p>
        </div>
      </div>`,
  }),

  order_completed: (data) => ({
    subject: `Order Completed — #${(data.orderId || '').toString().slice(0,8).toUpperCase()} ✅`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8eaf0">
        <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:32px 40px">
          <div style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:-0.5px">BlowUpSocials</div>
        </div>
        <div style="padding:36px 40px">
          <h1 style="font-size:1.2rem;font-weight:700;color:#0f0e1c;margin:0 0 8px">Your order is complete 🎉</h1>
          <p style="color:#4b5063;font-size:0.88rem;line-height:1.6;margin:0 0 24px">Your order has been successfully delivered. Thank you for using BlowUpSocials!</p>
          <div style="background:#ecfdf5;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #d1fae5">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-size:0.8rem;color:#8b8fa8">Order ID</span><span style="font-size:0.8rem;font-weight:700;color:#0f0e1c">#${(data.orderId || '').toString().slice(0,8).toUpperCase()}</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-size:0.8rem;color:#8b8fa8">Service</span><span style="font-size:0.8rem;font-weight:600;color:#0f0e1c">${data.service || '—'}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="font-size:0.8rem;color:#8b8fa8">Status</span><span style="font-size:0.8rem;font-weight:700;color:#10b981">Completed</span></div>
          </div>
          <a href="https://blowupsocials.net/new-order.html" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;font-weight:700;font-size:0.88rem;padding:13px 28px;border-radius:9px;text-decoration:none">Place Another Order →</a>
        </div>
        <div style="padding:20px 40px;border-top:1px solid #e8eaf0;background:#f8f9fc">
          <p style="font-size:0.75rem;color:#8b8fa8;margin:0">Need help? Email <a href="mailto:support@blowupsocials.net" style="color:#7c3aed">support@blowupsocials.net</a></p>
        </div>
      </div>`,
  }),

  fund_approved: (data) => ({
    subject: 'Funds Added to Your Wallet ✅',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8eaf0">
        <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:32px 40px">
          <div style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:-0.5px">BlowUpSocials</div>
        </div>
        <div style="padding:36px 40px">
          <h1 style="font-size:1.2rem;font-weight:700;color:#0f0e1c;margin:0 0 8px">Wallet Funded 💰</h1>
          <p style="color:#4b5063;font-size:0.88rem;line-height:1.6;margin:0 0 24px">Your add-funds request has been approved and your wallet has been credited.</p>
          <div style="background:#f8f9fc;border-radius:10px;padding:20px;margin-bottom:24px">
            <div style="display:flex;justify-content:space-between"><span style="font-size:0.8rem;color:#8b8fa8">Amount Added</span><span style="font-size:1rem;font-weight:800;color:#10b981">${data.amount || '—'}</span></div>
          </div>
          <a href="https://blowupsocials.net/dashboard.html" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;font-weight:700;font-size:0.88rem;padding:13px 28px;border-radius:9px;text-decoration:none">Go to Dashboard →</a>
        </div>
        <div style="padding:20px 40px;border-top:1px solid #e8eaf0;background:#f8f9fc">
          <p style="font-size:0.75rem;color:#8b8fa8;margin:0">Need help? Email <a href="mailto:support@blowupsocials.net" style="color:#7c3aed">support@blowupsocials.net</a></p>
        </div>
      </div>`,
  }),
};

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Email not configured' }); return; }

  const { type, to, data = {} } = req.body || {};
  if (!type || !to) { res.status(400).json({ error: 'Missing type or to' }); return; }

  const tpl = TEMPLATES[type];
  if (!tpl) { res.status(400).json({ error: `Unknown email type: ${type}` }); return; }

  const { subject, html } = tpl(data);

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    const result = await r.json();
    if (!r.ok) { res.status(r.status).json({ error: result }); return; }
    res.status(200).json({ id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
