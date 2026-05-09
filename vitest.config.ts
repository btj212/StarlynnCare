import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    sequence: {
      // Run files sequentially: avoids hammering Supabase with parallel connections
      // and keeps rate-limit tests predictable.
      concurrent: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
