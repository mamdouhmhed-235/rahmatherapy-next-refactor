import Image, { type ImageProps } from "next/image";
import { getSiteImage, type SiteImageKey } from "@/content/images";
import type { ImageReference } from "@/types/content";

type ResponsiveImageSource = SiteImageKey | ImageReference<SiteImageKey>;

export interface ResponsiveImageProps
  extends Omit<ImageProps, "src" | "alt"> {
  image: ResponsiveImageSource;
}

export function ResponsiveImage({
  image,
  sizes,
  priority,
  style,
  ...props
}: ResponsiveImageProps) {
  const imageKey = typeof image === "string" ? image : image.image;
  const asset = getSiteImage(imageKey);
  const alt = typeof image === "string" ? asset.alt : image.alt ?? asset.alt;

  const width = props.width ?? asset.width;
  const height = props.height ?? asset.height;

  if (typeof asset.src === "string" && !props.fill && (!width || !height)) {
    throw new Error(
      `ResponsiveImage requires width and height for string image sources: ${imageKey}`
    );
  }

  return (
    <Image
      src={asset.src}
      alt={alt}
      width={props.fill ? props.width : width}
      height={props.fill ? props.height : height}
      sizes={sizes ?? asset.sizes}
      priority={priority ?? asset.priority}
      loading={priority ?? asset.priority ? undefined : props.loading ?? asset.loading}
      style={
        props.fill
          ? style
          : { width: "100%", height: "100%", objectFit: "cover", ...style }
      }
      {...props}
    />
  );
}
