export const inr = (n: number | string | null | undefined) =>
  '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const num = (n: number | string | null | undefined) => Number(n ?? 0).toLocaleString('en-IN');

export function shortDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export function dateTime(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export function daysAgo(d: string | Date | null | undefined) {
  if (!d) return 'Never';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export const TXN_LABEL: Record<string, string> = {
  earn_points: 'Points earned',
  redeem_points: 'Points used',
  earn_stamps: 'Stamp collected',
  redeem_stamps: 'Stamps used',
  earn_cashback: 'Cashback earned',
  redeem_cashback: 'Cashback used',
  signup_bonus: 'Welcome bonus',
  referral_bonus: 'Referral bonus',
  birthday_bonus: 'Birthday bonus',
  adjustment: 'Adjustment',
  expiry: 'Points expired',
  refund: 'Returned',
};
