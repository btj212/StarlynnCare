import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memory Care Facilities — Real Inspection Records | StarlynnCare",
  description:
    "Find memory care facilities with real state inspection records, deficiency histories, and staffing data. No referral commissions. Starting in Alameda County, California.",
  openGraph: {
    title: "Find memory care you can actually trust | StarlynnCare",
    description:
      "Real inspection records. No commissions. Built for families searching for memory care in Alameda County, California.",
    url: "https://www.starlynncare.com",
    siteName: "StarlynnCare",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Find memory care you can actually trust | StarlynnCare",
    description:
      "Real inspection records. No commissions. Built for families searching for memory care in Alameda County, California.",
  },
  metadataBase: new URL("https://www.starlynncare.com"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-19JKWKER15" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-19JKWKER15');
        `}} />
      </head>
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
