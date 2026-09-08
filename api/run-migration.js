// ONE-TIME migration endpoint — DELETE after use
const SUPABASE_URL = 'https://puutwycvshayqoozwfwv.supabase.co';
const SQL = `
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  to_email TEXT NOT NULL,
  name TEXT,
  send_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_queue' AND policyname = 'authenticated_insert'
  ) THEN
    CREATE POLICY authenticated_insert ON public.email_queue
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END
$body$;
`;

export default async function handler(req, res) {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'No service key' });

  try {
    // Use Supabase's internal Management API via service key
    const mgmtRes = await fetch(
      `https://api.supabase.com/v1/projects/puutwycvshayqoozwfwv/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: SQL }),
      }
    );
    const mgmtBody = await mgmtRes.text();

    if (mgmtRes.ok) {
      return res.status(200).json({ success: true, method: 'management-api' });
    }

    // Fallback: try Supabase pg meta endpoint
    const pgRes = await fetch(
      `${SUPABASE_URL}/pg/query`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: SQL }),
      }
    );
    const pgBody = await pgRes.text();

    return res.status(200).json({
      mgmt: { status: mgmtRes.status, body: mgmtBody.slice(0, 300) },
      pg:   { status: pgRes.status,   body: pgBody.slice(0, 300) },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
