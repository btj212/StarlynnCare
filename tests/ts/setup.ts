/**
 * Vitest global setup.
 *
 * Loads .env.local so tests can read NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and DATABASE_URL.
 */
import path from "node:path";
import { config } from "dotenv";

const root = path.resolve(__dirname, "../../");
config({ path: path.join(root, ".env.local") });
config({ path: path.join(root, ".env") });
