// Signed, short-lived customer identity tokens for the loyalty-card QR.
// Format: CR1.<base64url(payload)>.<base64url(hmac-sha256)>
// payload = { t: tenantId, c: customerId, e: expiryUnixSeconds, n: nonce }
// Pure Node crypto, no framework imports, so it is unit-testable.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const QR_TOKEN_PREFIX = 'CR1';
export const QR_TOKEN_TTL_SECONDS = 120;

export interface QrTokenPayload {
  t: string;
  c: string;
  e: number;
  n: string;
}

export type VerifyResult =
  | { ok: true; tenantId: string; customerId: string; expiresAt: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'wrong_tenant' };

const b64url = (buf: Buffer) => buf.toString('base64url');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(data: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(data).digest());
}

function assertSecret(secret: string) {
  if (!secret || secret.length < 32) throw new Error('QR_TOKEN_SECRET must be at least 32 characters');
}

export function createQrToken(
  tenantId: string,
  customerId: string,
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = QR_TOKEN_TTL_SECONDS,
): { token: string; expiresAt: number } {
  assertSecret(secret);
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(customerId)) throw new Error('invalid ids');
  const payload: QrTokenPayload = {
    t: tenantId,
    c: customerId,
    e: Math.floor(nowMs / 1000) + ttlSeconds,
    n: b64url(randomBytes(6)),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const data = `${QR_TOKEN_PREFIX}.${body}`;
  return { token: `${data}.${sign(data, secret)}`, expiresAt: payload.e };
}

export function verifyQrToken(
  token: string,
  secret: string,
  expectedTenantId?: string,
  nowMs: number = Date.now(),
): VerifyResult {
  assertSecret(secret);
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== QR_TOKEN_PREFIX) return { ok: false, reason: 'malformed' };
  const data = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(data, secret));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'bad_signature' };

  let payload: QrTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!payload || !UUID_RE.test(payload.t) || !UUID_RE.test(payload.c) || typeof payload.e !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  if (payload.e < Math.floor(nowMs / 1000)) return { ok: false, reason: 'expired' };
  if (expectedTenantId && payload.t !== expectedTenantId) return { ok: false, reason: 'wrong_tenant' };
  return { ok: true, tenantId: payload.t, customerId: payload.c, expiresAt: payload.e };
}
