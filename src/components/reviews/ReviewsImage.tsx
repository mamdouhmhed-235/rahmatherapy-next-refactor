import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { ImagePlaceholder } from "@/components/shared";
import { cn } from "@/lib/utils";

interface ReviewsImageProps {
  src: string;
  alt: string;
  imageType: string;
  className?: string;
  priority?: boolean;
}

function publicAssetExists(src: string) {
  const publicPath = path.join(process.cwd(), "public", src.replace(/^\//, ""));
  return fs.existsSync(publicPath);
}

export function ReviewsImage({
  src,
  alt,
  imageType,
  className,
  priority = false,
}: ReviewsImageProps) {
  if (!publicAssetExists(src)) {
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
