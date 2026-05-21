import type { MetadataRoute } from "next";

const DISALLOWED = ["/admin", "/admin/", "/api/", "/unlock", "/sign-in"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Explicit opt-in for AI training/indexing crawlers so our inspection
      // data surfaces in LLM knowledge bases. Keep Disallow matching the
      // wildcard rule so auth surfaces are excluded from all crawlers.
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: DISALLOWED,
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: DISALLOWED,
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: DISALLOWED,
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: DISALLOWED,
      },
      {
        userAgent: "CCBot",
        allow: "/",
        disallow: DISALLOWED,
      },
      // Default — all other crawlers
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED,
      },
    ],
    sitemap: "https://www.starlynncare.com/sitemap.xml",
  };
}
