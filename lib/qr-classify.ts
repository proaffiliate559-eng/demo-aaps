// Browser-safe: tells the cashier scanner what kind of QR was scanned.
// (Kept apart from qr-token.ts, which uses node:crypto and runs on the server.)
export const CUSTOMER_TOKEN_PREFIX = 'CR1';

// What a scanned QR string is. Redemption QRs carry "CR:R:<CODE>".
export type ScannedQr =
  | { kind: 'customer'; token: string }
  | { kind: 'redemption'; code: string }
  | { kind: 'url'; url: string }
  | { kind: 'unknown' };

export function classifyScan(raw: string): ScannedQr {
  const s = String(raw || '').trim();
  if (s.startsWith(`${CUSTOMER_TOKEN_PREFIX}.`)) return { kind: 'customer', token: s };
  const m = s.match(/^CR:R:([A-Z0-9]{8})$/);
  if (m) return { kind: 'redemption', code: m[1] };
  if (/^[A-HJ-NP-Z2-9]{8}$/.test(s.toUpperCase())) return { kind: 'redemption', code: s.toUpperCase() };
  if (/^https?:\/\//i.test(s)) return { kind: 'url', url: s };
  return { kind: 'unknown' };
}
