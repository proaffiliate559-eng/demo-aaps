# CafeRepeat AI

Multi-tenant customer loyalty SaaS for Indian cafes, restaurants and bakeries.
Customers scan a QR, verify their mobile with an OTP and get a digital loyalty
card (no app download). Cafes record bills at the counter and every point,
stamp and rupee of cashback is written to a ledger.

**Status: Milestones 1 + 2 of 6.** See [What's built](#whats-built) and
[Not built yet](#not-built-yet).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres,
Auth, RLS) · `qrcode` + `jsqr` · Vercel Cron.

## Quick start (local)

Requirements: Node 18.18+, Docker, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
supabase start                 # local Postgres + Auth; applies migrations + seed.sql
cp .env.example .env.local     # paste the URL and keys printed by `supabase start`
openssl rand -base64 48        # use as QR_TOKEN_SECRET (and another for CRON_SECRET)
npm run dev                    # http://localhost:3000
```

1. Open `/signup`, create an owner account, then add your cafe.
2. Print the QR from **QR codes**, scan it with your phone, join with your mobile.
3. Open **Cashier**, scan the customer's card QR, enter the bill.

Local phone login: `supabase/config.toml` sets test numbers `9811111111` and
`9822222222` with OTP `123456`. For real SMS, configure an SMS provider in the
Supabase dashboard (Authentication → Providers → Phone).

### Demo data

`seed.sql` creates the subscription plans and a demo cafe **`/c/demo-cafe`**
with 12 sample customers and purchases (demo mode only, never run it on a
production database). To manage it from the dashboard, sign up in the app and
then run in the SQL editor:

```sql
select private.grant_demo_owner('you@example.com');
```

Tip: the owner dashboard (email login) and the customer portal (phone login)
share one browser session. Use a private window for one of them.

## Deploy (Vercel + Supabase)

1. Create a Supabase project. Run the migrations: `supabase link` then `supabase db push`.
   Run only the plans part of `seed.sql` in production.
2. Supabase → Authentication: enable **Phone** with an SMS provider; set Site URL to your domain
   and add `https://your-domain/auth/callback` to redirect URLs.
3. Import the repo in Vercel, add the variables from `.env.example`
   (`NEXT_PUBLIC_APP_URL` = your domain, because printed QR codes contain it).
4. `vercel.json` runs `/api/cron` daily (expire unused reward codes, birthday points, points expiry).
   Vercel sends `CRON_SECRET` automatically as the bearer token.

## Architecture

```
app/
  page.tsx                    marketing + plans
  (auth)/login, signup        staff/owner email auth
  onboarding/                 create a business (RPC create_tenant)
  dashboard/[slug]/           owner/staff dashboard (RLS-scoped to the tenant)
    cashier/                  scan card QR → record bill; confirm reward codes
    customers/ rewards/ loyalty/ qr/ branches/
  c/[slug]/                   customer portal: join (OTP) → card, rewards, history, profile
  q/[code]                    printed QR target: counts the scan, redirects to the portal
  api/
    customer/qr-token         signed 2-minute card QR token
    staff/resolve             token or phone → customer (+ wallet)
    staff/purchases           → RPC record_purchase
    staff/redemptions/confirm → RPC confirm_redemption
    staff/customers           walk-in registration
    qr/[code]/png             QR image (download / print)
    cron                      scheduled jobs (service role, secret-protected)
lib/                          supabase clients, qr-token, permissions, errors, rate-limit
supabase/
  migrations/                 schema · security (roles + RLS) · loyalty engine
  seed.sql                    plans + demo cafe
  tests/                      SQL tests + concurrency test
```

### Multi-tenancy and security

- Every business row has `tenant_id`. **Row Level Security is on for all 31 tables.**
  Staff see a tenant only through `user_roles`; customers see only their own rows.
- Roles: owner, manager, cashier, marketing. The permission matrix lives in
  SQL (`private.role_perms`) and is mirrored for the UI in `lib/permissions.ts`.
  Cashiers can be limited to branches via `staff_members`.
- Clients can **not** write balances, the ledger, purchases, visits or redemptions
  directly (privileges revoked). Only `SECURITY DEFINER` functions do, after
  checking permissions.
- Customer card QR = HMAC-signed token, valid 2 minutes, refreshed every minute,
  so screenshots stop working. Reward codes are one-time and expire.
- Server-side: zod validation, same-origin check, rate limits, secrets only in
  server env (`lib/env.ts` is `server-only`), security headers in `next.config.mjs`.
- `audit_logs` records registrations, purchases, redemptions, adjustments, QR creation.

### Loyalty engine (ledger)

`private.apply_txn` is the only code that changes a wallet. It locks the wallet
row, skips a repeated idempotency key, refuses negative balances and writes a
`loyalty_transactions` row with the balances after the change. The tests check
that **every wallet equals the sum of its ledger**.

Duplicate protection on purchases: client idempotency key (retries return the
first result), unique POS bill number per branch, and a configurable "same
amount, same customer, within N seconds" block.

Supported rules: points per ₹100 with tier multipliers (Silver/Gold/Platinum),
stamps per visit or per matching item ("buy 5 coffees, get 1 free"), cashback %
with cap, minimum bill, max points per bill, branch-specific overrides,
welcome/referral/birthday bonuses, points expiry after inactivity, reward
stock/limits/expiry, daily redemption limit.

## Tests

```bash
npm test                       # unit tests: QR tokens, scanner parsing, phone, errors, rate limit, permissions
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:test
```

`db:test` runs `supabase/tests/01_loyalty_rls_test.sql` (54 checks: tenant
isolation, role limits, ledger integrity, duplicates, redemption, expiry,
birthday, tiers, anonymous access) and `02_concurrency_test.sh` (two
simultaneous redemptions cannot double-spend; one purchase per idempotency key).
Run it on a fresh local database (`supabase db reset`). It creates test users.

## What's built

**Milestone 1:** project setup, owner/staff auth, onboarding, full database
schema (31 tables incl. later-milestone tables), multi-tenant RLS, roles and
permissions, audit logs.

**Milestone 2:** QR system (branch/table/counter/campaign codes, scan tracking,
sign-up attribution, PNG download, print sheet); customer portal with phone OTP
registration, digital loyalty card with rotating QR, stamps, points wallet,
cashback, tiers, reward redemption with one-time codes, coupons list,
referral sharing, birthday rewards, visit and reward history, feedback &
ratings, WhatsApp consent settings; staff cashier (camera scan or phone search,
walk-in registration, record bill, confirm rewards); rewards and loyalty rule
management; branches; basic customer list and overview numbers.

## Not built yet

- **Milestone 3:** charts, customer segments, customer profile pages, coupon redemption at the counter, campaign builder.
- **Milestone 4:** Meta WhatsApp Cloud API (templates, consent-aware sending, opt-out webhook, delivery logs), AI assistant, automations.
- **Milestone 5:** Razorpay subscriptions (webhook-verified), plan limits enforcement, Super Admin panel.
- **Milestone 6:** E2E tests, shared rate-limit store (Upstash/Redis), performance work.

Tables for these already exist so later milestones need no breaking migrations.
No integration is faked: there is no WhatsApp, Razorpay or AI code yet.

## Known limits

- The in-memory rate limiter is per server instance. Swap `lib/rate-limit.ts` for Redis before scaling out.
- Database types are not generated yet. Run `supabase gen types typescript --local > lib/database.types.ts` and pass the type to the clients for stricter checks.
