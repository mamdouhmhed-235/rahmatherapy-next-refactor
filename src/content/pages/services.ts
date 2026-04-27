import type { BookingPackageId } from "@/features/booking/data/booking-packages";

export const servicePackages = [
  {
    id: "supreme-combo",
    title: "Supreme Combo Package",
    price: "£55",
    badge: "Most complete",
    image: "/images/services/supreme-combo.webp",
    imageType:
      "Cupping cups, IASTM tool, clean towels, massage oil, premium treatment setup.",
    alt: "Supreme Combo Package with cupping and IASTM tools",
    shortDescription:
      "The full Rahma Therapy reset: massage, IASTM-style work, dry cupping, fire cupping and hijama in one package.",
    includes: [
      "Pre-cupping massage",
      "IASTM / Graston-style therapy",
      "Dry cupping",
      "Fire cupping",
      "Wet cupping / hijama",
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
    image: "/images/services/hijama-package.webp",
    imageType:
      "Clean hijama/cupping setup with cups and hygienic equipment, no blood.",
    alt: "Hijama package equipment for private home treatment",
    shortDescription:
      "A focused wet cupping package with pre-cupping massage and dry cupping before hijama.",
    includes: [
      "Pre-cupping massage",
      "Dry cupping",
      "Wet cupping / hijama",
      "Aftercare guidance",
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
    image: "/images/services/fire-package.webp",
    imageType:
      "Glass cups or controlled fire cupping setup, safe and calm visual, not dramatic.",
    alt: "Fire cupping package setup with glass cups",
    shortDescription:
      "A warming cupping package using pre-cupping massage with essential oils and dry/fire cupping.",
    includes: [
      "Pre-cupping massage with essential oils",
      "Dry / fire cupping",
      "Non-wet cupping session",
      "Aftercare guidance",
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
    image: "/images/services/massage-therapy.webp",
    imageType:
      "Therapist giving back, shoulder or neck massage in calm private setting.",
    alt: "Mobile massage therapy session in Luton",
    shortDescription:
      "A shorter focused session for one main area such as back, neck, shoulders or legs.",
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
    image: "/images/services/massage-therapy.webp",
    imageType:
      "Therapist giving back, shoulder or neck massage in calm private setting.",
    alt: "Mobile massage therapy session in Luton",
    shortDescription:
      "A longer mobile massage session for deeper work, multiple areas or a calmer full-body reset.",
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
    id: "full-reset",
    label: "I want the full reset",
    packageTitle: "Supreme Combo Package",
    body: "Best if you want the most complete session with massage, IASTM-style therapy, dry cupping, fire cupping and hijama included.",
    href: "?booking=1&services=supreme-combo",
    cta: "Book Supreme Combo",
  },
  {
    id: "classic-hijama",
    label: "I want classic hijama",
    packageTitle: "Hijama Package",
    body: "Best if you want wet cupping with pre-cupping massage and dry cupping included.",
    href: "?booking=1&services=hijama-package",
    cta: "Book Hijama Package",
  },
  {
    id: "no-wet-cupping",
    label: "I want cupping without wet cupping",
    packageTitle: "Fire Package",
    body: "Best if you want dry/fire cupping and pre-cupping massage without wet cupping.",
    href: "?booking=1&services=fire-package",
    cta: "Book Fire Package",
  },
  {
    id: "quick-targeted",
    label: "I need a quick targeted session",
    packageTitle: "Massage Therapy — 30 mins",
    body: "Best if you want focused work on one main area such as back, neck, shoulders or legs.",
    href: "?booking=1&services=massage-30",
    cta: "Book 30 mins",
  },
  {
    id: "longer-massage",
    label: "I want a longer massage",
    packageTitle: "Massage Therapy — 1 hour",
    body: "Best if you want more time for multiple areas, deeper work or a calmer full-body session.",
    href: "?booking=1&services=massage-60",
    cta: "Book 1 hour",
  },
  {
    id: "female-client",
    label: "I’m booking for a female client",
    packageTitle: "Choose any package with a female therapist",
    body: "Female clients are treated by a female therapist. Choose the package you prefer and select the female therapist option when booking.",
    href: "?booking=1",
    cta: "Book female therapist",
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
    supremeCombo: "Yes",
    hijama: "Yes",
    firePackage: "Yes, with oils",
    massage30: "Optional style",
    massage60: "Optional style",
  },
  {
    feature: "Wet cupping / hijama",
    supremeCombo: "Yes",
    hijama: "Yes",
    firePackage: "No",
    massage30: "No",
    massage60: "No",
  },
  {
    feature: "Dry cupping",
    supremeCombo: "Yes",
    hijama: "Yes",
    firePackage: "Yes",
    massage30: "Optional cupping massage",
    massage60: "Optional cupping massage",
  },
  {
    feature: "Fire cupping",
    supremeCombo: "Yes",
    hijama: "No",
    firePackage: "Yes",
    massage30: "No",
    massage60: "No",
  },
  {
    feature: "IASTM / Graston-style therapy",
    supremeCombo: "Yes",
    hijama: "No",
    firePackage: "No",
    massage30: "Optional",
    massage60: "Optional",
  },
  {
    feature: "Essential oil blend",
    supremeCombo: "No",
    hijama: "No",
    firePackage: "Yes",
    massage30: "Yes",
    massage60: "Yes",
  },
  {
    feature: "Best for",
    supremeCombo: "Full reset and recovery-style support",
    hijama: "Classic hijama",
    firePackage: "Cupping without wet cupping",
    massage30: "One focused area",
    massage60: "Longer massage or multiple areas",
  },
] as const;

export const treatmentMethods = [
  {
    title: "Hijama / wet cupping",
    body: "A traditional cupping method where suction is used and small superficial incisions are made in selected areas. Your therapist checks suitability and explains the process before treatment.",
    includedIn: "Included in: Supreme Combo, Hijama Package",
    icon: "Droplets",
  },
  {
    title: "Dry cupping",
    body: "Cups are placed on the skin to create suction without incisions. Often chosen for muscle tension, stiffness and recovery support.",
    includedIn: "Included in: Supreme Combo, Hijama Package, Fire Package",
    icon: "Activity",
  },
  {
    title: "Fire cupping",
    body: "A traditional heat-assisted cupping method using glass cups to create suction. Rahma Therapy uses a careful, controlled approach.",
    includedIn: "Included in: Supreme Combo, Fire Package",
    icon: "Flame",
  },
  {
    title: "Massage therapy",
    body: "Hands-on therapy tailored around your needs, with relaxing, deep tissue, cupping massage and essential-oil options.",
    includedIn: "Included in: Massage Therapy, Supreme Combo, Hijama Package, Fire Package",
    icon: "HandHeart",
  },
  {
    title: "IASTM / Graston-style therapy",
    body: "Instrument-assisted soft-tissue work often chosen for tightness, stiffness and movement restriction.",
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
