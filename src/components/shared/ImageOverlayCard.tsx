import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ImagePlaceholder, type ImagePlaceholderProps } from "./ImagePlaceholder";

interface ImageOverlayCardProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  ctaLabel?: string;
  href?: string;
  image?: ReactNode;
  placeholder?: ImagePlaceholderProps;
  className?: string;
  contentClassName?: string;
}

function CardContent({
  title,
  description,
  eyebrow,
  meta,
  ctaLabel,
  image,
  placeholder,
  contentClassName,
}: Omit<ImageOverlayCardProps, "href" | "className">) {
  return (
    <>
      {image ?? (placeholder ? <ImagePlaceholder {...placeholder} /> : null)}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(31,47,43,0.06)_0%,rgba(31,47,43,0.36)_46%,rgba(31,47,43,0.88)_100%)]" />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 text-white sm:p-7",
          contentClassName
        )}
      >
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rahma-gold">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-semibold leading-tight">{title}</h3>
          {description ? (
            <p className="max-w-xl text-sm leading-6 text-white/78">{description}</p>
          ) : null}
        </div>
        {(meta || ctaLabel) && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm font-semibold">
            {meta ? <span className="text-white/90">{meta}</span> : <span />}
            {ctaLabel ? <span className="text-rahma-gold">{ctaLabel}</span> : null}
          </div>
        )}
      </div>
    </>
  );
}

export function ImageOverlayCard({
  href,
  className,
  ...contentProps
}: ImageOverlayCardProps) {
  const cardClassName = cn(
    "group relative block min-h-80 overflow-hidden rounded-3xl bg-rahma-green shadow-card",
    className
  );

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        <CardContent {...contentProps} />
      </Link>
    );
  }

  return (
    <div className={cardClassName}>
      <CardContent {...contentProps} />
    </div>
  );
}
