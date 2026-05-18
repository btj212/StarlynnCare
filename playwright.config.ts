import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local for BASE_URL
config({ path: resolve(__dirname, ".env.local") });

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Sequential to avoid rate limits on API
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000, // 60s per test (real DB + network)
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // No screenshots — keeps it fast and CI-friendly
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Do NOT start the web server automatically — tests assume a running server.
  // Start with: npm run dev (or set NEXT_PUBLIC_BASE_URL to the deployed URL)
});
