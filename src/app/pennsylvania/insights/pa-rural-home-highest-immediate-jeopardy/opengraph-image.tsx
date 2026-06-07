import { ImageResponse } from "next/og";
import { PaInsightsOgTemplate } from "@/lib/og/paInsightsTemplate";

export const alt =
  "A 48-bed rural PA home holds the state's highest immediate-jeopardy count — StarlynnCare";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <PaInsightsOgTemplate
      heroStat="21 IJ findings"
      headline="A 48-bed rural PA home holds the state's highest immediate-jeopardy count"
      eyebrow="Immediate jeopardy · PA DHS OLTL"
    />,
    { ...size },
  );
}
