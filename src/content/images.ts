import type { ImageAsset } from "@/types/content";

function localImage(options: {
  alt: string;
  publicPath: string;
  width: number;
  height: number;
  sizes?: string;
  loading?: "eager" | "lazy";
  priority?: boolean;
}): ImageAsset {
  return {
    kind: "local",
    src: options.publicPath,
    alt: options.alt,
    width: options.width,
    height: options.height,
    publicPath: options.publicPath,
    sizes: options.sizes,
    loading: options.loading ?? (options.priority ? "eager" : "lazy"),
    priority: options.priority,
  };
}

export const siteImages = {
  rahmaLogoRefined: localImage({
    alt: "Rahma Therapy",
    publicPath: "/images/brand/rahma/logo-refined.svg",
    width: 1600,
    height: 587,
    sizes: "(max-width: 767px) 132px, 168px",
    priority: true,
  }),
  rahmaLogoMark: localImage({
    alt: "Rahma Therapy brand mark",
    publicPath: "/images/brand/rahma/logo-mark.svg",
    width: 512,
    height: 512,
    sizes: "72px",
  }),
  rahmaSocialPreview: localImage({
    alt: "Rahma Therapy",
    publicPath: "/images/brand/rahma/social-preview.png",
    width: 1200,
    height: 630,
    sizes: "1200px",
  }),
} as const satisfies Record<string, ImageAsset>;

export type SiteImageKey = keyof typeof siteImages;

export function getSiteImage(key: SiteImageKey) {
  return siteImages[key];
}
