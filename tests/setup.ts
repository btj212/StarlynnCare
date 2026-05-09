/**
 * Global test setup: loads .env.local so integration tests can reach the
 * real Supabase project without committing credentials.
 *
 * All integration tests call skipIfUnconfigured() and skip gracefully when
 * NEXT_PUBLIC_SUPABASE_URL is absent — so `vitest run` never hard-fails in CI
 * unless credentials are intentionally injected.
 */
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });
