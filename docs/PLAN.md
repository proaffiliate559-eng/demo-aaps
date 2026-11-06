# StyleMood AI — Development Plan

Status legend: ✅ done & tested · 🚧 in progress · ⏳ planned

## Architecture at a glance

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router, RSC, Server Actions), React 19, TypeScript strict | One dev server only (8 GB laptop friendly) |
| Styling | Tailwind CSS v4 + hand-written shadcn/ui-style components (Radix primitives) | Design tokens live in `app/globals.css` |
| Motion | Framer Motion, respects `prefers-reduced-motion` | |
| Auth | Supabase Auth via `@supabase/ssr` (cookie sessions) | Email/password, Google (flag-gated), reset |
| DB | Supabase Postgres, SQL migrations in `supabase/migrations`, RLS on every table | |
| Storage | Supabase Storage, private buckets, signed URLs | Phase 3 |
| AI | Provider adapter (`lib/ai/providers/*`), Gemini first, Zod-validated JSON | Clearly labelled mock provider for dev only |
| Payments | Razorpay adapter, webhook-verified, idempotent | Optional until keys exist |
| Validation | Zod v4, shared by client + server | |
| Tests | Vitest (unit), Playwright (E2E) against a real local Supabase stack | |
| i18n | Dictionary-based (`lib/i18n`), English default, Hindi-ready | |

### Request flow
```
Browser ──► middleware.ts (refresh session cookie, gate protected routes)
        ──► RSC page / Server Action / Route Handler
              ├─ lib/supabase/server.ts   (user-scoped client, RLS enforced)
              ├─ lib/supabase/admin.ts    (service role, server-only, admin + webhooks)
              ├─ lib/ai/*                 (server-only AI calls, never from browser)
              └─ lib/payments/*           (server-only)
```

### Security principles
- Keys only in server env vars; `server-only` import guard on privileged modules.
- RLS: users read/write only rows where `user_id = auth.uid()`.
- Admin role lives in a separate `user_roles` table writable only by service role — never in `profiles`.
- Usage limits enforced in Postgres (atomic function), not the browser.
- Redirect targets sanitised (no open redirects); generic auth errors (no user enumeration).

## Phases

### Phase 1 — Foundation, design system, landing, auth ✅
- Project scaffold, env validation, `.env.example`, security headers
- Design system: tokens, typography (Instrument Serif + Inter), Button/Input/Card/Badge/Accordion/Sheet
- Landing: nav, hero, how it works, features, example showcase, pricing, FAQ, CTA, footer
- Auth: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/auth/confirm`, sign-out
- Middleware route protection; authenticated users bounced from auth pages
- Minimal protected `/dashboard` shell (real user data, sign-out)
- Tests: unit (validation, redirect sanitiser, route rules) + E2E against local Supabase

### Phase 2 — Onboarding, profile, dashboard, DB ✅
- Full schema migration: 14 tables, FKs, indexes, check constraints, RLS on all, column-level grants, `handle_new_user` trigger, plans seed
- Admin role in separate `user_roles` table (`is_admin()`), never user-writable
- 6-step onboarding (each step saved server-side; fit step skippable), `/profile` section editor
- App shell (sidebar / mobile drawer); unbuilt features shown as non-interactive "Soon"
- Dashboard: greeting (IST), today's outfit, credits (real usage, IST reset), recent & favourite looks, profile summary, matched tips — all from DB with empty states
- `/settings`: account info, change password, delete account (storage + cascade)
- Tests: 11 DB permission tests, onboarding/profile/dashboard/settings/mobile E2E
- Deferred to Phase 3: dashboard mood selector (it routes into `/generate`)

### Phase 3 — AI generation ✅
- Migration 2: private `user-uploads` / `outfit-images` buckets with folder-scoped storage policies; `generation_quota()` + atomic `reserve_generation()` (advisory lock, pending reservations refunded on failure), `my_generation_quota()` for display
- `/generate` 7-step wizard (photo → mood → occasion → style → weather → budget → review), prefilled from profile and dashboard mood selector
- Photo upload API: auth, 5 MB limit, magic-byte type check, sharp re-encode (EXIF/GPS stripped, auto-rotate, max 1600px), per-request consent, delete/replace
- `lib/ai`: provider interface, Gemini provider (structured JSON output, per-attempt timeout, model fallback, error taxonomy, key in header only), labelled mock provider, strict Zod output schema + one retry on invalid output
- `/api/generate-outfit` → results page `/generate/[requestId]`: 3 looks with full details, save (plan saved-limit enforced), rate 1–5, share (Web Share / clipboard), regenerate
- Limit reached → upgrade screen; API returns 402 (server-enforced)
- Mode A inspiration images: adapter + `/api/outfit-image` + UI, feature-flagged off (`IMAGE_PROVIDER`), since the free Gemini tier has no image quota. Mode B (virtual try-on): interface only
- Verified live against Gemini (`gemini-3.5-flash`): ~10s per request, with and without photo

### Phase 4 — Saved, wardrobe, stylist chat ✅
- Migration 3: `updated_at` on wardrobe & conversations; chat writes server-only; wardrobe image path must be inside owner's folder
- `/saved`: lookbook with style/occasion filters, generation date, view/share/remove, plan saved-limit shown and enforced
- `/wardrobe`: list with search (LIKE-escaped) + category chips, add/edit/delete with private photo upload (EXIF stripped), photo replacement cleans old file; upload-in-progress blocks submit; form keeps input on server errors
- `/stylist`: AI stylist chat (Gemini JSON replies validated with Zod), knows profile + wardrobe, fashion-only scope, follow-up suggestions, one-tap "Create 3 full looks" into the generator, history, delete, retry on failure (messages stored only after a successful reply), daily chat limit
- Shared `GeminiJsonClient` (fallback/timeouts) used by outfit + chat providers
- Account deletion now removes files in nested storage folders
- Fixed: chat state lost when a new conversation got its id (now `?c=<id>`)
### Phase 5 — Admin, usage tracking, subscriptions (Razorpay) ✅
- Migration 4: `payments`, `webhook_events` (idempotency), `admin_audit_log`; one active subscription per user; atomic idempotent `fulfil_payment()`; `expire_subscriptions()`; service-role-only analytics functions (overview, daily activity, mood/occasion/style breakdown, AI usage, user list with LIKE-escaped search)
- Admin area `/admin` (server-verified role, 404 for others): live KPIs, 14-day charts, popularity, AI usage/error table; users (search, paginate, detail, suspend, grant/revoke plan, make admin, delete); plans & prices editor; free daily limit; feature switches (stylist chat, wardrobe, inspiration images) enforced in nav, pages and APIs; content reports workflow; audit trail; `npm run admin:grant`
- Users can report a look for review
- Billing `/billing`: current plan, plans from DB, Razorpay Checkout (order created server-side, price from DB), signature-verified callback, webhook (raw-body HMAC, event de-duplication, failure handling), cancel/dismiss tracking, payment history; disabled with an honest notice when keys are absent
- Landing pricing now reads plans from the database
### Phase 6 — Security hardening, full test matrix, perf, deployment docs ✅
- Migration 5: admin-check no longer callable for arbitrary users (`am_i_admin()`), trigger functions revoked, server-only tables locked at grant level, no default anon privileges, upload rate-limit function, analytics index
- Nonce-based CSP (`strict-dynamic`) on every response + COOP; Zod `jitless` to avoid eval; upload (30/h) and chat (8/min) burst limits
- `npm audit` 0 vulnerabilities (postcss override)
- WCAG AA: accessible bronze text colour, logo labelling; axe-core suite on 14 pages
- Performance: CSS-only hero/scroll animations (no JS for LCP), landing JS −26%; Lighthouse mobile 91–95, desktop 100; a11y/best-practices/SEO 100
- `/api/health`, `robots.txt`, `sitemap.xml`, metadata in `<head>`, `vercel.json` (Mumbai), GitHub Actions CI
- Docs: DEPLOYMENT, TESTING (report), SECURITY, ROADMAP (limitations + future)