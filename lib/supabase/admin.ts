import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

// Service-role client: bypasses RLS. Use ONLY in trusted server code that has
// already authorised the caller (cron jobs, webhooks). Never import from a
// client component.
export function createAdminClient() {
  return createSupabaseClient(serverEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
