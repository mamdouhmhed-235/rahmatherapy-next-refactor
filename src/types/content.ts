import type { StaticImageData } from "next/image";

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
