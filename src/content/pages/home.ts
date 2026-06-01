import type { BookingPackageId } from "@/features/booking/data/booking-packages";

export const homePainPoints = [
  {
    title: "Back pain & stiffness",
    body: "After a long shift, hours behind the wheel, or just life — when your back feels locked up.",
    image: "/images/home/pain-back-tension.webp",
    imageType: "Person with back or shoulder stiffness, or a calm therapeutic image.",
    alt: "Client with back and shoulder tension",
  },
  {
    title: "Neck & shoulder tension",
    body: "When stress settles in your traps and refuses to leave.",
    image: "/images/home/pain-neck-shoulder-tension.webp",
    imageType: "Person with back or shoulder stiffness, or a calm therapeutic image.",
    alt: "Client with neck and shoulder tension",
  },
  {
    title: "Muscle tightness",
    body: "The knots that stretching, foam-rolling and hot showers can't reach.",
    image: "/images/home/pain-muscle-tightness.webp",
    imageType: "Gym or sports recovery style image.",
    alt: "Muscle tightness and recovery support",
  },
  {
    title: "Stress & body heaviness",
    body: "When everything feels heavy and you can't switch off.",
    image: "/images/home/pain-stress.webp",
    imageType: "Relaxed wellness or stress-relief image.",
    alt: "Relaxed client receiving private therapy support",
  },
  {
    title: "Gym & sports recovery",
    body: "Tight hamstrings, sore shoulders, the leg-day hangover.",
    image: "/images/home/pain-gym-recovery.webp",
    imageType: "Gym or sports recovery style image.",
    alt: "Gym recovery and muscle tightness support",
  },
  {
    title: "Private hijama at home",
    body: "Clean, respectful wet cupping — with the male or female therapist you choose.",
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
    body: "Massage, IASTM, dry cupping, fire cupping and hijama. One full reset, one session.",
    cta: "View Supreme Combo",
    href: "/services/supreme-combo-package",
    bookingHref: "?booking=1&services=supreme-combo",
    image: "/images/home/package-supreme.jpg",
    imageType: "Cups, IASTM tool, towels, oils, premium setup.",
    alt: "Supreme Combo Package with cupping and IASTM tools",
    featured: true,
  },
  {
    id: "hijama-package",
    badge: "Classic hijama",
    title: "Hijama Package",
    price: "£45",
    body: "Wet cupping with pre-cupping massage. The traditional hijama experience, at home.",
    cta: "View Hijama Package",
    href: "/services/hijama-package",
    bookingHref: "?booking=1&services=hijama-package",
    image: "/images/home/package-hijama-card.jpg",
    imageType: "Clean hijama or cupping setup with no blood or incisions.",
    alt: "Hijama package clean cupping setup",
    featured: true,
  },
  {
    id: "fire-package",
    badge: "No wet cupping",
    title: "Fire Package",
    price: "£40",
    body: "Cupping without hijama. Warming, traditional, no incisions.",
    cta: "View Fire Package",
    href: "/services/fire-cupping-package",
    bookingHref: "?booking=1&services=fire-package",
    image: "/images/home/package-fire.jpg",
    imageType: "Controlled glass cup or fire cupping setup, calm and safe-looking.",
    alt: "Fire cupping package setup with glass cups",
    featured: false,
  },
  {
    id: "massage-30",
    badge: "Targeted session",
    title: "Massage Therapy — 30 mins",
    price: "£40",
    body: "One area, 30 minutes. Back, neck, shoulders or legs.",
    cta: "View 30-Min Massage",
    href: "/services/massage-therapy-30-mins",
    bookingHref: "?booking=1&services=massage-30",
    image: "/images/home/package-massage.jpg",
    imageType: "Therapist giving back, shoulder or neck massage.",
    alt: "Mobile massage therapy session in Luton",
    featured: false,
  },
  {
    id: "massage-60",
    badge: "Longer reset",
    title: "Massage Therapy — 1 hour",
    price: "£60",
    body: "One full hour. Multiple areas. Deeper work.",
    cta: "View 1-Hour Massage",
    href: "/services/massage-therapy-1-hour",
    bookingHref: "?booking=1&services=massage-60",
    image: "/images/home/package-massage-60.jpg",
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
    body: "No drive with a tight back. No waiting room. No clinic stress.",
    icon: "Home",
  },
  {
    title: "Male & female therapists",
    body: "Pick the therapist you're comfortable with. Female clients are treated by a female therapist.",
    icon: "Users",
  },
  {
    title: "Qualified care",
    body: "CMA and IPHM qualified across hijama, cupping and massage.",
    icon: "Award",
  },
  {
    title: "Everything explained",
    body: "Your therapist walks you through it before anything begins.",
    icon: "MessageCircle",
  },
  {
    title: "Clean setup",
    body: "Hygiene-led, single-use items where it matters.",
    icon: "ShieldCheck",
  },
  {
    title: "Aftercare included",
    body: "You leave knowing exactly what to do next.",
    icon: "ClipboardCheck",
  },
] as const;

export const homeProcessSteps = [
  {
    number: "01",
    title: "Pick your package",
    body: "Hijama, cupping, massage or a combo — you choose.",
  },
  {
    number: "02",
    title: "Tell us what you need",
    body: "Where you're tight, who you'd prefer to see, and anything we should know about your health.",
  },
  {
    number: "03",
    title: "We come to your home",
    body: "Your therapist arrives with everything needed and walks you through it before anything begins.",
  },
  {
    number: "04",
    title: "Aftercare included",
    body: "Simple guidance for what to do after — based on the treatment you had.",
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
    body: "Hijama, cupping and massage delivered with a calm, methodical style.",
    image: "/images/about/nadimur-rahman.png",
    imageType: "Professional portrait of Nadimur Rahman.",
    alt: "Nadimur Rahman from Rahma Therapy",
  },
  {
    name: "Minhaj Rahman",
    role: "Founder & CMA/IPHM qualified therapist",
    body: "Founded Rahma Therapy to make traditional cupping and massage easier to access at home.",
    image: "/images/about/minhaj-rahman-v2.jpg",
    imageType: "Professional portrait of Minhaj Rahman.",
    alt: "Minhaj Rahman from Rahma Therapy",
  },
  {
    name: "Female Therapist",
    role: "CMA & IPHM qualified female therapist",
    body: "Private same-gender care, built around modesty, comfort and clear communication.",
    image: "/images/about/female-therapist.jpg",
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
    question: "Does hijama hurt?",
    answer:
      "Less than most people expect. Suction first, then a quick scratch-like sensation during the incisions. Your therapist talks you through each step and checks your comfort.",
  },
  {
    question: "Will you bring everything you need?",
    answer:
      "Yes — treatment couch, cups, oils, towels, single-use items. You just clear a private space.",
  },
  {
    question: "How soon can I book?",
    answer:
      "Often same week, sometimes same day. WhatsApp us for the soonest slot.",
  },
  {
    question: "I'm not sure which package suits me.",
    answer:
      "Tell us where you're tight and we'll point you to the right one. The Services page also has a package finder.",
  },
  {
    question: "What if treatment isn't suitable for me?",
    answer:
      "We ask about your health before booking. If anything rules treatment out, your therapist explains why and what's safer.",
  },
] as const;
