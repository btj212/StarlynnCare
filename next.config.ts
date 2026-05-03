import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
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
      {
        source: "/library",
        destination: "/library/type-a-vs-type-b-deficiencies-explained",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
