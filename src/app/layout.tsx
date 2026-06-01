import type { Metadata } from "next";
import Script from "next/script";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ShortlistProvider } from "@/lib/shortlist/context";
import { ShortlistBar } from "@/components/shortlist/ShortlistBar";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "optional",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.starlynncare.com"),
  title: "California Memory Care, Ranked by Inspection Data | StarlynnCare",
  description:
    "California memory care with real CDSS inspection records, citations, and quality context. No referral commissions.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "StarlynnCare — Find memory care you can trust, ranked with regulator data.",
    description:
      "Real inspection records. No commissions. Built for families searching for memory care.",
    url: "https://www.starlynncare.com",
    siteName: "StarlynnCare",
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "StarlynnCare — asterisk mark with wordmark on paper background",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StarlynnCare — Find memory care you can trust, ranked with regulator data.",
    description:
      "Real inspection records. No commissions. Built for families searching for memory care.",
    images: ["/og-default.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${interTight.variable} ${jetbrainsMono.variable}`}>
      <body>
        {/* GovernanceBar rendered per-page inside page layouts, not globally, to avoid auth pages */}
        <ClerkProvider>
          <ShortlistProvider>
            {children}
            <ShortlistBar />
          </ShortlistProvider>
        </ClerkProvider>
        <Script src="https://analytics.ahrefs.com/analytics.js" data-key="IjDNyQvSmnNGFMK02hdywA" strategy="afterInteractive" />
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function() {
              if (window.location.hostname !== 'www.starlynncare.com') return;
              // Skip obvious bots/crawlers to keep Clarity bounce/dwell metrics clean.
              // Dashboard filters (Clarity > Filters > IP / User Agent) handle the rest:
              //   - Add UA filters for: Googlebot, bingbot, AhrefsBot, SemrushBot, DataForSeo
              //   - Add UA filter for: Windows NT.*Edge (inflated 85% bounce, 98s avg in audit)
              //   - Add UA filter for: Linux.*Chrome (100% bounce / 0s — crawler signature)
              var ua = navigator.userAgent;
              var botPattern = /bot|crawl|spider|slurp|ahrefsbot|semrush|bytespider|dataforseo/i;
              if (botPattern.test(ua)) return;
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "wroc9wbsaf");
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
