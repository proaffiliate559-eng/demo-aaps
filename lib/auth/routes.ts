/** Route rules shared by middleware and tests. Pure functions, no I/O. */

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/generate",
  "/wardrobe",
  "/saved",
  "/stylist",
  "/profile",
  "/settings",
  "/admin",
] as const;

/** Pages a signed-in user should not see (they get sent to the dashboard). */
export const AUTH_ONLY_PAGES = ["/login", "/signup", "/forgot-password"] as const;

export const DEFAULT_AUTHED_PATH = "/dashboard";

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export function isAuthOnlyPath(pathname: string) {
  return AUTH_ONLY_PAGES.some((p) => matchesPrefix(pathname, p));
}

/**
 * Only allow same-origin, path-relative redirect targets.
 * Blocks open redirects such as "//evil.com", "/\\evil.com" or "https://evil.com".
 */
export function sanitizeRedirect(target: string | null | undefined, fallback = DEFAULT_AUTHED_PATH) {
  if (!target || typeof target !== "string") return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(target)) return fallback;
  try {
    const url = new URL(target, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
