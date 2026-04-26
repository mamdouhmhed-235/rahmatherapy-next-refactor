import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "export",
  distDir: process.env.NEXT_DIST_DIR || "dist",
  images: {
    unoptimized: true,
    localPatterns: [
      {
        pathname: "/images/**",
        search: "",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
      },
    ],
  },
  trailingSlash: true,
  turbopack: {
    root: ROOT_DIR,
  },
};

export default nextConfig;
