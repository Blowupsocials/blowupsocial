const SUPABASE_URL = 'https://puutwycvshayqoozwfwv.supabase.co';
const FROM        = 'BlowUpSocials <support@blowupsocials.net>';
const ADMIN_EMAIL = 'blowupsocialsconsult@gmail.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { segment, subject, preview, heading, body, ctaLabel, ctaUrl, adminEmail, countOnly } = req.body || {};

  if (adminEmail !== ADMIN_EMAIL) return res.status(403).json({ error: 'Not authorized' });
  if (!segment)                   return res.status(400).json({ error: 'Missing segment' });
  if (!countOnly && (!subject || !body)) return res.status(400).json({ error: 'Missing subject or body' });

  const svcKey   = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  let recipients;
  try {
    recipients = await getSegment(segment, svcKey);
  } catch (err) {
    return res.status(500).json({ error: `Segment query failed: ${err.message}` });
  }

  if (countOnly) return res.json({ count: recipients.length });

  // Send in batches of 100 (Resend batch limit)
  const BATCH = 100;
  let sent = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += BATCH) {
    const slice  = recipients.slice(i, i + BATCH);
    const emails = slice.map(r => ({
      from:    FROM,
      to:      r.email,
      subject,
      html:    buildHtml({ name: r.full_name || r.email.split('@')[0], preview, heading, body, ctaLabel, ctaUrl }),
    }));

    try {
      const resp   = await fetch('https://api.resend.com/emails/batch', {
        method:  'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(emails),
      });
      const result = await resp.json();
      if (!resp.ok) errors.push(result);
      else sent += slice.length;
    } catch (err) {
      errors.push(err.message);
    }
  }

  return res.json({ sent, total: recipients.length, ...(errors.length ? { errors } : {}) });
}

/* ── Segment queries ──────────────────────────────────────────── */
async function supaFetch(path, svcKey) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}`, Range: '0-9999' },
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

async function getSegment(segment, svcKey) {
  if (segment === 'all') {
    return supaFetch('profiles?select=email,full_name&email=not.is.null', svcKey);
  }
  if (segment === 'wallet') {
    return supaFetch('profiles?select=email,full_name&wallet_balance=gt.0&email=not.is.null', svcKey);
  }

  let ids;
  if (segment === 'smm') {
    const rows = await supaFetch('orders?select=user_id&status=neq.Cancelled', svcKey);
    ids = [...new Set(rows.map(r => r.user_id))];
  } else if (segment === 'accounts') {
    const rows = await supaFetch('account_orders?select=user_id&status=neq.refunded', svcKey);
    ids = [...new Set(rows.map(r => r.user_id))];
  } else if (segment === 'paid') {
    const [smm, acct] = await Promise.all([
      supaFetch('orders?select=user_id&status=neq.Cancelled', svcKey),
      supaFetch('account_orders?select=user_id&status=neq.refunded', svcKey),
    ]);
    ids = [...new Set([...smm.map(r => r.user_id), ...acct.map(r => r.user_id)])];
  } else {
    throw new Error('Unknown segment: ' + segment);
  }

  if (!ids.length) return [];
  return supaFetch(`profiles?select=email,full_name&id=in.(${ids.join(',')})&email=not.is.null`, svcKey);
}

/* ── Email template ───────────────────────────────────────────── */
function buildHtml({ name, preview, heading, body, ctaLabel, ctaUrl }) {
  const safeBody = (body || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\{\{name\}\}/g, name)
    .replace(/\n\n/g, '</p><p style="color:#4b5063;font-size:0.9rem;line-height:1.6;margin:0 0 16px">')
    .replace(/\n/g, '<br>');

  const safeHeading = heading
    ? heading.replace(/\{\{name\}\}/g, name)
    : '';

  const cta = ctaLabel && ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;font-weight:700;font-size:0.88rem;padding:13px 28px;border-radius:9px;text-decoration:none;margin-top:16px">${ctaLabel} →</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f4f4f8;font-family:Inter,Arial,sans-serif">
${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px">${preview}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8eaf0">
  <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:32px 40px">
    <div style="font-size:1.4rem;font-weight:800;color:#fff;letter-spacing:-0.5px">BlowUpSocials</div>
    <div style="font-size:0.8rem;color:rgba(255,255,255,0.7);margin-top:2px">SMM Panel &amp; Digital Store</div>
  </div>
  <div style="padding:36px 40px">
    ${safeHeading ? `<h1 style="font-size:1.25rem;font-weight:700;color:#0f0e1c;margin:0 0 16px">${safeHeading}</h1>` : ''}
    <p style="color:#4b5063;font-size:0.9rem;line-height:1.6;margin:0 0 16px">${safeBody}</p>
    ${cta}
  </div>
  <div style="padding:20px 40px;border-top:1px solid #e8eaf0;background:#f8f9fc">
    <p style="font-size:0.75rem;color:#8b8fa8;margin:0">
      Questions? Email <a href="mailto:support@blowupsocials.net" style="color:#7c3aed">support@blowupsocials.net</a>
      &middot; <a href="https://blowupsocials.net" style="color:#7c3aed">blowupsocials.net</a>
    </p>
  </div>
</div>
</body></html>`;
}
