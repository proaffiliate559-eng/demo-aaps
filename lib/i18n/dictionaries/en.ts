/** English copy — the source of truth. Other locales must match this shape. */
export const en = {
  nav: {
    home: "Home",
    howItWorks: "How It Works",
    features: "Features",
    pricing: "Pricing",
    login: "Login",
    getStarted: "Get Started",
    dashboard: "Dashboard",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  hero: {
    eyebrow: "Your AI personal stylist · Made for India",
    titleA: "Your Mood.",
    titleB: "Your Style.",
    titleC: "Your Personal AI Stylist.",
    subtitle: "Discover the perfect outfit for every mood, moment and occasion.",
    primaryCta: "Generate My Outfit",
    secondaryCta: "Explore Features",
    trust: "Free to start · 3 looks a day · No card needed",
  },
  howItWorks: {
    eyebrow: "How it works",
    title: "From mood to outfit in four calm steps",
    steps: [
      { title: "Upload your photo", body: "Optional. Add a photo for more personal suggestions — only with your consent." },
      { title: "Choose your mood", body: "Confident, romantic, relaxed or bold — tell us how you feel today." },
      { title: "Select your occasion", body: "College, office, a wedding or date night, plus weather and budget." },
      { title: "Get three looks", body: "A safe, a trendy and a bold outfit — with pieces, colours and prices in ₹." },
    ],
  },
  features: {
    eyebrow: "Features",
    title: "A stylist that knows your mood, your wardrobe and your city's weather",
    items: [
      { title: "Mood-based styling", body: "Outfits tuned to how you feel, not just what's trending." },
      { title: "AI outfit generator", body: "Three distinct looks per request, validated and explained." },
      { title: "Digital wardrobe", body: "Catalogue what you own and get looks built around it." },
      { title: "Weather-aware", body: "Breathable picks for hot days, layers for cold, smart choices for monsoon." },
      { title: "Personal fashion profile", body: "Your styles, colours, fit and budget remembered for every request." },
      { title: "Save favourite looks", body: "Build a personal lookbook you can revisit, rate and share." },
    ],
  },
  showcase: {
    eyebrow: "Example outfit showcase",
    title: "One request. Three ways to wear it.",
    disclaimer:
      "Illustrative example showing the format of a recommendation. Your looks are generated for your own profile and inputs.",
    request: "Mood: Confident · Occasion: College fest · Weather: Hot · Budget: ₹1,000–₹2,000",
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Start free. Upgrade when it becomes a habit.",
    note: "Prices in INR. Paid plans are prepaid monthly passes — no auto-renewal. Every account starts on Free.",
    perMonth: "/month",
    free: "Free",
    popular: "Most popular",
    ctaFree: "Start free",
    ctaPaid: "Start free, upgrade later",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions, answered",
  },
  cta: {
    title: "Dress for the mood you're in.",
    body: "Create your free fashion profile in under two minutes.",
    button: "Get Started — it's free",
  },
  footer: {
    tagline: "Your mood. Your style. Your personal AI stylist.",
    product: "Product",
    account: "Account",
    legal: "Legal",
    privacy: "Privacy notice",
    terms: "Terms of use",
    signup: "Create account",
    rights: "All rights reserved.",
    madeIn: "Designed for India · Prices in ₹",
  },
};

export type Dictionary = typeof en;
