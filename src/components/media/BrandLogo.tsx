import { ResponsiveImage, type ResponsiveImageProps } from "./ResponsiveImage";
import { siteIdentity } from "@/content/site/identity";

export function BrandLogo(
  props: Omit<ResponsiveImageProps, "image">
) {
  return <ResponsiveImage image={siteIdentity.logo} {...props} />;
}
