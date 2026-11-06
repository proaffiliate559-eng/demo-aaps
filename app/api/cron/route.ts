import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import { fail, json } from '@/lib/api';

// Daily jobs. Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>"
// (see vercel.json). Uses the service role, so the secret check is essential.
export async function GET(request: Request) {
  const given = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${serverEnv.cronSecret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return fail('forbidden', 'Forbidden', 403);

  const admin = createAdminClient();
  const results: Record<string, number | string> = {};
  for (const job of ['job_expire_redemptions', 'job_birthday_rewards', 'job_expire_points'] as const) {
    const { data, error } = await admin.rpc(job);
    results[job] = error ? `error: ${error.message}` : Number(data ?? 0);
  }
  return json({ ok: true, results, at: new Date().toISOString() });
}
