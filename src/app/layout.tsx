import type { Metadata } from "next";
import { Urbanist, Work_Sans } from "next/font/google";
import "react-day-picker/style.css";
import "@/styles/site-parity.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rahmatherapy.co.uk"),
  title: "Mobile Hijama, Cupping & Massage Therapy in Luton | Rahma Therapy",
  description:
    "Mobile hijama, cupping, massage and soft-tissue therapy in Luton and surrounding areas.",
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
