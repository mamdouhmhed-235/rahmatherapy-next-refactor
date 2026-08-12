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

export const packagePages = [
  {
    slug: "supreme-combo-package",
    title: "Supreme Combo Package",
    eyebrow: "Most complete package",
    h1: "Supreme Combo — the full reset, at home in Luton.",
    subheading: "Massage, IASTM, dry cupping, fire cupping and hijama in one session. The most complete option we offer.",
    openingCopy: "When your body feels tight, heavy or overdue for a proper reset, one treatment method may not feel like enough. The Supreme Combo Package brings Rahma Therapy’s key techniques together in one complete home session.",
    price: "£55",
    duration: "Confirm at booking",
    heroImage: "/images/packages/supreme-combo-package/hero.jpg",
    heroImageType: "Premium treatment setup with cups, IASTM tool, oils, towels, massage couch.",
    heroAlt: "Supreme Combo Package with cupping massage and IASTM tools",
    breakdownImage: "/images/packages/supreme-combo-package/breakdown.jpg",
    breakdownImageType: "Close-up of cups and IASTM tool in clean setup.",
    breakdownAlt: "Cupping and IASTM tools used in the Supreme Combo Package",
    heroOverlayTitle: "The full reset",
    heroOverlayText: "Massage • IASTM • Dry cupping • Fire cupping • Hijama",
    bookingHref: "?booking=1&services=supreme-combo",
    bookingCta: "Book Supreme Combo",
    whatsappHref: "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20interested%20in%20the%20Supreme%20Combo%20Package.%20Is%20it%20suitable%20for%20me%3F",
    whatsappCta: "Ask if this is right for me",
    bookingServiceId: "supreme-combo",
    seo: {
      title: "Supreme Combo Package | Mobile Cupping, Hijama & Massage in Luton",
      description: "Book Rahma Therapy’s Supreme Combo Package in Luton: pre-cupping massage, IASTM-style therapy, dry cupping, fire cupping and hijama in one private home session."
    },
    summary: {
      price: "£55",
      duration: "Confirm at booking",
      bestFor: "Stiffness, tight muscles, recovery, or a proper full-body reset.",
      therapistOption: "Male or female therapist of your choice. Female clients are treated by a female therapist.",
      includes: [
        "Pre-cupping massage",
        "IASTM / Graston-style therapy",
        "Dry cupping",
        "Fire cupping",
        "Wet cupping / hijama"
      ]
    },
    fitCards: [
      {
        title: "You don't want to pick just one",
        body: "Five methods, one appointment."
      },
      {
        title: "You feel tight across more than one area",
        body: "Back, shoulders and neck all need attention."
      },
      {
        title: "You train, work or drive a lot",
        body: "Your body needs more than a stretch can give."
      },
      {
        title: "You already value hijama",
        body: "Wet cupping included, alongside everything else."
      },
      {
        title: "You want a multi-method session",
        body: "Massage, IASTM and cupping in one appointment."
      }
    ],
    includesDetailed: [
      {
        title: "Pre-cupping massage",
        body: "Used at the start of the session to warm the body and prepare selected areas."
      },
      {
        title: "IASTM / Graston-style therapy",
        body: "Tool-assisted soft-tissue work used on selected areas that feel tight or restricted."
      },
      {
        title: "Dry cupping",
        body: "Cupping suction without incisions, used to target selected areas."
      },
      {
        title: "Fire cupping",
        body: "A traditional heat-assisted cupping method carried out with care and control."
      },
      {
        title: "Wet cupping / hijama",
        body: "Traditional wet cupping using suction and small superficial incisions, subject to suitability."
      }
    ],
    treatmentBreakdown: [
      {
        title: "Pre-cupping massage",
        whatItIs: "A hands-on massage stage before cupping starts.",
        whyIncluded: "Warms the body and softens tension before the cups go on.",
        clientUse: "You want the body settled before the deeper work begins.",
        persuasivePhrase: "Start by softening the tension before the cups are placed.",
        icon: "HandHeart"
      },
      {
        title: "IASTM / Graston-style therapy",
        whatItIs: "Tool-assisted soft-tissue work on areas that feel tight or stuck.",
        whyIncluded: "Reaches areas that massage alone can't always loosen.",
        clientUse: "You have stubborn stiffness or restricted movement.",
        persuasivePhrase: "For the areas that feel stuck, tight or hard to loosen with massage alone.",
        icon: "WandSparkles"
      },
      {
        title: "Dry cupping",
        whatItIs: "Suction-only cupping — no incisions.",
        whyIncluded: "Targets the areas holding the most tension.",
        clientUse: "You want focused cupping support for tight muscles.",
        persuasivePhrase: "Targeted suction for the areas holding the most tension.",
        icon: "Activity"
      },
      {
        title: "Fire cupping",
        whatItIs: "Heat-assisted cupping with glass cups. Always controlled.",
        whyIncluded: "Adds a warming, traditional cupping experience to the session.",
        clientUse: "You like traditional cupping methods and a warming session feel.",
        persuasivePhrase: "A warming, traditional cupping method carried out with care and control.",
        icon: "Flame"
      },
      {
        title: "Wet cupping / hijama",
        whatItIs: "Traditional hijama — suction with small superficial incisions.",
        whyIncluded: "Completes the package for clients who want hijama included.",
        clientUse: "You already book hijama or want it as part of a wider session.",
        persuasivePhrase: "For clients who want hijama included as part of a complete treatment session.",
        icon: "Droplets"
      }
    ],
    benefits: {
      heading: "For when you want it all in one session.",
      subheading: "Several Rahma Therapy methods in one appointment, instead of booking them separately.",
      cards: [
        {
          title: "More than a basic session",
          body: "Massage, cupping, IASTM and hijama — all included."
        },
        {
          title: "Built for stubborn tightness",
          body: "When one method alone hasn't been enough."
        },
        {
          title: "Private, at home",
          body: "No drive with a tight back. No waiting room."
        },
        {
          title: "Five treatments. £55.",
          body: "Strong value, one appointment."
        }
      ]
    },
    faqs: [
      {
        question: "Is the Supreme Combo too intense for a first session?",
        answer: "It can suit first-time clients, but suitability is checked before treatment. If it isn't right for you, your therapist will guide you to a safer option."
      },
      {
        question: "Does it include hijama?",
        answer: "Yes — wet cupping / hijama is part of the package."
      },
      {
        question: "Can I book this with a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist."
      },
      {
        question: "How is it different from the Hijama Package?",
        answer: "The Hijama Package covers pre-cupping massage, dry cupping and hijama. The Supreme Combo adds IASTM-style work and fire cupping."
      },
      {
        question: "Who should avoid this package?",
        answer: "If you have a medical condition, take medication, are pregnant, have blood-related issues or are unwell, ask before booking and seek medical advice where needed."
      }
    ],
    relatedPackages: [
      {
        title: "Hijama Package",
        price: "£45",
        body: "Choose this if you mainly want wet cupping with a simpler treatment structure.",
        href: "/services/hijama-package",
        cta: "View Hijama Package"
      },
      {
        title: "Fire Package",
        price: "£40",
        body: "Choose this if you want cupping without wet cupping.",
        href: "/services/fire-cupping-package",
        cta: "View Fire Package"
      },
      {
        title: "Massage Therapy — 1 hour",
        price: "£60",
        body: "Choose this if you want a longer massage-focused session without hijama.",
        href: "/services/massage-therapy-1-hour",
        cta: "View 1-Hour Massage"
      }
    ],
    finalCta: {
      heading: "Ready to book your Supreme Combo?",
      body: "The full reset, at home in Luton. Pick your therapist, tell us what you need."
    }
  },
  {
    slug: "hijama-package",
    title: "Hijama Package",
    eyebrow: "Classic hijama",
    h1: "Private hijama, at home in Luton.",
    subheading: "Wet cupping with pre-cupping massage and dry cupping. Delivered to your door by a male or female therapist of your choice.",
    openingCopy: "Hijama is personal. You want it done cleanly, respectfully and by someone who explains what is happening before anything begins. Rahma Therapy’s Hijama Package gives you a focused wet cupping session at home, with pre-cupping massage, dry cupping and aftercare guidance included.",
    price: "£45",
    duration: "Confirm at booking",
    heroImage: "/images/packages/hijama-package/hero.jpg",
    heroImageType: "Clean wet cupping/hijama setup with cups and hygienic items, no blood.",
    heroAlt: "Private hijama package setup for home treatment in Luton",
    breakdownImage: "/images/packages/hijama-package/breakdown.jpg",
    breakdownImageType: "Therapist preparing cups or clean equipment, non-graphic.",
    breakdownAlt: "Clean hijama preparation by Rahma Therapy",
    heroOverlayTitle: "Private home hijama",
    heroOverlayText: "Pre-cupping massage • Dry cupping • Wet cupping",
    bookingHref: "?booking=1&services=hijama-package",
    bookingCta: "Book Hijama Package",
    whatsappHref: "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20interested%20in%20the%20Hijama%20Package.%20Can%20you%20advise%20if%20it%20is%20suitable%20for%20me%3F",
    whatsappCta: "Ask about hijama suitability",
    bookingServiceId: "hijama-package",
    seo: {
      title: "Hijama Package in Luton | Private Mobile Wet Cupping | Rahma Therapy",
      description: "Book Rahma Therapy’s Hijama Package in Luton: pre-cupping massage, dry cupping and wet cupping delivered privately at home by CMA and IPHM qualified therapists."
    },
    summary: {
      price: "£45",
      duration: "Confirm at booking",
      bestFor: "You already book hijama, or you want a clean, respectful first-time experience at home.",
      therapistOption: "Male or female therapist of your choice. Female clients are treated by a female therapist.",
      includes: [
        "Pre-cupping massage",
        "Dry cupping",
        "Wet cupping / hijama"
      ]
    },
    fitCards: [
      {
        title: "You already value hijama",
        body: "A focused package for people who specifically want wet cupping."
      },
      {
        title: "You want hijama at home",
        body: "Private treatment without travelling to a clinic."
      },
      {
        title: "It's your first time",
        body: "Everything explained before anything begins."
      },
      {
        title: "You want a therapist of your gender",
        body: "Female clients are treated by a female therapist."
      },
      {
        title: "You want it done cleanly",
        body: "Suitability, hygiene and aftercare built into every session."
      }
    ],
    includesDetailed: [
      {
        title: "Pre-cupping massage",
        body: "A short massage stage used to prepare selected areas before cupping."
      },
      {
        title: "Dry cupping",
        body: "Suction without incisions, used before wet cupping."
      },
      {
        title: "Wet cupping / hijama",
        body: "Traditional wet cupping using suction and small superficial incisions, subject to suitability."
      }
    ],
    treatmentBreakdown: [
      {
        title: "Pre-cupping massage",
        whatItIs: "A short massage before the cupping stage begins.",
        whyIncluded: "Helps you settle in and prepares the area.",
        clientUse: "You want a gentler start before hijama.",
        persuasivePhrase: "Ease into hijama with the body already warmed and prepared.",
        icon: "HandHeart"
      },
      {
        title: "Dry cupping",
        whatItIs: "Suction without incisions.",
        whyIncluded: "The first cupping stage, before wet cupping starts.",
        clientUse: "You want a traditional cupping warm-up.",
        persuasivePhrase: "A clear first stage before wet cupping begins.",
        icon: "Activity"
      },
      {
        title: "Wet cupping / hijama",
        whatItIs: "Traditional hijama — suction with small superficial incisions in selected areas.",
        whyIncluded: "The main focus of this package.",
        clientUse: "You see hijama as part of your wellness routine.",
        persuasivePhrase: "Traditional wet cupping, delivered privately and respectfully at home.",
        icon: "Droplets"
      }
    ],
    benefits: {
      heading: "Clean, private, and explained first.",
      subheading: "Focused wet cupping without confusion, pressure or clinic travel.",
      cards: [
        {
          title: "Private home setting",
          body: "Hijama in your own space — no waiting room."
        },
        {
          title: "Clear explanation",
          body: "You'll know what happens before anything begins."
        },
        {
          title: "Same-gender care",
          body: "Female clients are treated by a female therapist."
        },
        {
          title: "Focused structure",
          body: "Pre-cupping massage, dry cupping, hijama. That's it."
        }
      ]
    },
    faqs: [
      {
        question: "Does hijama hurt?",
        answer: "Less than most people expect. Suction first, then a quick scratch-like sensation during the incisions. Your therapist walks you through every step and checks your comfort."
      },
      {
        question: "Is hijama the same as dry cupping?",
        answer: "No. Dry cupping is suction only. Hijama (wet cupping) uses suction with small superficial incisions."
      },
      {
        question: "Can women book with a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist."
      },
      {
        question: "What should I do after hijama?",
        answer: "Your therapist gives you aftercare guidance. Usually: rest, hydrate, keep the area clean and dry, and avoid heavy sweating for the period advised."
      },
      {
        question: "Is hijama suitable for everyone?",
        answer: "No. Suitability is checked before treatment. Some clients should seek medical advice before booking."
      }
    ],
    relatedPackages: [
      {
        title: "Supreme Combo Package",
        price: "£55",
        body: "Choose this if you want hijama plus IASTM-style therapy and fire cupping.",
        href: "/services/supreme-combo-package",
        cta: "View Supreme Combo"
      },
      {
        title: "Fire Package",
        price: "£40",
        body: "Choose this if you want cupping without wet cupping.",
        href: "/services/fire-cupping-package",
        cta: "View Fire Package"
      },
      {
        title: "Massage Therapy — 1 hour",
        price: "£60",
        body: "Choose this if you mainly want focused massage for one area.",
        href: "/services/massage-therapy-1-hour",
        cta: "View 1-Hour Massage"
      }
    ],
    finalCta: {
      heading: "Ready to book your Hijama Package?",
      body: "Private hijama at home in Luton, by a CMA and IPHM qualified therapist. We check suitability, explain everything, send aftercare."
    }
  },
  {
    slug: "fire-cupping-package",
    title: "Fire Package",
    eyebrow: "Cupping without hijama",
    h1: "Fire cupping at home in Luton.",
    subheading: "Cupping without hijama. Warming, traditional, with pre-cupping massage and essential oils — delivered at home.",
    openingCopy: "Want the feeling of cupping without wet cupping? The Fire Package is designed for clients who want a warming, traditional cupping experience with massage and essential oils — no hijama, no incisions, just a focused cupping session at home.",
    price: "£40",
    duration: "Confirm at booking",
    heroImage: "/images/packages/fire-cupping-package/hero.jpg",
    heroImageType: "Glass cups/fire cupping setup, controlled and calm, no theatrical flame.",
    heroAlt: "Fire cupping package setup with glass cups",
    breakdownImage: "/images/packages/fire-cupping-package/breakdown.jpg",
    breakdownImageType: "Glass cups, towels, essential oils.",
    breakdownAlt: "Fire cupping and essential oils package setup",
    heroOverlayTitle: "No wet cupping",
    heroOverlayText: "Massage with oils • Dry/fire cupping",
    bookingHref: "?booking=1&services=fire-package",
    bookingCta: "Book Fire Package",
    whatsappHref: "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20interested%20in%20the%20Fire%20Package.%20Is%20it%20suitable%20for%20me%3F",
    whatsappCta: "Ask if fire cupping is suitable",
    bookingServiceId: "fire-package",
    seo: {
      title: "Fire Cupping Package in Luton | Mobile Cupping Without Hijama",
      description: "Book Rahma Therapy’s Fire Package in Luton: pre-cupping massage with essential oils and dry/fire cupping delivered privately at home."
    },
    summary: {
      price: "£40",
      duration: "Confirm at booking",
      bestFor: "Cupping without hijama, or a warming session for muscle tension and stiffness.",
      therapistOption: "Male or female therapist of your choice. Female clients are treated by a female therapist.",
      includes: [
        "Pre-cupping massage",
        "Dry cupping",
        "Fire cupping"
      ]
    },
    fitCards: [
      {
        title: "You want cupping but not hijama",
        body: "No incisions, no wet cupping."
      },
      {
        title: "You prefer a warming session",
        body: "Fire cupping adds a traditional heat-assisted method."
      },
      {
        title: "Your back, shoulders or legs feel tight",
        body: "Often chosen for stiff or tense areas."
      },
      {
        title: "You want our entry price",
        body: "£40 — a focused cupping option."
      },
      {
        title: "You want a calm home appointment",
        body: "Private mobile treatment, no clinic travel."
      }
    ],
    includesDetailed: [
      {
        title: "Pre-cupping massage",
        body: "A massage stage using an essential oil blend to prepare the treatment area and create a calmer experience."
      },
      {
        title: "Dry cupping",
        body: "Cupping suction without incisions, used to target selected areas of tension."
      },
      {
        title: "Fire cupping",
        body: "A traditional heat-assisted cupping method carried out with care and control. No wet cupping."
      }
    ],
    treatmentBreakdown: [
      {
        title: "Pre-cupping massage with essential oils",
        whatItIs: "A massage stage using an essential oil blend before cupping.",
        whyIncluded: "Prepares the area and makes the session feel calmer.",
        clientUse: "You want a relaxing start before the cups go on.",
        persuasivePhrase: "A calmer start before the cups are applied.",
        icon: "HandHeart"
      },
      {
        title: "Dry / fire cupping",
        whatItIs: "Heat-assisted cupping with glass cups. Suction only — no incisions.",
        whyIncluded: "Cupping without hijama, for clients who want one or the other.",
        clientUse: "You want a warming, traditional cupping experience.",
        persuasivePhrase: "Traditional warming cupping, without wet cupping.",
        icon: "Flame"
      }
    ],
    benefits: {
      heading: "The cupping option for those not ready for hijama.",
      subheading: "Focused cupping without wet cupping, with massage and essential oils included.",
      cards: [
        {
          title: "No incisions",
          body: "A non-wet cupping package, end to end."
        },
        {
          title: "Warming treatment feel",
          body: "Traditional cupping, always controlled."
        },
        {
          title: "Entry-price package",
          body: "£40 — a focused cupping option."
        },
        {
          title: "At home",
          body: "The therapist brings the setup to you."
        }
      ]
    },
    faqs: [
      {
        question: "Does the Fire Package include hijama?",
        answer: "No. No wet cupping, no incisions — cupping only."
      },
      {
        question: "Is fire cupping painful?",
        answer: "Most people feel warmth and suction, sometimes a tight pulling sensation. Your therapist checks your comfort throughout."
      },
      {
        question: "Will fire cupping leave marks?",
        answer: "Cupping can leave temporary circular marks that usually fade over time. Your therapist will explain what to expect."
      },
      {
        question: "Can I book this as a first cupping session?",
        answer: "Yes — a strong option if you want cupping without wet cupping, subject to suitability."
      },
      {
        question: "Can female clients book this with a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist."
      }
    ],
    relatedPackages: [
      {
        title: "Supreme Combo Package",
        price: "£55",
        body: "Choose this if you want fire cupping plus hijama and IASTM-style work.",
        href: "/services/supreme-combo-package",
        cta: "View Supreme Combo"
      },
      {
        title: "Hijama Package",
        price: "£45",
        body: "Choose this if you want wet cupping included.",
        href: "/services/hijama-package",
        cta: "View Hijama Package"
      },
      {
        title: "Massage Therapy — 30 mins",
        price: "£40",
        body: "Choose this if you want focused massage without cupping.",
        href: "/services/massage-therapy-30-mins",
        cta: "View 30-Min Massage"
      }
    ],
    finalCta: {
      heading: "Ready to book your Fire Package?",
      body: "Private fire cupping at home in Luton — cupping without hijama."
    }
  },
  {
    slug: "massage-therapy-30-mins",
    title: "Massage Therapy — 30 mins",
    eyebrow: "Targeted session",
    h1: "30-min mobile massage in Luton.",
    subheading: "Focused work on one area in 30 minutes. Back, neck, shoulders or legs — at home.",
    openingCopy: "Not every session needs to be long. Sometimes you just need focused work on the one area that keeps bothering you — your lower back, your shoulders, your neck or your legs after training. The 30-minute Massage Therapy package gives you targeted support at home without rearranging your whole day.",
    price: "£40",
    duration: "30 minutes",
    heroImage: "/images/packages/massage-therapy-30-mins/hero.jpg",
    heroImageType: "Therapist giving focused neck/back/shoulder massage.",
    heroAlt: "Thirty minute mobile massage therapy session in Luton",
    breakdownImage: "/images/packages/massage-therapy-30-mins/breakdown.jpg",
    breakdownImageType: "Close-up of targeted massage or oil/towel setup.",
    breakdownAlt: "Focused mobile massage therapy for one target area",
    heroOverlayTitle: "Focused support",
    heroOverlayText: "One main area • 30 minutes • At home",
    bookingHref: "?booking=1&services=massage-30",
    bookingCta: "Book 30-Min Massage",
    whatsappHref: "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20interested%20in%20the%2030-minute%20Massage%20Therapy%20package.%20Can%20you%20advise%20which%20style%20suits%20me%3F",
    whatsappCta: "Ask which massage style suits me",
    bookingServiceId: "massage-30",
    seo: {
      title: "30-Min Mobile Massage Therapy in Luton | Rahma Therapy",
      description: "Book a 30-minute mobile massage therapy session in Luton for one focused area such as back, neck, shoulders or legs. Private home appointments from £40."
    },
    summary: {
      price: "£40",
      duration: "30 minutes",
      bestFor: "One area, a quick reset, or trying us out before a longer session.",
      therapistOption: "Male or female therapist of your choice. Female clients are treated by a female therapist.",
      includesHeading: "Includes one suitable style:",
      includes: [
        "Relaxing massage",
        "Deep tissue option",
        "Cupping massage option",
        "IASTM / Graston-style option",
        "Essential oil blend"
      ]
    },
    fitCards: [
      {
        title: "You have one main problem area",
        body: "Focused work, no full-body appointment needed."
      },
      {
        title: "You want a quicker appointment",
        body: "For when work, family or training won't wait."
      },
      {
        title: "You want massage without hijama",
        body: "No wet cupping in this package."
      },
      {
        title: "You want to try us first",
        body: "A simple entry point before a longer session."
      },
      {
        title: "You prefer private at-home care",
        body: "The therapist comes to you."
      }
    ],
    includesDetailed: [
      {
        title: "Relaxing massage",
        body: "A calmer massage style for stress, tiredness and general relaxation."
      },
      {
        title: "Deep tissue option",
        body: "A firmer massage style for clients who prefer deeper pressure on tight areas."
      },
      {
        title: "Cupping massage option",
        body: "Massage with cupping-style support where appropriate, without wet cupping."
      },
      {
        title: "IASTM / Graston-style option",
        body: "Tool-assisted soft-tissue work for selected areas of tightness or movement restriction."
      },
      {
        title: "Essential oil blend",
        body: "Used to make the massage feel smoother and more comfortable."
      }
    ],
    treatmentBreakdown: [
      {
        title: "Relaxing massage",
        whatItIs: "A calmer hands-on massage option.",
        whyIncluded: "It is suitable when the aim is to slow down, relax and ease body tiredness.",
        clientUse: "Often chosen when stress shows up as tight shoulders or general body tension.",
        persuasivePhrase: "Slow down your body when the week has built up.",
        icon: "HeartHandshake"
      },
      {
        title: "Deep tissue option",
        whatItIs: "A firmer massage style using deeper pressure where appropriate.",
        whyIncluded: "It is useful for clients who prefer stronger work on tight areas.",
        clientUse: "Often chosen for back, neck, shoulder or leg tension.",
        persuasivePhrase: "Focused pressure for the area that feels tightest.",
        icon: "HandHeart"
      },
      {
        title: "Cupping massage option",
        whatItIs: "Massage with cupping-style support where appropriate.",
        whyIncluded: "It gives a cupping-based option without wet cupping or hijama.",
        clientUse: "Often chosen for stubborn tension or tightness.",
        persuasivePhrase: "Massage with added cupping support for stubborn tension.",
        icon: "Activity"
      },
      {
        title: "IASTM / Graston-style option",
        whatItIs: "Instrument-assisted soft-tissue work using a specialist tool on selected areas.",
        whyIncluded: "It offers a focused option for areas that feel tight or restricted.",
        clientUse: "Often chosen for stiffness, tightness and movement restriction support.",
        persuasivePhrase: "For a focused area that feels restricted or hard to loosen.",
        icon: "WandSparkles"
      },
      {
        title: "Essential oil blend",
        whatItIs: "An oil blend used during massage.",
        whyIncluded: "It helps the session feel smoother and calmer.",
        clientUse: "Often chosen by clients who want a more relaxing massage feel.",
        persuasivePhrase: "A smoother, calmer massage experience.",
        icon: "Sparkles"
      }
    ],
    benefits: {
      heading: "Quick, focused, on the area that needs it most.",
      subheading: "For when you know exactly where you feel tension and don't need a longer session.",
      cards: [
        {
          title: "Focused on one area",
          body: "Back, neck, shoulders or legs."
        },
        {
          title: "Fits your day",
          body: "A shorter appointment, at home."
        },
        {
          title: "Flexible style",
          body: "Relaxing, deep tissue, cupping massage or IASTM where suitable."
        },
        {
          title: "No wet cupping",
          body: "A massage-only package."
        }
      ]
    },
    faqs: [
      {
        question: "Is 30 minutes enough?",
        answer: "Yes — for one main area. If you need multiple areas covered, the 1-hour session is better."
      },
      {
        question: "Can I choose deep tissue?",
        answer: "Yes. You can choose relaxing, deep tissue, cupping massage or IASTM-style work, where suitable."
      },
      {
        question: "Does this include hijama?",
        answer: "No. This is a massage-only package."
      },
      {
        question: "Do you come to my home?",
        answer: "Yes. We're fully mobile across Luton and surrounding areas."
      },
      {
        question: "Can female clients book with a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist."
      }
    ],
    relatedPackages: [
      {
        title: "Massage Therapy — 1 hour",
        price: "£60",
        body: "Choose this if you want more time or multiple areas treated.",
        href: "/services/massage-therapy-1-hour",
        cta: "View 1-Hour Massage"
      },
      {
        title: "Fire Package",
        price: "£40",
        body: "Choose this if you want cupping without wet cupping.",
        href: "/services/fire-cupping-package",
        cta: "View Fire Package"
      },
      {
        title: "Supreme Combo Package",
        price: "£55",
        body: "Choose this if you want massage plus cupping and hijama.",
        href: "/services/supreme-combo-package",
        cta: "View Supreme Combo"
      }
    ],
    finalCta: {
      heading: "Ready to book your 30-minute massage?",
      body: "Tell us where you're tight. We'll pick the right style and come to you."
    }
  },
  {
    slug: "massage-therapy-1-hour",
    title: "Massage Therapy — 1 hour",
    eyebrow: "Longer session",
    h1: "1-hour mobile massage in Luton.",
    subheading: "More time, more areas, deeper work. The unhurried option — at home.",
    openingCopy: "When tension is not just in one place, a short session can feel rushed. The 1-hour Massage Therapy package gives your therapist more time to work across your back, neck, shoulders, legs or other agreed areas — with a massage style tailored to what your body needs.",
    price: "£60",
    duration: "1 hour",
    heroImage: "/images/packages/massage-therapy-1-hour/hero.jpg",
    heroImageType: "Calm full massage session in private home-style environment.",
    heroAlt: "One hour mobile massage therapy session in Luton",
    breakdownImage: "/images/packages/massage-therapy-1-hour/breakdown.jpg",
    breakdownImageType: "Relaxed full-body massage setup or therapist preparing massage couch.",
    breakdownAlt: "Longer mobile massage therapy setup for a private home session",
    heroOverlayTitle: "More time, more care",
    heroOverlayText: "Multiple areas • 1 hour • At home",
    bookingHref: "?booking=1&services=massage-60",
    bookingCta: "Book 1-Hour Massage",
    whatsappHref: "https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%27m%20interested%20in%20the%201-hour%20Massage%20Therapy%20package.%20Can%20you%20advise%20which%20style%20suits%20me%3F",
    whatsappCta: "Ask which massage style suits me",
    bookingServiceId: "massage-60",
    seo: {
      title: "1-Hour Mobile Massage Therapy in Luton | Rahma Therapy",
      description: "Book a 1-hour mobile massage therapy session in Luton for deeper work, multiple areas, stress tension or a calmer full-body reset. Private home appointments from £60."
    },
    summary: {
      price: "£60",
      duration: "1 hour",
      bestFor: "Multiple areas, stress tension, or a calmer full-body reset.",
      therapistOption: "Male or female therapist of your choice. Female clients are treated by a female therapist.",
      includesHeading: "Includes one suitable style:",
      includes: [
        "Relaxing massage",
        "Deep tissue option",
        "Cupping massage option",
        "IASTM / Graston-style option",
        "Essential oil blend"
      ]
    },
    fitCards: [
      {
        title: "You need more than one area treated",
        body: "Back, shoulders and neck all need attention."
      },
      {
        title: "You don't want to feel rushed",
        body: "A calmer pace, at home."
      },
      {
        title: "You want deeper recovery",
        body: "After heavy work, training, or weeks of stiffness."
      },
      {
        title: "You want a fuller massage",
        body: "A broader, more thorough body reset."
      },
      {
        title: "You want private at-home care",
        body: "No clinic travel, no waiting room."
      }
    ],
    includesDetailed: [
      {
        title: "Relaxing massage",
        body: "A slower massage style for stress, tiredness and general relaxation."
      },
      {
        title: "Deep tissue option",
        body: "A firmer option for deeper work across larger or multiple areas."
      },
      {
        title: "Cupping massage option",
        body: "Massage combined with cupping-style support where appropriate, without wet cupping."
      },
      {
        title: "IASTM / Graston-style option",
        body: "Tool-assisted soft-tissue work for selected areas of stiffness or restriction."
      },
      {
        title: "Essential oil blend",
        body: "Used to make the massage feel smoother and more comfortable."
      }
    ],
    treatmentBreakdown: [
      {
        title: "Relaxing massage",
        whatItIs: "A slower hands-on massage option.",
        whyIncluded: "It supports a calmer, more relaxed session when the body feels tired or tense.",
        clientUse: "Often chosen for stress tension, tiredness and general relaxation.",
        persuasivePhrase: "More time to unwind, slow down and reset.",
        icon: "HeartHandshake"
      },
      {
        title: "Deep tissue option",
        whatItIs: "A firmer massage style using deeper pressure where suitable.",
        whyIncluded: "The longer session gives more time for broader or deeper work.",
        clientUse: "Often chosen when multiple areas feel tight.",
        persuasivePhrase: "More time for the areas that need proper attention.",
        icon: "HandHeart"
      },
      {
        title: "Cupping massage option",
        whatItIs: "Massage with cupping-style support where appropriate.",
        whyIncluded: "It gives clients another way to work on tightness without wet cupping.",
        clientUse: "Often chosen for stubborn tension or recovery support.",
        persuasivePhrase: "A deeper massage session with added cupping support.",
        icon: "Activity"
      },
      {
        title: "IASTM / Graston-style option",
        whatItIs: "Instrument-assisted soft-tissue work using a specialist tool over selected areas.",
        whyIncluded: "It can be used for selected areas that still feel stiff or restricted.",
        clientUse: "Often chosen for tightness, stiffness and movement restriction support.",
        persuasivePhrase: "Target the areas that still feel stuck after ordinary massage.",
        icon: "WandSparkles"
      },
      {
        title: "Essential oil blend",
        whatItIs: "An oil blend used during massage.",
        whyIncluded: "It helps the session feel smoother and more relaxing.",
        clientUse: "Often chosen by clients who want a calmer massage experience.",
        persuasivePhrase: "A more relaxing feel from start to finish.",
        icon: "Sparkles"
      }
    ],
    benefits: {
      heading: "When you want more time, more areas, and no rush.",
      subheading: "A fuller mobile massage experience without watching the clock.",
      cards: [
        {
          title: "More time, more areas",
          body: "Back, neck, shoulders, legs — cover them all."
        },
        {
          title: "A calmer pace",
          body: "Less rushed than a short targeted appointment."
        },
        {
          title: "Flexible style",
          body: "Relaxing, deep tissue, cupping massage or IASTM, where suitable."
        },
        {
          title: "Built for stress tension",
          body: "When stress shows up as tight shoulders and body tiredness."
        }
      ],
      comparison: {
        heading: "30 minutes or 1 hour?",
        columns: [
          {
            heading: "Pick 30 mins if…",
            items: [
              "You have one main area",
              "You want a quicker session",
              "You want targeted work",
              "You're trying us out first"
            ]
          },
          {
            heading: "Pick 1 hour if…",
            items: [
              "You have multiple areas",
              "You want an unrushed session",
              "You want deeper or broader work",
              "You know your body needs more time"
            ]
          }
        ]
      }
    },
    faqs: [
      {
        question: "Is 1 hour better than 30 minutes?",
        answer: "It depends. One target area — 30 minutes is fine. Multiple areas or a calmer pace — go with 1 hour."
      },
      {
        question: "Can I have deep tissue for the full hour?",
        answer: "Yes, where suitable. Your therapist talks pressure and comfort with you before treatment."
      },
      {
        question: "Does this include cupping?",
        answer: "You can pick a cupping massage style where suitable, but no wet cupping or hijama in this package."
      },
      {
        question: "Can this help with stress tension?",
        answer: "Often, yes. Many people book massage when stress shows up as tight shoulders, back tension or general tiredness."
      },
      {
        question: "Can female clients book with a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist."
      }
    ],
    relatedPackages: [
      {
        title: "Massage Therapy — 30 mins",
        price: "£40",
        body: "Choose this if you only need one focused area treated.",
        href: "/services/massage-therapy-30-mins",
        cta: "View 30-Min Massage"
      },
      {
        title: "Supreme Combo Package",
        price: "£55",
        body: "Choose this if you want massage plus cupping and hijama.",
        href: "/services/supreme-combo-package",
        cta: "View Supreme Combo"
      },
      {
        title: "Fire Package",
        price: "£40",
        body: "Choose this if you want cupping without wet cupping.",
        href: "/services/fire-cupping-package",
        cta: "View Fire Package"
      }
    ],
    finalCta: {
      heading: "Ready to book your 1-hour massage?",
      body: "A longer mobile massage, at home in Luton. Pick your therapist, tell us where you're tight."
    }
  }
] as const satisfies readonly PackagePage[];

export function getPackagePage(slug: string) {
  return packagePages.find((page) => page.slug === slug);
}
