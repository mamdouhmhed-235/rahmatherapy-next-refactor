import Image from "next/image";
import { ImagePlaceholder } from "@/components/shared";
import { cn } from "@/lib/utils";

interface ServicesImageProps {
  src: string;
  alt: string;
  imageType: string;
  className?: string;
  priority?: boolean;
  fetchPriority?: "high";
  sizes?: string;
}

const approvedServiceImagePaths = new Set<string>([
  "/images/services/package-supreme.jpg",
  "/images/services/package-hijama-card.jpg",
  "/images/services/package-fire.jpg",
  "/images/services/package-massage.jpg",
  "/images/services/package-massage-60.jpg",
  "/images/services/services-hero-v1.jpg",
  "/images/services/services-final-cta-v1.jpg",
  "/images/services/package-finder-v1.jpg",
  "/images/services/treatment-methods-v1.jpg",
]);

export function ServicesImage({
  src,
  alt,
  imageType,
  className,
  priority = false,
  fetchPriority,
  sizes = "(max-width: 768px) 100vw, 50vw",
}: ServicesImageProps) {
  if (!approvedServiceImagePaths.has(src)) {
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
