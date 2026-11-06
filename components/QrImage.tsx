'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Renders any text as a QR image in the browser.
export default function QrImage({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 2, width: size * 2, color: { dark: '#1B1B1F', light: '#FFFFFF' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => { alive = false; };
  }, [value, size]);
  if (!src) return <div style={{ width: size, height: size }} className="animate-pulse rounded-xl bg-ground" aria-label={`${label} loading`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={label} className="rounded-xl" style={{ imageRendering: 'pixelated' }} />;
}
