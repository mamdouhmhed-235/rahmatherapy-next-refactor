import { pageSeoByKey } from "@/content/site/seo";
import type { SiteImageKey } from "@/content/images";
import type { ServicesIndexPageContent } from "@/types/content";

const bookingHref = (services: string) => `/?booking=1&services=${services}#book-now`;

export const servicesPageContent = {
  key: "services",
  seo: pageSeoByKey.services,
  hero: {
    eyebrow: "Mobile Therapy Services in Luton",
    title: "Hijama, Cupping & Massage Therapy Brought to Your Home",
    description:
      "Choose from trusted mobile treatments designed for comfort, relaxation, muscle tension, mobility support, and traditional wellness — with male and female therapists available.",
    primaryCta: {
      label: "Book a mobile visit",
      href: "#book-now",
      variant: "primary",
    },
    secondaryCta: {
      label: "Compare packages",
      href: "#popular-packages",
      variant: "secondary",
    },
    images: [{ image: "hijamaHero" }, { image: "sportsMassageHero" }],
    trustChips: [
      "500+ clients worked with",
      "Established in 2020",
      "Male & female therapists",
      "Home visits across Luton",
      "Packages from £40",
    ],
  },
  intro: {
    title: "Choose the Treatment That Fits What You Need",
    description:
      "Some clients come to Rahma Therapy for a complete hijama and cupping package. Others want massage, dry cupping, fire cupping, or targeted soft-tissue work. Use the options below to compare each service, then book the one that feels most suitable for you.",
    items: [
      {
        title: "Mobile visits",
        description: "Your therapist travels to your chosen location across Luton and surrounding areas.",
      },
      {
        title: "Therapist options",
        description: "Male and female therapists are available, with preferences requested during booking.",
      },
      {
        title: "Clear package choices",
        description: "Prices and included treatment elements are shown before you start the booking form.",
      },
    ],
  },
  popularPackages: {
    title: "Popular packages",
    description: "Simple treatment packages for clients who want a clear, ready-to-book option.",
    packages: [
      {
        id: "supreme-combo",
        title: "Supreme Combo Package",
        priceLabel: "£55",
        description:
          "A complete cupping-focused session combining pre-treatment massage, IASTM-style soft-tissue work, dry cupping, fire cupping, and wet cupping/hijama.",
        suitableFor: "Best for clients who want the full Rahma Therapy experience in one appointment.",
        includes: ["Pre-treatment massage", "IASTM / Graston-style therapy", "Dry cupping", "Fire cupping", "Wet cupping / hijama"],
        cta: { label: "Book This Package", href: bookingHref("supreme-combo") },
        badge: "Most Complete",
        image: { image: "hijamaCta", alt: "Clean cupping treatment setup with cups and towels" },
      },
      {
        id: "hijama-package",
        title: "Hijama Package",
        priceLabel: "£45",
        description: "A focused hijama appointment including pre-cupping massage, dry cupping, and wet cupping/hijama.",
        suitableFor: "Best for clients who already know they want hijama or prefer a traditional cupping-focused session.",
        includes: ["Pre-treatment massage", "Dry cupping", "Wet cupping / hijama"],
        cta: { label: "Book Hijama Package", href: bookingHref("hijama-package") },
        badge: "Hijama Focused",
        image: { image: "hijamaHero", alt: "Clean hijama appointment setup with no blood visible" },
      },
      {
        id: "fire-package",
        title: "Fire Package",
        priceLabel: "£40",
        description: "A fire cupping session with pre-cupping massage and essential oils, designed for clients who prefer a traditional dry/fire cupping experience.",
        suitableFor: "Best for clients who want a warming cupping session without wet cupping/hijama.",
        includes: ["Pre-treatment massage with essential oils", "Dry/fire cupping"],
        cta: { label: "Book Fire Package", href: bookingHref("fire-package") },
        badge: "Warm Cupping Option",
        image: { image: "sportsMassageHeroSecondary", alt: "Calm treatment preparation image for fire cupping package" },
      },
      {
        id: "massage",
        title: "Massage Therapy",
        priceLabel: "£40 / 30 mins or £60 / 1 hour",
        description: "Choose from relaxing massage, deep tissue, cupping massage, or IASTM-style therapy with essential oils.",
        suitableFor: "Best for clients looking for relaxation, muscle comfort, or a non-cupping therapy option.",
        includes: ["Relaxing massage", "Deep tissue massage", "Cupping massage", "IASTM / Graston-style therapy option", "Essential oil blend"],
        cta: { label: "Book 60 Minute Massage", href: bookingHref("massage-60") },
        badge: "Relaxation & Soft-Tissue Work",
        image: { image: "homeServiceSportsMassage", alt: "Therapist providing massage therapy in a calm room" },
      },
    ],
  },
  treatments: {
    title: "Explore our treatments",
    description: "Use this overview to compare treatment styles without linking to unbuilt detail pages.",
    items: [
      { title: "Hijama / Wet Cupping", description: "Traditional wet cupping carried out with hygiene and aftercare guidance.", image: { image: "hijamaHero" }, href: "/hijama", ctaLabel: "View Hijama" },
      { title: "Dry Cupping", description: "Suction-only cupping that may leave temporary circular marks.", image: { image: "hijamaHeroCloseup" } },
      { title: "Fire Cupping", description: "A cupping option selected by clients who want a different style of suction therapy.", image: { image: "sportsMassageHeroSecondary" } },
      { title: "Massage Therapy", description: "Hands-on treatment for relaxation, muscle comfort and soft-tissue support.", image: { image: "homeServiceSportsMassage" }, href: "/sports-massage-barnet", ctaLabel: "View Massage" },
      { title: "IASTM / Graston-Style Therapy", description: "Targeted soft-tissue work using specialist tools as part of selected sessions.", image: { image: "physiotherapyHeroPrimary" } },
      { title: "Cupping Massage", description: "A treatment option combining massage techniques with cupping-style support.", image: { image: "sportsMassageRecovery" } },
    ],
  },
  guidance: {
    title: "Not Sure Which Service to Choose?",
    description:
      "Here's a simple guide to help you choose. You can also message Rahma Therapy before booking if you want help picking the most suitable option.",
    items: [
      { title: "Want the full experience?", description: "Choose the Supreme Combo Package." },
      { title: "Want hijama specifically?", description: "Choose the Hijama Package." },
      { title: "Want cupping without wet cupping?", description: "Choose the Fire Package or Dry Cupping." },
      { title: "Want relaxation or general muscle comfort?", description: "Choose Massage Therapy." },
    ],
    cta: { label: "Message Us Before Booking", href: "#book-now" },
  },
  visitIncludes: {
    title: "What every mobile visit includes",
    description: "Every visit is designed to make mobile treatment clear, private, and prepared.",
    items: [
      { title: "Home Visit Convenience", description: "Your therapist travels to your chosen location across Luton and surrounding areas." },
      { title: "Clear Treatment Explanation", description: "Before starting, your therapist explains what the session involves and what to expect." },
      { title: "Clean Professional Setup", description: "Equipment is prepared carefully and the treatment space is kept clean and organised." },
      { title: "Aftercare Guidance", description: "You receive simple aftercare advice before the appointment is complete." },
    ],
  },
  pricing: {
    title: "Simple pricing",
    description: "Clean pricing cards make the current treatment options easy to compare.",
    note: "Male and female therapists available. Terms and conditions may apply.",
    packages: [
      {
        id: "pricing-supreme-combo",
        title: "Supreme Combo Package",
        priceLabel: "£55",
        description: "Pre-cupping massage, IASTM, dry cupping, fire cupping, and wet cupping/hijama.",
        includes: [],
        cta: { label: "Book This Package", href: bookingHref("supreme-combo") },
      },
      {
        id: "pricing-hijama",
        title: "Hijama Package",
        priceLabel: "£45",
        description: "Pre-cupping massage, dry cupping, and wet cupping/hijama.",
        includes: [],
        cta: { label: "Book Hijama Package", href: bookingHref("hijama-package") },
      },
      {
        id: "pricing-fire",
        title: "Fire Package",
        priceLabel: "£40",
        description: "Pre-cupping massage with essential oils and dry/fire cupping.",
        includes: [],
        cta: { label: "Book Fire Package", href: bookingHref("fire-package") },
      },
      {
        id: "pricing-massage",
        title: "Massage Therapy",
        priceLabel: "£40 / 30 mins or £60 / 1 hour",
        description: "Relaxing, deep tissue, cupping massage, or IASTM-style therapy options.",
        includes: [],
        cta: { label: "Book 60 Minute Massage", href: bookingHref("massage-60") },
      },
    ],
  },
  trust: {
    title: "Trusted by clients across Luton",
    description:
      "Rahma Therapy has worked with 500+ clients and continues to serve people across Luton with mobile hijama, cupping, massage and therapy packages.",
    items: [
      { title: "Private home visits", description: "Appointments are arranged around your chosen location." },
      { title: "Clear explanations", description: "Clients are told what to expect before treatment starts." },
      { title: "Respectful care", description: "Therapist preference can be requested when booking." },
    ],
  },
  cta: {
    title: "Ready to book your mobile therapy visit?",
    description:
      "Choose your treatment, preferred therapist and appointment details. Rahma Therapy will contact you to confirm availability.",
    primary: { label: "Book a mobile visit", href: "#book-now" },
    secondary: { label: "Compare packages", href: "#popular-packages" },
  },
} as const satisfies ServicesIndexPageContent<SiteImageKey>;
