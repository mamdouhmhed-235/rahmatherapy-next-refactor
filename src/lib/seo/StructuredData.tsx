import { serializeJsonLd } from "./jsonLd";

interface StructuredDataProps {
  data: Parameters<typeof serializeJsonLd>[0];
}

export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
