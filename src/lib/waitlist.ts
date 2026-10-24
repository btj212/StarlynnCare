import { registerCustomerCommitment } from "@/lib/customers/commitments";

export interface WaitlistEntry {
  email: string;
  zip?: string;
  path: "planning" | "crisis" | "hero" | "footer";
  createdAt: string;
}

export async function addToWaitlist(entry: WaitlistEntry): Promise<void> {
  const email = entry.email.trim().toLowerCase();
  await registerCustomerCommitment({
    email,
    product: "waitlist",
    subjectKey: entry.zip?.trim() || entry.path,
    source: entry.path,
    status: "active",
    metadata: { zip: entry.zip ?? null, path: entry.path },
    contact: {
      email,
      userGroup: "waitlist",
      source: entry.path,
      journeyStage: "orientation",
    },
  });
}
