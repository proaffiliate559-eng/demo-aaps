import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';

// Printed QR codes point here: /q/<code>. We count the scan, then send the
// visitor to the cafe's portal with the branch and QR id for attribution.
export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const code = String(params.code || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  const origin = new URL(request.url).origin;
  if (!code) return NextResponse.redirect(new URL('/', origin));
  if (!rateLimit(`qr:${clientIp(request.headers)}`, 30, 60_000).ok) {
    return new NextResponse('Too many scans. Please wait a minute.', { status: 429 });
  }

  const supabase = createClient();
  const { data } = await supabase.rpc('track_qr_scan', { p_code: code, p_user_agent: request.headers.get('user-agent') });
  const info = data as { tenant_slug: string; branch_id: string | null; qr_id: string } | null;
  if (!info) return NextResponse.redirect(new URL('/?qr=invalid', origin));

  const target = new URL(`/c/${info.tenant_slug}`, origin);
  if (info.branch_id) target.searchParams.set('b', info.branch_id);
  target.searchParams.set('qr', info.qr_id);
  return NextResponse.redirect(target, { status: 302 });
}
