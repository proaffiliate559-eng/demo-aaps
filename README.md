# StyleMood AI

AI personal stylist: mood-, occasion-, weather- and budget-aware outfit recommendations for Indian users (₹).

**Status:** All 6 phases complete. Ready to deploy.

## Documentation
| Doc | What's inside |
|---|---|
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Step-by-step: GitHub → Supabase Cloud → Vercel → admin → Razorpay → launch checklist |
| [`docs/TESTING.md`](docs/TESTING.md) | Test report: suites, the 7 user journeys, defects found and fixed, live AI verification |
| [`docs/SECURITY.md`](docs/SECURITY.md) | How auth, data, uploads, AI and payments are protected |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Known limitations and future feature roadmap |
| [`docs/PLAN.md`](docs/PLAN.md) | Architecture and what was built in each phase |
| [`.env.example`](.env.example) | Every environment variable, explained | See [`docs/PLAN.md`](docs/PLAN.md).

## Stack
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui-style components (Radix) · Framer Motion · Supabase (Auth, Postgres, Storage) · Zod · Vitest · Playwright

## Local setup

Requirements: Node 22 and Docker (for the local Supabase stack).

```bash
npm install
```

```bash
npm run db:start
```

This starts Postgres, Auth, Storage and Mailpit locally. The first run downloads the images. Copy the printed `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY` into `.env.local` (template: `.env.example`).

```bash
npm run dev
```

Open http://localhost:3000. Confirmation and password-reset emails land in **Mailpit** at http://127.0.0.1:54324.

> Low-RAM tip (8 GB laptops): run only one Next server. `npm run build && npm start` uses less memory than `npm run dev`. Studio, Realtime and Analytics are disabled in `supabase/config.toml` to save memory.

## Environment variables

| Name | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key (safe in the browser; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Admin operations / webhooks. Never expose. |
| `NEXT_PUBLIC_SITE_URL` | public | Base URL for auth email redirects |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | public | `true` shows "Continue with Google" (enable the provider in Supabase first) |

### AI configuration
| Name | Purpose |
|---|---|
| `AI_PROVIDER` | `gemini` (real AI) or `mock` (labelled development placeholders; refused in Vercel production) |
| `GEMINI_API_KEY` | **server only** — from https://aistudio.google.com/apikey |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS` | Main model and comma-separated fallbacks (default `gemini-3.5-flash`, fallback `gemini-3.5-flash-lite`) |
| `CHAT_DAILY_LIMIT` | Stylist chat messages per user per day (default 40) |
| `IMAGE_PROVIDER` | `none` (default) or `gemini` for outfit inspiration images — requires billing on your Google AI account |

If the key is missing, generation fails with a clear "not set up" message and no credit is used — the app never silently substitutes mock output.

## Admin account setup
Admins are stored in the `user_roles` table, which only the server (service role) can write. Users can never make themselves admins.
1. Sign up normally in the app with the email you want to use.
2. Run the grant script:
   ```bash
   npm run admin:grant -- you@example.com
   ```
   Or run this in the Supabase SQL editor: `insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'you@example.com';`
3. Sign in again. An **Admin** link appears in the sidebar, and `/admin` now opens. Non-admins get a 404 there.

From the admin area you can see live statistics, search users, suspend or delete them, grant complimentary plans, edit plans and prices, change the free daily limit, switch features on or off, and review reported looks. Every admin action is recorded in `admin_audit_log`.

## Payments (Razorpay)
Paid plans are **prepaid monthly passes**: nothing renews automatically, and buying the same plan again extends it by a month. Without keys, the billing page shows "Payments launching soon" and nothing can be bought.
1. Create a Razorpay account and complete KYC. Start with **Test mode** keys (`rzp_test_…`).
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. Add a webhook in the Razorpay Dashboard → Webhooks:
   - URL: `https://YOUR_DOMAIN/api/payments/webhook`
   - Events: `payment.captured`, `order.paid`, `payment.failed`
   - Copy its secret into `RAZORPAY_WEBHOOK_SECRET`.
4. Test with Razorpay's test cards or UPI, then switch to live keys.

How payments are protected:
- Prices are read from the database on the server.
- A plan is granted only after an HMAC signature check (on the checkout callback or the webhook).
- Fulfilment (`fulfil_payment`) is atomic and idempotent.
- Webhook events are de-duplicated by event id.
- Failed and dismissed checkouts are recorded and never grant access. If Supabase keys are missing, the site still renders and the auth forms show a clear "not configured" notice.

## Supabase Cloud setup
1. Create a project and copy the URL and anon/service keys into your env.
1. Apply the database schema: `npx supabase link --project-ref <ref>` then `npx supabase db push` (or paste `supabase/migrations/*.sql` into the SQL Editor in order).
2. **Authentication → URL Configuration**: set Site URL to your domain and add `https://YOUR_DOMAIN/**` (plus `http://localhost:3000/**` for dev) to Redirect URLs.
3. **Authentication → Providers → Email**: keep "Confirm email" on. Set minimum password length to 8.
4. **Custom SMTP** (Authentication → Emails → SMTP): required for production. The built-in mailer only sends a few emails per hour.
5. Google (optional): enable the provider with OAuth credentials from Google Cloud, using the callback `https://<project-ref>.supabase.co/auth/v1/callback`, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Database permission (RLS) tests against local Supabase |
| `npm run admin:grant -- <email>` | Make an existing user an admin |
| `npm run db:types` | Regenerate `types/database.ts` from the local schema |
| `npm run test:e2e` | E2E tests (Playwright). Needs `npm run db:start` and a built app started with `AI_PROVIDER=mock RAZORPAY_KEY_ID=rzp_test_e2e RAZORPAY_KEY_SECRET=e2e_key_secret RAZORPAY_WEBHOOK_SECRET=e2e_webhook_secret npm start`. These are fake test values, so no AI quota or real payments are used. |

## Project structure
```
app/
  page.tsx, privacy/, terms/        public pages (landing, legal)
  (auth)/                           login, signup, forgot-password, reset-password
  auth/                             email-link handlers (callback, confirm, error)
  onboarding/                       6-step style questionnaire
  (app)/                            signed-in app: dashboard, generate, saved, wardrobe,
                                    stylist, profile, billing, settings
  admin/                            admin area (overview, users, plans & settings, reports)
  api/                              generate-outfit, upload-image, outfit-image, chat,
                                    payments/{create-order,verify,cancel,webhook}, health
components/                         ui, layout, landing, auth, forms, profile, onboarding,
                                    dashboard, generate, outfits, wardrobe, stylist, billing, admin
lib/
  ai/                               provider adapters (Gemini, mock, image), prompts, schemas,
                                    generation service, chat/
  supabase/                         browser / server / middleware / admin clients
  auth/ admin/ payments/ profile/ outfits/ wardrobe/ stylist/ usage/ plans/ settings/ storage/
  security/csp.ts                   nonce-based Content Security Policy
  validations/                      Zod schemas shared by client and server
  i18n/ config/                     copy dictionaries (en, hi-ready), options, plans, tips
supabase/migrations/                5 SQL migrations (schema, RLS, storage, quotas, payments, hardening)
tests/unit, tests/integration, tests/e2e
scripts/grant-admin.ts              make a user admin
docs/                               deployment, testing report, security, roadmap, plan
```

## Security notes (summary; see docs/SECURITY.md)
- Sessions are verified server-side with `getUser()` in middleware and again in protected pages.
- Redirect targets are sanitised, which blocks open redirects.
- Auth errors and password resets give the same answer whether or not an account exists, so they don't reveal registered emails.
- Security headers: `X-Frame-Options`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`. `X-Powered-By` is removed.
- The service-role client is guarded with `server-only`.
