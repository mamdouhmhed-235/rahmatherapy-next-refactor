import type { BookingPackageId } from "@/features/booking/data/booking-packages";

export const servicePackages = [
  {
    id: "supreme-combo",
    title: "Supreme Combo Package",
    price: "£55",
    badge: "Most complete",
    image: "/images/services/package-supreme.jpg",
    imageType:
      "Cupping cups, IASTM tool, clean towels, massage oil, premium treatment setup.",
    alt: "Supreme Combo Package with cupping and IASTM tools",
    shortDescription:
      "Get the full treatment experience of cupping with Graston therapy — helps to alleviate muscle tension.",
    includes: [
      "Pre-cupping massage / Graston Therapy (IASTM)",
      "Dry Cupping",
      "Fire Cupping",
      "Wet Cupping (Hijama)",
    ],
    bestFor:
      "Clients who want the most complete package for stiffness, tight muscles, recovery support or a full-body reset.",
    href: "/services/supreme-combo-package",
    bookingHref: "?booking=1&services=supreme-combo",
    cta: "View Supreme Combo",
    bookingCta: "Book this package",
  },
  {
    id: "hijama-package",
    title: "Hijama Package",
    price: "£45",
    badge: "Classic hijama",
    image: "/images/services/package-hijama-card.jpg",
    imageType:
      "Clean hijama/cupping setup with cups and hygienic equipment, no blood.",
    alt: "Hijama package equipment for private home treatment",
    shortDescription:
      "Traditional wet cupping with a brief pre-cupping massage.",
    includes: [
      "Pre-cupping massage",
      "Dry Cupping",
      "Wet Cupping (Hijama)",
    ],
    bestFor:
      "Clients who already value hijama, want a traditional wellness session, or prefer a clear first-time hijama experience at home.",
    href: "/services/hijama-package",
    bookingHref: "?booking=1&services=hijama-package",
    cta: "View Hijama Package",
    bookingCta: "Book this package",
  },
  {
    id: "fire-package",
    title: "Fire Package",
    price: "£40",
    badge: "No wet cupping",
    image: "/images/services/package-fire.jpg",
    imageType:
      "Glass cups or controlled fire cupping setup, safe and calm visual, not dramatic.",
    alt: "Fire cupping package setup with glass cups",
    shortDescription:
      "Traditional dry cupping therapy with no incisions or blood loss.",
    includes: [
      "Pre-cupping massage",
      "Dry Cupping",
      "Fire Cupping",
    ],
    bestFor:
      "Clients who want cupping for muscle tension, stiffness or relaxation support without wet cupping.",
    href: "/services/fire-cupping-package",
    bookingHref: "?booking=1&services=fire-package",
    cta: "View Fire Package",
    bookingCta: "Book this package",
  },
  {
    id: "massage-30",
    title: "Massage Therapy — 30 mins",
    price: "£40",
    badge: "Targeted session",
    image: "/images/services/package-massage.jpg",
    imageType:
      "Therapist giving back, shoulder or neck massage in calm private setting.",
    alt: "Mobile massage therapy session in Luton",
    shortDescription:
      "Unwind with a relaxing, deep tissue, cupping massage or graston therapy — a focused 30 minutes on one area.",
    includes: [
      "Relaxing massage",
      "Deep tissue option",
      "Cupping massage option",
      "IASTM-style option",
      "Essential oil blend",
    ],
    bestFor:
      "Clients who want targeted support for one area or a quicker appointment at home.",
    href: "/services/massage-therapy-30-mins",
    bookingHref: "?booking=1&services=massage-30",
    cta: "View 30-Min Massage",
    bookingCta: "Book 30 mins",
  },
  {
    id: "massage-60",
    title: "Massage Therapy — 1 hour",
    price: "£60",
    badge: "Longer session",
    image: "/images/services/package-massage-60.jpg",
    imageType:
      "Therapist giving back, shoulder or neck massage in calm private setting.",
    alt: "Mobile massage therapy session in Luton",
    shortDescription:
      "Unwind with a relaxing, deep tissue, cupping massage or graston therapy — a full hour for deeper, multi-area work.",
    includes: [
      "Relaxing massage",
      "Deep tissue option",
      "Cupping massage option",
      "IASTM-style option",
      "Essential oil blend",
    ],
    bestFor:
      "Clients who want more time for back, neck, shoulders, legs, stress tension or general recovery support.",
    href: "/services/massage-therapy-1-hour",
    bookingHref: "?booking=1&services=massage-60",
    cta: "View 1-Hour Massage",
    bookingCta: "Book 1 hour",
  },
] as const satisfies readonly {
  id: BookingPackageId;
  title: string;
  price: string;
  badge: string;
  image: string;
  imageType: string;
  alt: string;
  shortDescription: string;
  includes: readonly string[];
  bestFor: string;
  href: string;
  bookingHref: string;
  cta: string;
  bookingCta: string;
}[];

export const serviceTrustItems = [
  {
    title: "CMA & IPHM qualified",
    body: "Professional complementary therapy standards.",
    icon: "ShieldCheck",
  },
  {
    title: "Fully mobile",
    body: "We bring the treatment setup to your home.",
    icon: "Home",
  },
  {
    title: "Same-gender care",
    body: "Female clients are treated by a female therapist.",
    icon: "Users",
  },
  {
    title: "Clear aftercare",
    body: "Know what to do before and after your session.",
    icon: "ClipboardCheck",
  },
] as const;

export const packageFinderOptions = [
  {
    id: "general-detox",
    label: "I want a general detox",
    recommendations: [
      {
        packageTitle: "Supreme Combo Package",
        body: "The most complete option: massage, IASTM, dry cupping, fire cupping and hijama in one full-body reset.",
        href: "?booking=1&services=supreme-combo",
        cta: "Book Supreme Combo",
      },
      {
        packageTitle: "Hijama Package",
        body: "Traditional wet cupping with a brief pre-cupping massage — the classic hijama detox.",
        href: "?booking=1&services=hijama-package",
        cta: "Book Hijama Package",
      },
    ],
  },
  {
    id: "muscle-aches",
    label: "I have muscle aches",
    recommendations: [
      {
        packageTitle: "Supreme Combo Package",
        body: "Massage, IASTM and cupping combined to release tight, aching muscles in one session.",
        href: "?booking=1&services=supreme-combo",
        cta: "Book Supreme Combo",
      },
      {
        packageTitle: "Massage Therapy — 30 mins",
        body: "Targeted hands-on massage — relaxing, deep tissue or cupping massage — for one aching area.",
        href: "?booking=1&services=massage-30",
        cta: "Book 30 mins",
      },
      {
        packageTitle: "Massage Therapy — 1 hour",
        body: "A full hour of relaxing, deep tissue or cupping massage for deeper, multi-area muscle relief.",
        href: "?booking=1&services=massage-60",
        cta: "Book 1 hour",
      },
    ],
  },
  {
    id: "just-hijama",
    label: "I want to book just hijama",
    recommendations: [
      {
        packageTitle: "Hijama Package",
        body: "Wet cupping with pre-cupping massage and dry cupping. The traditional hijama experience.",
        href: "?booking=1&services=hijama-package",
        cta: "Book Hijama Package",
      },
    ],
  },
  {
    id: "cupping-no-hijama",
    label: "I want cupping without hijama",
    recommendations: [
      {
        packageTitle: "Fire Package",
        body: "Dry and fire cupping with a pre-cupping massage. No incisions, no wet cupping.",
        href: "?booking=1&services=fire-package",
        cta: "Book Fire Package",
      },
    ],
  },
  {
    id: "short-massage",
    label: "I want a short massage",
    recommendations: [
      {
        packageTitle: "Massage Therapy — 30 mins",
        body: "A focused 30-minute massage for one area — back, neck, shoulders or legs.",
        href: "?booking=1&services=massage-30",
        cta: "Book 30 mins",
      },
    ],
  },
  {
    id: "injury-recovery",
    label: "I'm recovering from an injury",
    recommendations: [
      {
        packageTitle: "Supreme Combo Package",
        body: "The most complete option for recovery: massage, IASTM, dry cupping, fire cupping and hijama in one session.",
        href: "?booking=1&services=supreme-combo",
        cta: "Book Supreme Combo",
      },
    ],
  },
] as const;

export const comparisonRows = [
  {
    feature: "Price",
    supremeCombo: "£55",
    hijama: "£45",
    firePackage: "£40",
    massage30: "£40",
    massage60: "£60",
  },
  {
    feature: "Pre-cupping massage",
    supremeCombo: "yes",
    hijama: "yes",
    firePackage: "yes",
    massage30: "optional",
    massage60: "optional",
  },
  {
    feature: "Wet cupping / hijama",
    supremeCombo: "yes",
    hijama: "yes",
    firePackage: "no",
    massage30: "no",
    massage60: "no",
  },
  {
    feature: "Dry cupping",
    supremeCombo: "yes",
    hijama: "yes",
    firePackage: "yes",
    massage30: "optional",
    massage60: "optional",
  },
  {
    feature: "Fire cupping",
    supremeCombo: "yes",
    hijama: "no",
    firePackage: "yes",
    massage30: "no",
    massage60: "no",
  },
  {
    feature: "IASTM / Graston-style",
    supremeCombo: "yes",
    hijama: "no",
    firePackage: "no",
    massage30: "optional",
    massage60: "optional",
  },
  {
    feature: "Essential oil blend",
    supremeCombo: "no",
    hijama: "no",
    firePackage: "yes",
    massage30: "yes",
    massage60: "yes",
  },
  {
    feature: "Best for",
    supremeCombo: "Full reset",
    hijama: "Classic hijama",
    firePackage: "No wet cupping",
    massage30: "One focused area",
    massage60: "Multiple areas",
  },
] as const;

export const treatmentMethods = [
  {
    title: "Hijama / wet cupping",
    body: "Traditional wet cupping with small superficial incisions. Suitability checked, every step explained.",
    includedIn: "Included in: Supreme Combo, Hijama Package",
    icon: "Droplets",
  },
  {
    title: "Dry cupping",
    body: "Suction without incisions. Most often chosen for muscle tension and stiffness.",
    includedIn: "Included in: Supreme Combo, Hijama Package, Fire Package",
    icon: "Activity",
  },
  {
    title: "Fire cupping",
    body: "Heat-assisted cupping with glass cups. Always controlled, never theatrical.",
    includedIn: "Included in: Supreme Combo, Fire Package",
    icon: "Flame",
  },
  {
    title: "Massage therapy",
    body: "Hands-on work tailored around what you need: relaxing, deep tissue, cupping massage or essential-oil options.",
    includedIn: "Included in: Massage Therapy, Supreme Combo, Hijama Package, Fire Package",
    icon: "HandHeart",
  },
  {
    title: "IASTM / Graston-style therapy",
    body: "Tool-assisted soft-tissue work for tightness, stiffness and restricted movement.",
    includedIn: "Included in: Supreme Combo, Massage Therapy option",
    icon: "Sparkles",
  },
] as const;

export const homeAppointmentSteps = [
  {
    number: "01",
    title: "Choose your package",
    body: "Pick from hijama, cupping, massage or a combination package.",
  },
  {
    number: "02",
    title: "Tell us what you need",
    body: "Share your main concern, preferred therapist option and any health details we should know.",
  },
  {
    number: "03",
    title: "We come to your home",
    body: "Your therapist brings the treatment setup and explains everything clearly before starting.",
  },
  {
    number: "04",
    title: "Aftercare included",
    body: "You’ll receive simple guidance on what to do after your session.",
  },
] as const;

export const serviceSafetyItems = [
  "CMA and IPHM qualified therapists",
  "Pre-treatment consultation",
  "Clean mobile setup",
  "Single-use items where required",
  "Clear explanation before treatment",
  "Male and female therapists available",
  "Female clients treated by female therapist",
  "Aftercare guidance included",
] as const;

export const miniFaqs = [
  {
    question: "Which package should I choose first?",
    answer:
      "If you want the most complete option, choose the Supreme Combo Package. If you specifically want wet cupping, choose the Hijama Package. If you want cupping without wet cupping, choose the Fire Package. If you mainly want hands-on massage, choose the 30-minute or 1-hour Massage Therapy option.",
  },
  {
    question: "Do you offer female therapists?",
    answer:
      "Yes. Rahma Therapy offers male and female therapists. Female clients are treated by a female therapist.",
  },
  {
    question: "Do you come to my home?",
    answer:
      "Yes. Rahma Therapy is fully mobile across Luton and surrounding areas. Your therapist brings the treatment setup to your home.",
  },
  {
    question: "Is hijama suitable for everyone?",
    answer:
      "No. Suitability is checked before treatment. Hijama may not be suitable for certain medical conditions, medication use, pregnancy, blood-related issues or if you are unwell. If you are unsure, speak to a healthcare professional before booking.",
  },
  {
    question: "What if I am not sure what to book?",
    answer:
      "Send us a message with what you are struggling with and we can guide you towards the most suitable package.",
  },
] as const;

export const serviceSafetyDisclaimer =
  "Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please speak to a healthcare professional before booking.";
