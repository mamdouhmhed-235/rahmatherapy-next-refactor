import Image from "next/image";
import { ImagePlaceholder } from "@/components/shared";
import { cn } from "@/lib/utils";

interface FaqsAftercareImageProps {
  src: string;
  alt: string;
  imageType: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

const approvedFaqsAftercareImagePaths = new Set<string>();

export function FaqsAftercareImage({
  src,
  alt,
  imageType,
  className,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
}: FaqsAftercareImageProps) {
  if (!approvedFaqsAftercareImagePaths.has(src)) {
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
