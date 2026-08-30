import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // ⛔ HSTS. Without it a browser's FIRST visit to rahmatherapy.uk
            // still goes out over plain http before the redirect upgrades it,
            // and the staff session cookie can ride along in the clear on a
            // shared network. The `secure` flag added to that cookie is only
            // half the protection; this is the other half.
            //
            // ⚠️ `preload` is deliberately NOT set. Getting onto the browser
            // preload list is effectively irreversible for months, and it would
            // commit every present and future subdomain to https-only. Two
            // years is the list's minimum age anyway, so this is the right
            // value with or without a later decision to preload.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    localPatterns: [
      {
        pathname: "/images/**",
        search: "",
      },
    ],
  },
  trailingSlash: true,
  turbopack: {
    root: ROOT_DIR,
  },
};

export default withSentryConfig(nextConfig, {
  org: "lanternvale",
  project: "rahmatherapy-next-refactor",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
