/**
 * Daily keep-alive, hit by the Vercel cron in vercel.json.
 *
 * Free-tier Supabase pauses a project after 7 days without API traffic, and a
 * paused project makes every sign-in fail with "Failed to fetch". One cheap
 * PostgREST read a day counts as activity and keeps it awake. RLS returns no
 * rows to the anon key, which is fine — the request still reaches Postgres.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: false, error: 'Supabase not configured' }, { status: 500 });

  const res = await fetch(`${url}/rest/v1/habits?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  return Response.json({ ok: res.ok, status: res.status, at: new Date().toISOString() }, { status: res.ok ? 200 : 502 });
}
