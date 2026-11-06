# Vibe Coder ka SaaS Guide – Sales Landing Page

Plain HTML/CSS/JS static site (no build step). Is folder ko kisi bhi static host par
deploy karein (Vercel, Netlify, GitHub Pages, Hostinger).

## Launch se pehle ye karein

1. **`config.js`** kholein aur bharein:
   - `PAYMENT_LINK` – Razorpay / Instamojo / Cosmofeed payment page link (saare "Kharido" buttons)
   - `DOWNLOAD_LINK` – ebook PDF ka link (/thank-you page ka download button)
   - `CONTACT_EMAIL`, `WHATSAPP_NUMBER`
2. **Images replace karein** (same naam, compressed; WebP-quality PNG/JPG, 600×800 px):
   `cover.png`, `preview1.png`, `preview2.png`, `preview3.png`, `author.png` (300×300).
   Tip: [squoosh.app](https://squoosh.app) se har image 100 KB se kam rakhein.
3. **`index.html`** mein:
   - `YOUR-DOMAIN.com` (og:image, og:url) ko apne domain se badlein. WhatsApp preview ke liye zaroori.
   - Meta Pixel aur Google Analytics code `<head>` ke comments mein paste karein (thank-you.html mein bhi).
   - `[Author bio yahan likhein]` aur FAQ ka `[Apni refund policy yahan likhein]` bharein.
   - Reviews: sirf asli buyer reviews add karein. Section tab tak apne aap hidden rehta hai
     jab tak koi `.review-card` nahi hota (format comment mein diya hai).
4. **Policy pages** (`privacy-policy.html`, `terms.html`, `refund-policy.html`, `contact.html`)
   ke saare `[...]` placeholders bharein. Razorpay approval ke liye ye zaroori hain.
5. **Razorpay** Payment Page settings mein "Redirect after payment" URL set karein:
   `https://YOUR-DOMAIN.com/thank-you` (Vercel par `vercel.json` clean URLs deta hai;
   Netlify bhi `/thank-you` serve karta hai. Doosre hosts par `/thank-you.html` use karein.)

> Note: `/thank-you` page public hai, to `DOWNLOAD_LINK` jo bhi us URL ko jaanta hai use mil sakta hai.
> Agar ye chinta ki baat hai, to Razorpay/Cosmofeed ki built-in digital file delivery use karein.

## Local preview
```bash
python3 -m http.server 8000
```
Phir http://localhost:8000 kholein.
