import { Resend } from "resend";
import { canonicalFor } from "@/lib/seo/canonical";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWatchConfirmation({
  to,
  facilityName,
  confirmationToken,
}: {
  to: string;
  facilityName: string;
  confirmationToken: string;
}): Promise<void> {
  const confirmUrl = canonicalFor(`/watch/confirm/${confirmationToken}`);
  const unsubscribeUrl = canonicalFor(`/watch/unsubscribe/${confirmationToken}`);
  await resend.emails.send({
    from: "StarlynnCare <hello@starlynncare.com>",
    to,
    subject: `Confirm your watch for ${facilityName}`,
    html: `
      <p>You asked to be notified when <strong>${facilityName}</strong>'s inspection record changes.</p>
      <p><a href="${confirmUrl}" style="background:#1A3D3B;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;margin:12px 0">Confirm my watch</a></p>
      <p style="color:#666;font-size:14px">If you didn't request this, ignore this email. <a href="${unsubscribeUrl}">Unsubscribe</a>.</p>
      <p style="color:#666;font-size:12px">StarlynnCare · Independent memory care research · No facility payments.</p>
    `,
  });
}
