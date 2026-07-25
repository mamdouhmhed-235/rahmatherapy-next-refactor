import type { Metadata } from "next";
import { Cormorant_Garamond, Urbanist, Work_Sans } from "next/font/google";
import "react-day-picker/style.css";
import "@/styles/site-parity.css";
import "./globals.css";
import { SentryProvider } from "@/components/SentryProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://rahmatherapy.co.uk"),
  title: "Mobile Hijama, Cupping & Massage Therapy in Luton | Rahma Therapy",
  description:
    "Mobile hijama, cupping, massage and soft-tissue therapy in Luton and surrounding areas.",
  icons: {
    icon: [
      { url: "/images/brand/rahma/favicon.svg", type: "image/svg+xml" },
      { url: "/images/brand/rahma/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/brand/rahma/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/images/brand/rahma/apple-touch-icon.png",
    shortcut: "/images/brand/rahma/favicon.ico",
  },
  openGraph: {
    siteName: "Rahma Therapy",
    title: "Mobile Hijama, Cupping & Massage Therapy in Luton | Rahma Therapy",
    description:
      "Mobile hijama, cupping, massage and soft-tissue therapy in Luton and surrounding areas.",
    images: [
      {
        url: "/images/brand/rahma/social-preview.png",
        width: 1200,
        height: 630,
        alt: "Rahma Therapy",
      },
    ],
  },
};

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-urbanist",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-work-sans",
  display: "swap",
});

const adminSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-admin-serif",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${urbanist.variable} ${workSans.variable} ${adminSerif.variable}`}>
      <body>
        <SentryProvider />
        {children}
      </body>
    </html>
  );
}
