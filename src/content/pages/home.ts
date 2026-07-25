import type { BookingPackageId } from "@/features/booking/data/booking-packages";

export const homePainPoints = [
  {
    body: "Reduce chronic musculoskeletal pain.",
    image: "/images/home/pain-back-tension.webp",
    imageType: "Person with back or shoulder stiffness, or a calm therapeutic image.",
    alt: "Client with back and shoulder tension",
  },
  {
    body: "Improve your sleep quality.",
    image: "/images/home/pain-neck-shoulder-tension.webp",
    imageType: "Person with back or shoulder stiffness, or a calm therapeutic image.",
    alt: "Client with neck and shoulder tension",
  },
  {
    body: "Enhance your physical function.",
    image: "/images/home/pain-muscle-tightness.webp",
    imageType: "Gym or sports recovery style image.",
    alt: "Muscle tightness and recovery support",
  },
  {
    body: "Reduce stress and anxiety.",
    image: "/images/home/pain-stress.webp",
    imageType: "Relaxed wellness or stress-relief image.",
    alt: "Relaxed client receiving private therapy support",
  },
  {
    body: "Rehabilitate trauma from sports and injury.",
    image: "/images/home/pain-gym-recovery.webp",
    imageType: "Gym or sports recovery style image.",
    alt: "Gym recovery and muscle tightness support",
  },
  {
    body: "Improve your general health and wellbeing.",
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
    body: "Get the full treatment experience of cupping with Graston therapy — helps to alleviate muscle tension.",
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
    body: "Traditional wet cupping with a brief pre-cupping massage.",
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
    body: "Traditional dry cupping therapy with no incisions or blood loss.",
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
    body: "Unwind with a relaxing, deep tissue, cupping massage or graston therapy — a focused 30 minutes on one area.",
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
    body: "Unwind with a relaxing, deep tissue, cupping massage or graston therapy — a full hour for deeper, multi-area work.",
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
    title: "Choose an appointment which suits you",
    body: "Pick a date and time that works around your schedule.",
  },
  {
    number: "02",
    title: "Pick a package",
    body: "Choose hijama, cupping, massage or a combination package.",
  },
  {
    number: "03",
    title: "Give us your details",
    body: "Share your contact details and anything we should know.",
  },
  {
    number: "04",
    title: "We will be in touch to confirm your booking",
    body: "We'll confirm your appointment and answer any questions.",
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
    name: "Nadim",
    role: "CMA & IPHM qualified therapist",
    image: "/images/about/nadimur-rahman.png",
    imageType: "Professional portrait of Nadimur Rahman.",
    alt: "Nadimur Rahman from Rahma Therapy",
  },
  {
    name: "Minhaj",
    role: "CMA & IPHM qualified therapist",
    image: "/images/about/minhaj-rahman-v2.jpg",
    imageType: "Professional portrait of Minhaj Rahman.",
    alt: "Minhaj Rahman from Rahma Therapy",
  },
  {
    name: "Faheemah",
    role: "CMA & IPHM qualified female therapist",
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
    question: "Does cupping hurt?",
    answer: [
      {
        type: "p",
        text: "Although some may find the process uneasy, most find it therapeutic and painless. Expect to feel tightness from the cups applied in order to create decompression.",
      },
      {
        type: "p",
        text: "During wet cupping (Hijama), superficial incisions are made on the surface of the skin which can feel like a scratch or tickle.",
      },
    ],
  },
  {
    question: "What is Hijama?",
    answer: [
      {
        type: "p",
        text: "“Hijama” or known as wet cupping, is a traditional form of treatment where cups are placed across reflex points and muscle tissue to pump stagnant blood to the surface of the skin.",
      },
      {
        type: "p",
        text: "Superficial incisions are made on the cupped area where stagnant blood can exit.",
      },
      {
        type: "p",
        text: "This enhances a healthy blood circulation and aims to bring the body to a state of homeostasis (balance).",
      },
    ],
  },
  {
    question: "What are the benefits of cupping therapy?",
    answer: [
      { type: "p", text: "Many clients seek cupping therapy for:" },
      {
        type: "list",
        items: [
          "Muscle tension and stiffness",
          "Back, neck, and shoulder discomfort",
          "Sports recovery",
          "Relaxation and stress relief",
          "Improved mobility and flexibility",
        ],
      },
      {
        type: "p",
        text: "Individual results can vary, and cupping should not be considered a replacement for medical care.",
      },
    ],
  },
  {
    question: "Why do cupping marks appear?",
    answer: [
      {
        type: "p",
        text: "The circular marks are caused by the suction drawing blood to the surface of the skin. They are not usually bruises from impact and typically fade within a few days to two weeks, depending on the individual.",
      },
    ],
  },
  {
    question: "How long is a treatment session?",
    answer: [
      {
        type: "p",
        text: "Session lengths typically range from 45 to 60 minutes, depending on the package selected and your individual needs.",
      },
    ],
  },
  {
    question: "How many sessions will I need?",
    answer: [
      {
        type: "p",
        text: "This varies from person to person. Some clients feel benefits after one session, while others with ongoing issues may benefit from a series of treatments.",
      },
    ],
  },
  {
    question: "Are there any side effects?",
    answer: [
      { type: "p", text: "Common temporary effects may include:" },
      {
        type: "list",
        items: [
          "Mild soreness",
          "Redness of the skin",
          "Temporary cupping marks",
          "Feeling relaxed or tired after treatment",
        ],
      },
      { type: "p", text: "Most effects resolve within a few days." },
    ],
  },
  {
    question: "Who should avoid cupping therapy?",
    answer: [
      { type: "p", text: "Cupping may not be suitable for individuals with:" },
      {
        type: "list",
        items: [
          "Open wounds or skin infections",
          "Certain bleeding disorders",
          "Severe skin conditions",
          "Certain medical conditions or medications affecting clotting",
        ],
      },
      { type: "p", text: "Please discuss your medical history before treatment." },
    ],
  },
] as const;
