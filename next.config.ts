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
  async headers() {
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
    ];
  },
};

export default nextConfig;
