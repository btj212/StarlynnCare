/**
 * Vitest global setup — loads .env.local / .env from the repo root so
 * NEXT_PUBLIC_SUPABASE_URL and keys are available in test runs.
 */

import { config } from "dotenv";
import { resolve } from "path";

const repoRoot = resolve(__dirname, "../../");

// Load .env.local first (takes precedence), then .env
config({ path: resolve(repoRoot, ".env.local") });
config({ path: resolve(repoRoot, ".env") });
