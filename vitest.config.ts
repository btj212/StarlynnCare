import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // 30 s per test — network calls to production can be slow
    testTimeout: 30_000,
    hookTimeout: 10_000,
    include: ["tests/ts/**/*.test.ts"],
    // Run serially to avoid hammering the production API with 10 concurrent requests
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
