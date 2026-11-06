import type { MetadataRoute } from "next";

const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacy", "/terms", "/login", "/signup"], disallow: ["/api/", "/admin", "/dashboard", "/generate", "/wardrobe", "/saved", "/stylist", "/profile", "/settings", "/billing", "/onboarding", "/auth/"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
