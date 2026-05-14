import { addLoopsContact } from "@/lib/loops";

export interface WaitlistEntry {
  email: string;
  zip?: string;
  path: "planning" | "crisis" | "hero" | "footer";
  createdAt: string;
}

export async function addToWaitlist(entry: WaitlistEntry): Promise<void> {
  await addLoopsContact({
    email: entry.email,
    userGroup: "waitlist",
    source: entry.path,
    ...(entry.zip ? { zip: entry.zip } : {}),
  });
}
