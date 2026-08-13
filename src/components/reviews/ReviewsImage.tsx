import Image from "next/image";
import { ImagePlaceholder } from "@/components/shared";
import { publicImageExists } from "@/lib/media/image-manifest";
import { cn } from "@/lib/utils";

interface ReviewsImageProps {
  src: string;
  alt: string;
  imageType: string;
  className?: string;
  priority?: boolean;
}

export function ReviewsImage({
  src,
  alt,
  imageType,
  className,
  priority = false,
}: ReviewsImageProps) {
  if (!publicImageExists(src)) {
    return (
      <ImagePlaceholder
        filePath={src}
        imageType={imageType}
        label={`PLACEHOLDER IMAGE: ${imageType}`}
        className={cn("h-full min-h-full", className)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="(min-width: 1024px) 50vw, 100vw"
      className={cn("object-cover", className)}
    />
  );
}
