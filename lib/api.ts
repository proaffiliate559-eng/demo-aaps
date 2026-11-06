import 'server-only';
import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { toAppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export const fail = (code: string, message: string, status = 400) => json({ error: { code, message } }, status);
export const fromDbError = (err: unknown) => {
  const e = toAppError(err);
  if (e.status >= 500) console.error('[db]', err);
  return fail(e.code, e.message, e.status);
};

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<{ data: T } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { response: fail('bad_request', 'Invalid JSON body') };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { response: fail('validation', parsed.error.issues[0]?.message ?? 'Invalid input', 422) };
  return { data: parsed.data };
}

export function limit(key: string, max: number, windowMs: number) {
  return rateLimit(key, max, windowMs).ok ? null : fail('rate_limited', 'Too many requests. Please slow down.', 429);
}

// Only same-origin browser requests may call our JSON APIs (CSRF defence in
// addition to SameSite cookies).
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}
