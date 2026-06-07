import { ImageResponse } from "next/og";
import { PaInsightsOgTemplate } from "@/lib/og/paInsightsTemplate";

export const alt =
  "Bigger isn't safer: PA's largest memory care facilities average nearly 4× more severe citations — StarlynnCare";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <PaInsightsOgTemplate
      heroStat="5.1 avg severe"
      headline="Bigger isn't safer: PA's XL facilities average nearly 4× more severe citations than small homes"
      eyebrow="Facility size analysis · PA DHS OLTL"
    />,
    { ...size },
  );
}
