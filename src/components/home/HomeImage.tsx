import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { ImagePlaceholder } from "@/components/shared";
import { cn } from "@/lib/utils";

interface HomeImageProps {
  src: string;
  alt: string;
  imageType: string;
  className?: string;
  priority?: boolean;
}

function publicAssetExists(src: string) {
  return existsSync(path.join(process.cwd(), "public", src.replace(/^\//, "")));
}

export function HomeImage({
  src,
  alt,
  imageType,
  className,
  priority = false,
}: HomeImageProps) {
  if (!publicAssetExists(src)) {
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
      sizes="(max-width: 768px) 100vw, 50vw"
      className={cn("object-cover", className)}
    />
  );
}
