import type { BookingPackageId } from "@/features/booking/data/booking-packages";

export type PackagePage = {
  slug: string;
  title: string;
  eyebrow: string;
  h1: string;
  subheading: string;
  openingCopy: string;
  price: string;
  duration?: string;
  heroImage: string;
  heroImageType: string;
  heroAlt: string;
  breakdownImage: string;
  breakdownImageType: string;
  breakdownAlt: string;
  heroOverlayTitle: string;
  heroOverlayText: string;
  bookingHref: string;
  bookingCta: string;
  whatsappHref: string;
  whatsappCta: string;
  bookingServiceId: BookingPackageId;
  seo: {
    title: string;
    description: string;
  };
  summary: {
    price: string;
    duration?: string;
    bestFor: string;
    therapistOption: string;
    includesHeading?: string;
    includes: readonly string[];
  };
  fitCards: readonly {
    title: string;
    body: string;
  }[];
  includesDetailed: readonly {
    title: string;
    body: string;
  }[];
  treatmentBreakdown: readonly {
    title: string;
    whatItIs: string;
    whyIncluded: string;
    clientUse: string;
    persuasivePhrase: string;
    icon: string;
  }[];
  benefits: {
    heading: string;
    subheading: string;
    cards: readonly {
      title: string;
      body: string;
    }[];
    comparison?: {
      heading: string;
      columns: readonly {
        heading: string;
        items: readonly string[];
      }[];
    };
  };
  faqs: readonly {
    question: string;
    answer: string;
  }[];
  relatedPackages: readonly {
    title: string;
    price: string;
    body: string;
    href: string;
    cta: string;
  }[];
  finalCta: {
    heading: string;
    body: string;
  };
};

const sharedSessionSteps = [
  {
    number: "01",
    title: "Book your package",
    body: "Choose the package and therapist option that suits you.",
  },
  {
    number: "02",
    title: "Suitability check",
    body: "Tell us your main concern and any health details we should know.",
  },
  {
    number: "03",
    title: "Therapist comes to your home",
    body: "We bring the treatment setup and explain everything before starting.",
  },
  {
    number: "04",
    title: "Treatment and aftercare",
    body: "Your session is carried out privately, with simple aftercare guidance included.",
  },
] as const;

export const packageSessionSteps = sharedSessionSteps;

export const packageSafetyItems = [
  "CMA and IPHM qualified therapists",
  "Pre-treatment suitability questions",
  "Clean mobile setup",
  "Single-use items where required",
  "Treatment explained before starting",
  "Male and female therapists available",
  "Female clients treated by female therapist",
  "Aftercare guidance included",
] as const;

export const packageSafetyDisclaimer =
  "Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please speak to a healthcare professional before booking.";

export const packagePages = [
  {
    slug: "supreme-combo-package",
    title: "Supreme Combo Package",
    eyebrow: "Most complete package",
    h1: "Supreme Combo Package in Luton",
    subheading:
      "A full Rahma Therapy reset combining massage, IASTM-style soft-tissue work, dry cupping, fire cupping and hijama — delivered privately at home.",
    openingCopy:
      "When your body feels tight, heavy or overdue for a proper reset, one treatment method may not feel like enough. The Supreme Combo Package brings Rahma Therapy’s key techniques together in one complete home session.",
    price: "£55",
    duration: "Confirm at booking",
    heroImage: "/images/packages/supreme-combo-hero.webp",
    heroImageType:
      "Premium treatment setup with cups, IASTM tool, oils, towels, massage couch.",
    heroAlt: "Supreme Combo Package with cupping massage and IASTM tools",
    breakdownImage: "/images/packages/supreme-combo-breakdown.webp",
    breakdownImageType: "Close-up of cups and IASTM tool in clean setup.",
    breakdownAlt: "Cupping and IASTM tools used in the Supreme Combo Package",
    heroOverlayTitle: "The full reset",
    heroOverlayText: "Massage • IASTM • Dry cupping • Fire cupping • Hijama",
    bookingHref: "?booking=1&services=supreme-combo",
    bookingCta: "Book Supreme Combo",
    whatsappHref:
      "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20interested%20in%20the%20Supreme%20Combo%20Package.%20Is%20it%20suitable%20for%20me%3F",
    whatsappCta: "Ask if this is right for me",
    bookingServiceId: "supreme-combo",
    seo: {
      title: "Supreme Combo Package | Mobile Cupping, Hijama & Massage in Luton",
      description:
        "Book Rahma Therapy’s Supreme Combo Package in Luton: pre-cupping massage, IASTM-style therapy, dry cupping, fire cupping and hijama in one private home session.",
    },
    summary: {
      price: "£55",
      duration: "Confirm at booking",
      bestFor:
        "Clients who want the most complete package for stiffness, tight muscles, recovery support or a full-body reset.",
      therapistOption:
        "Male and female therapists available. Female clients are treated by a female therapist.",
      includes: [
        "Pre-cupping massage",
        "IASTM / Graston-style therapy",
        "Dry cupping",
        "Fire cupping",
        "Wet cupping / hijama",
      ],
    },
    fitCards: [
      {
        title: "You want the most complete package",
        body: "For clients who do not want to choose just one treatment method.",
      },
      {
        title: "Your back, neck or shoulders feel tight",
        body: "A strong option when tension is sitting across more than one area.",
      },
      {
        title: "You train, work or drive and feel stiff",
        body: "Designed for people who feel their body needs a fuller reset.",
      },
      {
        title: "You already value hijama",
        body: "Includes wet cupping as part of a wider treatment session.",
      },
      {
        title: "You want a multi-method session",
        body: "Massage, tool-assisted work and cupping are combined in one package.",
      },
    ],
    includesDetailed: [
      {
        title: "Pre-cupping massage",
        body: "Used at the start of the session to warm the body and prepare selected areas.",
      },
      {
        title: "IASTM / Graston-style therapy",
        body: "Tool-assisted soft-tissue work used on selected areas that feel tight or restricted.",
      },
      {
        title: "Dry cupping",
        body: "Cupping suction without incisions, used to target selected areas.",
      },
      {
        title: "Fire cupping",
        body: "A traditional heat-assisted cupping method carried out with care and control.",
      },
      {
        title: "Wet cupping / hijama",
        body: "Traditional wet cupping using suction and small superficial incisions, subject to suitability.",
      },
    ],
    treatmentBreakdown: [
      {
        title: "Pre-cupping massage",
        whatItIs: "A hands-on massage stage used before cupping begins.",
        whyIncluded:
          "It helps the session start more comfortably and prepares selected areas before cupping.",
        clientUse:
          "Often chosen by clients who want the body warmed and settled before deeper work.",
        persuasivePhrase: "Start by softening the tension before the cups are placed.",
        icon: "HandHeart",
      },
      {
        title: "IASTM / Graston-style therapy",
        whatItIs:
          "Instrument-assisted soft-tissue work using a specialist tool over selected areas.",
        whyIncluded:
          "It gives the therapist another way to work on areas that feel tight, restricted or harder to loosen with massage alone.",
        clientUse:
          "Often chosen for stiffness, tightness and movement restriction support.",
        persuasivePhrase:
          "For the areas that feel stuck, tight or hard to loosen with massage alone.",
        icon: "WandSparkles",
      },
      {
        title: "Dry cupping",
        whatItIs: "Cups are placed on the skin to create suction without incisions.",
        whyIncluded:
          "It targets selected areas before the rest of the treatment continues.",
        clientUse: "Often chosen for muscle tension, stiffness and recovery support.",
        persuasivePhrase: "Targeted suction for the areas holding the most tension.",
        icon: "Activity",
      },
      {
        title: "Fire cupping",
        whatItIs:
          "A traditional heat-assisted cupping method using glass cups and controlled suction.",
        whyIncluded:
          "It adds a warming cupping experience within the full combination session.",
        clientUse:
          "Often chosen by clients who enjoy traditional cupping methods and warming treatment sensations.",
        persuasivePhrase:
          "A warming, traditional cupping method carried out with care and control.",
        icon: "Flame",
      },
      {
        title: "Wet cupping / hijama",
        whatItIs:
          "Hijama, also known as wet cupping, uses suction and small superficial incisions in selected areas.",
        whyIncluded:
          "It completes the package for clients who want hijama included as part of a full session.",
        clientUse:
          "Often chosen by clients who already value hijama or want wet cupping in a private home appointment.",
        persuasivePhrase:
          "For clients who want hijama included as part of a complete treatment session.",
        icon: "Droplets",
      },
    ],
    benefits: {
      heading: "The package for people who want the full reset.",
      subheading:
        "The Supreme Combo is built for clients who want several Rahma Therapy methods in one appointment instead of booking separate sessions.",
      cards: [
        {
          title: "More complete than a basic session",
          body: "Combines massage, cupping, IASTM-style work and hijama.",
        },
        {
          title: "Built around stubborn tightness",
          body: "Useful when one method alone does not feel like enough.",
        },
        {
          title: "Private at-home convenience",
          body: "No travelling with a tight back or heavy body.",
        },
        {
          title: "Strong value at £55",
          body: "Five treatment methods included in one package.",
        },
      ],
    },
    faqs: [
      {
        question: "Is the Supreme Combo too intense for a first session?",
        answer:
          "It can be suitable for some first-time clients, but suitability is checked before treatment. If a full combination is not right for you, the therapist will guide you to a safer option.",
      },
      {
        question: "Does it include hijama?",
        answer: "Yes. The Supreme Combo includes wet cupping / hijama.",
      },
      {
        question: "Can I book this with a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist.",
      },
      {
        question: "How is it different from the Hijama Package?",
        answer:
          "The Hijama Package focuses on pre-cupping massage, dry cupping and hijama. The Supreme Combo also includes IASTM-style work and fire cupping.",
      },
      {
        question: "Who should avoid this package?",
        answer:
          "Anyone unsure because of medical conditions, pregnancy, medication, blood-related issues or feeling unwell should ask before booking and seek medical advice where needed.",
      },
    ],
    relatedPackages: [
      {
        title: "Hijama Package",
        price: "£45",
        body: "Choose this if you mainly want wet cupping with a simpler treatment structure.",
        href: "/services/hijama-package",
        cta: "View Hijama Package",
      },
      {
        title: "Fire Package",
        price: "£40",
        body: "Choose this if you want cupping without wet cupping.",
        href: "/services/fire-cupping-package",
        cta: "View Fire Package",
      },
      {
        title: "Massage Therapy — 1 hour",
        price: "£60",
        body: "Choose this if you want a longer massage-focused session without hijama.",
        href: "/services/massage-therapy-1-hour",
        cta: "View 1-Hour Massage",
      },
    ],
    finalCta: {
      heading: "Ready to book your Supreme Combo?",
      body: "Book the full Rahma Therapy reset at home in Luton. Tell us what you need, choose your therapist option, and we’ll guide you through the session clearly.",
    },
  },
  {
    slug: "hijama-package",
    title: "Hijama Package",
    eyebrow: "Classic hijama package",
    h1: "Private Hijama Package in Luton",
    subheading:
      "Wet cupping, dry cupping and pre-cupping massage delivered at home by CMA and IPHM qualified male and female therapists.",
    openingCopy:
      "Hijama is personal. You want it done cleanly, respectfully and by someone who explains what is happening before anything begins. Rahma Therapy’s Hijama Package gives you a focused wet cupping session at home, with pre-cupping massage, dry cupping and aftercare guidance included.",
    price: "£45",
    duration: "Confirm at booking",
    heroImage: "/images/packages/hijama-hero.webp",
    heroImageType:
      "Clean wet cupping/hijama setup with cups and hygienic items, no blood.",
    heroAlt: "Private hijama package setup for home treatment in Luton",
    breakdownImage: "/images/packages/hijama-process.webp",
    breakdownImageType: "Therapist preparing cups or clean equipment, non-graphic.",
    breakdownAlt: "Clean hijama preparation by Rahma Therapy",
    heroOverlayTitle: "Private home hijama",
    heroOverlayText: "Pre-cupping massage • Dry cupping • Wet cupping",
    bookingHref: "?booking=1&services=hijama-package",
    bookingCta: "Book Hijama Package",
    whatsappHref:
      "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20interested%20in%20the%20Hijama%20Package.%20Can%20you%20advise%20if%20it%20is%20suitable%20for%20me%3F",
    whatsappCta: "Ask about hijama suitability",
    bookingServiceId: "hijama-package",
    seo: {
      title: "Hijama Package in Luton | Private Mobile Wet Cupping | Rahma Therapy",
      description:
        "Book Rahma Therapy’s Hijama Package in Luton: pre-cupping massage, dry cupping and wet cupping delivered privately at home by CMA and IPHM qualified therapists.",
    },
    summary: {
      price: "£45",
      duration: "Confirm at booking",
      bestFor:
        "Clients who want a focused wet cupping session, traditional wellness support, private home hijama or a clear first-time hijama experience.",
      therapistOption:
        "Male and female therapists available. Female clients are treated by a female therapist.",
      includes: [
        "Pre-cupping massage",
        "Dry cupping",
        "Wet cupping / hijama",
        "Aftercare guidance",
      ],
    },
    fitCards: [
      {
        title: "You already value hijama",
        body: "A focused package for clients who specifically want wet cupping.",
      },
      {
        title: "You want hijama at home",
        body: "Private treatment without travelling to a clinic.",
      },
      {
        title: "You are booking hijama for the first time",
        body: "Everything is explained clearly before treatment begins.",
      },
      {
        title: "You want male or female therapist choice",
        body: "Female clients are treated by a female therapist.",
      },
      {
        title: "You want a clean, respectful process",
        body: "Suitability, hygiene and aftercare are built into the session.",
      },
    ],
    includesDetailed: [
      {
        title: "Pre-cupping massage",
        body: "A short massage stage used to prepare selected areas before cupping.",
      },
      {
        title: "Dry cupping",
        body: "Suction without incisions, used before wet cupping.",
      },
      {
        title: "Wet cupping / hijama",
        body: "Traditional wet cupping using suction and small superficial incisions, subject to suitability.",
      },
      {
        title: "Aftercare guidance",
        body: "Simple advice after your session so you know what to do next.",
      },
    ],
    treatmentBreakdown: [
      {
        title: "Pre-cupping massage",
        whatItIs: "A short massage used before the cupping stage.",
        whyIncluded:
          "It helps you settle into the session and prepares the selected area.",
        clientUse: "Often chosen by clients who want a gentler start before hijama.",
        persuasivePhrase: "Ease into hijama with the body already warmed and prepared.",
        icon: "HandHeart",
      },
      {
        title: "Dry cupping",
        whatItIs: "Cups create suction on the skin without incisions.",
        whyIncluded: "It is used as a first cupping stage before wet cupping begins.",
        clientUse:
          "Often chosen for muscle tension, stiffness and traditional cupping support.",
        persuasivePhrase: "A clear first stage before wet cupping begins.",
        icon: "Activity",
      },
      {
        title: "Wet cupping / hijama",
        whatItIs:
          "A traditional wet cupping method where cups are applied and small superficial incisions are made in selected areas.",
        whyIncluded: "It is the main focus of this package.",
        clientUse:
          "Often chosen by clients who value hijama as part of their wellness routine.",
        persuasivePhrase:
          "Traditional wet cupping, delivered privately and respectfully at home.",
        icon: "Droplets",
      },
    ],
    benefits: {
      heading: "Clean, private and explained first.",
      subheading:
        "The Hijama Package is designed for clients who want focused wet cupping without confusion, pressure or clinic travel.",
      cards: [
        {
          title: "Private home setting",
          body: "Receive hijama in your own space without a waiting room.",
        },
        {
          title: "Clear explanation",
          body: "Know what will happen before treatment begins.",
        },
        {
          title: "Same-gender care available",
          body: "Female clients are treated by a female therapist.",
        },
        {
          title: "Focused package",
          body: "A clear structure: pre-cupping massage, dry cupping and hijama.",
        },
      ],
    },
    faqs: [
      {
        question: "Does hijama hurt?",
        answer:
          "Most clients find it more manageable than expected, but sensation varies. Your therapist explains each step and checks your comfort throughout.",
      },
      {
        question: "Is hijama the same as dry cupping?",
        answer:
          "No. Dry cupping uses suction without incisions. Hijama / wet cupping involves suction and small superficial incisions.",
      },
      {
        question: "Can women book with a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist.",
      },
      {
        question: "What should I do after hijama?",
        answer:
          "You will receive aftercare guidance after your session. This may include rest, hydration and avoiding certain activities for a short period.",
      },
      {
        question: "Is hijama suitable for everyone?",
        answer:
          "No. Suitability is checked before treatment, and some clients should seek medical advice before booking.",
      },
    ],
    relatedPackages: [
      {
        title: "Supreme Combo Package",
        price: "£55",
        body: "Choose this if you want hijama plus IASTM-style therapy and fire cupping.",
        href: "/services/supreme-combo-package",
        cta: "View Supreme Combo",
      },
      {
        title: "Fire Package",
        price: "£40",
        body: "Choose this if you want cupping without wet cupping.",
        href: "/services/fire-cupping-package",
        cta: "View Fire Package",
      },
      {
        title: "Massage Therapy — 1 hour",
        price: "£60",
        body: "Choose this if you mainly want focused massage for one area.",
        href: "/services/massage-therapy-1-hour",
        cta: "View 1-Hour Massage",
      },
    ],
    finalCta: {
      heading: "Ready to book your Hijama Package?",
      body: "Book private home hijama in Luton with a CMA and IPHM qualified therapist. We’ll check suitability, explain the process and provide aftercare guidance.",
    },
  },
  {
    slug: "fire-cupping-package",
    title: "Fire Package",
    eyebrow: "Cupping without wet cupping",
    h1: "Fire Cupping Package in Luton",
    subheading:
      "A warming cupping session with pre-cupping massage, essential oils and dry/fire cupping — delivered privately at home.",
    openingCopy:
      "Want the feeling of cupping without wet cupping? The Fire Package is designed for clients who want a warming, traditional cupping experience with massage and essential oils — no hijama, no incisions, just a focused cupping session at home.",
    price: "£40",
    duration: "Confirm at booking",
    heroImage: "/images/packages/fire-cupping-hero.webp",
    heroImageType:
      "Glass cups/fire cupping setup, controlled and calm, no theatrical flame.",
    heroAlt: "Fire cupping package setup with glass cups",
    breakdownImage: "/images/packages/fire-cupping-breakdown.webp",
    breakdownImageType: "Glass cups, towels, essential oils.",
    breakdownAlt: "Fire cupping and essential oils package setup",
    heroOverlayTitle: "No wet cupping",
    heroOverlayText: "Massage with oils • Dry/fire cupping",
    bookingHref: "?booking=1&services=fire-package",
    bookingCta: "Book Fire Package",
    whatsappHref:
      "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20interested%20in%20the%20Fire%20Package.%20Is%20it%20suitable%20for%20me%3F",
    whatsappCta: "Ask if fire cupping is suitable",
    bookingServiceId: "fire-package",
    seo: {
      title: "Fire Cupping Package in Luton | Mobile Cupping Without Hijama",
      description:
        "Book Rahma Therapy’s Fire Package in Luton: pre-cupping massage with essential oils and dry/fire cupping delivered privately at home.",
    },
    summary: {
      price: "£40",
      duration: "Confirm at booking",
      bestFor:
        "Clients who want cupping without wet cupping, a warming traditional cupping experience, or a shorter package for muscle tension, stiffness and relaxation support.",
      therapistOption:
        "Male and female therapists available. Female clients are treated by a female therapist.",
      includes: [
        "Pre-cupping massage with essential oils",
        "Dry / fire cupping",
        "Non-wet cupping session",
        "Aftercare guidance",
      ],
    },
    fitCards: [
      {
        title: "You want cupping but not hijama",
        body: "A non-wet cupping option with no incisions.",
      },
      {
        title: "You prefer a warming session",
        body: "Fire cupping adds a traditional heat-assisted cupping experience.",
      },
      {
        title: "Your back, shoulders or legs feel tight",
        body: "Often chosen for areas that feel stiff or tense.",
      },
      {
        title: "You want a shorter package from £40",
        body: "A focused cupping option at Rahma Therapy’s entry package price.",
      },
      {
        title: "You want a calm home appointment",
        body: "Private mobile treatment without clinic travel.",
      },
    ],
    includesDetailed: [
      {
        title: "Pre-cupping massage with essential oils",
        body: "A massage stage using essential oils to prepare the treatment area and create a calmer experience.",
      },
      {
        title: "Dry / fire cupping",
        body: "Cupping suction without wet cupping or incisions.",
      },
      {
        title: "Aftercare guidance",
        body: "Simple advice after your session so you know what to expect.",
      },
    ],
    treatmentBreakdown: [
      {
        title: "Pre-cupping massage with essential oils",
        whatItIs: "A massage stage using an essential oil blend before cupping.",
        whyIncluded:
          "It helps prepare the area and makes the session feel smoother and calmer.",
        clientUse:
          "Often chosen by clients who want a relaxing start before cupping.",
        persuasivePhrase: "A calmer start before the cups are applied.",
        icon: "HandHeart",
      },
      {
        title: "Dry / fire cupping",
        whatItIs:
          "A traditional heat-assisted cupping method using glass cups to create suction without incisions.",
        whyIncluded: "It gives clients a cupping option without wet cupping.",
        clientUse:
          "Often chosen for muscle tension, stiffness and a warming traditional cupping experience.",
        persuasivePhrase: "Traditional warming cupping, without wet cupping.",
        icon: "Flame",
      },
    ],
    benefits: {
      heading: "The cupping option for clients who are not ready for hijama.",
      subheading:
        "The Fire Package gives you a focused cupping session without wet cupping, with massage and essential oils included.",
      cards: [
        {
          title: "No incisions",
          body: "A non-wet cupping package for clients who do not want hijama.",
        },
        {
          title: "Warming treatment feel",
          body: "A traditional cupping method carried out with care and control.",
        },
        {
          title: "Entry package price",
          body: "A focused package from £40.",
        },
        {
          title: "Home convenience",
          body: "The therapist brings the setup to your home.",
        },
      ],
    },
    faqs: [
      {
        question: "Does the Fire Package include hijama?",
        answer: "No. The Fire Package does not include wet cupping or hijama.",
      },
      {
        question: "Is fire cupping painful?",
        answer:
          "Most clients experience warmth and suction, but comfort varies. Your therapist checks your comfort during the session.",
      },
      {
        question: "Will fire cupping leave marks?",
        answer:
          "Cupping can leave temporary marks on the skin. Your therapist will explain what to expect before treatment.",
      },
      {
        question: "Can I book this as a first cupping session?",
        answer:
          "Yes, it can be a good option for clients who want cupping without wet cupping, subject to suitability.",
      },
      {
        question: "Can female clients book this with a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist.",
      },
    ],
    relatedPackages: [
      {
        title: "Supreme Combo Package",
        price: "£55",
        body: "Choose this if you want fire cupping plus hijama and IASTM-style work.",
        href: "/services/supreme-combo-package",
        cta: "View Supreme Combo",
      },
      {
        title: "Hijama Package",
        price: "£45",
        body: "Choose this if you want wet cupping included.",
        href: "/services/hijama-package",
        cta: "View Hijama Package",
      },
      {
        title: "Massage Therapy — 30 mins",
        price: "£40",
        body: "Choose this if you want focused massage without cupping.",
        href: "/services/massage-therapy-30-mins",
        cta: "View 30-Min Massage",
      },
    ],
    finalCta: {
      heading: "Ready to book your Fire Package?",
      body: "Book a private fire cupping session at home in Luton. This package is ideal if you want cupping without wet cupping or hijama.",
    },
  },
  {
    slug: "massage-therapy-30-mins",
    title: "Massage Therapy — 30 mins",
    eyebrow: "Targeted massage session",
    h1: "30-Min Mobile Massage Therapy in Luton",
    subheading:
      "A focused at-home massage session for one main area — ideal for back, neck, shoulders, legs or targeted tension.",
    openingCopy:
      "Not every session needs to be long. Sometimes you just need focused work on the one area that keeps bothering you — your lower back, your shoulders, your neck or your legs after training. The 30-minute Massage Therapy package gives you targeted support at home without rearranging your whole day.",
    price: "£40",
    duration: "30 minutes",
    heroImage: "/images/packages/massage-30-hero.webp",
    heroImageType: "Therapist giving focused neck/back/shoulder massage.",
    heroAlt: "Thirty minute mobile massage therapy session in Luton",
    breakdownImage: "/images/packages/massage-30-breakdown.webp",
    breakdownImageType: "Close-up of targeted massage or oil/towel setup.",
    breakdownAlt: "Focused mobile massage therapy for one target area",
    heroOverlayTitle: "Focused support",
    heroOverlayText: "One main area • 30 minutes • At home",
    bookingHref: "?booking=1&services=massage-30",
    bookingCta: "Book 30-Min Massage",
    whatsappHref:
      "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20interested%20in%20the%2030-minute%20Massage%20Therapy%20package.%20Can%20you%20advise%20which%20style%20suits%20me%3F",
    whatsappCta: "Ask which massage style suits me",
    bookingServiceId: "massage-30",
    seo: {
      title: "30-Min Mobile Massage Therapy in Luton | Rahma Therapy",
      description:
        "Book a 30-minute mobile massage therapy session in Luton for one focused area such as back, neck, shoulders or legs. Private home appointments from £40.",
    },
    summary: {
      price: "£40",
      duration: "30 minutes",
      bestFor:
        "Clients who want targeted support for one area or a quicker appointment at home.",
      therapistOption:
        "Male and female therapists available. Female clients are treated by a female therapist.",
      includesHeading: "Includes one suitable style:",
      includes: [
        "Relaxing massage",
        "Deep tissue option",
        "Cupping massage option",
        "IASTM / Graston-style option",
        "Essential oil blend",
      ],
    },
    fitCards: [
      {
        title: "You have one main problem area",
        body: "A focused session for one area rather than a full-body appointment.",
      },
      {
        title: "You want a quicker appointment",
        body: "Useful when you are busy with work, family or training.",
      },
      {
        title: "You want massage without hijama",
        body: "No wet cupping is included in this package.",
      },
      {
        title: "You want to try Rahma Therapy first",
        body: "A simple entry point before booking a longer session.",
      },
      {
        title: "You prefer private home treatment",
        body: "The therapist brings the setup to your home.",
      },
    ],
    includesDetailed: [
      {
        title: "Relaxing massage",
        body: "A calmer massage style for stress, tiredness and general relaxation.",
      },
      {
        title: "Deep tissue option",
        body: "A firmer massage style for clients who prefer deeper pressure on tight areas.",
      },
      {
        title: "Cupping massage option",
        body: "Massage with cupping-style support where appropriate, without wet cupping.",
      },
      {
        title: "IASTM / Graston-style option",
        body: "Tool-assisted soft-tissue work for selected areas of tightness or movement restriction.",
      },
      {
        title: "Essential oil blend",
        body: "Used to make the massage feel smoother and more comfortable.",
      },
    ],
    treatmentBreakdown: [
      {
        title: "Relaxing massage",
        whatItIs: "A calmer hands-on massage option.",
        whyIncluded:
          "It is suitable when the aim is to slow down, relax and ease body tiredness.",
        clientUse:
          "Often chosen when stress shows up as tight shoulders or general body tension.",
        persuasivePhrase: "Slow down your body when the week has built up.",
        icon: "HeartHandshake",
      },
      {
        title: "Deep tissue option",
        whatItIs: "A firmer massage style using deeper pressure where appropriate.",
        whyIncluded: "It is useful for clients who prefer stronger work on tight areas.",
        clientUse: "Often chosen for back, neck, shoulder or leg tension.",
        persuasivePhrase: "Focused pressure for the area that feels tightest.",
        icon: "HandHeart",
      },
      {
        title: "Cupping massage option",
        whatItIs: "Massage with cupping-style support where appropriate.",
        whyIncluded:
          "It gives a cupping-based option without wet cupping or hijama.",
        clientUse: "Often chosen for stubborn tension or tightness.",
        persuasivePhrase: "Massage with added cupping support for stubborn tension.",
        icon: "Activity",
      },
      {
        title: "IASTM / Graston-style option",
        whatItIs:
          "Instrument-assisted soft-tissue work using a specialist tool on selected areas.",
        whyIncluded:
          "It offers a focused option for areas that feel tight or restricted.",
        clientUse:
          "Often chosen for stiffness, tightness and movement restriction support.",
        persuasivePhrase:
          "For a focused area that feels restricted or hard to loosen.",
        icon: "WandSparkles",
      },
      {
        title: "Essential oil blend",
        whatItIs: "An oil blend used during massage.",
        whyIncluded: "It helps the session feel smoother and calmer.",
        clientUse:
          "Often chosen by clients who want a more relaxing massage feel.",
        persuasivePhrase: "A smoother, calmer massage experience.",
        icon: "Sparkles",
      },
    ],
    benefits: {
      heading: "A quick, focused session for the area that needs attention most.",
      subheading:
        "The 30-minute massage package is built for clients who know exactly where they feel tension and want support without booking a longer appointment.",
      cards: [
        {
          title: "Focused on one area",
          body: "Ideal for back, neck, shoulders or legs.",
        },
        {
          title: "Easier to fit into your day",
          body: "A shorter appointment brought to your home.",
        },
        {
          title: "Flexible massage style",
          body: "Choose relaxing, deep tissue, cupping massage or IASTM-style support where suitable.",
        },
        {
          title: "No wet cupping",
          body: "A massage-only package without hijama.",
        },
      ],
    },
    faqs: [
      {
        question: "Is 30 minutes enough?",
        answer:
          "Yes, if you want focused work on one main area. If you need multiple areas covered, the 1-hour session may be better.",
      },
      {
        question: "Can I choose deep tissue?",
        answer:
          "Yes. You can choose relaxing, deep tissue, cupping massage or IASTM-style work depending on suitability.",
      },
      {
        question: "Does this include hijama?",
        answer: "No. This is a massage therapy package, not a hijama package.",
      },
      {
        question: "Can I book this at home?",
        answer:
          "Yes. Rahma Therapy is fully mobile across Luton and surrounding areas.",
      },
      {
        question: "Can female clients book with a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist.",
      },
    ],
    relatedPackages: [
      {
        title: "Massage Therapy — 1 hour",
        price: "£60",
        body: "Choose this if you want more time or multiple areas treated.",
        href: "/services/massage-therapy-1-hour",
        cta: "View 1-Hour Massage",
      },
      {
        title: "Fire Package",
        price: "£40",
        body: "Choose this if you want cupping without wet cupping.",
        href: "/services/fire-cupping-package",
        cta: "View Fire Package",
      },
      {
        title: "Supreme Combo Package",
        price: "£55",
        body: "Choose this if you want massage plus cupping and hijama.",
        href: "/services/supreme-combo-package",
        cta: "View Supreme Combo",
      },
    ],
    finalCta: {
      heading: "Ready to book your 30-minute massage?",
      body: "Book a focused mobile massage session at home in Luton. Tell us the main area you want to work on and we’ll guide you to the right style.",
    },
  },
  {
    slug: "massage-therapy-1-hour",
    title: "Massage Therapy — 1 hour",
    eyebrow: "Longer massage session",
    h1: "1-Hour Mobile Massage Therapy in Luton",
    subheading:
      "A longer private home massage session for deeper work, multiple areas and a calmer full-body reset.",
    openingCopy:
      "When tension is not just in one place, a short session can feel rushed. The 1-hour Massage Therapy package gives your therapist more time to work across your back, neck, shoulders, legs or other agreed areas — with a massage style tailored to what your body needs.",
    price: "£60",
    duration: "1 hour",
    heroImage: "/images/packages/massage-60-hero.webp",
    heroImageType: "Calm full massage session in private home-style environment.",
    heroAlt: "One hour mobile massage therapy session in Luton",
    breakdownImage: "/images/packages/massage-60-breakdown.webp",
    breakdownImageType:
      "Relaxed full-body massage setup or therapist preparing massage couch.",
    breakdownAlt: "Longer mobile massage therapy setup for a private home session",
    heroOverlayTitle: "More time, more care",
    heroOverlayText: "Multiple areas • 1 hour • At home",
    bookingHref: "?booking=1&services=massage-60",
    bookingCta: "Book 1-Hour Massage",
    whatsappHref:
      "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20interested%20in%20the%201-hour%20Massage%20Therapy%20package.%20Can%20you%20advise%20which%20style%20suits%20me%3F",
    whatsappCta: "Ask which massage style suits me",
    bookingServiceId: "massage-60",
    seo: {
      title: "1-Hour Mobile Massage Therapy in Luton | Rahma Therapy",
      description:
        "Book a 1-hour mobile massage therapy session in Luton for deeper work, multiple areas, stress tension or a calmer full-body reset. Private home appointments from £60.",
    },
    summary: {
      price: "£60",
      duration: "1 hour",
      bestFor:
        "Clients who want more time for back, neck, shoulders, legs, stress tension or general recovery support.",
      therapistOption:
        "Male and female therapists available. Female clients are treated by a female therapist.",
      includesHeading: "Includes one suitable style:",
      includes: [
        "Relaxing massage",
        "Deep tissue option",
        "Cupping massage option",
        "IASTM / Graston-style option",
        "Essential oil blend",
      ],
    },
    fitCards: [
      {
        title: "You want more than one area treated",
        body: "A better choice if your back, shoulders and neck all need attention.",
      },
      {
        title: "You prefer not to feel rushed",
        body: "More time for a calmer session at home.",
      },
      {
        title: "You want deeper recovery support",
        body: "Useful after work, training or long periods of stiffness.",
      },
      {
        title: "You want a fuller massage experience",
        body: "A stronger choice for a broader body reset.",
      },
      {
        title: "You want private at-home care",
        body: "No clinic travel, no waiting room, just treatment in your own space.",
      },
    ],
    includesDetailed: [
      {
        title: "Relaxing massage",
        body: "A slower massage style for stress, tiredness and general relaxation.",
      },
      {
        title: "Deep tissue option",
        body: "A firmer option for deeper work across larger or multiple areas.",
      },
      {
        title: "Cupping massage option",
        body: "Massage combined with cupping-style support where appropriate, without wet cupping.",
      },
      {
        title: "IASTM / Graston-style option",
        body: "Tool-assisted soft-tissue work for selected areas of stiffness or restriction.",
      },
      {
        title: "Essential oil blend",
        body: "Used to make the massage feel smoother and more comfortable.",
      },
    ],
    treatmentBreakdown: [
      {
        title: "Relaxing massage",
        whatItIs: "A slower hands-on massage option.",
        whyIncluded:
          "It supports a calmer, more relaxed session when the body feels tired or tense.",
        clientUse: "Often chosen for stress tension, tiredness and general relaxation.",
        persuasivePhrase: "More time to unwind, slow down and reset.",
        icon: "HeartHandshake",
      },
      {
        title: "Deep tissue option",
        whatItIs: "A firmer massage style using deeper pressure where suitable.",
        whyIncluded: "The longer session gives more time for broader or deeper work.",
        clientUse: "Often chosen when multiple areas feel tight.",
        persuasivePhrase: "More time for the areas that need proper attention.",
        icon: "HandHeart",
      },
      {
        title: "Cupping massage option",
        whatItIs: "Massage with cupping-style support where appropriate.",
        whyIncluded:
          "It gives clients another way to work on tightness without wet cupping.",
        clientUse: "Often chosen for stubborn tension or recovery support.",
        persuasivePhrase: "A deeper massage session with added cupping support.",
        icon: "Activity",
      },
      {
        title: "IASTM / Graston-style option",
        whatItIs:
          "Instrument-assisted soft-tissue work using a specialist tool over selected areas.",
        whyIncluded:
          "It can be used for selected areas that still feel stiff or restricted.",
        clientUse:
          "Often chosen for tightness, stiffness and movement restriction support.",
        persuasivePhrase:
          "Target the areas that still feel stuck after ordinary massage.",
        icon: "WandSparkles",
      },
      {
        title: "Essential oil blend",
        whatItIs: "An oil blend used during massage.",
        whyIncluded: "It helps the session feel smoother and more relaxing.",
        clientUse:
          "Often chosen by clients who want a calmer massage experience.",
        persuasivePhrase: "A more relaxing feel from start to finish.",
        icon: "Sparkles",
      },
    ],
    benefits: {
      heading:
        "The better option when you want more time, more areas and a calmer session.",
      subheading:
        "The 1-hour massage package is built for clients who want a fuller mobile massage experience without rushing.",
      cards: [
        {
          title: "More time for multiple areas",
          body: "Better if your back, neck, shoulders or legs all need attention.",
        },
        {
          title: "A calmer session pace",
          body: "Less rushed than a short targeted appointment.",
        },
        {
          title: "Flexible treatment style",
          body: "Choose relaxing, deep tissue, cupping massage or IASTM-style support where suitable.",
        },
        {
          title: "Ideal for stress tension",
          body: "Many clients choose massage when stress shows up as tight shoulders or body tiredness.",
        },
      ],
      comparison: {
        heading: "30 minutes or 1 hour?",
        columns: [
          {
            heading: "Choose 30 mins if…",
            items: [
              "You have one main area",
              "You want a quicker session",
              "You want targeted work",
              "You are trying the service first",
            ],
          },
          {
            heading: "Choose 1 hour if…",
            items: [
              "You have multiple areas",
              "You want a calmer, unrushed session",
              "You want deeper or broader work",
              "You already know your body needs more time",
            ],
          },
        ],
      },
    },
    faqs: [
      {
        question: "Is 1 hour better than 30 minutes?",
        answer:
          "It depends on what you need. If you have one target area, 30 minutes may be enough. If you want multiple areas or a calmer session, 1 hour is usually better.",
      },
      {
        question: "Can I choose deep tissue for the full hour?",
        answer:
          "Yes, where suitable. Your therapist will discuss pressure and comfort before treatment.",
      },
      {
        question: "Does this include cupping?",
        answer:
          "You can choose a cupping massage style where suitable, but this package does not include wet cupping / hijama.",
      },
      {
        question: "Can this help with stress tension?",
        answer:
          "Many clients choose massage when stress shows up as tight shoulders, back tension or body tiredness.",
      },
      {
        question: "Can female clients book with a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist.",
      },
    ],
    relatedPackages: [
      {
        title: "Massage Therapy — 30 mins",
        price: "£40",
        body: "Choose this if you only need one focused area treated.",
        href: "/services/massage-therapy-30-mins",
        cta: "View 30-Min Massage",
      },
      {
        title: "Supreme Combo Package",
        price: "£55",
        body: "Choose this if you want massage plus cupping and hijama.",
        href: "/services/supreme-combo-package",
        cta: "View Supreme Combo",
      },
      {
        title: "Fire Package",
        price: "£40",
        body: "Choose this if you want cupping without wet cupping.",
        href: "/services/fire-cupping-package",
        cta: "View Fire Package",
      },
    ],
    finalCta: {
      heading: "Ready to book your 1-hour massage?",
      body: "Book a longer mobile massage session at home in Luton. Choose your therapist option, tell us what areas need attention, and enjoy a calmer, more complete session.",
    },
  },
] as const satisfies readonly PackagePage[];

export type PackagePageSlug = (typeof packagePages)[number]["slug"];

export function getPackagePage(slug: string) {
  return packagePages.find((page) => page.slug === slug);
}
