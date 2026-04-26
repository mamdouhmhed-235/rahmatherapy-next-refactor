import type { Metadata } from "next";
import { Urbanist, Work_Sans } from "next/font/google";
import "react-day-picker/style.css";
import "@/styles/site-parity.css";
import "./globals.css";
import { buildRootMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildRootMetadata();

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: "500",
  variable: "--font-urbanist",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-work-sans",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${urbanist.variable} ${workSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
