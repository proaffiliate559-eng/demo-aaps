import 'server-only';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. See .env.example`);
  return v;
}

export const serverEnv = {
  get supabaseUrl() { return required('NEXT_PUBLIC_SUPABASE_URL'); },
  get supabaseAnonKey() { return required('NEXT_PUBLIC_SUPABASE_ANON_KEY'); },
  get serviceRoleKey() { return required('SUPABASE_SERVICE_ROLE_KEY'); },
  get qrSecret() { return required('QR_TOKEN_SECRET'); },
  get cronSecret() { return required('CRON_SECRET'); },
  get appUrl() { return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, ''); },
};
