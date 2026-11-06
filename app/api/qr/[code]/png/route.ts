import { NextResponse, type NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { serverEnv } from '@/lib/env';

// PNG of a printed QR (/q/<code>). The QR only contains a public URL, so this
// endpoint does not need a login. ?download=1 forces a file download.
export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const code = String(params.code || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  if (code.length < 6) return NextResponse.json({ error: 'bad code' }, { status: 400 });
  const size = Math.min(2000, Math.max(200, Number(new URL(request.url).searchParams.get('size')) || 1024));
  const png = await QRCode.toBuffer(`${serverEnv.appUrl}/q/${code}`, {
    errorCorrectionLevel: 'M', margin: 2, width: size, color: { dark: '#1B1B1F', light: '#FFFFFF' },
  });
  const download = new URL(request.url).searchParams.get('download') === '1';
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
      ...(download ? { 'Content-Disposition': `attachment; filename="qr-${code}.png"` } : {}),
    },
  });
}
