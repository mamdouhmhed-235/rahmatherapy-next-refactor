import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  devIndicators: false,
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

export default nextConfig;
