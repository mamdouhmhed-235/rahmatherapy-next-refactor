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
  header: 64,
  footer: 96,
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
      href="/"
      aria-label="Zam Therapy home"
      className={cn(
        size === "footer" ? "footer_logo-link w-nav-brand" : "navbar31_logo-link w-nav-brand",
        className
      )}
      style={
        size === "footer"
          ? { width: "6.375rem", height: "6.375rem" }
          : { width: "4.375rem", height: "4.375rem" }
      }
    >
      <BrandLogo
        width={logoSize}
        height={logoSize}
        priority={priority}
        className={cn(
          size === "footer" ? "footer_logo" : "navbar31_logo",
          imageClassName
        )}
        style={{
          display: "inline",
          objectFit: "cover",
          objectPosition: "top",
        }}
        sizes={`${logoSize}px`}
      />
    </Link>
  );
}
