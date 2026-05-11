import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/ts/**/*.test.ts"],
    globals: true,
    setupFiles: ["tests/ts/setup.ts"],
    testTimeout: 30000,
    reporters: ["verbose"],
  },
});
