/** Curated styling tips (editorial content). Tagged so we can match a user's profile. */
export interface StyleTip {
  id: string;
  tip: string;
  tags: string[]; // style, occasion, colour or weather values from lib/config/options
}

export const STYLE_TIPS: StyleTip[] = [
  { id: "t1", tip: "Roll shirt sleeves to just below the elbow — it reads relaxed but intentional.", tags: ["casual", "smart_casual", "office"] },
  { id: "t2", tip: "Pair one statement piece with neutrals so the outfit has a clear focal point.", tags: ["streetwear", "party", "luxury"] },
  { id: "t3", tip: "Linen and cotton breathe best in Indian summers; skip polyester for daytime events.", tags: ["casual", "traditional", "daily_wear", "travel"] },
  { id: "t4", tip: "For festivals, anchor a bright kurta with neutral bottoms and let jewellery do the rest.", tags: ["traditional", "festival", "wedding"] },
  { id: "t5", tip: "Monochrome outfits (one colour, different shades) instantly look more expensive.", tags: ["minimalist", "luxury", "black", "beige", "white"] },
  { id: "t6", tip: "White sneakers work with chinos, jeans and even a casual kurta — keep them clean.", tags: ["casual", "smart_casual", "college", "white"] },
  { id: "t7", tip: "Match your belt to your shoes for a polished office look.", tags: ["formal", "office", "brown", "black"] },
  { id: "t8", tip: "Oversized tops look best balanced with a slimmer or straight bottom.", tags: ["streetwear", "college", "casual"] },
  { id: "t9", tip: "For date night, choose one texture that invites a closer look — satin, knit or suede.", tags: ["date", "party", "luxury"] },
  { id: "t10", tip: "Carry a light overshirt or shrug for over-air-conditioned offices and cinemas.", tags: ["office", "college", "travel", "smart_casual"] },
  { id: "t11", tip: "In the monsoon, quick-dry fabrics and darker bottoms hide splashes better.", tags: ["daily_wear", "travel", "blue", "black"] },
  { id: "t12", tip: "Pastels pair beautifully with white and beige — keep accessories gold or tan.", tags: ["pastel", "beige", "white", "date"] },
  { id: "t13", tip: "Sporty doesn't mean sloppy: well-fitted joggers and a clean tee look sharp off-duty.", tags: ["sporty", "casual", "travel"] },
  { id: "t14", tip: "Indo-western tip: a short kurta over straight jeans is easy, comfortable and festive.", tags: ["traditional", "festival", "college", "party"] },
  { id: "t15", tip: "Earthy greens and browns flatter most Indian skin tones — great for everyday wear.", tags: ["green", "brown", "daily_wear", "casual"] },
];

/** Deterministic daily selection: profile-matched tips first, rotated by day. */
export function pickTips(tags: string[], count = 3, now = new Date()) {
  const set = new Set(tags);
  const scored = STYLE_TIPS.map((t) => ({ t, score: t.tags.filter((x) => set.has(x)).length }));
  const matched = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.t);
  const pool = matched.length >= count ? matched : [...matched, ...STYLE_TIPS.filter((t) => !matched.includes(t))];
  const day = Math.floor(now.getTime() / 86_400_000);
  const offset = day % pool.length;
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(offset + i) % pool.length]);
}
