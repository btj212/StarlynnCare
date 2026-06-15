import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Run in Node environment (server-side code, no DOM needed)
    environment: "node",
    // Test files
    include: ["tests/typescript/**/*.test.ts"],
    // Globals (describe, it, expect) without importing
    globals: true,
    // Timeout per test (ms) — government APIs and DB can be slow
    testTimeout: 60_000,
    // Run tests serially to avoid overwhelming Supabase rate limits
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Reporter
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      // Match Next.js path aliases so imports like @/lib/... work
      "@": resolve(__dirname, "src"),
    },
  },
});
