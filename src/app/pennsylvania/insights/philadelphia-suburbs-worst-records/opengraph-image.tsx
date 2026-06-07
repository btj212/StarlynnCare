import { ImageResponse } from "next/og";
import { PaInsightsOgTemplate } from "@/lib/og/paInsightsTemplate";

export const alt =
  "Philadelphia's affluent suburbs have some of PA's worst memory care records — StarlynnCare";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <PaInsightsOgTemplate
      heroStat="80.1 def/facility"
      headline="Philadelphia's affluent suburbs have some of PA's worst memory care records"
      eyebrow="County comparison · PA DHS OLTL"
    />,
    { ...size },
  );
}
