import { CtaSection } from "./CtaSection";
import type { CtaSection as CtaSectionContent } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

interface FinalCtaSectionProps {
  content: CtaSectionContent<SiteImageKey>;
}

export function FinalCtaSection({ content }: FinalCtaSectionProps) {
  return <CtaSection content={content} />;
}
