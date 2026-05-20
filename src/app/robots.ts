import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Audit M4 — admin is gated by Clerk + ADMIN_EMAILS so content does
      // not leak, but the URL surface should not be in any crawler index.
      // /api is excluded so internal endpoints aren't surfaced as search
      // results. /unlock and /sign-in are auth surfaces and add no value
      // to the index.
      disallow: ["/admin", "/admin/", "/api/", "/unlock", "/sign-in"],
    },
    sitemap: "https://www.starlynncare.com/sitemap.xml",
  };
}
