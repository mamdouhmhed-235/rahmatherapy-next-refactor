import Image from "next/image";

const credentialLogos = [
  {
    src: "/logos/cma-logo.jpg",
    alt: "The Complementary Medical Association logo",
    width: 150,
    height: 60,
  },
  {
    src: "/logos/iphm-logo.svg",
    alt: "International Practitioners of Holistic Medicine logo",
    width: 134,
    height: 32,
  },
] as const;

export function CredentialLogos({ decorative = false }: { decorative?: boolean }) {
  return (
    <div className="mb-5 flex min-h-12 flex-wrap items-center gap-3">
      {credentialLogos.map((logo) => (
        <Image
          key={logo.src}
          src={logo.src}
          alt={decorative ? "" : logo.alt}
          width={logo.width}
          height={logo.height}
          unoptimized
          className="max-h-10 w-auto object-contain"
        />
      ))}
    </div>
  );
}
