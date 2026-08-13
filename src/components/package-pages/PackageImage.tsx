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
  sizes?: string;
}

export function PackageImage({
  src,
  alt,
  imageType,
  className,
  priority = false,
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
      sizes={sizes}
      className={cn("object-cover", className)}
    />
  );
}
