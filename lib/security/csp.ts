/**
 * Content Security Policy with a per-request nonce (strict-dynamic).
 * Scripts run only if they carry the nonce or are loaded by one that does
 * (e.g. Razorpay checkout injected by our own code).
 */
export function buildCsp(nonce: string, opts: { supabaseUrl: string; dev: boolean; https: boolean }) {
  const supabase = opts.supabaseUrl ? new URL(opts.supabaseUrl).origin : "";
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "https://checkout.razorpay.com", ...(opts.dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"], // Framer Motion & Next set inline styles
    "img-src": ["'self'", "data:", "blob:", supabase, "https://*.razorpay.com"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase, "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
    "frame-src": ["https://api.razorpay.com", "https://checkout.razorpay.com"],
    "form-action": ["'self'", supabase, "https://accounts.google.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.filter(Boolean).join(" ")}`);
  if (opts.https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
