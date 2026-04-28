import Image from "next/image";

const credentialLogos = [
  {
    src: "/logos/cma-logo.jpg",
    alt: "The Complementary Medical Association logo",
    width: 150,
    height: 60,
    needsDarkSurface: false,
  },
  {
    src: "/logos/iphm-logo.svg",
    alt: "International Practitioners of Holistic Medicine logo",
    width: 134,
    height: 32,
    needsDarkSurface: true,
  },
] as const;

export function CredentialLogos({ decorative = false }: { decorative?: boolean }) {
  return (
    <div className="mb-5 flex min-h-12 flex-wrap items-center gap-3">
      {credentialLogos.map((logo) => (
        <span
          key={logo.src}
          className={
            logo.needsDarkSurface
              ? "inline-flex min-h-10 items-center rounded-2xl bg-rahma-green px-3 py-2"
              : "inline-flex min-h-10 items-center"
          }
        >
          <Image
            src={logo.src}
            alt={decorative ? "" : logo.alt}
            width={logo.width}
            height={logo.height}
            unoptimized
            className="max-h-10 w-auto object-contain"
          />
        </span>
      ))}
    </div>
  );
}
