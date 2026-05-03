import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
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
  openGraph: {
    title: "California Memory Care, Ranked by Inspection Data | StarlynnCare",
    description:
      "Real inspection records. No commissions. Built for families searching for memory care in California.",
    url: "https://www.starlynncare.com",
    siteName: "StarlynnCare",
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "StarlynnCare",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "California Memory Care, Ranked by Inspection Data | StarlynnCare",
    description:
      "Real inspection records. No commissions. Built for families searching for memory care in California.",
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
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-19JKWKER15" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-19JKWKER15');
        `}} />
        <script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="IjDNyQvSmnNGFMK02hdywA"
          async
        />
      </head>
      <body>
        {/* GovernanceBar rendered per-page inside page layouts, not globally, to avoid auth pages */}
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
