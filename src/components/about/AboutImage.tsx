import Image from "next/image";
import { ImagePlaceholder } from "@/components/shared";
import { publicImageExists } from "@/lib/media/image-manifest";
import { cn } from "@/lib/utils";

interface AboutImageProps {
  src: string;
  alt: string;
  imageType: string;
  className?: string;
  priority?: boolean;
  fetchPriority?: "high";
  sizes?: string;
}

export function AboutImage({
  src,
  alt,
  imageType,
  className,
  priority = false,
  fetchPriority,
  sizes = "(max-width: 768px) 100vw, 50vw",
}: AboutImageProps) {
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
