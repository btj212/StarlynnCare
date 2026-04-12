import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export interface WaitlistEntry {
  email: string;
  zip?: string;
  path: "planning" | "crisis" | "hero" | "footer";
  createdAt: string;
}

export async function addToWaitlist(entry: WaitlistEntry): Promise<void> {
  const client = getRedis();
  if (!client) {
    // Dev fallback: log and continue without storing
    console.log("[waitlist] Redis not configured. Entry:", entry);
    return;
  }
  await client.set(`waitlist:${entry.email}`, JSON.stringify(entry));
}
