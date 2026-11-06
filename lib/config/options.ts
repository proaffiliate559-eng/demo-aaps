/** Option lists for onboarding, profile editing and (later) outfit generation. */

export type Option<V extends string = string> = { value: V; label: string; hint?: string };

const opts = <const T extends readonly { value: string; label: string; hint?: string }[]>(o: T) => o;

export const GENDER_PREFERENCES = opts([
  { value: "womenswear", label: "Womenswear" },
  { value: "menswear", label: "Menswear" },
  { value: "gender_neutral", label: "Gender-neutral / both" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
]);

export const AGE_GROUPS = opts([
  { value: "under_18", label: "Under 18" },
  { value: "18_24", label: "18–24" },
  { value: "25_34", label: "25–34" },
  { value: "35_44", label: "35–44" },
  { value: "45_54", label: "45–54" },
  { value: "55_plus", label: "55+" },
]);

export const LANGUAGES = opts([
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)", hint: "Interface coming soon — your stylist will remember the preference" },
]);

export const STYLES = opts([
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "streetwear", label: "Streetwear" },
  { value: "traditional", label: "Traditional" },
  { value: "minimalist", label: "Minimalist" },
  { value: "luxury", label: "Luxury" },
  { value: "sporty", label: "Sporty" },
  { value: "smart_casual", label: "Smart casual" },
]);

export const COLOURS = opts([
  { value: "black", label: "Black", hint: "#141414" },
  { value: "white", label: "White", hint: "#f7f5f0" },
  { value: "blue", label: "Blue", hint: "#2f4e7a" },
  { value: "red", label: "Red", hint: "#a8323a" },
  { value: "green", label: "Green", hint: "#4c6b48" },
  { value: "beige", label: "Beige", hint: "#d8c7ac" },
  { value: "brown", label: "Brown", hint: "#6e4b33" },
  { value: "pastel", label: "Pastel", hint: "linear-gradient(135deg,#f6d6dc,#d7e6f5,#e3f1d9)" },
]);

export const BUDGETS = [
  { value: "under_500", label: "Under ₹500", min: 0, max: 500 },
  { value: "500_1000", label: "₹500–₹1,000", min: 500, max: 1000 },
  { value: "1000_2000", label: "₹1,000–₹2,000", min: 1000, max: 2000 },
  { value: "2000_5000", label: "₹2,000–₹5,000", min: 2000, max: 5000 },
  { value: "above_5000", label: "Above ₹5,000", min: 5000, max: null },
] as const;

export const OCCASIONS = opts([
  { value: "college", label: "College" },
  { value: "office", label: "Office" },
  { value: "party", label: "Party" },
  { value: "date", label: "Date" },
  { value: "wedding", label: "Wedding" },
  { value: "travel", label: "Travel" },
  { value: "daily_wear", label: "Daily wear" },
  { value: "festival", label: "Festival" },
]);

export const FITS = opts([
  { value: "slim", label: "Slim" },
  { value: "regular", label: "Regular" },
  { value: "relaxed", label: "Relaxed" },
  { value: "oversized", label: "Oversized" },
]);

export const TOP_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;
export const WAIST_SIZES = ["26", "28", "30", "32", "34", "36", "38", "40", "42"] as const;
export const SHOE_SIZES_UK = ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

export const HEIGHT_RANGES = opts([
  { value: "under_150", label: "Under 150 cm" },
  { value: "150_160", label: "150–160 cm" },
  { value: "160_170", label: "160–170 cm" },
  { value: "170_180", label: "170–180 cm" },
  { value: "180_190", label: "180–190 cm" },
  { value: "over_190", label: "Over 190 cm" },
]);

export const MODESTY = opts([
  { value: "no_preference", label: "No preference" },
  { value: "standard", label: "Standard coverage" },
  { value: "more_coverage", label: "More coverage", hint: "Longer hemlines, higher necklines" },
  { value: "full_coverage", label: "Full coverage", hint: "Full sleeves, ankle length" },
]);

export const values = <T extends readonly { value: string }[]>(o: T) =>
  o.map((x) => x.value) as unknown as [T[number]["value"], ...T[number]["value"][]];

export function labelOf(list: readonly { value: string; label: string }[], value: string | null | undefined) {
  return list.find((o) => o.value === value)?.label ?? value ?? "";
}

export function budgetKeyFromRange(min: number | null, max: number | null) {
  return BUDGETS.find((b) => b.min === min && b.max === max)?.value ?? null;
}

// ── Outfit generator ───────────────────────────────────────────────────
export const MOODS = [
  { value: "happy", label: "Happy", emoji: "☀️", hint: "Bright and cheerful" },
  { value: "confident", label: "Confident", emoji: "✨", hint: "Sharp and self-assured" },
  { value: "romantic", label: "Romantic", emoji: "🌹", hint: "Soft and dreamy" },
  { value: "relaxed", label: "Relaxed", emoji: "🌿", hint: "Easy and comfortable" },
  { value: "sad", label: "Low-key", emoji: "🌧️", hint: "Cosy comfort, gentle colours" },
  { value: "energetic", label: "Energetic", emoji: "⚡", hint: "Bold and lively" },
  { value: "professional", label: "Professional", emoji: "💼", hint: "Polished and capable" },
  { value: "creative", label: "Creative", emoji: "🎨", hint: "Expressive and playful" },
  { value: "elegant", label: "Elegant", emoji: "🕊️", hint: "Refined and graceful" },
  { value: "adventurous", label: "Adventurous", emoji: "🧭", hint: "Ready for anything" },
] as const;

export const GEN_OCCASIONS = opts([
  { value: "college", label: "College" },
  { value: "office", label: "Office" },
  { value: "party", label: "Party" },
  { value: "date_night", label: "Date night" },
  { value: "wedding", label: "Wedding" },
  { value: "travel", label: "Travel" },
  { value: "shopping", label: "Shopping" },
  { value: "gym", label: "Gym" },
  { value: "casual_outing", label: "Casual outing" },
  { value: "festival", label: "Festival" },
]);

export const GEN_STYLES = opts([
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "streetwear", label: "Streetwear" },
  { value: "traditional", label: "Traditional" },
  { value: "minimalist", label: "Minimalist" },
  { value: "luxury", label: "Luxury" },
  { value: "sporty", label: "Sporty" },
  { value: "korean", label: "Korean-inspired" },
  { value: "indo_western", label: "Indo-western" },
]);

export const WEATHER = [
  { value: "hot", label: "Hot", hint: "Above 30°C" },
  { value: "pleasant", label: "Pleasant", hint: "20–30°C" },
  { value: "cold", label: "Cold", hint: "Below 20°C" },
  { value: "rainy", label: "Rainy", hint: "Monsoon showers" },
] as const;

// ── Wardrobe ───────────────────────────────────────────────────────────
export const WARDROBE_CATEGORIES = opts([
  { value: "shirts", label: "Shirts" },
  { value: "t_shirts", label: "T-shirts" },
  { value: "trousers", label: "Trousers" },
  { value: "jeans", label: "Jeans" },
  { value: "jackets", label: "Jackets" },
  { value: "dresses", label: "Dresses" },
  { value: "skirts", label: "Skirts" },
  { value: "shoes", label: "Shoes" },
  { value: "accessories", label: "Accessories" },
  { value: "traditional", label: "Traditional" },
]);

export const SEASONS = opts([
  { value: "all", label: "All seasons" },
  { value: "summer", label: "Summer" },
  { value: "monsoon", label: "Monsoon" },
  { value: "winter", label: "Winter" },
]);
