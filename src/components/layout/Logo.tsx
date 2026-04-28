import Link from "next/link";
import { BrandLogo } from "@/components/media/BrandLogo";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  size?: "header" | "footer";
}

const logoSizes = {
  header: 168,
  footer: 196,
} as const;

const logoIntrinsicSize = {
  width: 1600,
  height: 587,
} as const;

export function Logo({
  className,
  imageClassName,
  priority = false,
  size = "header",
}: LogoProps) {
  const logoSize = logoSizes[size];

  return (
    <Link
      href="/home"
      aria-label="Rahma Therapy home"
      className={cn(
        size === "footer" ? "footer_logo-link w-nav-brand" : "navbar31_logo-link w-nav-brand",
        className
      )}
      style={
        size === "footer"
          ? { width: "clamp(10rem, 18vw, 12.25rem)", height: "4.5rem" }
          : { width: "clamp(7.25rem, 32vw, 10.5rem)", height: "3.875rem" }
      }
    >
      <BrandLogo
        width={logoIntrinsicSize.width}
        height={logoIntrinsicSize.height}
        priority={priority}
        className={cn(
          size === "footer" ? "footer_logo" : "navbar31_logo",
          imageClassName
        )}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          maxHeight: "100%",
          objectFit: "contain",
          objectPosition: "left center",
        }}
        sizes={`${logoSize}px`}
      />
    </Link>
  );
}
