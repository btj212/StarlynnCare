import { ImageResponse } from "next/og";
import { isFacilityUuid } from "@/lib/partners/gate";
import { loadPublicPartnerPanel } from "@/lib/partners/panel";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ facilityId: string }> },
) {
  const { facilityId } = await context.params;
  if (!isFacilityUuid(facilityId)) {
    return new Response("Not found", { status: 404 });
  }
  const panel = await loadPublicPartnerPanel(facilityId);
  if (!panel) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#f4efe6",
          color: "#1c1915",
          padding: "16px 22px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" }}>
            StarlynnCare
          </div>
          <div style={{ fontSize: 22, marginTop: 4 }}>Verified partner</div>
        </div>
        <div style={{ fontSize: 13, maxWidth: 260, textAlign: "right" }}>{panel.communityName}</div>
      </div>
    ),
    {
      width: 480,
      height: 96,
      headers: { "Cache-Control": "public, max-age=300" },
    },
  );
}
