# Deploying StyleMood AI

This guide puts StyleMood AI online using **GitHub** (stores the code), **Supabase** (database, login and photo storage) and **Vercel** (hosting). All three have free tiers that are enough to launch. Budget about an hour the first time.

> Order matters: code on GitHub → Supabase project → Vercel site → finish Supabase settings with your site address → make yourself admin → (optional) Razorpay.

---

## 0. What you need

| Account | Sign up | Used for |
|---|---|---|
| GitHub | https://github.com/signup | Stores the code; Vercel deploys from it |
| Supabase | https://supabase.com (sign in with GitHub) | Database, accounts, private photo storage |
| Vercel | https://vercel.com (continue with GitHub) | Hosts the website |
| Google AI Studio | https://aistudio.google.com/apikey | Gemini API key for the AI stylist |
| Razorpay (optional) | https://razorpay.com | Paid plans. Leave for later if you like. |
| Email sender (recommended) | e.g. Resend, Brevo, Amazon SES | Sends sign-up and password emails reliably |

---

## 1. Put the code on GitHub

1. Create a **private** repository named `stylemood-ai`.
2. Upload the project. If Claude has access to your GitHub account, it can push the code for you. Otherwise, from the project folder:
   ```bash
   git init && git add . && git commit -m "StyleMood AI"
   ```
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/stylemood-ai.git
   ```
   ```bash
   git push -u origin main
   ```
   `.env.local` is in `.gitignore`, so your secrets are never uploaded.

---

## 2. Create the Supabase project

1. In Supabase, click **New project**.
   - Name: `stylemood-ai`
   - Region: **Mumbai (ap-south-1)**, closest to Indian users
   - Database password: generate one and save it somewhere safe
2. When it's ready, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (secret, server only)
3. **Create the database tables.** Choose one option:
   - **Option A, CLI (recommended).** From the project folder:
     ```bash
     npx supabase login
     ```
     ```bash
     npx supabase link --project-ref YOUR_PROJECT_REF
     ```
     ```bash
     npx supabase db push
     ```
     `YOUR_PROJECT_REF` is the part of your project URL before `.supabase.co`.
   - **Option B, browser.** Open **SQL Editor** and run each file in `supabase/migrations/` **in order** (`…0001` to `…0005`), pasting the whole file each time.

   This creates every table, the security rules (row-level security), the two private photo buckets, the plans (Free, ₹99, ₹199, ₹299) and the default settings.
4. Check it worked: **Table Editor** should list `profiles`, `outfits`, `plans` (4 rows), `payments` and so on. **Storage** should show the `user-uploads` and `outfit-images` buckets, both **private**.

---

## 3. Deploy on Vercel

1. In Vercel, click **Add New → Project**, import `stylemood-ai` from GitHub. Framework: **Next.js** (auto-detected).
2. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 2 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 2 (secret) |
   | `NEXT_PUBLIC_SITE_URL` | `https://YOUR-PROJECT.vercel.app` (or your own domain later) |
   | `AI_PROVIDER` | `gemini` |
   | `GEMINI_API_KEY` | your key (create a **new** one for production) |
   | `GEMINI_MODEL` | `gemini-3.5-flash` |
   | `GEMINI_FALLBACK_MODELS` | `gemini-3.5-flash-lite` |
   | `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `false` (set `true` only after step 4.4) |
   | `IMAGE_PROVIDER` | `none` |

   `vercel.json` already runs the app in Vercel's Mumbai region (`bom1`), next to the database.
3. Click **Deploy**. When it finishes, open `https://YOUR-PROJECT.vercel.app/api/health`. You should see:
   ```json
   { "status": "ok", "database": "ok", "ai": "gemini", "serviceRole": true, ... }
   ```
   If it shows `"degraded"`, the field that isn't `ok` tells you which variable to fix. After changing variables, redeploy from **Deployments → ⋯ → Redeploy**.

---

## 4. Finish Supabase authentication settings

1. **Authentication → URL Configuration**
   - Site URL: `https://YOUR-PROJECT.vercel.app`
   - Redirect URLs: add `https://YOUR-PROJECT.vercel.app/**`
2. **Authentication → Providers → Email:** keep **Confirm email** ON. Set the minimum password length to **8**.
3. **Custom SMTP (strongly recommended): Authentication → Emails → SMTP Settings.** Supabase's built-in mailer sends only a few emails per hour, which isn't enough for real users. Enter your email provider's SMTP details and use a sender like `hello@yourdomain.com`.
4. **Google sign-in (optional).**
   1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (Web application).
   2. Authorised redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   3. Paste the client ID and secret into Supabase **Authentication → Providers → Google**, and enable it.
   4. In Vercel, set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` and redeploy.

---

## 5. Make yourself admin

1. Open your live site and **sign up** with your own email. Confirm it and finish onboarding.
2. Grant admin in Supabase **SQL Editor**:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'YOUR_EMAIL';
   ```
   Or from your computer, with the production keys in `.env.local`:
   ```bash
   npm run admin:grant -- YOUR_EMAIL
   ```
3. Refresh the site. An **Admin** link appears in the sidebar, and `/admin` opens.

---

## 6. Payments with Razorpay (optional, do it when ready)

Without these keys the site works normally and upgrade buttons show **"Payments launching soon"**.

1. Create a Razorpay account and complete KYC (business details, bank account).
2. **Test mode first.** Dashboard → Account & Settings → **API Keys** → generate test keys (`rzp_test_…`).
3. In Vercel add:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
4. Dashboard → **Webhooks → Add new webhook**:
   - URL: `https://YOUR-PROJECT.vercel.app/api/payments/webhook`
   - Secret: create a long random string and also set it in Vercel as `RAZORPAY_WEBHOOK_SECRET`
   - Active events: `payment.captured`, `order.paid`, `payment.failed`
5. Redeploy, then buy a plan using Razorpay's **test card / UPI**. Your plan should switch immediately, and the payment should show in **Admin → Overview → Revenue** and on the user's **Plans & Billing** page.
6. When everything works, generate **live** keys (`rzp_live_…`), replace both keys in Vercel, update the webhook to live mode, and redeploy. Admin → Plans & settings shows whether you're in test or live mode.

---

## 7. Your own domain (optional)

1. Vercel → Project → **Settings → Domains** → add `stylemood.in` (or similar) and follow the DNS instructions.
2. Update `NEXT_PUBLIC_SITE_URL` in Vercel, and the Site URL and Redirect URLs in Supabase (step 4.1). Also update the Razorpay webhook URL if you use payments. Then redeploy.

---

## 8. Launch checklist

- [ ] `/api/health` returns `"status": "ok"`
- [ ] Sign up → confirmation email arrives (custom SMTP) → onboarding → dashboard
- [ ] Forgot password email works
- [ ] Generate outfit returns three real looks with no "Development mock" banner
- [ ] Upload a photo; it appears, and Supabase Storage shows it under `user-uploads/<your-id>/style/`
- [ ] AI stylist replies
- [ ] `/admin` works for you and shows 404 in a private window or for another account
- [ ] Privacy notice and terms reviewed by a lawyer (India DPDP Act 2023)
- [ ] New Gemini key created for production; the key shared during development deleted in AI Studio
- [ ] (If payments) test payment succeeds, then live keys are in place
- [ ] Supabase **Database → Backups** enabled (paid plans have daily backups; on free, export regularly)

## Updating the site later

Push changes to the `main` branch on GitHub and Vercel redeploys automatically. Database changes go in a new file in `supabase/migrations/`. Apply it with `npx supabase db push` **before** the code that needs it goes live.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Health shows `database: "error"` | Check `NEXT_PUBLIC_SUPABASE_URL` and the anon key; confirm migrations ran |
| Health shows `ai: "not_configured"` | Set `GEMINI_API_KEY` and redeploy |
| Confirmation emails missing or "Too many attempts" | Configure custom SMTP (step 4.3) |
| Email link opens "That link didn't work" | Site URL and Redirect URLs in Supabase must exactly match your domain |
| "AI stylist is busy" often | Google's model is overloaded. Add another model to `GEMINI_FALLBACK_MODELS` or enable billing on Google AI Studio for higher limits |
| Upgrade button says "Payments launching soon" | Razorpay keys are missing |
| Paid but plan didn't change | Check the Razorpay webhook URL, secret and events; webhook deliveries are visible in the Razorpay dashboard |
