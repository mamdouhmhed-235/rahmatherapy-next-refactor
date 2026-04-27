import type { BookingPackageId } from "@/features/booking/data/booking-packages";

export const homeTrustItems = [
  {
    title: "CMA & IPHM qualified",
    body: "Professional complementary therapy standards.",
    icon: "ShieldCheck",
  },
  {
    title: "Fully mobile in Luton",
    body: "We bring the treatment setup to your home.",
    icon: "Home",
  },
  {
    title: "Male & female therapists",
    body: "Female clients are treated by a female therapist.",
    icon: "Users",
  },
  {
    title: "Aftercare included",
    body: "Clear guidance before and after your session.",
    icon: "ClipboardCheck",
  },
] as const;

export const homePainPoints = [
  {
    title: "Back pain & stiffness",
    body: "For clients who feel tight, sore or restricted after work, driving or daily life.",
    image: "/images/home/pain-back-tension.webp",
    imageType: "Person with back or shoulder stiffness, or a calm therapeutic image.",
    alt: "Client with back and shoulder tension",
  },
  {
    title: "Neck & shoulder tension",
    body: "For stress that sits in the upper back, traps and shoulders.",
    image: "/images/home/pain-back-tension.webp",
    imageType: "Person with back or shoulder stiffness, or a calm therapeutic image.",
    alt: "Client with neck and shoulder tension",
  },
  {
    title: "Muscle tightness",
    body: "For stubborn areas that feel hard to loosen.",
    image: "/images/home/pain-gym-recovery.webp",
    imageType: "Gym or sports recovery style image.",
    alt: "Muscle tightness and recovery support",
  },
  {
    title: "Stress & body heaviness",
    body: "For clients who want to feel calmer, lighter and more at ease.",
    image: "/images/home/pain-stress.webp",
    imageType: "Relaxed wellness or stress-relief image.",
    alt: "Relaxed client receiving private therapy support",
  },
  {
    title: "Gym & sports recovery",
    body: "For training soreness, tight legs, shoulders or recovery support.",
    image: "/images/home/pain-gym-recovery.webp",
    imageType: "Gym or sports recovery style image.",
    alt: "Gym recovery and muscle tightness support",
  },
  {
    title: "Private hijama at home",
    body: "For clients who value clean, respectful wet cupping with male or female therapist options.",
    image: "/images/home/package-hijama.webp",
    imageType: "Clean hijama or cupping setup with no blood or incisions.",
    alt: "Clean hijama package setup",
  },
] as const;

export const homePackages = [
  {
    id: "supreme-combo",
    badge: "Most complete",
    title: "Supreme Combo Package",
    price: "£55",
    body: "Massage, IASTM, dry cupping, fire cupping and hijama in one full reset.",
    cta: "View Supreme Combo",
    href: "/services/supreme-combo-package",
    bookingHref: "?booking=1&services=supreme-combo",
    image: "/images/home/package-supreme.webp",
    imageType: "Cups, IASTM tool, towels, oils, premium setup.",
    alt: "Supreme Combo Package with cupping and IASTM tools",
    featured: true,
  },
  {
    id: "hijama-package",
    badge: "Classic hijama",
    title: "Hijama Package",
    price: "£45",
    body: "Pre-cupping massage, dry cupping and wet cupping at home.",
    cta: "View Hijama Package",
    href: "/services/hijama-package",
    bookingHref: "?booking=1&services=hijama-package",
    image: "/images/home/package-hijama.webp",
    imageType: "Clean hijama or cupping setup with no blood or incisions.",
    alt: "Hijama package clean cupping setup",
    featured: true,
  },
  {
    id: "fire-package",
    badge: "No wet cupping",
    title: "Fire Package",
    price: "£40",
    body: "A warming dry/fire cupping session with essential oils.",
    cta: "View Fire Package",
    href: "/services/fire-cupping-package",
    bookingHref: "?booking=1&services=fire-package",
    image: "/images/home/package-fire.webp",
    imageType: "Controlled glass cup or fire cupping setup, calm and safe-looking.",
    alt: "Fire cupping package setup with glass cups",
    featured: false,
  },
  {
    id: "massage-30",
    badge: "Targeted session",
    title: "Massage Therapy — 30 mins",
    price: "£40",
    body: "Focused support for one main area, such as back, neck or shoulders.",
    cta: "View 30-Min Massage",
    href: "/services/massage-therapy-30-mins",
    bookingHref: "?booking=1&services=massage-30",
    image: "/images/home/package-massage.webp",
    imageType: "Therapist giving back, shoulder or neck massage.",
    alt: "Mobile massage therapy session in Luton",
    featured: false,
  },
  {
    id: "massage-60",
    badge: "Longer reset",
    title: "Massage Therapy — 1 hour",
    price: "£60",
    body: "More time for multiple areas, deeper work or a calmer full-body session.",
    cta: "View 1-Hour Massage",
    href: "/services/massage-therapy-1-hour",
    bookingHref: "?booking=1&services=massage-60",
    image: "/images/home/package-massage.webp",
    imageType: "Therapist giving back, shoulder or neck massage.",
    alt: "Mobile massage therapy session in Luton",
    featured: false,
  },
] as const satisfies readonly {
  id: BookingPackageId;
  badge: string;
  title: string;
  price: string;
  body: string;
  cta: string;
  href: string;
  bookingHref: string;
  image: string;
  imageType: string;
  alt: string;
  featured: boolean;
}[];

export const whyRahmaItems = [
  {
    title: "We come to you",
    body: "No travelling with back pain, no waiting room, no clinic stress.",
    icon: "Home",
  },
  {
    title: "Male & female therapists",
    body: "Choose the therapist option you feel comfortable with. Female clients are treated by a female therapist.",
    icon: "Users",
  },
  {
    title: "Qualified care",
    body: "CMA and IPHM qualified therapists with experience across hijama, cupping and massage.",
    icon: "Award",
  },
  {
    title: "Everything explained",
    body: "Your therapist talks you through the process before treatment begins.",
    icon: "MessageCircle",
  },
  {
    title: "Clean setup",
    body: "Hygiene-led home treatment with single-use items where required.",
    icon: "ShieldCheck",
  },
  {
    title: "Aftercare included",
    body: "You leave knowing what to do after your session.",
    icon: "ClipboardCheck",
  },
] as const;

export const homeProcessSteps = [
  {
    number: "01",
    title: "Choose your package",
    body: "Pick hijama, cupping, massage or a combination package.",
  },
  {
    number: "02",
    title: "Tell us what you need",
    body: "Share your main concern, therapist preference and any health details we should know.",
  },
  {
    number: "03",
    title: "We come to your home",
    body: "Your therapist brings the treatment setup and explains everything clearly before starting.",
  },
  {
    number: "04",
    title: "Aftercare included",
    body: "You receive simple guidance on what to do after your session.",
  },
] as const;

export const homeReviews = [
  {
    reviewer: "nish r",
    rating: 5,
    category: "Home visit",
    shortQuote: "Sessions planned around my timetable and from the comfort of my home was a huge benefit.",
    fullQuote:
      "Fantastic customer service alhamdulillah, and they give you honest advice. The fact that all sessions I was able to plan around my timetable and from the comfort of my home was a huge benefit. I would recommend anyone who is considering reaching out to Rahma Therapy to give them a go!",
  },
  {
    reviewer: "Shalim Miah",
    rating: 5,
    category: "Mobile therapist",
    shortQuote: "Arrived at my house on time, well equipped, professional and knowledgeable.",
    fullQuote:
      "This is a mobile therapist. First time used. Arrived in my house on time, well equipped, professional and knowledgeable. Very happy and pleased with the experience. Will definitely use again and highly recommended!",
  },
  {
    reviewer: "Duncan Djillali",
    rating: 5,
    category: "Explained clearly",
    shortQuote: "Everything was explained to me so that I knew what was happening.",
    fullQuote:
      "My first treatment today with Rahma Therapy. Everything was explained to me so that I knew what was happening and the reasons why it was being done. Very professional, friendly and good service.",
  },
  {
    reviewer: "Aysha Khatoon",
    rating: 5,
    category: "Female therapist",
    shortQuote: "The female therapist was amazing. Friendly and professional.",
    fullQuote:
      "The female therapist was amazing. Friendly and professional. Have used her a few times now.",
  },
  {
    reviewer: "Tazim Hoque",
    rating: 5,
    category: "Hijama & Supreme Package",
    shortQuote: "My first ever experience of Hijama with Rahma Therapy was excellent.",
    fullQuote:
      "Alhamdulillah, my first ever experience of Hijama with Rahma Therapy was excellent! I could not have asked for a better therapist than Nadim, who was very knowledgeable, calm, and explained the whole process clearly. The Supreme Package was also perfect, as I was looking to incorporate Graston therapy into my recovery as well.",
  },
  {
    reviewer: "Humera Akbur",
    rating: 5,
    category: "Massage",
    shortQuote: "Booked a relaxation massage with a female therapist. She arrived on time and was professional.",
    fullQuote:
      "Booked a relaxation massage with a female therapist. She arrived on time and was professional. Great job.",
  },
  {
    reviewer: "Habib Raj",
    rating: 5,
    category: "Comfort",
    shortQuote: "Very knowledgeable and make you feel extremely comfortable.",
    fullQuote:
      "Absolutely brilliant service with brilliant conversation. Very knowledgeable and make you feel extremely comfortable. I’ve used them myself but also for my female family members and their staff all have the same calming, holistic approach. Absolute pleasure as always.",
  },
  {
    reviewer: "Anjoom Sultan",
    rating: 5,
    category: "Repeat client",
    shortQuote: "Excellent service, was my second time going back to them. On time… highly recommend.",
    fullQuote:
      "Excellent service, was my second time going back to them. On time, they do a good job and I highly recommend them! If you’re around Luton and looking for hijama / cupping do check these guys out.",
  },
] as const;

export const homeTeamMembers = [
  {
    name: "Nadimur Rahman",
    role: "CMA & IPHM qualified therapist",
    body: "Mobile hijama, cupping and massage support with a calm, professional approach.",
    image: "/images/home/team-nadimur.webp",
    imageType: "Professional portrait of Nadimur Rahman.",
    alt: "Nadimur Rahman from Rahma Therapy",
  },
  {
    name: "Minhaj Rahman",
    role: "Founder & CMA/IPHM qualified therapist",
    body: "Helping build Rahma Therapy around private, accessible care for the Luton community.",
    image: "/images/home/team-minhaj.webp",
    imageType: "Professional portrait of Minhaj Rahman.",
    alt: "Minhaj Rahman from Rahma Therapy",
  },
  {
    name: "Female Therapist",
    role: "CMA & IPHM qualified female therapist",
    body: "Private same-gender care for female clients who want comfort, modesty and clear explanation.",
    image: "/images/home/team-female.webp",
    imageType: "Female therapist image or non-identifying professional setup image.",
    alt: "Female Rahma Therapy therapist preparing a private treatment session",
  },
] as const;

export const homeSafetyItems = [
  "Pre-treatment consultation",
  "Clean mobile setup",
  "Single-use items where required",
  "Male and female therapists",
  "Female clients treated by female therapist",
  "Aftercare guidance included",
] as const;

export const homeFaqs = [
  {
    question: "Do you come to my home?",
    answer:
      "Yes. Rahma Therapy is fully mobile across Luton and surrounding areas. Your therapist brings the treatment setup to your home.",
  },
  {
    question: "Do you offer female therapists?",
    answer:
      "Yes. Male and female therapists are available. Female clients are treated by a female therapist.",
  },
  {
    question: "Which package should I choose?",
    answer:
      "Choose Supreme Combo for the full reset, Hijama Package for wet cupping, Fire Package for cupping without hijama, or Massage Therapy for hands-on treatment.",
  },
  {
    question: "Is hijama suitable for everyone?",
    answer:
      "No. Suitability is checked before treatment. If you have a medical condition, take medication, are pregnant or are unsure, please seek medical advice before booking.",
  },
  {
    question: "How do I book?",
    answer:
      "Use the Book Now page or message Rahma Therapy on WhatsApp with your preferred package, location and therapist preference.",
  },
] as const;
