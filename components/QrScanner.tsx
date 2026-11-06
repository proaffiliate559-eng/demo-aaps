'use client';
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Button } from '@/components/ui';

interface BarcodeDetectorLike { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }
declare global {
  interface Window { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }
}

async function decode(canvas: HTMLCanvasElement): Promise<string | null> {
  if (window.BarcodeDetector) {
    try {
      const r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(canvas);
      if (r[0]?.rawValue) return r[0].rawValue;
    } catch { /* fall back to jsQR */ }
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

// Camera QR scanner with a photo-upload fallback (camera may be blocked).
export default function QrScanner({ onResult, onClose, title }: { onResult: (text: string) => void; onClose: () => void; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [msg, setMsg] = useState('Point the camera at the QR code');
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const canvas = document.createElement('canvas');
    let busy = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        timer = setInterval(async () => {
          if (busy || done.current || !v.videoWidth) return;
          busy = true;
          const s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
          canvas.width = Math.round(v.videoWidth * s);
          canvas.height = Math.round(v.videoHeight * s);
          canvas.getContext('2d', { willReadFrequently: true })?.drawImage(v, 0, 0, canvas.width, canvas.height);
          const text = await decode(canvas);
          busy = false;
          if (text && !done.current) { done.current = true; onResult(text); }
        }, 300);
      } catch {
        setCamError('Camera not available. Allow camera access, or upload a photo of the QR.');
      }
    })();
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  async function fromFile(file: File) {
    setMsg('Reading photo…');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      const c = document.createElement('canvas');
      const s = Math.min(1, 1200 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const text = await decode(c);
      if (text) { done.current = true; onResult(text); } else setMsg('No QR found in that photo. Try a closer, sharper photo.');
    };
    img.src = url;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex w-full max-w-md flex-col gap-3 rounded-[28px] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close scanner" className="h-11 w-11 rounded-full border border-line">✕</button>
        </div>
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-ink">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <div aria-hidden className="absolute inset-[18%] rounded-2xl border-[3px] border-accent" />
          {camError && <div className="absolute inset-0 flex items-center justify-center bg-ink p-6 text-center text-sm text-white">{camError}</div>}
        </div>
        <p aria-live="polite" className="text-sm font-semibold text-muted">{msg}</p>
        <label className="inline-flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line font-semibold">
          Upload a photo of the QR
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && fromFile(e.target.files[0])} />
        </label>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
