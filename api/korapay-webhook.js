// Korapay webhook — credits wallet on charge.success
// userId is read from Korapay metadata (embedded at charge creation) — no DB schema change needed.
import crypto from 'crypto';
import { creditWallet } from './korapay.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const encKey = process.env.KORAPAY_ENCRYPTION_KEY || process.env.KORAPAY_SECRET_KEY;
  const svcKey = process.env.SUPABASE_SERVICE_KEY;

  // Verify Korapay HMAC-SHA256 signature
  // Only verify when body is still raw string — Vercel auto-parses JSON so
  // JSON.stringify(req.body) doesn't reproduce the exact original payload.
  const sig = req.headers['x-korapay-signature'];
  if (sig && encKey && typeof req.body === 'string') {
    const expected = crypto.createHmac('sha256', encKey).update(req.body).digest('hex');
    if (sig !== expected) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }

  const { event, data } = req.body || {};

  if (event === 'charge.success' && svcKey) {
    const userId    = data?.metadata?.user_id;
    const amountNGN = data?.metadata?.amount_ngn || data?.amount;
    const reference = data?.reference;

    if (userId && amountNGN) {
      const bonus = Number(amountNGN) === 20000 ? 2000 : 0;
      await creditWallet(svcKey, userId, Number(amountNGN) + bonus, reference);
    }
  }

  return res.status(200).json({ received: true });
}
