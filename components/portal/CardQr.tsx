'use client';
import { useCallback, useEffect, useState } from 'react';
import QrImage from '@/components/QrImage';

// Shows a signed QR that expires after 2 minutes and refreshes every 60 s.
// A screenshot therefore stops working quickly.
export default function CardQr({ slug, memberLabel }: { slug: string; memberLabel: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/customer/qr-token?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? 'error');
      setToken(j.token);
      setError(null);
    } catch (e) {
      setError(e instanceof Error && e.message !== 'error' ? e.message : 'Could not load your QR. Check your internet.');
    }
  }, [slug]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {token ? <QrImage value={token} size={220} label="Your member QR code" /> : <div className="h-[220px] w-[220px] animate-pulse rounded-xl bg-ground" />}
      <span className="font-display text-lg font-bold tracking-wider">{memberLabel}</span>
      {error ? <span className="text-sm font-semibold text-bad">{error}</span>
        : <span className="text-xs text-muted">Show this at the counter. It refreshes every minute.</span>}
    </div>
  );
}
