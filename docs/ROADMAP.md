# Known limitations & future roadmap

## Known limitations

| Area | Limitation | Impact / workaround |
|---|---|---|
| AI availability | Google's newest Gemini models are sometimes overloaded (503). | Automatic fallback to `GEMINI_FALLBACK_MODELS`; the user sees a friendly retry message and the credit is refunded. Enabling billing in AI Studio raises limits. |
| AI accuracy | Recommendations and ₹ estimates are AI suggestions, not live store prices. | Labelled in the UI; users can report a look. |
| Inspiration images | Built but **off**: the free Gemini tier has no image quota. | Enable billing on Google AI, set `IMAGE_PROVIDER=gemini`, switch on in Admin → Plans & settings. |
| Virtual try-on | Interface only (Mode B); no provider connected. | Planned; needs a dedicated try-on API and explicit consent. |
| Payments | Prepaid monthly passes; no auto-renewing subscriptions. Real Razorpay checkout not tested without live credentials. | Test with Razorpay test keys before going live. Auto-renew needs Razorpay Subscriptions (roadmap). |
| Refunds | Not automated. | Issue from the Razorpay dashboard; revoke the plan in Admin → Users. |
| Hindi | Architecture ready (dictionaries, language preference); only a few strings translated, and the app UI isn't wired to switch yet. | Translate `lib/i18n/dictionaries/hi.ts` (by a native speaker) and add a language switch. |
| Weather | Chosen manually. | Automatic detection via a weather API is on the roadmap. |
| Email delivery | Supabase's built-in mailer is heavily rate-limited. | Configure custom SMTP before launch (see DEPLOYMENT.md). |
| Orphaned photos | Style photos uploaded but never used in a generation stay until the user deletes them or their account. Wardrobe forms abandoned mid-upload can leave a file. | Small storage cost; covered by account deletion. A scheduled cleanup job is planned. |
| Sharing | Share sends a text summary (Web Share / clipboard); there are no public share links, because looks are private. | Public share pages with opt-in are planned. |
| Wardrobe-only outfits | The stylist chat uses the wardrobe; the 3-look generator doesn't yet build outfits *only* from owned items. | Planned (spec's "future feature"). |
| Rate limiting | Per-user limits live in Postgres; there's no IP-level limiting for anonymous traffic beyond Supabase Auth's own limits. | Add Vercel Firewall / WAF rules if abuse appears. |
| Legal | Privacy notice and terms are drafts. | Review by a lawyer (DPDP Act 2023) before launch. |
| Devices | Tested with Chromium device emulation, not physical iPhones or Android phones. | Do a quick manual check on real phones after deployment. |

## Roadmap

### Next (after launch)
1. **Wardrobe-based generation:** "Style me using only my clothes", with item photos as AI context.
2. **Auto weather:** detect city weather (with permission) to pre-fill the weather step.
3. **Hindi interface:** complete translations and add a language switch in the header and settings.
4. **Public share pages:** an opt-in, read-only link for a look, with an Open Graph image.
5. **Auto-renewing plans:** Razorpay Subscriptions, plus a self-serve cancel or pause.

### Later
6. **Inspiration images on by default** for Pro and Premium (once Gemini image billing is enabled).
7. **Virtual try-on (Mode B)** via a dedicated provider, with explicit per-photo consent and clear "simulation" labelling.
8. **Shop the look:** affiliate links to Indian retailers (Myntra, Ajio, Nykaa Fashion) with transparent disclosure.
9. **Smarter personalisation:** learn from ratings and saved looks; seasonal and festival calendars (Diwali, Eid, weddings).
10. **Mobile app (PWA):** installable, offline lookbook, push reminders ("Tomorrow's office outfit?").
11. **Admin extras:** CSV export, cohort and retention charts, refund workflow, email broadcasts.
12. **Scheduled jobs:** expire passes, clean orphaned uploads, daily metrics snapshot (Vercel Cron).
