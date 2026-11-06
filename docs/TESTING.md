# StyleMood AI — Testing Report

**Date:** 6 November 2026 · **Build:** Next.js 15.5.29 production build (`next start`) · **Database:** local Supabase stack (Postgres 17, Auth, Storage, Mailpit)

## Summary

| Suite | Tool | Result |
|---|---|---|
| Unit | Vitest | **67 / 67 passed** (7 files) |
| Database security & logic | Vitest against local Supabase | **25 / 25 passed** |
| End-to-end | Playwright (Chromium; desktop + Pixel 7) | **60 / 60 passed**, two consecutive runs, no flakes |
| Accessibility | axe-core (WCAG 2.1 A/AA) on 14 pages | **0 serious/critical violations** |
| Lighthouse | 4 pages × mobile/desktop | Accessibility 100, Best practices 100, SEO 100; Performance 91–95 mobile, 100 desktop |
| Dependency audit | `npm audit --omit=dev` | **0 vulnerabilities** |
| Lint / types | ESLint, `tsc --noEmit` | clean |
| Live AI | Real Gemini (`gemini-3.5-flash`) | generation ~10–11 s (with and without photo), chat ~3 s |

The E2E suite uses `AI_PROVIDER=mock` (labelled placeholder output) so it doesn't spend AI quota, and **fake Razorpay test credentials**, so no real payments happen. The real AI path was verified separately against Gemini (see the last section).

## Required user journeys

| # | Journey | Covered by | Result |
|---|---|---|---|
| 1 | Signup → confirm email → login → onboarding → dashboard | `auth.spec.ts` (real confirmation email via Mailpit) | ✅ |
| 2 | Generate outfit → mood → occasion → submit → AI results | `generate.spec.ts` | ✅ |
| 3 | Save outfit → Saved Looks → delete | `phase4.spec.ts` | ✅ |
| 4 | Upload wardrobe item → edit → delete | `phase4.spec.ts` | ✅ |
| 5 | AI stylist chat → recommendation | `phase4.spec.ts` (+ real Gemini check) | ✅ |
| 6 | Free user hits limit → upgrade option (UI and API 402) | `generate.spec.ts` | ✅ |
| 7 | Admin login → dashboard → statistics | `phase5.spec.ts` | ✅ |

## Required test areas

| Area | What was tested | Result |
|---|---|---|
| Mobile responsiveness | No horizontal scroll on every public and app page (Pixel 7 / iPhone 13); mobile menu and drawer | ✅ |
| Invalid uploads | Disguised script as `.png` (server byte check), PDF, file over 5 MB, path traversal | ✅ rejected |
| Unauthorized access | Signed-out users redirected; other users' looks, wardrobe and chats return 404; APIs return 401; `/admin` returns 404 for non-admins | ✅ |
| API failures | 503 and network failure in generation and chat → friendly error, retry, credit refunded | ✅ |
| Empty states | Dashboard, saved, wardrobe, chat, admin tables | ✅ |
| Invalid AI JSON | Missing fields, wrong tiers, bad hex, string budgets, prose instead of JSON → rejected; one automatic retry | ✅ (unit) |
| Database permissions | RLS isolation, column privileges, server-only tables, admin self-promotion, function privileges | ✅ (25 DB tests) |
| Usage limits | Atomic quota under 6 concurrent requests (exactly 3 granted), refund on failure, burst limits, chat daily limit, upload rate limit | ✅ |

## Security tests (highlights)

- **Auth:** open-redirect attempts (`//evil.com`, `/\evil.com`, `javascript:`), no user enumeration on signup and password reset, generic login errors.
- **CSP:** a per-request nonce is present and differs between requests; 18 pages render with zero CSP violations; a simulated XSS injection is blocked.
- **Payments:**
  - a forged checkout signature is rejected
  - verifying someone else's order returns 404
  - a paid order can't be cancelled
  - a webhook with a wrong secret is rejected
  - a duplicate webhook event is ignored
  - two simultaneous fulfilments grant exactly one pass
  - a failed payment is recorded and never grants access
- **Privacy:** uploaded photos have EXIF/GPS metadata stripped; account deletion removes all files (including nested folders) and all rows.
- **Secrets:** no keys in the repository or in backups; the health endpoint doesn't leak secrets; the Gemini key is sent only in a header, never in a URL.

## Defects found during testing and fixed

| # | Issue | Fix |
|---|---|---|
| 1 | Duplicate signup within ~60 s revealed the email was registered (rate-limit message) | Neutral response |
| 2 | Wardrobe: saving while a photo was uploading lost the photo or orphaned the file | Save disabled until upload finishes |
| 3 | Wardrobe form wiped user input after a server validation error (React 19 form reset) | Manual submit, values kept |
| 4 | Chat lost on-screen messages when a new conversation received its id (route remount) | Conversation in `?c=` query param |
| 5 | Account deletion missed files in nested storage folders | Recursive cleanup + test |
| 6 | `is_admin(uid)` callable by anyone → admin enumeration | Server-only; `am_i_admin()` for self |
| 7 | Phase 5 tables kept default broad grants | Revoked; defence in depth |
| 8 | PostCSS advisories (bundled in Next.js) | `overrides` → postcss 8.5.32, 0 vulnerabilities |
| 9 | Text colour contrast below WCAG AA (logo "AI", step numbers, greeting) | Accessible bronze `#80694a` (4.9:1) |
| 10 | Logo link accessible name didn't match visible text | Fixed labelling |
| 11 | Landing page LCP 3.9 s on mobile (headline hidden until JS) | CSS animations; Performance 74 → 91 |
| 12 | Zod's eval probe triggered CSP violations | `jitless` mode |

## Live AI verification (real Gemini, not mock)

- **Outfit generation, no photo:**
  - Prompt: Confident · office · Indo-western · rainy · ₹2,000–5,000
  - Result: 3 valid looks in 9.4 s, budgets within range, rain-appropriate fabrics
- **Outfit generation, with photo and consent:**
  - Prompt: Romantic · date night · Korean · pleasant
  - Result: 3 looks in 11.1 s; colours from the photo used; "more coverage" preference respected
- **Stylist chat:**
  - Used the user's wardrobe items by name
  - Declined off-topic questions
  - Offered one-tap generation
  - Replies took 2.5–4 s
- **Final check after all Phase 6 changes:** festive looks in 11.0 s, chat in 2.9 s, **zero browser console errors**.
- **Model availability:** `gemini-2.5-flash` is unavailable to new keys. `gemini-3.8-flash` and `gemini-3.7-flash` returned 503 during testing, which is why model fallback exists.

## Not tested (and why)

- **Real Razorpay checkout window:** needs real Razorpay credentials. All server-side logic (order creation errors, signature verification, webhooks, idempotency) is tested with generated signatures.
- **Google sign-in:** needs Google OAuth credentials. The button is hidden until enabled.
- **Inspiration image generation:** the free Gemini tier has no image quota (HTTP 429). The adapter and route are built, feature-flagged off, and unit-tested around the error mapping.
- **Real iOS Safari / Android Chrome devices:** responsive behaviour was tested with Playwright device emulation only.
- **Load testing:** not performed. Limits are enforced in Postgres and are concurrency-safe.

## How to run

```bash
npm run db:start
```
```bash
npm test
```
```bash
npm run test:db
```
```bash
npm run build
```
```bash
AI_PROVIDER=mock RAZORPAY_KEY_ID=rzp_test_e2e RAZORPAY_KEY_SECRET=e2e_key_secret RAZORPAY_WEBHOOK_SECRET=e2e_webhook_secret npm start
```
Then, in a second terminal:
```bash
npm run test:e2e
```
