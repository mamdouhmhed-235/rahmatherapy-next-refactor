import type { StaticImageData } from "next/image";

export const SITE_ROUTE_KEYS = [
  "home",
  "services",
  "about",
  "faqs-aftercare",
  "physiotherapy",
  "sports-massage-barnet",
  "hijama",
] as const;

export type SiteRouteKey = (typeof SITE_ROUTE_KEYS)[number];
export type ExistingServiceRouteKey =
  | "physiotherapy"
  | "sports-massage-barnet"
  | "hijama";
export type RahmaPageRouteKey = "services" | "about" | "faqs-aftercare";

export const SITE_ROUTE_PATHS = [
  "/",
  "/services",
  "/about",
  "/faqs-aftercare",
  "/physiotherapy",
  "/sports-massage-barnet",
  "/hijama",
] as const;

export type SiteRoutePath = (typeof SITE_ROUTE_PATHS)[number];

export interface ImageAsset {
  kind: "local";
  src: string | StaticImageData;
  alt: string;
  width?: number;
  height?: number;
  publicPath?: string;
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
  trustChips?: readonly string[];
}

export interface ServiceSummary<ImageKey extends string = string> {
  key: ExistingServiceRouteKey;
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

export interface LabeledText {
  label?: string;
  title: string;
  description: string;
}

export interface StatCard {
  value: string;
  label: string;
  description?: string;
}

export interface PackageCard<ImageKey extends string = string> {
  id: string;
  title: string;
  priceLabel: string;
  description: string;
  suitableFor?: string;
  includes: readonly string[];
  cta: ActionLink;
  badge?: string;
  image?: ImageReference<ImageKey>;
}

export interface TreatmentCard<ImageKey extends string = string> {
  title: string;
  description: string;
  image?: ImageReference<ImageKey>;
  href?: SiteRoutePath;
  ctaLabel?: string;
}

export interface TeamCard<ImageKey extends string = string> {
  name: string;
  role: string;
  description: string;
  image?: ImageReference<ImageKey>;
  badges?: readonly string[];
  notes?: readonly string[];
}

export interface TimelineItem {
  date: string;
  title: string;
  description: string;
}

export interface AccordionItem {
  title: string;
  description: string;
}

export interface TabPanelContent {
  id: string;
  label: string;
  title: string;
  description: string;
  items: readonly string[];
}

export type FaqCategory =
  | "All"
  | "Booking"
  | "Treatments"
  | "Therapist Options"
  | "Safety"
  | "Before"
  | "Aftercare"
  | "Pricing";

export interface SearchableFaqItem extends FaqItem {
  category: Exclude<FaqCategory, "All">;
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
  key: ExistingServiceRouteKey;
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

export interface ServicesIndexPageContent<ImageKey extends string = string> {
  key: "services";
  seo: PageSeo<ImageKey>;
  hero: HeroSection<ImageKey>;
  intro: {
    title: string;
    description: string;
    items: readonly LabeledText[];
  };
  popularPackages: {
    title: string;
    description: string;
    packages: readonly PackageCard<ImageKey>[];
  };
  treatments: {
    title: string;
    description: string;
    items: readonly TreatmentCard<ImageKey>[];
  };
  guidance: {
    title: string;
    description: string;
    items: readonly LabeledText[];
    cta: ActionLink;
  };
  visitIncludes: {
    title: string;
    description: string;
    items: readonly LabeledText[];
  };
  pricing: {
    title: string;
    description: string;
    packages: readonly PackageCard<ImageKey>[];
    note: string;
  };
  trust: {
    title: string;
    description: string;
    items: readonly LabeledText[];
  };
  cta: CtaSection<ImageKey>;
}

export interface AboutPageContent<ImageKey extends string = string> {
  key: "about";
  seo: PageSeo<ImageKey>;
  hero: HeroSection<ImageKey>;
  proof: {
    items: readonly StatCard[];
  };
  whoWeAre: {
    title: string;
    description: string;
    image?: ImageReference<ImageKey>;
    cta?: ActionLink;
    caption?: string;
  };
  team: {
    title: string;
    description: string;
    items: readonly TeamCard<ImageKey>[];
  };
  comfort: {
    title: string;
    description: string;
    items: readonly LabeledText[];
  };
  standards: {
    title: string;
    description: string;
    items: readonly AccordionItem[];
    image?: ImageReference<ImageKey>;
    caption?: string;
  };
  timeline: {
    title: string;
    description: string;
    items: readonly TimelineItem[];
  };
  appreciation: {
    title: string;
    description: string;
    items: readonly LabeledText[];
  };
  process: {
    title: string;
    description: string;
    items: readonly LabeledText[];
  };
  cta: CtaSection<ImageKey>;
}

export interface FaqsAftercarePageContent<ImageKey extends string = string> {
  key: "faqs-aftercare";
  seo: PageSeo<ImageKey>;
  hero: HeroSection<ImageKey>;
  reassurance: {
    title: string;
    items: readonly LabeledText[];
  };
  beforeAppointment: {
    title: string;
    description: string;
    image?: ImageReference<ImageKey>;
    items: readonly LabeledText[];
  };
  aftercare: {
    title: string;
    description: string;
    tabs: readonly TabPanelContent[];
  };
  faq: {
    title: string;
    description: string;
    categories: readonly FaqCategory[];
    items: readonly SearchableFaqItem[];
  };
  safety: {
    title: string;
    description: string;
    items: readonly LabeledText[];
  };
  unsureCta: CtaSection<ImageKey>;
  cta: CtaSection<ImageKey>;
}
