import type { MetadataRoute } from "next";

const DISALLOWED = ["/admin", "/admin/", "/api/", "/unlock", "/sign-in", "/preferences", "/unsubscribe"];

/**
 * These agents may read the facility JSON. `/api/facilities/` is the longer
 * match, so it wins over `Disallow: /api/`. Every other crawler still skips
 * `/api/`, and the responses stay noindex.
 */
const AI_AGENTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_AGENTS.map((userAgent) => ({
        userAgent,
        allow: ["/", "/api/facilities/"],
        disallow: DISALLOWED,
      })),
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED,
      },
    ],
    sitemap: "https://www.starlynncare.com/sitemap.xml",
  };
}
