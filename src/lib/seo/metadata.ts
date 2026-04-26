import type { Metadata } from "next";
import { getSiteImage, type SiteImageKey } from "@/content/images";
import { siteIdentity } from "@/content/site/identity";
import { siteSeo } from "@/content/site/seo";
import type { PageSeo } from "@/types/content";

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    return new URL(value.endsWith("/") ? value : `${value}/`);
  } catch {
    return null;
  }
}

function getImageUrl(imageKey?: SiteImageKey) {
  if (!imageKey) {
    return undefined;
  }

  const image = getSiteImage(imageKey);
  const siteUrl = getSiteUrl();

  if (siteUrl && "publicPath" in image && typeof image.publicPath === "string") {
    return new URL(image.publicPath, siteUrl).toString();
  }

  if (image.sourceUrl) {
    return image.sourceUrl;
  }

  if (typeof image.src === "string") {
    return image.src;
  }

  return image.src.src;
}

export function buildRootMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const defaultImageUrl = getImageUrl(siteSeo.defaultOgImage);

  return {
    metadataBase: siteUrl ?? undefined,
    title: {
      default: siteSeo.defaultTitle,
      template: "%s",
    },
    description: siteSeo.defaultDescription,
    applicationName: siteIdentity.name,
    openGraph: {
      title: siteSeo.defaultTitle,
      description: siteSeo.defaultDescription,
      siteName: siteSeo.siteName,
      type: "website",
      locale: "en_GB",
      url: siteUrl ? "/" : undefined,
      images: defaultImageUrl
        ? [
            {
              url: defaultImageUrl,
              alt: siteIdentity.logo.alt,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: siteSeo.defaultTitle,
      description: siteSeo.defaultDescription,
      images: defaultImageUrl ? [defaultImageUrl] : undefined,
    },
  };
}

export function buildPageMetadata(
  seo: PageSeo<SiteImageKey>
): Metadata {
  const siteUrl = getSiteUrl();
  const title = seo.title;
  const description = seo.description;
  const openGraphTitle = seo.ogTitle ?? title;
  const openGraphDescription = seo.ogDescription ?? description;
  const imageUrl = getImageUrl(seo.ogImage ?? siteSeo.defaultOgImage);

  return {
    title,
    description,
    alternates: siteUrl
      ? {
          canonical: seo.path,
        }
      : undefined,
    openGraph: {
      title: openGraphTitle,
      description: openGraphDescription,
      siteName: siteSeo.siteName,
      type: "website",
      locale: "en_GB",
      url: siteUrl ? seo.path : undefined,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: openGraphTitle,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: openGraphTitle,
      description: openGraphDescription,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}
