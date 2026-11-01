import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
