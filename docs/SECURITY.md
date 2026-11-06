# Security overview

## Authentication & sessions
- Supabase Auth with cookie sessions (`@supabase/ssr`), refreshed in middleware. Every protected page and API re-verifies the user server-side with `getUser()`.
- Email confirmation required; 8+ character passwords with letters and numbers.
- No user enumeration: signup, reset and login responses don't reveal whether an email exists.
- Redirect targets are sanitised; open redirects are blocked.

## Authorisation
- **Row Level Security on every table.** Users can only read and change their own rows.
- Column-level grants: users can't change their email, ids, timestamps, plans, usage, outfits or roles.
- Server-only tables (`payments` writes, `webhook_events`, `admin_audit_log`, `ai_usage` writes, `subscriptions`, `user_roles`, `app_settings`, `plans`) are written only with the service role.
- **Admins** live in `user_roles`, writable only by the service role. Admin pages and actions verify the role on every request. Non-admins get a 404. Every admin action is logged in `admin_audit_log`.
- Logged-out visitors can read only the public `plans` list and can call no database functions.

## AI
- AI keys are server-only and sent in a header (never a URL).
- Input is restricted to validated enums plus validated free text (chat ≤ 1000 characters).
- Output must pass strict Zod schemas before it's stored or shown; it's rendered as text (no HTML).
- The system prompts forbid inferring sensitive traits from photos and restrict the chat to fashion.
- Photos are sent to the AI only with per-request consent.
- Quotas are enforced atomically in Postgres (advisory lock). Failures refund the credit. Burst limits apply to generation (5/min) and chat (8/min, 40/day).
- The mock provider is refused in Vercel production and is always labelled in the UI.

## Uploads
- Authenticated users only; 5 MB limit; type detected from file bytes (JPEG/PNG/WEBP), never from the browser's claim.
- Re-encoded with sharp: EXIF/GPS stripped, auto-rotated, resized. This also neutralises polyglot files.
- Private buckets; storage policies scope every object to `<user_id>/…`. Signed URLs expire after 10–60 minutes.
- 30 uploads per hour per user.

## Payments
- Prices come from the database on the server.
- A plan is granted only after HMAC-SHA256 signature verification (constant-time compare) on the checkout callback or the webhook.
- Webhooks are verified on the raw body and de-duplicated by event id.
- Fulfilment is atomic and idempotent (`fulfil_payment`). A paid order can never be cancelled or downgraded.
- Failed and dismissed checkouts are recorded.

## HTTP hardening
- Per-request **nonce-based CSP** with `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'none'` and `base-uri 'self'`.
- HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and COOP headers are set; `X-Powered-By` is removed.
- Server actions use Next.js origin checks.

## Privacy
- Account deletion removes all rows (cascade) and all files (recursive).
- Admins can delete users.
- The privacy notice explains photo processing and retention.

## Reporting
For a security issue, contact the site owner privately. Don't open a public issue.
