import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { recordSubmission } from "@/lib/submissions/recordSubmission";
import {
  commitmentIdempotencyKey,
  recordCustomerDelivery,
  registerCustomerCommitment,
} from "@/lib/customers/commitments";
import { addBusinessDays, requestWindowKey } from "@/lib/customers/sla";
import { rateLimit, clientIp } from "@/lib/security/rateLimit";
import { isValidEmail } from "@/lib/security/email";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(req: NextRequest) {
  const limit = await rateLimit(`contract-review:${clientIp(req)}`, 3, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const email = formData.get("email");
  const file = formData.get("file");

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "A document file is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large — maximum 10 MB" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only PDF, Word (.docx), JPEG, or PNG files are accepted" },
      { status: 400 },
    );
  }

  const supabase = getServiceClient();

  // Upload to private bucket; path includes timestamp so filenames don't collide.
  const timestamp = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const storagePath = `${timestamp}_${safeFilename}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("contract-reviews")
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[contract-review] upload error:", uploadError.message);
    return NextResponse.json({ error: "Upload failed — please try again" }, { status: 500 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const dueAt = addBusinessDays(new Date(), 2).toISOString();
  const registered = await registerCustomerCommitment({
    email: normalizedEmail,
    product: "contract_review",
    subjectKey: "admission-agreement",
    source: "contract_decoder",
    status: "open",
    stage: "file_received",
    dueAt,
    metadata: { storagePath, fileType: file.type },
    contact: {
      email: normalizedEmail,
      userGroup: "offer_contract",
      source: "contract_decoder",
      journeyStage: "decision",
    },
  });

  await recordCustomerDelivery({
    commitmentId: registered.commitmentId,
    idempotencyKey: commitmentIdempotencyKey([
      "file",
      normalizedEmail,
      requestWindowKey(),
    ]),
    kind: "confirmation",
    status: "skipped",
    templateKey: "contract_ack",
    payload: {
      note: "The file is already in the private bucket. The ack template asks the family to reply with a PDF, so it is not sent.",
    },
  });

  recordSubmission({
    type: "contract_review",
    email: normalizedEmail,
    source: "contract_decoder",
    summary: `contract decoder upload · ${file.name.slice(0, 80)}`,
    payload: { storagePath, fileSize: file.size, fileType: file.type, stage: "file_received", dueAt },
  }).catch((err) => console.error("[contract-review] recordSubmission failed:", err));

  return NextResponse.json({ ok: true });
}
