import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
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
    "Find memory care facilities with real state inspection records, deficiency histories, and staffing data. No referral commissions. Florida available now.",
  openGraph: {
    title: "Find memory care you can actually trust | StarlynnCare",
    description:
      "Real inspection records. No commissions. Built for families searching for memory care in Florida.",
    url: "https://www.starlynncare.com",
    siteName: "StarlynnCare",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Find memory care you can actually trust | StarlynnCare",
    description:
      "Real inspection records. No commissions. Built for families searching for memory care in Florida.",
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
        {/* Google Tag Manager placeholder — replace GTM-XXXXXXX with your ID */}
        {/* <script dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-XXXXXXX');` }} /> */}
      </head>
      <body>{children}</body>
    </html>
  );
}
