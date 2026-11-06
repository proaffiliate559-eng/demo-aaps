/** Clearly-labelled demo data, used only when AI_MODE=mock (no API key needed). */
export function mockSuggestion(mood) {
  const titles = {
    date: "Soft Romantic Evening",
    friends: "Easy Weekend Cool",
    party: "Festive Glow",
    office: "Sharp & Confident",
  };
  return {
    mock: true,
    photo_ok: true,
    photo_issue: "",
    current_outfit: {
      description: "DEMO MODE — ye asli AI analysis nahi hai.",
      score: 6,
      verdict: "Demo: look theek hai, thoda upgrade ho sakta hai!",
      works: ["Demo point: colours simple hain"],
      improve: ["Demo point: footwear upgrade karo"],
    },
    suggestion: {
      title: `${titles[mood] ?? "Demo Look"} (demo)`,
      vibe: "Demo vibe",
      pieces: [
        { type: "top", item: "Ivory linen shirt, relaxed fit", est_price_inr: 1200 },
        { type: "bottom", item: "Navy straight-fit chinos", est_price_inr: 1500 },
        { type: "footwear", item: "White leather sneakers", est_price_inr: 2000 },
      ],
      colors: [
        { name: "Ivory", hex: "#F6F1E7" },
        { name: "Navy", hex: "#1F2A44" },
      ],
      why: "Ye demo data hai. Asli suggestion ke liye GEMINI_API_KEY set karo.",
      grooming_tip: "Demo tip: hair neat rakho.",
      tryon_description: "an ivory relaxed-fit linen shirt, navy straight-fit chinos and white leather sneakers",
    },
  };
}
