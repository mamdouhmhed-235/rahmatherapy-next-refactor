import type { StaticImageData } from "next/image";

export const SITE_ROUTE_KEYS = [
  "home",
  "physiotherapy",
  "sports-massage-barnet",
  "hijama",
] as const;

export type SiteRouteKey = (typeof SITE_ROUTE_KEYS)[number];

export const SITE_ROUTE_PATHS = [
  "/",
  "/physiotherapy",
  "/sports-massage-barnet",
  "/hijama",
] as const;

export type SiteRoutePath = (typeof SITE_ROUTE_PATHS)[number];

export interface ImageAsset {
  kind: "remote" | "local";
  src: string | StaticImageData;
  alt: string;
  width?: number;
  height?: number;
  publicPath?: string;
  sourceUrl?: string;
  sizes?: string;
  loading?: "eager" | "lazy";
  priority?: boolean;
  note?: string;
}

export interface ImageReference<ImageKey extends string = string> {
  image: ImageKey;
  alt?: string;
}

export interface ActionLink {
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "ghost" | "link";
}

export interface PageSeo<ImageKey extends string = string> {
  title: string;
  description: string;
  path: SiteRoutePath;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: ImageKey;
}

export interface RouteDefinition {
  key: SiteRouteKey;
  path: SiteRoutePath;
  label: string;
  navLabel: string;
}

export interface SiteIdentity<ImageKey extends string = string> {
  name: string;
  legalName: string;
  tagline: string;
  defaultDescription: string;
  location: string;
  serviceArea: string;
  footerCredit: string;
  logo: ImageReference<ImageKey>;
}

export interface NavItem {
  label: string;
  href: string;
}

export interface ContactLink {
  label: string;
  value: string;
  href: string;
}

export interface SocialLink {
  label: string;
  href: string;
}

export interface LegalLink {
  label: string;
  href: string;
}

export interface FooterContent {
  serviceLinks: readonly NavItem[];
  legalLinks: readonly LegalLink[];
  copyrightLine: string;
}

export interface HeroSection<ImageKey extends string = string> {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  description: string;
  primaryCta: ActionLink;
  secondaryCta?: ActionLink;
  image?: ImageReference<ImageKey>;
  images?: readonly ImageReference<ImageKey>[];
}

export interface ServiceSummary<ImageKey extends string = string> {
  key: Exclude<SiteRouteKey, "home">;
  name: string;
  route: SiteRoutePath;
  summary: string;
  priceLabel: string;
  image: ImageReference<ImageKey>;
  ctaLabel: string;
}

export interface NumberedFeature {
  eyebrow: string;
  title: string;
  description: string;
}

export interface FeatureCard<ImageKey extends string = string> {
  title: string;
  description: string;
  image?: ImageReference<ImageKey>;
}

export interface IconFeature<ImageKey extends string = string> {
  title: string;
  description: string;
  image?: ImageReference<ImageKey>;
}

export interface ProcessStep<ImageKey extends string = string> {
  description: string;
  image?: ImageReference<ImageKey>;
}

export interface StoryCase<ImageKey extends string = string> {
  title: string;
  description: string;
  image?: ImageReference<ImageKey>;
}

export interface FeaturedQuote<ImageKey extends string = string> {
  quote: string;
  author: string;
  role?: string;
  image?: ImageReference<ImageKey>;
}

export interface Testimonial<ImageKey extends string = string> {
  quote: string;
  author: string;
  role?: string;
  rating?: number;
  image?: ImageReference<ImageKey>;
}

export interface PricingPlan {
  title: string;
  priceLabel: string;
  meta: string;
  includes: readonly string[];
  cta: ActionLink;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface CtaSection<ImageKey extends string = string> {
  title: string;
  description: string;
  primary: ActionLink;
  secondary?: ActionLink;
  image?: ImageReference<ImageKey>;
}

export interface HomePageContent<ImageKey extends string = string> {
  key: "home";
  seo: PageSeo<ImageKey>;
  hero: HeroSection<ImageKey>;
  services: {
    title: string;
    items: readonly ServiceSummary<ImageKey>[];
  };
  trust: {
    title: string;
    items: readonly NumberedFeature[];
  };
  about: {
    title: string;
    description: string;
    image: ImageReference<ImageKey>;
  };
  outcomes: {
    title: string;
    items: readonly IconFeature<ImageKey>[];
    asideTitle: string;
    asideDescription: string;
  };
  featuredTestimonial: FeaturedQuote<ImageKey>;
  testimonials: {
    title: string;
    items: readonly Testimonial<ImageKey>[];
  };
  cta: CtaSection<ImageKey>;
  faq: {
    title: string;
    items: readonly FaqItem[];
  };
}

export interface ServicePageContent<ImageKey extends string = string> {
  key: Exclude<SiteRouteKey, "home">;
  seo: PageSeo<ImageKey>;
  hero: HeroSection<ImageKey>;
  benefits: {
    title: string;
    items: readonly FeatureCard<ImageKey>[];
  };
  expectations: {
    title: string;
    description: string;
    items: readonly ProcessStep<ImageKey>[];
    cta: ActionLink;
    image?: ImageReference<ImageKey>;
  };
  stories: {
    title: string;
    description: string;
    items: readonly StoryCase<ImageKey>[];
  };
  featuredTestimonial: FeaturedQuote<ImageKey>;
  recoveryPath: {
    title: string;
    description: string;
    items: readonly NumberedFeature[];
  };
  pricing: {
    title: string;
    plans: readonly PricingPlan[];
  };
  testimonials: {
    title: string;
    items: readonly Testimonial<ImageKey>[];
  };
  outcomes: {
    title: string;
    description: string;
    image?: ImageReference<ImageKey>;
    items: readonly FeatureCard<ImageKey>[];
  };
  cta: CtaSection<ImageKey>;
  faq: {
    title: string;
    items: readonly FaqItem[];
  };
}
