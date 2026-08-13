import type { BookingPackageId } from "@/features/booking/data/booking-packages";

// Area / location (service-area) pages — SEO "service area" pages.
// Each entry reuses the shared packages + process/safety/FAQ content but adds
// genuinely unique local content (intro, landmarks, why-here cards, area FAQs,
// testimonials) so pages are differentiated, not doorway clones.
//
// Ported verbatim from the design handoff (prototype/data-areas.js). The only
// non-copy changes: hero image paths point at the real copied photos, and the
// areaLinks hrefs use the production /areas/<slug> routes.

export interface AreaFact {
  icon: string;
  label: string;
}

export interface AreaWhyCard {
  icon: string;
  title: string;
  body: string;
}

export interface AreaReview {
  reviewer: string;
  rating: number;
  text: string;
  tag: string;
}

export interface AreaFaq {
  question: string;
  answer: string;
}

export interface AreaCoverageMap {
  heading: string;
  body: string;
  embedSrc: string;
  coverage: string[];
}

export interface AreaSpokeLink {
  name: string;
  href: string;
  note: string;
}

export interface AreaLinksBlock {
  heading: string;
  body: string;
  links: AreaSpokeLink[];
}

/**
 * Real administrative geography, consumed only by structured data
 * (`buildAreaJsonLd`). Not rendered, and not copy.
 *
 * Bury Park, Leagrave and Stopsley are districts WITHIN Luton. Dunstable and
 * Houghton Regis are separate towns in Central Bedfordshire — adjacent to
 * Luton, but not part of it. The visible titles already draw this distinction
 * correctly ("in Dunstable", not "in Dunstable, Luton"); this field lets the
 * machine-readable layer draw it too.
 */
export type AreaPlaceType =
  /** Luton itself — the hub. */
  | "city"
  /** A district inside Luton; emitted with `containedInPlace` → Luton. */
  | "district"
  /** A separate town, emitted as its own `City`, never suffixed with Luton. */
  | "town";

export interface AreaPage {
  slug: string;
  name: string;
  placeType: AreaPlaceType;
  eyebrow: string;
  h1: string;
  subheading: string;
  priceFrom: string;
  heroNote: string;
  heroImage: string;
  heroImageType: string;
  heroAlt: string;
  bookingHref: string;
  bookingCta: string;
  whatsappHref: string;
  whatsappCta: string;
  intro: {
    heading: string;
    paragraphs: string[];
    facts: AreaFact[];
  };
  packageOrder: BookingPackageId[];
  packagesHeading: string;
  packagesSubheading: string;
  whyHeading: string;
  whyCards: AreaWhyCard[];
  reviewsHeading: string;
  reviewsNote: string;
  reviews: AreaReview[];
  faqs: AreaFaq[];
  finalCta: {
    heading: string;
    body: string;
  };
  map: AreaCoverageMap;
  nearby?: string[];
  areaLinks?: AreaLinksBlock;
  seo: {
    title: string;
    description: string;
  };
}

export const areaPages: AreaPage[] = [
  {
    slug: "bury-park",
    name: "Bury Park",
    placeType: "district",
    eyebrow: "Mobile hijama & cupping · Bury Park, Luton",
    h1: "Private Hijama & Cupping at Home in Bury Park",
    subheading:
      "Clean, respectful wet cupping, dry cupping and massage brought to your door in Bury Park — by CMA & IPHM qualified male and female therapists. No clinic, no waiting room, no travelling with a tight back.",
    priceFrom: "From £40",
    heroNote: "Same-week home visits · often same day",
    heroImage: "/images/areas/bury-park-hero.jpg",
    heroImageType: "Clean hijama / cupping setup at home, cups and towels, no blood.",
    heroAlt: "Private hijama and cupping setup for a home visit in Bury Park, Luton",
    bookingHref: "?booking=1&services=hijama-package",
    bookingCta: "Book a home visit",
    whatsappHref:
      "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27d%20like%20to%20book%20hijama%2Fcupping%20at%20home%20in%20Bury%20Park.",
    whatsappCta: "Message us on WhatsApp",

    intro: {
      heading: "Hijama at home, in the heart of Bury Park",
      paragraphs: [
        "Bury Park sits just off Dunstable Road, about a mile north-west of Luton town centre — a close-knit community settled here since the 1970s, with the halal restaurants, grocers and shops along Dunstable Road at its heart. Hijama is part of everyday wellbeing here, not something unfamiliar: for many families it is a Sunnah practice, and we treat it with the respect, hygiene and privacy it deserves.",
        "We bring the full treatment to homes right across Bury Park and the streets around it — near the mosques off Westbourne Road and Bury Park Road, around Kenilworth Road, and through the wider Dallow and Biscot area. You clear a private space; we arrive with the couch, cups, single-use items and everything else.",
        "Because we work locally, appointments in Bury Park are usually easy to arrange the same week — and often the same day. Female clients are treated by a female therapist throughout, so sisters can book with complete peace of mind.",
      ],
      facts: [
        { icon: "MapPin", label: "1 mile NW of Luton town centre, just off Dunstable Road (A505)" },
        { icon: "Home", label: "Home visits across Bury Park, Dallow & Biscot" },
        { icon: "Users", label: "Female clients treated by a female therapist" },
        { icon: "CalendarDays", label: "Same-week slots — often same day" },
      ],
    },

    packageOrder: ["hijama-package", "supreme-combo", "fire-package", "massage-30", "massage-60"],
    packagesHeading: "Packages we bring to Bury Park",
    packagesSubheading:
      "The same Rahma Therapy packages and prices as everywhere we serve — led here by our hijama and cupping sessions.",

    whyHeading: "Why Bury Park books Rahma Therapy",
    whyCards: [
      {
        icon: "Droplets",
        title: "Hijama done properly",
        body: "Clean, respectful wet cupping with single-use items, clear explanation and aftercare — the way a Sunnah practice should be carried out.",
      },
      {
        icon: "Users",
        title: "A female therapist for sisters",
        body: "Female clients are treated by a qualified female therapist, with full modesty and privacy in your own home.",
      },
      {
        icon: "DoorOpen",
        title: "We're minutes away",
        body: "Working locally means short notice is rarely a problem — many Bury Park visits are arranged the same day.",
      },
      {
        icon: "HeartHandshake",
        title: "The whole family welcome",
        body: "Plenty of clients book for parents and siblings too. Tell us who the session is for and we'll plan around your household.",
      },
    ],

    reviewsHeading: "What clients across Luton's community say",
    reviewsNote:
      "Verified Google reviews from Rahma Therapy clients across Luton. Reviews describe individual experiences, not guaranteed outcomes.",
    reviews: [
      {
        reviewer: "Sadia Malik",
        rating: 5,
        text: "I had my very first hijama with sister Fahima yesterday and received exceptional service. Very warm and friendly at the same time professional and knowledgeable about the whole process, she instantly made me feel relaxed. I will definitely be booking further sessions for myself and other members of my family.",
        tag: "First hijama · female therapist",
      },
      {
        reviewer: "Shamilah Khan",
        rating: 5,
        text: "I've been using the female cupping therapist at Rahma Therapy for a few years now and honestly, she is an absolute natural at what she does. Every session has been very comfortable and I always feel great afterwards. I've recommended Rahma Therapy to family and friends and will keep doing so.",
        tag: "Repeat client · female therapist",
      },
      {
        reviewer: "Salehah Awan",
        rating: 5,
        text: "My first Hijama session was amazing — the therapist explained everything clearly and made me feel comfortable. I love the mobile service, and she's always professional and reliable. I highly recommend Rahma Therapy to anyone considering Hijama.",
        tag: "Home visit · hijama",
      },
    ],

    faqs: [
      {
        question: "Which parts of Bury Park do you cover?",
        answer:
          "All of it — every street in Bury Park, plus the surrounding Dallow, Biscot and town-centre areas. If you're nearby and unsure, message us your postcode and we'll confirm.",
      },
      {
        question: "Can a sister have hijama with a female therapist in Bury Park?",
        answer:
          "Yes. Female clients are treated by a qualified female therapist throughout the session, in the privacy of your own home, with modesty respected at every step.",
      },
      {
        question: "How quickly can you reach Bury Park?",
        answer:
          "We work locally, so Bury Park appointments are usually available the same week and often the same day. WhatsApp us for the soonest slot.",
      },
      {
        question: "Can I book hijama for a particular day?",
        answer:
          "Yes. Many clients prefer specific days for hijama, including dates on the Islamic calendar. Tell us your preferred day and we'll do our best to fit you in.",
      },
    ],

    finalCta: {
      heading: "Book hijama at home in Bury Park",
      body: "Tell us what you need and who the session is for. We'll confirm your therapist, check suitability and bring everything to your door — usually within the same week.",
    },

    map: {
      heading: "Covering Bury Park and the streets around it",
      body: "We're fully mobile across Bury Park and the surrounding LU1 and LU3 streets. Just outside the area? Message us your postcode and we'll confirm.",
      embedSrc:
        "https://www.openstreetmap.org/export/embed.html?bbox=-0.4640%2C51.8770%2C-0.4060%2C51.8960&layer=mapnik&marker=51.8862%2C-0.4347",
      coverage: ["Bury Park", "Dallow", "Biscot", "Dunstable Road", "Leagrave Road", "Luton town centre"],
    },

    nearby: ["leagrave", "stopsley", "dunstable"],

    seo: {
      title: "Hijama & Cupping in Bury Park, Luton | At-Home Wet Cupping",
      description:
        "Private mobile hijama, cupping and massage at home in Bury Park, Luton. CMA & IPHM qualified male and female therapists. Same-week home visits from £40.",
    },
  },

  {
    slug: "luton",
    name: "Luton",
    placeType: "city",
    eyebrow: "At-home therapy · across Luton, Bedfordshire",
    h1: "Mobile Hijama, Cupping & Massage Across Luton",
    subheading:
      "One trusted team for hijama, cupping and therapeutic massage — brought to your door anywhere in Luton by CMA & IPHM qualified male and female therapists. No clinic, no waiting room, no travelling when you're already sore.",
    priceFrom: "From £40",
    heroNote: "Covering every LU postcode",
    heroImage: "/images/areas/luton-hero.jpg",
    heroImageType: "Therapist arriving at a Luton home with treatment couch and kit.",
    heroAlt: "Mobile hijama, cupping and massage therapist visiting a home in Luton",
    bookingHref: "?booking=1",
    bookingCta: "Book a home visit",
    whatsappHref:
      "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27d%20like%20to%20book%20a%20home%20visit%20in%20Luton.",
    whatsappCta: "Message us on WhatsApp",

    intro: {
      heading: "Your local mobile therapists for the whole of Luton",
      paragraphs: [
        "Luton is a busy, diverse town of around 200,000 people — from the streets around the town centre and Bury Park to the suburbs of Leagrave, Stopsley, Round Green, Farley Hill and Wigmore. Wherever you are in the town, we bring the full treatment to you.",
        "Some clients book us for hijama as a Sunnah practice, others for cupping to ease gym and work strain, and plenty simply want a proper therapeutic massage without the drive to a clinic. One team covers all of it — with both male and female therapists, so everyone in the household has someone they're comfortable with.",
        "Because we're based in and around Luton, appointments anywhere in town are usually easy to arrange the same week, and often the same day. You pick the treatment and the time; we handle the rest.",
      ],
      facts: [
        { icon: "MapPin", label: "Home visits across every Luton (LU1–LU4) postcode" },
        { icon: "Sparkles", label: "Hijama, cupping and massage — one trusted team" },
        { icon: "Users", label: "Male & female therapists for the whole family" },
        { icon: "CalendarDays", label: "Same-week appointments — often same day" },
      ],
    },

    packageOrder: ["supreme-combo", "hijama-package", "fire-package", "massage-60", "massage-30"],
    packagesHeading: "Packages we bring across Luton",
    packagesSubheading:
      "The same clear packages and pricing wherever you are in town — from a focused massage to our most complete reset.",

    whyHeading: "Why Luton chooses Rahma Therapy",
    whyCards: [
      {
        icon: "Home",
        title: "We come to you",
        body: "No clinic and no travelling with a tight back — we bring the couch, cups and full setup to your door anywhere in Luton.",
      },
      {
        icon: "Sparkles",
        title: "Every treatment, one team",
        body: "Hijama, dry and fire cupping, massage and IASTM/Graston work — all from the same qualified, trusted therapists.",
      },
      {
        icon: "Users",
        title: "Male & female therapists",
        body: "Female clients are treated by a qualified female therapist, so everyone in the household is comfortable.",
      },
      {
        icon: "ShieldCheck",
        title: "CMA & IPHM qualified",
        body: "Professional, insured therapists who check suitability and explain everything before any treatment begins.",
      },
    ],

    reviewsHeading: "What clients across Luton say",
    reviewsNote:
      "Verified Google reviews from Rahma Therapy clients across Luton. Reviews describe individual experiences, not guaranteed outcomes.",
    reviews: [
      {
        reviewer: "Shalim Miah",
        rating: 5,
        text: "This is a mobile therapist. First time used. Arrived in my house on time, well equipped, professional and knowledgeable. Very happy and pleased with the experience. Will definitely use again and highly recommended!",
        tag: "Home visit · first-time client",
      },
      {
        reviewer: "Habib Raj",
        rating: 5,
        text: "Absolutely brilliant service with brilliant conversation. My regular ailment fixers! A seized back here, a trapped nerve there, Rahma always come through and get me right. Very knowledgeable and make you feel extremely comfortable. I've used them myself but also for my female family members.",
        tag: "Back & neck · repeat client",
      },
      {
        reviewer: "Hassanur Rahman",
        rating: 5,
        text: "Very professional and friendly, got cupping done due to body pains from training martial arts. This has definitely helped my recovery, I feel so much stronger and confident in training. I would recommend everyone to try this — mark my words, you will not be disappointed!",
        tag: "Sports recovery · cupping",
      },
    ],

    faqs: [
      {
        question: "Which parts of Luton do you cover?",
        answer:
          "All of it — the town centre, Bury Park, Leagrave, Stopsley, Round Green, Farley Hill, Wigmore, Hockwell Ring and everywhere in between. We also travel to Dunstable and Houghton Regis. Message us your postcode if you'd like to confirm.",
      },
      {
        question: "Do you charge extra to travel within Luton?",
        answer:
          "No — home visits anywhere within Luton are included in the package price. For areas a little further out, just ask and we'll confirm before you book.",
      },
      {
        question: "Can I choose a male or female therapist?",
        answer:
          "Yes. We have both male and female therapists, and female clients are always treated by a female therapist. Let us know your preference when you book.",
      },
      {
        question: "How quickly can you visit?",
        answer:
          "Because we're local to Luton, appointments are usually available the same week and often the same day. WhatsApp us for the soonest slot.",
      },
    ],

    finalCta: {
      heading: "Book your home visit anywhere in Luton",
      body: "Tell us the treatment, the area and who it's for. We'll confirm your therapist, check suitability and bring everything to your door — usually within the same week.",
    },

    map: {
      heading: "Covering the whole of Luton",
      body: "We're fully mobile across every Luton postcode and the surrounding towns. Not sure if we reach you? Send us your postcode and we'll confirm.",
      embedSrc:
        "https://www.openstreetmap.org/export/embed.html?bbox=-0.4900%2C51.8500%2C-0.3700%2C51.9150&layer=mapnik&marker=51.8787%2C-0.4200",
      coverage: ["Town centre", "Bury Park", "Leagrave", "Stopsley", "Round Green", "Farley Hill", "Wigmore", "Dunstable", "Houghton Regis"],
    },

    areaLinks: {
      heading: "Explore the areas we serve",
      body: "We cover the whole town, but here are some of the Luton neighbourhoods and nearby towns we visit most often.",
      links: [
        { name: "Bury Park", href: "/areas/bury-park", note: "Hijama & cupping" },
        { name: "Leagrave", href: "/areas/leagrave", note: "Commuter & sports recovery" },
        { name: "Stopsley", href: "/areas/stopsley", note: "Massage & wellness" },
        { name: "Dunstable", href: "/areas/dunstable", note: "Massage & cupping" },
        { name: "Houghton Regis", href: "/areas/houghton-regis", note: "Family wellness" },
      ],
    },

    seo: {
      title: "Mobile Hijama, Cupping & Massage in Luton | At-Home Therapy",
      description:
        "Private mobile hijama, cupping and massage at home across Luton. CMA & IPHM qualified male and female therapists. Same-week home visits from £40.",
    },
  },

  {
    slug: "leagrave",
    name: "Leagrave",
    placeType: "district",
    eyebrow: "At-home massage & recovery · Leagrave, Luton",
    h1: "Mobile Massage, Cupping & Recovery in Leagrave",
    subheading:
      "Back, neck and shoulder tension easing after the commute or the gym — therapeutic massage, cupping and hijama brought to your door in Leagrave by CMA & IPHM qualified therapists. No clinic, no driving home stiff.",
    priceFrom: "From £40",
    heroNote: "Evening & weekend slots available",
    heroImage: "/images/areas/leagrave-hero.jpg",
    heroImageType: "Deep-tissue back/shoulder massage during a home visit.",
    heroAlt: "Mobile massage and cupping therapist treating back tension at a home in Leagrave, Luton",
    bookingHref: "?booking=1&services=massage-60",
    bookingCta: "Book a home visit",
    whatsappHref:
      "https://wa.me/447798897222?text=Hi%2C%20I%27d%20like%20to%20book%20a%20massage%2Fcupping%20home%20visit%20in%20Leagrave.",
    whatsappCta: "Message us on WhatsApp",

    intro: {
      heading: "Recovery at home, around the Leagrave commute",
      paragraphs: [
        "Leagrave is one of Luton's busiest commuter suburbs, in the north-west of the town — a short walk from Leagrave station, with direct Thameslink trains reaching London St Pancras in around 35 minutes, and Junctions 11 and 11a of the M1 close by. Long days at a desk or behind the wheel take their toll, and a tight lower back or stiff neck is the most common reason people in Leagrave call us.",
        "We bring proper therapeutic treatment to homes right across Leagrave, Lewsey, Hockwell Ring, Limbury and the estates around Leagrave Park — deep-tissue and cupping massage, IASTM/Graston work for stubborn knots, and hijama for those who want it. You stay home; we bring the couch and the kit.",
        "Because evenings and weekends are when most Leagrave clients are free, that's exactly when we work. Book around the school run, the gym or the commute, and have someone come to you when it actually suits.",
      ],
      facts: [
        { icon: "MapPin", label: "Home visits across Leagrave, Lewsey & Hockwell Ring" },
        { icon: "Activity", label: "Back, neck, shoulder & sports-recovery focus" },
        { icon: "Clock3", label: "Evening & weekend appointments" },
        { icon: "Users", label: "Male & female therapists for the household" },
      ],
    },

    packageOrder: ["massage-60", "supreme-combo", "fire-package", "hijama-package", "massage-30"],
    packagesHeading: "Packages we bring to Leagrave",
    packagesSubheading:
      "From a focused recovery massage to our most complete reset — the same clear pricing, brought to your home in Leagrave.",

    whyHeading: "Why Leagrave books Rahma Therapy",
    whyCards: [
      {
        icon: "Activity",
        title: "Built for desk & commute strain",
        body: "Deep-tissue, cupping and Graston work that targets the tight lower backs, necks and shoulders that come with long commutes and desk days.",
      },
      {
        icon: "Clock3",
        title: "Evenings & weekends",
        body: "We work around your schedule — after work, after training or at the weekend — so recovery fits your week instead of fighting it.",
      },
      {
        icon: "Home",
        title: "No drive home stiff",
        body: "Skip the clinic and the car journey afterwards. Treatment happens at home, so you can rest the moment it's finished.",
      },
      {
        icon: "Dumbbell",
        title: "Gym & sports recovery",
        body: "Train hard in Leagrave? Cupping and sports massage help you recover faster and move better between sessions.",
      },
    ],

    reviewsHeading: "What recovery clients say",
    reviewsNote:
      "Verified Google reviews from Rahma Therapy clients across Luton. Reviews describe individual experiences, not guaranteed outcomes.",
    reviews: [
      {
        reviewer: "Keiron Boyce",
        rating: 5,
        text: "The treatment that I had from Rahma Therapy was first rate. I had multiple ailments and areas of stiffness along my back that have been remedied. My neck mobility is now as good as it has been in years. The specialist was extremely knowledgeable and thoroughly professional throughout. This has to be an essential part of body maintenance going forward.",
        tag: "Back & neck · mobility",
      },
      {
        reviewer: "Manish Panjabi",
        rating: 5,
        text: "Amazing! My back was hurting and I could not sleep through the night. The Graston therapy was exactly what was required for the muscle spasm and trapped nerve. Feels like all the pain has gone away in just one session. The cupping was the icing on the cake to release the stress. Really liked the session and will highly recommend the service.",
        tag: "Trapped nerve · Graston & cupping",
      },
      {
        reviewer: "Owen Phillips",
        rating: 5,
        text: "First session with Rahma Therapy — the service was great from booking all the way to the cupping itself. The therapist made sure I was comfortable at all times and not once did the session feel rushed. Definitely felt the benefits from the Supreme Combo package, highly recommend!",
        tag: "Supreme Combo · cupping",
      },
    ],

    faqs: [
      {
        question: "Do you cover the streets near Leagrave station?",
        answer:
          "Yes — we visit homes right across Leagrave, including the roads around the station, Marsh Farm, Lewsey and Hockwell Ring. Message us your postcode and we'll confirm.",
      },
      {
        question: "Can you come after work or at the weekend?",
        answer:
          "Yes. Evening and weekend slots are our most popular in Leagrave, so you can book around the commute, the gym or family time. WhatsApp us for the next available slot.",
      },
      {
        question: "Which treatment is best for desk or commute back pain?",
        answer:
          "For tight lower backs, necks and shoulders we usually recommend the one-hour massage with cupping or Graston work. Tell us where it hurts and we'll tailor the session — your therapist checks everything before starting.",
      },
      {
        question: "Do you help with gym and sports recovery?",
        answer:
          "Absolutely. Sports massage and cupping are popular with Leagrave clients who train, helping ease soreness and support recovery between sessions.",
      },
    ],

    finalCta: {
      heading: "Book recovery at home in Leagrave",
      body: "Tell us where it's tight and when suits you — evenings and weekends included. We'll confirm your therapist, check suitability and bring everything to your door.",
    },

    map: {
      heading: "Covering Leagrave and the north-west of Luton",
      body: "We're fully mobile across Leagrave and the surrounding LU3 and LU4 streets. Just outside the area? Send your postcode and we'll confirm.",
      embedSrc:
        "https://www.openstreetmap.org/export/embed.html?bbox=-0.4760%2C51.8980%2C-0.4180%2C51.9230&layer=mapnik&marker=51.9105%2C-0.4470",
      coverage: ["Leagrave", "Lewsey", "Hockwell Ring", "Marsh Farm", "Sundon Park", "Limbury"],
    },

    nearby: ["bury-park", "stopsley", "houghton-regis"],

    seo: {
      title: "Mobile Massage, Cupping & Hijama in Leagrave, Luton | At-Home Recovery",
      description:
        "At-home massage, cupping and hijama in Leagrave, Luton. Back, neck and sports-recovery focus, evening & weekend slots. CMA & IPHM qualified, from £40.",
    },
  },

  {
    slug: "stopsley",
    name: "Stopsley",
    placeType: "district",
    eyebrow: "At-home massage & wellness · Stopsley, Luton",
    h1: "Relaxing Mobile Massage & Therapy in Stopsley",
    subheading:
      "Unwind without leaving home. Calm, unhurried massage, cupping and hijama brought to your door in Stopsley by CMA & IPHM qualified male and female therapists — a proper chance to switch off and ease the week's tension.",
    priceFrom: "From £40",
    heroNote: "Calm, unhurried home sessions",
    heroImage: "/images/areas/stopsley-hero.jpg",
    heroImageType: "Calm, relaxing massage in a comfortable home setting.",
    heroAlt: "Relaxing mobile massage therapy during a home visit in Stopsley, Luton",
    bookingHref: "?booking=1&services=massage-60",
    bookingCta: "Book a home visit",
    whatsappHref:
      "https://wa.me/447798897222?text=Hi%2C%20I%27d%20like%20to%20book%20a%20relaxing%20massage%20home%20visit%20in%20Stopsley.",
    whatsappCta: "Message us on WhatsApp",

    intro: {
      heading: "Unhurried treatment in the comfort of Stopsley",
      paragraphs: [
        "Stopsley is one of Luton's leafier, more established corners — a former village in the LU2 north-east of town, set around the old green and Hitchin Road, with quiet residential streets, well-regarded schools like Putteridge High and Wigmore Primary, and a strong community feel. It's the kind of place where life is busy with work and family, and switching off properly can be hard to find time for.",
        "That's where we come in. We bring relaxing, professional treatment to homes right across Stopsley, Round Green, Wigmore, Bushmead and Putteridge — from a full hour of massage to ease stress and tension, to cupping and hijama for those who want them. No clinic, no waiting room, no rushing.",
        "Many Stopsley clients book us as a regular reset — a standing appointment to stay on top of stress, sleep and tension. Female clients are treated by a female therapist, so it's comfortable for everyone in the household.",
      ],
      facts: [
        { icon: "MapPin", label: "Home visits across Stopsley, Round Green, Wigmore & Bushmead" },
        { icon: "Sparkles", label: "Relaxation, stress relief & general wellness" },
        { icon: "Users", label: "Female clients treated by a female therapist" },
        { icon: "HandHeart", label: "Regular wellness sessions welcome" },
      ],
    },

    packageOrder: ["massage-60", "massage-30", "supreme-combo", "fire-package", "hijama-package"],
    packagesHeading: "Packages we bring to Stopsley",
    packagesSubheading:
      "From an unhurried hour of relaxation to a focused session or a complete reset — the same clear pricing, brought to your home in Stopsley.",

    whyHeading: "Why Stopsley books Rahma Therapy",
    whyCards: [
      {
        icon: "Sparkles",
        title: "Time to actually switch off",
        body: "A full hour of relaxing massage in your own calm space — no clinic, no rush, just time to unwind and ease the week's tension.",
      },
      {
        icon: "Users",
        title: "Female therapist for the family",
        body: "Female clients are always treated by a qualified female therapist, so treatment is comfortable for everyone in the household.",
      },
      {
        icon: "HandHeart",
        title: "Wellness as a routine",
        body: "Many Stopsley clients book a regular standing session to stay on top of stress, sleep and muscle tension — we'll find a rhythm that suits.",
      },
      {
        icon: "Home",
        title: "Calm, at home",
        body: "We bring the couch, oils and everything else to you, so the moment your session ends you can simply rest — no journey home.",
      },
    ],

    reviewsHeading: "What wellness clients say",
    reviewsNote:
      "Verified Google reviews from Rahma Therapy clients across Luton. Reviews describe individual experiences, not guaranteed outcomes.",
    reviews: [
      {
        reviewer: "Humera Akbur",
        rating: 5,
        text: "Booked a relaxation massage with a female therapist. She arrived on time and was professional throughout. Comfortable, calm and exactly what I needed at home. Great job — I'll be booking again.",
        tag: "Relaxation massage · female therapist",
      },
      {
        reviewer: "nish r",
        rating: 5,
        text: "Fantastic customer service, and they give you honest advice. The fact that all sessions I was able to plan around my timetable and from the comfort of my home was a huge benefit. I would recommend anyone considering reaching out to Rahma Therapy to give them a go!",
        tag: "Home visits · flexible scheduling",
      },
      {
        reviewer: "Aysha Khatoon",
        rating: 5,
        text: "The female therapist was amazing — friendly and professional. I've used her a few times now and the service is consistently excellent. Highly recommend for anyone who wants treatment in the comfort of their own home.",
        tag: "Repeat client · female therapist",
      },
    ],

    faqs: [
      {
        question: "Do you serve Round Green and Wigmore as well as Stopsley?",
        answer:
          "Yes — we cover the whole north-east of Luton, including Round Green, Wigmore, Bushmead, Putteridge and Crawley Green, as well as Stopsley itself. Send us your postcode if you'd like to confirm.",
      },
      {
        question: "Can I book a regular standing appointment?",
        answer:
          "Definitely. Many Stopsley clients book a recurring session — weekly, fortnightly or monthly — to keep on top of stress and tension. Just let us know the rhythm that suits and we'll plan around it.",
      },
      {
        question: "Which session is best just to relax and de-stress?",
        answer:
          "The one-hour massage is our most popular for relaxation — a full, unhurried hour to ease tension and switch off. Add cupping if you'd like; your therapist will tailor it to you.",
      },
      {
        question: "Is treatment comfortable for women at home?",
        answer:
          "Yes. Female clients are always treated by a qualified female therapist, with modesty and privacy respected throughout, in the comfort of your own home.",
      },
    ],

    finalCta: {
      heading: "Book a calm home visit in Stopsley",
      body: "Tell us what you'd like and when suits you. We'll confirm your therapist, check suitability and bring everything to your door — so all you have to do is relax.",
    },

    map: {
      heading: "Covering Stopsley and the north-east of Luton",
      body: "We're fully mobile across Stopsley and the surrounding LU2 streets. Just outside the area? Send your postcode and we'll confirm.",
      embedSrc:
        "https://www.openstreetmap.org/export/embed.html?bbox=-0.4180%2C51.8920%2C-0.3560%2C51.9180&layer=mapnik&marker=51.9050%2C-0.3850",
      coverage: ["Stopsley", "Round Green", "Wigmore", "Bushmead", "Putteridge", "Crawley Green"],
    },

    nearby: ["bury-park", "leagrave", "dunstable"],

    seo: {
      title: "Relaxing Mobile Massage & Therapy in Stopsley, Luton | At-Home Wellness",
      description:
        "At-home relaxation massage, cupping and hijama in Stopsley, Luton. Calm, unhurried sessions with male & female therapists. CMA & IPHM qualified, from £40.",
    },
  },

  {
    slug: "dunstable",
    name: "Dunstable",
    placeType: "town",
    eyebrow: "Mobile therapy · we travel to Dunstable",
    h1: "Mobile Massage, Cupping & Hijama in Dunstable",
    subheading:
      "We travel to you in Dunstable. Sports and therapeutic massage, cupping and hijama brought to your door by CMA & IPHM qualified male and female therapists — no clinic, no drive across town, treatment in the comfort of home.",
    priceFrom: "From £40",
    heroNote: "We come to you — no travel charge in Dunstable",
    heroImage: "/images/areas/dunstable-hero-v2.jpg",
    heroImageType: "Sports / therapeutic massage during a home visit.",
    heroAlt: "Mobile sports and therapeutic massage during a home visit in Dunstable, Bedfordshire",
    bookingHref: "?booking=1&services=massage-60",
    bookingCta: "Book a home visit",
    whatsappHref:
      "https://wa.me/447798897222?text=Hi%2C%20I%27d%20like%20to%20book%20a%20massage%2Fcupping%20home%20visit%20in%20Dunstable.",
    whatsappCta: "Message us on WhatsApp",

    intro: {
      heading: "We bring the treatment to you in Dunstable",
      paragraphs: [
        "Dunstable sits at the foot of the Chilterns, just west of Luton — a historic market town in its own right, built where the old Watling Street (the A5) crosses the ancient Icknield Way, with the Priory church and Dunstable Downs on its doorstep and an active, outdoorsy community. From walkers and cyclists on the Downs to people on their feet all day at work, sore backs, tight legs and stiff shoulders are part of life here.",
        "We're a mobile service, so there's no clinic to visit — we travel to homes right across Dunstable, from the town centre and the Priory area out to Downside and the surrounding streets. You'll get sports and therapeutic massage, cupping for recovery, and hijama for those who want it, all set up in your own home.",
        "Being just along the busway and the A505 from Luton means reaching Dunstable is easy for us, and there's no extra travel charge within the town. Pick a time that works around your week and we'll come to you.",
      ],
      facts: [
        { icon: "Car", label: "We travel to you — no travel charge within Dunstable" },
        { icon: "Activity", label: "Sports & therapeutic massage, cupping for recovery" },
        { icon: "MapPin", label: "Home visits across Dunstable, Priory area & Downside" },
        { icon: "Users", label: "Male & female therapists available" },
      ],
    },

    packageOrder: ["massage-60", "fire-package", "supreme-combo", "massage-30", "hijama-package"],
    packagesHeading: "Packages we bring to Dunstable",
    packagesSubheading:
      "From sports and therapeutic massage to cupping for recovery — the same clear pricing, brought to your home in Dunstable.",

    whyHeading: "Why Dunstable books Rahma Therapy",
    whyCards: [
      {
        icon: "Car",
        title: "We travel to you",
        body: "No clinic and no drive across town — we come to your home anywhere in Dunstable, with no extra travel charge within the town.",
      },
      {
        icon: "Activity",
        title: "Recovery for active lives",
        body: "Sports and therapeutic massage with cupping and Graston work — ideal for walkers, cyclists and anyone on their feet all day.",
      },
      {
        icon: "BadgeCheck",
        title: "CMA & IPHM qualified",
        body: "Professional, insured therapists who explain everything and check suitability before any treatment begins.",
      },
      {
        icon: "Home",
        title: "Treatment in comfort",
        body: "We bring the couch, oils and full setup to you, so you can rest the moment your session ends — no journey home.",
      },
    ],

    reviewsHeading: "What clients say",
    reviewsNote:
      "Verified Google reviews from Rahma Therapy clients. Reviews describe individual experiences, not guaranteed outcomes.",
    reviews: [
      {
        reviewer: "Duncan Djillali",
        rating: 5,
        text: "My first treatment today with Rahma Therapy. Everything was explained to me so that I knew what was happening and the reasons why it was being done. Very professional, friendly and good service.",
        tag: "First treatment · explained clearly",
      },
      {
        reviewer: "Nasrul Gani",
        rating: 5,
        text: "Amazing service again from Rahma Therapy. I felt at ease, nothing to worry about, everything was well explained to me and I am already feeling the positive effects. I was treated for lower back pain. Highly recommend — the service is second to none.",
        tag: "Lower back · recovery",
      },
      {
        reviewer: "Irfan Saleem",
        rating: 5,
        text: "I got a next-day appointment for myself and the Mrs, the experience was exceptional — very knowledgeable, professional and hygienic. I will definitely be booking again and highly recommend anyone looking for treatment in the comfort of your own home.",
        tag: "Home visit · next-day booking",
      },
    ],

    faqs: [
      {
        question: "Do you charge extra to travel to Dunstable?",
        answer:
          "No — there's no additional travel charge for home visits within Dunstable. The price you see is the price you pay. For addresses further out, just ask and we'll confirm before you book.",
      },
      {
        question: "Are you based in Dunstable?",
        answer:
          "We're a mobile service covering Luton, Dunstable and the surrounding area — there's no clinic to visit. We travel to your home in Dunstable with everything needed for your treatment.",
      },
      {
        question: "Which treatment is best for sports and outdoor recovery?",
        answer:
          "For walkers, cyclists and active people we usually recommend the one-hour massage with cupping or Graston work to ease tight legs, backs and shoulders. Your therapist will tailor the session to you.",
      },
      {
        question: "How soon can you come to Dunstable?",
        answer:
          "We can often arrange a visit the same week, and sometimes the next day. WhatsApp us your preferred time and we'll confirm the soonest slot.",
      },
    ],

    finalCta: {
      heading: "Book a home visit in Dunstable",
      body: "Tell us the treatment, your address and a time that suits — we travel to you, with no extra charge within Dunstable. We'll confirm your therapist and bring everything needed.",
    },

    map: {
      heading: "We cover Dunstable and the surrounding area",
      body: "We're fully mobile across Dunstable and the nearby streets. Just outside the town? Send us your postcode and we'll confirm.",
      embedSrc:
        "https://www.openstreetmap.org/export/embed.html?bbox=-0.5470%2C51.8730%2C-0.4880%2C51.8990&layer=mapnik&marker=51.8860%2C-0.5210",
      coverage: ["Dunstable", "Priory area", "Downside", "Dunstable Downs", "Kensworth", "Totternhoe"],
    },

    nearby: ["houghton-regis", "leagrave", "bury-park"],

    seo: {
      title: "Mobile Massage, Cupping & Hijama in Dunstable | At-Home Therapy",
      description:
        "Mobile sports and therapeutic massage, cupping and hijama at home in Dunstable. No travel charge. CMA & IPHM qualified therapists, from £40.",
    },
  },

  {
    slug: "houghton-regis",
    name: "Houghton Regis",
    placeType: "town",
    eyebrow: "Mobile therapy · we travel to Houghton Regis",
    h1: "At-Home Massage, Cupping & Hijama in Houghton Regis",
    subheading:
      "Convenient, affordable treatment for the whole family — massage, cupping and hijama brought to your door in Houghton Regis by CMA & IPHM qualified male and female therapists. We travel to you, around your family's schedule.",
    priceFrom: "From £40",
    heroNote: "We come to you — no travel charge in Houghton Regis",
    heroImage: "/images/areas/houghton-regis-hero.jpg",
    heroImageType: "Therapist arriving at a modern family home with treatment kit.",
    heroAlt: "Mobile massage and cupping therapist visiting a family home in Houghton Regis, Bedfordshire",
    bookingHref: "?booking=1",
    bookingCta: "Book a home visit",
    whatsappHref:
      "https://wa.me/447798897222?text=Hi%2C%20I%27d%20like%20to%20book%20a%20home%20visit%20in%20Houghton%20Regis.",
    whatsappCta: "Message us on WhatsApp",

    intro: {
      heading: "Family-friendly treatment, brought to your door",
      paragraphs: [
        "Houghton Regis is a growing LU5 town just north of Dunstable — a former village hugely expanded with London overspill housing, and now growing again with thousands of new homes planned around Bidwell and its northern edge. It's home to plenty of busy working families, and between work, school runs and everything else, getting to a clinic isn't always realistic.",
        "So we bring the clinic to you. We travel to homes right across Houghton Regis — from Tithe Farm and Parkside to the newer developments off the Bedford Road — with massage to ease everyday aches, cupping for recovery, and hijama for those who want it. One visit, whoever in the household needs it.",
        "We're a short hop along the busway and the A5, so reaching Houghton Regis is easy and there's no extra travel charge within the town. Plenty of clients book for more than one person in the same visit — just tell us who it's for and we'll plan around your family.",
      ],
      facts: [
        { icon: "Car", label: "We travel to you — no travel charge within Houghton Regis" },
        { icon: "HeartHandshake", label: "Massage, cupping & hijama for the whole family" },
        { icon: "MapPin", label: "Home visits across Tithe Farm, Parkside & the new estates" },
        { icon: "Users", label: "Male & female therapists available" },
      ],
    },

    packageOrder: ["massage-60", "supreme-combo", "massage-30", "fire-package", "hijama-package"],
    packagesHeading: "Packages we bring to Houghton Regis",
    packagesSubheading:
      "From an everyday massage to a complete reset — the same clear, affordable pricing, brought to your home in Houghton Regis.",

    whyHeading: "Why Houghton Regis books Rahma Therapy",
    whyCards: [
      {
        icon: "Car",
        title: "We travel to you",
        body: "No clinic and no driving the family around — we come to your home anywhere in Houghton Regis, with no extra travel charge within the town.",
      },
      {
        icon: "HeartHandshake",
        title: "One visit, whole family",
        body: "Book for more than one person in the same appointment — a popular choice for busy households across Houghton Regis.",
      },
      {
        icon: "Clock3",
        title: "Around your schedule",
        body: "Daytime, evening or weekend — we work around school runs, shifts and family life so treatment actually fits your week.",
      },
      {
        icon: "Users",
        title: "Male & female therapists",
        body: "Female clients are treated by a qualified female therapist, so treatment is comfortable for everyone in the home.",
      },
    ],

    reviewsHeading: "What families say",
    reviewsNote:
      "Verified Google reviews from Rahma Therapy clients. Reviews describe individual experiences, not guaranteed outcomes.",
    reviews: [
      {
        reviewer: "Mohammed Miah",
        rating: 5,
        text: "Excellent professional service. Three people in my family have received treatment from Rahma Therapy and all three have reported positive changes health wise. Highly recommend Rahma Therapy.",
        tag: "Whole family · repeat clients",
      },
      {
        reviewer: "Rahath Ahmed",
        rating: 5,
        text: "Booked a session in for me and my father — booking was easy, great communication and the service was outstanding. It was my first time trying hijama; it was really relaxing and your muscles feel amazing at the end of the session. Will definitely be back soon!",
        tag: "Booked for two · easy booking",
      },
      {
        reviewer: "Saghar Najib",
        rating: 5,
        text: "It was a beautiful experience as I had really bad back pain — the way she explained the treatment was incredible. She was so nice and friendly and I already feel better. Thank you, sister.",
        tag: "Back pain · female therapist",
      },
    ],

    faqs: [
      {
        question: "Do you cover the new estates in Houghton Regis?",
        answer:
          "Yes — we visit homes right across Houghton Regis, including the newer developments off the Bedford Road and around the town's edges, as well as Tithe Farm, Parkside and the established areas. Send us your postcode and we'll confirm.",
      },
      {
        question: "Can you treat more than one person in the same visit?",
        answer:
          "Yes, and it's a popular choice here. Many Houghton Regis families book for two or more people in one appointment — just tell us who it's for and we'll plan the visit around your household.",
      },
      {
        question: "Do you charge extra to travel to Houghton Regis?",
        answer:
          "No — there's no additional travel charge for home visits within Houghton Regis. For addresses a little further out, just ask and we'll confirm before you book.",
      },
      {
        question: "How soon can you visit?",
        answer:
          "We can often arrange a visit the same week, and sometimes the next day. WhatsApp us your preferred time and we'll confirm the soonest slot.",
      },
    ],

    finalCta: {
      heading: "Book a family home visit in Houghton Regis",
      body: "Tell us the treatment, who it's for and a time that suits — we travel to you, with no extra charge within Houghton Regis. We'll confirm your therapist and bring everything needed.",
    },

    map: {
      heading: "We cover Houghton Regis and the surrounding area",
      body: "We're fully mobile across Houghton Regis and the nearby streets. Just outside the town? Send us your postcode and we'll confirm.",
      embedSrc:
        "https://www.openstreetmap.org/export/embed.html?bbox=-0.5430%2C51.8950%2C-0.4850%2C51.9210&layer=mapnik&marker=51.9080%2C-0.5160",
      coverage: ["Houghton Regis", "Tithe Farm", "Parkside", "Bidwell", "Chalton", "Woodside"],
    },

    nearby: ["dunstable", "leagrave", "bury-park"],

    seo: {
      title: "At-Home Massage, Cupping & Hijama in Houghton Regis | Mobile Therapy",
      description:
        "Mobile massage, cupping and hijama at home in Houghton Regis. Family-friendly, we travel to you at no charge. CMA & IPHM qualified, from £40.",
    },
  },
];

export function getAreaPage(slug: string) {
  return areaPages.find((area) => area.slug === slug);
}

// The hub (Luton) lives at /areas; the [slug] route serves only the spokes.
export const areaSpokes = areaPages.filter((area) => area.slug !== "luton");
