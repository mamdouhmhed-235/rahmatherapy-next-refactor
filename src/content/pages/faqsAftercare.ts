export const quickAnswers = [
  {
    title: "Do you come to my home?",
    body: "Yes — fully mobile across Luton and surrounding areas.",
    icon: "Home"
  },
  {
    title: "Can I choose a female therapist?",
    body: "Yes. Female clients are treated by a female therapist.",
    icon: "Users"
  },
  {
    title: "Which package should I choose?",
    body: "Supreme Combo for the full reset. Hijama Package for wet cupping. Fire Package for cupping without hijama. Massage Therapy for hands-on work.",
    icon: "HelpCircle"
  },
  {
    title: "Is aftercare included?",
    body: "Yes. Personalised guidance based on the treatment you receive.",
    icon: "ClipboardCheck"
  }
] as const;

export const beforeAppointmentItems = [
  {
    title: "Share health details",
    body: "Medical conditions, medication, pregnancy, skin issues, recent illness — tell us before booking.",
    icon: "Stethoscope"
  },
  {
    title: "Pick your therapist",
    body: "Male or female — your choice. Female clients are treated by a female therapist.",
    icon: "Users"
  },
  {
    title: "Prepare your space",
    body: "Clear a private area with enough room for the treatment couch.",
    icon: "Home"
  },
  {
    title: "Don't rush in",
    body: "Avoid heavy meals or alcohol before massage. Don't turn up unwell.",
    icon: "Clock"
  }
] as const;

export const aftercareTabs = [
  {
    id: "hijama",
    label: "Hijama / wet cupping",
    image: "/images/faqs-aftercare/hijama-aftercare.webp",
    imageType: "Clean cups, plasters or dressings, towel and aftercare setup. No blood.",
    imageAlt: "Clean hijama aftercare setup with dressings and cups",
    imageOverlay: "Hijama aftercare",
    intro: "Hijama involves small superficial incisions, so keeping the area clean and protected matters.",
    note: "Hijama aftercare is especially important because wet cupping involves small superficial incisions.",
    items: [
      {
        title: "Keep the area clean",
        body: "Keep treated areas clean and dry. No touching, scratching or picking.",
        icon: "ShieldCheck"
      },
      {
        title: "Follow dressing guidance",
        body: "If a dressing is used, follow your therapist's instructions on when to change it.",
        icon: "ClipboardCheck"
      },
      {
        title: "Skip heat and heavy sweating",
        body: "No swimming, sauna, steam, hot baths or heavy exercise for the period advised.",
        icon: "AlertTriangle"
      },
      {
        title: "Watch for warning signs",
        body: "Contact us or seek medical advice if you notice spreading redness, swelling, pus, fever, heavy bleeding or severe pain.",
        icon: "HelpCircle"
      }
    ]
  },
  {
    id: "cupping",
    label: "Dry & fire cupping",
    image: "/images/faqs-aftercare/cupping-aftercare.webp",
    imageType: "Glass or plastic cups and towel in a clean, calm setup. No unsafe flame close-up.",
    imageAlt: "Dry and fire cupping aftercare setup with cups and towel",
    imageOverlay: "Cupping aftercare",
    intro: "No incisions — but cupping can still leave temporary marks or skin sensitivity.",
    note: "Your therapist will explain what marks look like and what to expect.",
    items: [
      {
        title: "Temporary marks are normal",
        body: "Circular marks can appear. They usually fade over time.",
        icon: "Droplets"
      },
      {
        title: "Keep skin comfortable",
        body: "Keep clean, no scratching. Loose clothing helps if the area feels tender.",
        icon: "HeartHandshake"
      },
      {
        title: "Skip irritation",
        body: "No hot baths, sauna, steam or intense exercise straight after if the skin feels tender.",
        icon: "AlertTriangle"
      },
      {
        title: "Fire cupping safety",
        body: "If you notice blistering, burns, fever or severe discomfort, seek advice.",
        icon: "Flame"
      }
    ]
  },
  {
    id: "massage",
    label: "Massage / IASTM",
    image: "/images/faqs-aftercare/massage-aftercare.webp",
    imageType: "Relaxed massage setup with oils, towel and client resting.",
    imageAlt: "Massage aftercare setup with oils and towel",
    imageOverlay: "Massage aftercare",
    intro: "After massage, deep tissue or IASTM, give your body time to settle before rushing back in.",
    note: "Unsure what's normal after treatment? Message us.",
    items: [
      {
        title: "Rest briefly",
        body: "Take a few minutes after treatment, especially if you feel light-headed or very relaxed.",
        icon: "Clock"
      },
      {
        title: "Hydrate",
        body: "Drink water. Herbal tea is fine if you prefer something warm.",
        icon: "Droplets"
      },
      {
        title: "Go easy on alcohol and caffeine",
        body: "Avoid both for 24 hours after treatment.",
        icon: "AlertTriangle"
      },
      {
        title: "Take it easy",
        body: "No heavy training straight after deep tissue or IASTM. Gentle movement is fine.",
        icon: "HandHeart"
      },
      {
        title: "Mild soreness is normal",
        body: "Some tiredness or soreness can happen. Severe or worsening pain should be checked.",
        icon: "HelpCircle"
      }
    ]
  }
] as const;

export const suitabilityItems = [
  "Are pregnant or may be pregnant",
  "Take blood-thinning medication",
  "Have anaemia or a bleeding/clotting disorder",
  "Have a pacemaker or cardiovascular condition",
  "Have epilepsy or a seizure history",
  "Have eczema, psoriasis, open wounds, burns or active skin infection",
  "Feel unwell, feverish, dizzy or unusually weak",
  "Have recently had surgery or a major injury",
  "Are unsure whether treatment is suitable"
] as const;

export const faqCategories = [
  {
    id: "booking",
    label: "Booking",
    faqs: [
      {
        question: "How do I book a session?",
        answer: "Use the booking flow or message us on WhatsApp. Tell us the package you want, your location, therapist preference and any health details."
      },
      {
        question: "Do you come to my home?",
        answer: "Yes. We're fully mobile across Luton and surrounding areas. Your therapist brings everything needed."
      },
      {
        question: "What should I prepare before the therapist arrives?",
        answer: "Clear a private space with enough room for the treatment couch. Wear comfortable clothing. Have any health info ready."
      },
      {
        question: "Can I ask questions before booking?",
        answer: "Yes. Message us if you're unsure which package suits you or whether treatment is right for you."
      }
    ]
  },
  {
    id: "packages",
    label: "Packages",
    faqs: [
      {
        question: "Which package should I choose first?",
        answer: "Supreme Combo for the full reset. Hijama Package for wet cupping. Fire Package for cupping without hijama. Massage Therapy for hands-on work only."
      },
      {
        question: "Which packages include hijama?",
        answer: "Supreme Combo and the Hijama Package include wet cupping / hijama."
      },
      {
        question: "Which packages don't include wet cupping?",
        answer: "The Fire Package and both Massage Therapy options."
      },
      {
        question: "What are the prices?",
        answer: "Supreme Combo £55. Hijama £45. Fire £40. Massage £40 for 30 mins, £60 for 1 hour."
      },
      {
        question: "Can I change the package on the day?",
        answer: "Better to choose before booking so we can prepare correctly. If something needs to change, your therapist will discuss suitable options before treatment."
      }
    ]
  },
  {
    id: "therapists-privacy",
    label: "Therapists & Privacy",
    faqs: [
      {
        question: "Do you offer male and female therapists?",
        answer: "Yes — both."
      },
      {
        question: "Are female clients treated by a female therapist?",
        answer: "Yes. Always."
      },
      {
        question: "Will the therapist explain everything first?",
        answer: "Yes. Your therapist walks you through what's involved, checks your comfort and answers questions before starting."
      },
      {
        question: "Is the session private?",
        answer: "Yes. Sessions happen in your home in a private space. Your comfort and modesty are treated respectfully."
      }
    ]
  },
  {
    id: "hijama",
    label: "Hijama",
    faqs: [
      {
        question: "What is hijama?",
        answer: "Traditional wet cupping — suction with small superficial incisions in selected areas. Suitability is checked, every step is explained."
      },
      {
        question: "Is hijama the same as dry cupping?",
        answer: "No. Dry cupping is suction only. Hijama (wet cupping) uses suction with small superficial incisions."
      },
      {
        question: "Does hijama hurt?",
        answer: "Less than most people expect. Suction first, then a quick scratch-like sensation during the incisions. Your therapist checks your comfort throughout."
      },
      {
        question: "Is hijama suitable for everyone?",
        answer: "No. Suitability is checked before treatment. Certain medical conditions, medication, pregnancy, blood-related issues or skin conditions may rule it out."
      },
      {
        question: "What should I do after hijama?",
        answer: "Keep treated areas clean and dry. No scratching or picking. Avoid heavy sweating and heat for the period advised. Follow your therapist's aftercare."
      }
    ]
  },
  {
    id: "dry-fire-cupping",
    label: "Dry & Fire Cupping",
    faqs: [
      {
        question: "What is dry cupping?",
        answer: "Suction without incisions. Most often chosen for muscle tension, stiffness and recovery."
      },
      {
        question: "What is fire cupping?",
        answer: "Heat-assisted cupping with glass cups. Always controlled, never theatrical."
      },
      {
        question: "Will cupping leave marks?",
        answer: "Temporary circular marks are possible. They usually fade over time."
      },
      {
        question: "Is fire cupping dangerous?",
        answer: "Only when done carelessly. Heated cups can cause burns if used wrongly — ours never are. Your therapist explains what to expect and checks your comfort."
      }
    ]
  },
  {
    id: "massage-iastm",
    label: "Massage & IASTM",
    faqs: [
      {
        question: "What massage styles do you offer?",
        answer: "Relaxing, deep tissue, cupping massage and IASTM / Graston-style work — with an essential oil blend."
      },
      {
        question: "Is 30 minutes enough?",
        answer: "Yes — for one focused area. For multiple areas or a calmer full-body session, go with 1 hour."
      },
      {
        question: "Can massage help with stress?",
        answer: "Often, yes. Many people book massage when stress shows up as tight shoulders, body tension or trouble switching off."
      },
      {
        question: "Will I feel sore after deep tissue or IASTM?",
        answer: "Mild soreness or tiredness is normal. Severe or worsening pain should be checked."
      },
      {
        question: "Does massage replace medical care?",
        answer: "No. It's complementary care, not medical care."
      }
    ]
  },
  {
    id: "aftercare",
    label: "Aftercare",
    faqs: [
      {
        question: "What should I do straight after my session?",
        answer: "Rest briefly. Drink water. No rushing into heavy activity. Follow the aftercare for the treatment you received."
      },
      {
        question: "Can I exercise after treatment?",
        answer: "No heavy exercise straight after hijama, cupping, deep tissue or IASTM. Gentle movement is fine."
      },
      {
        question: "Can I shower after hijama?",
        answer: "Your therapist will advise. Since hijama involves small superficial incisions, keep the treated areas clean and dry while they settle."
      },
      {
        question: "When should I contact you or seek medical help?",
        answer: "If you notice heavy bleeding, spreading redness, swelling, pus, fever, burns, blistering, severe pain — or anything that feels off."
      }
    ]
  }
] as const;

export const adviceItems = [
  "Bleeding that doesn't settle",
  "Spreading redness, swelling or heat",
  "Pus or yellow discharge",
  "Fever or feeling generally unwell",
  "Burns, blistering or severe skin irritation",
  "Severe or worsening pain",
  "Fainting, dizziness that doesn't settle, or anything that worries you"
] as const;

export const faqsAftercareDisclaimer =
  "Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please speak to a healthcare professional before booking.";
