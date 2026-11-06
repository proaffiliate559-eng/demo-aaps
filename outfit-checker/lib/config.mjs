/** Shared constants: moods, weather, limits. Used by server and tests. */

export const MOODS = {
  date: {
    label: "Date night",
    brief:
      "a date (romantic dinner or coffee date). Look attractive, put-together and confident but not overdressed; flattering fit, one statement element, comfortable enough to sit and walk.",
  },
  friends: {
    label: "Friends ke saath ghumna",
    brief:
      "hanging out with friends (cafe, mall, street food, movie). Relaxed, trendy, comfortable for walking all day, photo-ready for group pictures.",
  },
  party: {
    label: "Party / Wedding",
    brief:
      "a party or Indian wedding / festive function. Festive, dressy and celebratory; Indian ethnic or Indo-western is welcome; rich colours and fabrics appropriate to the occasion.",
  },
  office: {
    label: "Office / Interview",
    brief:
      "office or a job interview. Professional, clean, well-fitted smart-formal or smart-casual; conservative colours; looks credible and confident.",
  },
};

export const WEATHER = {
  hot: "hot and humid weather (breathable fabrics like cotton and linen)",
  mild: "pleasant, mild weather",
  cold: "cold weather (layering, warm fabrics)",
  rainy: "rainy / monsoon weather (quick-dry fabrics, no long trailing hems, water-safe footwear)",
};

export const STYLE_FOR = {
  auto: "decide from the photo",
  men: "menswear",
  women: "womenswear",
  unisex: "gender-neutral / unisex clothing",
};

export const BUDGETS = {
  low: "under ₹2,000 total",
  mid: "₹2,000–₹6,000 total",
  high: "₹6,000+ total",
};

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
/** Max decoded image size accepted from the browser (the client already resizes). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_NOTE_CHARS = 200;
