import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Immutable Cache-Control on static chunks — prevents cross-deploy chunk 404s
  // when Ahrefs (or a user's browser) holds a reference to a chunk hash from a
  // previous deploy. Next.js content-hashes every file in /_next/static/ so
  // immutable caching is safe: different content = different URL.
  //
  // Site-wide security headers — audit finding H2. CSP is in Report-Only for now
  // so we can confirm Clerk + Supabase + Ahrefs + Clarity all stay on the
  // allowed origins; flip to Content-Security-Policy (no -Report-Only) once
  // reports come back clean for a few days.
  async headers() {
    const securityHeaders = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      },
      {
        key: "Content-Security-Policy-Report-Only",
        value: [
          "default-src 'self'",
          // 'unsafe-inline' is required by Clerk's bootstrap script and the
          // Clarity tag in app/layout.tsx. Tighten with a nonce later.
          "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://analytics.ahrefs.com https://www.clarity.ms https://*.clarity.ms",
          "connect-src 'self' https://*.supabase.co https://*.clerk.accounts.dev https://*.clerk.com https://analytics.ahrefs.com https://*.clarity.ms https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com",
          "img-src 'self' data: blob: https:",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "worker-src 'self' blob:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Clerk + app use /sign-in; common mistype /signin would 404 without this.
  async redirects() {
    return [
      { source: "/signin", destination: "/sign-in", permanent: true },
      { source: "/signup", destination: "/sign-in", permanent: true },
      {
        source: "/library/memory-care-cost-california",
        destination: "/california/cost-guide",
        permanent: true,
      },
      {
        source: "/california/cirtus-heights",
        destination: "/california/citrus-heights",
        permanent: true,
      },
      {
        source: "/california/cirtus-heights/:path*",
        destination: "/california/citrus-heights/:path*",
        permanent: true,
      },
      // UT guide pages Google crawled that don't exist — redirect to state hub
      {
        source: "/utah/memory-care-vs-nursing-home",
        destination: "/utah",
        permanent: true,
      },
      {
        source: "/utah/memory-care-licensing",
        destination: "/utah",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
