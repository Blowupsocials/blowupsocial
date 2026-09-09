const SUPABASE_URL = 'https://puutwycvshayqoozwfwv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dXR3eWN2c2hheXFvb3p3Znd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTIwODcsImV4cCI6MjEwMzg2ODA4N30.1V5LAxx8fDSCFrgUtdo2PEn-FC5ZReRKK1usVADkFy0';
const ADMIN_EMAILS = ['blowupsocialsconsult@gmail.com'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.slice(7);

  // Verify caller is admin
  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON },
  });
  if (!meRes.ok) return res.status(401).json({ error: 'Invalid session' });
  const me = await meRes.json();
  if (!ADMIN_EMAILS.includes(me.email)) return res.status(403).json({ error: 'Forbidden' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  // Delete from auth.users using service role key
  const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, apikey: process.env.SUPABASE_SERVICE_KEY },
  });

  if (!delRes.ok) {
    const body = await delRes.json().catch(() => ({}));
    return res.status(delRes.status).json({ error: body.message || 'Delete failed' });
  }

  res.status(200).json({ success: true });
}
