# Outfit Checker 👗✨

Ek simple webapp: user **apni photo upload karta hai**, **mood chunta hai** (Date night, Friends ke saath ghumna, Party/Wedding, Office/Interview), aur AI:

1. **Current outfit ko score karta hai** (0–10) — kya achha hai, kya improve karna hai.
2. **Ek better outfit suggest karta hai** — pieces, colours, ₹ price andaaza, grooming tip.
3. **User ki hi photo par naya outfit pehna ke realistic photo banata hai** (virtual try-on). Chehra, pose aur background wahi rehte hain, sirf kapde badalte hain.

Login ki zaroorat nahi. Photo server par **save nahi hoti** — sirf AI processing ke liye Google Gemini ko jaati hai.

## Chalane ka tareeka

Sirf **Node.js 22+** chahiye. `npm install` ki zaroorat nahi (koi dependency nahi hai).

```bash
cd outfit-checker
cp .env.example .env      # phir .env me GEMINI_API_KEY daalo
npm start                 # http://localhost:3000
```

Bina API key ke UI dekhna ho to demo mode (fake, clearly-labelled results):

```bash
npm run demo
```

Tests: `npm test`

## Gemini API key

1. https://aistudio.google.com/apikey se key banao aur `.env` me `GEMINI_API_KEY=` me daalo.
2. **Realistic try-on photo ke liye billing on karni padegi** — free tier me image model ka quota nahi hota. Bina billing ke outfit check/suggestion chalega, lekin try-on photo par error aayega.
3. Model names `.env` me badal sakte ho (`GEMINI_MODEL`, `GEMINI_IMAGE_MODEL`).

## Kaise kaam karta hai

| Step | Kya hota hai |
|---|---|
| Browser | Photo ko 1280px tak chhota karke JPEG banata hai (EXIF / location data hat jaata hai). |
| `POST /api/check` | Gemini text model photo + mood/mausam/budget dekh ke JSON deta hai: score, feedback, suggested outfit, aur try-on ke liye kapdon ka description. |
| `POST /api/tryon` | Gemini image model user ki photo edit karta hai — sirf kapde badalte hain. Result par "AI preview" label lagta hai. |

## Files

```
server.mjs          Node HTTP server (static files + API, security headers, per-IP rate limit)
lib/config.mjs      Moods, mausam, budget options
lib/prompts.mjs     AI prompts + JSON schema
lib/gemini.mjs      Gemini REST client (model fallback, timeouts, error messages)
lib/validate.mjs    Input validation (consent, image type check by bytes, size limits)
lib/mock.mjs        Demo-mode data
public/             index.html, styles.css, app.js
test/               node:test tests
```

## Deploy

Koi bhi Node host chalega (Render, Railway, Fly.io, VPS): start command `node server.mjs`, aur env me `GEMINI_API_KEY` set karo. `PORT` host khud deta hai.

## Privacy / safety

- Upload se pehle consent checkbox (apni photo, 18+).
- Photos memory me process hoti hain, disk/database par save nahi hoti.
- Try-on image par hamesha "AI preview" label; footer me likha hai ki image AI-generated hai aur prices andaaza hain.
- AI ko instruction hai ki body/skin/face par negative comment na kare, aur bachchon ki photo par kaam na kare.
- Rate limit: per IP per ghanta 30 requests (try-on = 2).
