import { defineConfig } from "vitest/config";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ root: resolve(__dirname, "../../") })],
  test: {
    globals: true,
    environment: "node",
    setupFiles: [resolve(__dirname, "./setup.ts")],
    include: [resolve(__dirname, "**/*.test.ts")],
    testTimeout: 60000,
    // Split into fast (pure) and slow (live DB) suites via:
    //   npm run test:pure   (no network, no DB)
    //   npm run test:live   (requires NEXT_PUBLIC_SUPABASE_URL)
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "../../src"),
    },
  },
});
