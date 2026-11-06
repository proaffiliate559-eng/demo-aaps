/**
 * Public (browser-safe) environment. Only NEXT_PUBLIC_* values may live here.
 * Server secrets are read in server-only modules (see lib/supabase/admin.ts).
 *
 * Next.js inlines NEXT_PUBLIC_* at build time only when accessed with a
 * literal `process.env.NAME`, so each one is referenced explicitly.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  googleAuthEnabled: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
};

export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
