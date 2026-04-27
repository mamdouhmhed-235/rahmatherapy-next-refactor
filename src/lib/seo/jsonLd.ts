import { getSiteImage } from "@/content/images";
import { contactLinks } from "@/content/site/contact";
import { siteIdentity } from "@/content/site/identity";
import { siteSeo } from "@/content/site/seo";
import type {
  FaqItem,
  HomePageContent,
  ServicePageContent,
} from "@/types/content";

type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonLdObject
  | JsonLdValue[];

interface JsonLdObject {
  [key: string]: JsonLdValue;
}

function getSiteUrl(path = "/") {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim() || siteSeo.siteUrl;

  try {
    return new URL(path, value.endsWith("/") ? value : `${value}/`).toString();
  } catch {
    return new URL(path, siteSeo.siteUrl).toString();
  }
}

function getLogoUrl() {
  const logo = getSiteImage(siteIdentity.logo.image);
  const siteUrl = getSiteUrl();

  if (siteUrl && "publicPath" in logo && typeof logo.publicPath === "string") {
    return new URL(logo.publicPath, siteUrl).toString();
  }

  return logo.publicPath;
}

export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildLocalBusinessJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": getSiteUrl("#local-business") ?? "#local-business",
    name: siteIdentity.name,
    legalName: siteIdentity.legalName,
    description: siteIdentity.defaultDescription,
    image: getLogoUrl(),
    url: getSiteUrl(),
    telephone: contactLinks.phone.value,
    email: contactLinks.email.value,
    areaServed: {
      "@type": "AdministrativeArea",
      name: siteIdentity.serviceArea,
    },
    currenciesAccepted: "GBP",
  };
}

export function buildServiceJsonLd(
  content: ServicePageContent
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: content.hero.title,
    serviceType: content.hero.title,
    description: content.hero.description,
    provider: {
      "@id": getSiteUrl("#local-business") ?? "#local-business",
      "@type": "LocalBusiness",
      name: siteIdentity.name,
    },
    areaServed: {
      "@type": "AdministrativeArea",
      name: siteIdentity.serviceArea,
    },
    url: getSiteUrl(content.seo.path),
  };
}

export function buildFaqJsonLd(items: readonly FaqItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildHomePageJsonLd(
  content: HomePageContent
): JsonLdObject[] {
  return [buildLocalBusinessJsonLd(), buildFaqJsonLd(content.faq.items)];
}

export function buildServicePageJsonLd(
  content: ServicePageContent
): JsonLdObject[] {
  return [
    buildLocalBusinessJsonLd(),
    buildServiceJsonLd(content),
    buildFaqJsonLd(content.faq.items),
  ];
}
