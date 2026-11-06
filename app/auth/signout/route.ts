import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  const form = await request.formData().catch(() => null);
  const to = String(form?.get('to') || '/login');
  return NextResponse.redirect(new URL(to.startsWith('/') && !to.startsWith('//') ? to : '/login', request.url), { status: 303 });
}
