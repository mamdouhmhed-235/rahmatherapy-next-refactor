import Image from "next/image";
import { ImagePlaceholder } from "@/components/shared";
import { publicImageExists } from "@/lib/media/image-manifest";
import { cn } from "@/lib/utils";

interface PackageImageProps {
  src: string;
  alt: string;
  imageType: string;
  className?: string;
  priority?: boolean;
  /**
   * Gate 14, F-14-01. `priority` alone did NOT produce a high-priority fetch
   * here — measured: the `/services/[slug]` hero went out at **Low** while
   * `/services/`, which passes this prop, went out at **High**. Mirrors
   * `ServicesImage`, which already carries the same escape hatch for the same
   * reason. Optional and unset by default, so the two below-the-fold callers
   * (`PackageFinalCTA`, `TreatmentBreakdown`) are unchanged.
   */
  fetchPriority?: "high";
  sizes?: string;
}

export function PackageImage({
  src,
  alt,
  imageType,
  className,
  priority = false,
  fetchPriority,
  sizes = "(max-width: 768px) 100vw, 50vw",
}: PackageImageProps) {
  if (!publicImageExists(src)) {
    return (
      <div className={cn("absolute inset-0", className)}>
        <ImagePlaceholder
          filePath={src}
          imageType={imageType}
          label={`PLACEHOLDER IMAGE: ${imageType}`}
          className="h-full min-h-full rounded-none border-0"
        />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      fetchPriority={fetchPriority}
      sizes={sizes}
      className={cn("object-cover", className)}
    />
  );
}
