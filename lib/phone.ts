// Mirrors private.normalize_phone in the database. Indian numbers by default.
export function normalizePhone(input: string): string | null {
  const raw = String(input ?? '').trim();
  const d = raw.replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]/.test(d)) return `+91${d}`;
  if (d.length === 12 && d.startsWith('91') && /^[6-9]/.test(d.slice(2))) return `+${d}`;
  if (raw.startsWith('+') && d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}

// '+919876543210' → '+91 98•••••210'
export function maskPhone(e164: string): string {
  const d = String(e164 ?? '').replace(/\D/g, '');
  if (d.length < 10) return e164;
  const cc = d.slice(0, d.length - 10);
  const local = d.slice(-10);
  return `${cc ? '+' + cc + ' ' : ''}${local.slice(0, 2)}•••••${local.slice(-3)}`;
}
