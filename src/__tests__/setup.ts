/**
 * Vitest global setup.
 *
 * Loads .env.local so all tests get real credentials automatically
 * when running locally. In CI, set env vars directly.
 */
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from repo root (where DATABASE_URL, SUPABASE keys live)
config({ path: resolve(process.cwd(), ".env.local") });
