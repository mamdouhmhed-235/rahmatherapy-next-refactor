export const quickAnswers = [
  {
    title: "Do you come to my home?",
    body: "Yes. Rahma Therapy is fully mobile across Luton and surrounding areas.",
    icon: "Home",
  },
  {
    title: "Can I choose a female therapist?",
    body: "Yes. Male and female therapists are available. Female clients are treated by a female therapist.",
    icon: "Users",
  },
  {
    title: "Which package should I choose?",
    body: "Supreme Combo for the full reset, Hijama Package for wet cupping, Fire Package for cupping without hijama, or Massage Therapy for hands-on treatment.",
    icon: "HelpCircle",
  },
  {
    title: "Is aftercare included?",
    body: "Yes. Your therapist explains what to do after your session based on the treatment you receive.",
    icon: "ClipboardCheck",
  },
] as const;

export const beforeAppointmentItems = [
  {
    title: "Share health details",
    body: "Tell us about medical conditions, medication, pregnancy, blood-related issues, skin conditions, recent illness or anything you are unsure about before booking.",
    icon: "Stethoscope",
  },
  {
    title: "Choose your therapist option",
    body: "Let us know whether you prefer a male or female therapist. Female clients are treated by a female therapist.",
    icon: "Users",
  },
  {
    title: "Prepare your space",
    body: "Clear a private area with enough room for the treatment setup. Your therapist will bring the equipment needed for your session.",
    icon: "Home",
  },
  {
    title: "Keep it simple before treatment",
    body: "Avoid turning up rushed, unwell or uncomfortable. For massage, avoid a heavy meal and alcohol before your appointment.",
    icon: "Clock",
  },
] as const;

export const aftercareTabs = [
  {
    id: "hijama",
    label: "Hijama / wet cupping",
    image: "/images/faqs-aftercare/hijama-aftercare.webp",
    imageType: "Clean cups, plasters or dressings, towel and aftercare setup. No blood.",
    imageAlt: "Clean hijama aftercare setup with dressings and cups",
    imageOverlay: "Hijama aftercare",
    intro:
      "Hijama involves small superficial incisions, so keeping the treated areas clean and protected matters.",
    note:
      "Hijama aftercare is especially important because wet cupping involves small superficial incisions.",
    items: [
      {
        title: "Keep the area clean",
        body: "Keep the treated areas clean and dry. Avoid touching, scratching or picking the skin.",
        icon: "ShieldCheck",
      },
      {
        title: "Follow dressing guidance",
        body: "If a dressing or plaster is used, follow your therapist’s guidance on when to remove or change it.",
        icon: "ClipboardCheck",
      },
      {
        title: "Avoid heat and heavy sweating",
        body: "Avoid swimming, sauna, steam rooms, hot baths and heavy exercise for the period advised by your therapist.",
        icon: "AlertTriangle",
      },
      {
        title: "Watch for unusual symptoms",
        body: "Contact us or seek medical advice if you notice increasing redness, swelling, pus, fever, excessive bleeding or severe pain.",
        icon: "HelpCircle",
      },
    ],
  },
  {
    id: "cupping",
    label: "Dry & fire cupping",
    image: "/images/faqs-aftercare/cupping-aftercare.webp",
    imageType: "Glass or plastic cups and towel in a clean, calm setup. No unsafe flame close-up.",
    imageAlt: "Dry and fire cupping aftercare setup with cups and towel",
    imageOverlay: "Cupping aftercare",
    intro:
      "Dry and fire cupping do not involve wet cupping, but they can still leave temporary marks or skin sensitivity.",
    note:
      "Your therapist will explain what marks may look like and what to expect after your session.",
    items: [
      {
        title: "Temporary marks are normal",
        body: "Cupping can leave circular marks. These are usually temporary and should fade over time.",
        icon: "Droplets",
      },
      {
        title: "Keep skin comfortable",
        body: "Keep the area clean and avoid scratching. Wear loose clothing if the area feels sensitive.",
        icon: "HeartHandshake",
      },
      {
        title: "Avoid irritation",
        body: "Avoid very hot baths, sauna, steam rooms or intense exercise straight after treatment if your skin feels tender.",
        icon: "AlertTriangle",
      },
      {
        title: "Fire cupping safety",
        body: "Fire cupping is carried out with a controlled approach. If you ever notice blistering, burns, fever or severe discomfort, seek advice.",
        icon: "Flame",
      },
    ],
  },
  {
    id: "massage",
    label: "Massage / IASTM",
    image: "/images/faqs-aftercare/massage-aftercare.webp",
    imageType: "Relaxed massage setup with oils, towel and client resting.",
    imageAlt: "Massage aftercare setup with oils and towel",
    imageOverlay: "Massage aftercare",
    intro:
      "After massage, deep tissue or IASTM-style work, give your body time to settle before rushing back into heavy activity.",
    note:
      "If you are unsure what is normal after your treatment, message Rahma Therapy for guidance.",
    items: [
      {
        title: "Rest briefly",
        body: "Take a few minutes to settle after treatment, especially if you feel light-headed or very relaxed.",
        icon: "Clock",
      },
      {
        title: "Hydrate",
        body: "Drink water after your session. Herbal tea is also fine if you prefer something warm.",
        icon: "Droplets",
      },
      {
        title: "Avoid alcohol and too much caffeine",
        body: "Avoid alcohol and too much caffeine for 24 hours after treatment.",
        icon: "AlertTriangle",
      },
      {
        title: "Take it easy",
        body: "Avoid heavy training or strenuous activity straight after deep tissue or IASTM-style work. Gentle movement is fine if comfortable.",
        icon: "HandHeart",
      },
      {
        title: "Mild soreness can happen",
        body: "Mild soreness or tiredness can happen after deeper work. Severe, unusual or worsening pain should be checked.",
        icon: "HelpCircle",
      },
    ],
  },
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
  "Are unsure whether treatment is suitable",
] as const;

export const faqCategories = [
  {
    id: "booking",
    label: "Booking",
    faqs: [
      {
        question: "How do I book a Rahma Therapy session?",
        answer:
          "You can book through the Book Now page or message us on WhatsApp. Tell us your preferred package, location, therapist preference and any health details we should know.",
      },
      {
        question: "Do you come to my home?",
        answer:
          "Yes. Rahma Therapy is a mobile service covering Luton and surrounding areas. Your therapist brings the treatment setup to your home.",
      },
      {
        question: "What should I prepare before the therapist arrives?",
        answer:
          "Please clear a private space with enough room for the treatment setup. Wear comfortable clothing and have any relevant health information ready.",
      },
      {
        question: "Can I ask questions before booking?",
        answer:
          "Yes. If you are unsure which package to choose or whether treatment is suitable, message us before booking.",
      },
    ],
  },
  {
    id: "packages",
    label: "Packages",
    faqs: [
      {
        question: "Which package should I choose first?",
        answer:
          "Choose the Supreme Combo Package if you want the most complete treatment. Choose the Hijama Package if you specifically want wet cupping. Choose the Fire Package if you want cupping without wet cupping. Choose Massage Therapy if you mainly want hands-on treatment.",
      },
      {
        question: "Which packages include hijama?",
        answer:
          "The Supreme Combo Package and Hijama Package include wet cupping / hijama.",
      },
      {
        question: "Which package does not include wet cupping?",
        answer:
          "The Fire Package and Massage Therapy options do not include wet cupping / hijama.",
      },
      {
        question: "What are the current package prices?",
        answer:
          "Supreme Combo Package is £55. Hijama Package is £45. Fire Package is £40. Massage Therapy is £40 for 30 minutes or £60 for 1 hour.",
      },
      {
        question: "Can I choose a package on the day?",
        answer:
          "It is better to choose before booking so the therapist can prepare correctly. If something needs to change, your therapist can discuss suitable options before treatment begins.",
      },
    ],
  },
  {
    id: "therapists-privacy",
    label: "Therapists & Privacy",
    faqs: [
      {
        question: "Do you offer male and female therapists?",
        answer: "Yes. Rahma Therapy has male and female therapists available.",
      },
      {
        question: "Are female clients treated by a female therapist?",
        answer: "Yes. Female clients are treated by a female therapist.",
      },
      {
        question: "Will the therapist explain everything first?",
        answer:
          "Yes. Your therapist will explain what the treatment involves, check your comfort and answer questions before starting.",
      },
      {
        question: "Is the session private?",
        answer:
          "Yes. Sessions are carried out in your home in a private space prepared for the treatment. Your comfort and modesty are treated respectfully.",
      },
    ],
  },
  {
    id: "hijama",
    label: "Hijama",
    faqs: [
      {
        question: "What is hijama?",
        answer:
          "Hijama, also known as wet cupping, is a traditional cupping method where suction is used and small superficial incisions are made in selected areas. Your therapist checks suitability and explains the process before treatment.",
      },
      {
        question: "Is hijama the same as dry cupping?",
        answer:
          "No. Dry cupping uses suction without incisions. Hijama / wet cupping involves suction and small superficial incisions.",
      },
      {
        question: "Does hijama hurt?",
        answer:
          "Sensation varies. You may feel suction, pressure or mild tenderness, but your therapist will explain each step and check your comfort throughout.",
      },
      {
        question: "Is hijama suitable for everyone?",
        answer:
          "No. Suitability is checked before treatment. It may not be suitable for certain medical conditions, medication use, pregnancy, blood-related issues, skin conditions or if you are unwell.",
      },
      {
        question: "What should I do after hijama?",
        answer:
          "Keep the treated areas clean and dry, avoid scratching or picking the skin, avoid heavy sweating or heat exposure for the period advised, and follow your therapist’s aftercare guidance.",
      },
    ],
  },
  {
    id: "dry-fire-cupping",
    label: "Dry & Fire Cupping",
    faqs: [
      {
        question: "What is dry cupping?",
        answer:
          "Dry cupping uses cups to create suction on the skin without incisions. It is often chosen by clients for muscle tension, stiffness and recovery support.",
      },
      {
        question: "What is fire cupping?",
        answer:
          "Fire cupping is a traditional heat-assisted cupping method using glass cups to create suction. Rahma Therapy uses a careful, controlled approach.",
      },
      {
        question: "Will cupping leave marks?",
        answer:
          "Cupping can leave temporary circular marks on the skin. These usually fade over time.",
      },
      {
        question: "Is fire cupping dangerous?",
        answer:
          "Fire cupping needs a trained, careful approach because heated cups can cause burns if used incorrectly. Your therapist will explain what to expect and check your comfort.",
      },
    ],
  },
  {
    id: "massage-iastm",
    label: "Massage & IASTM",
    faqs: [
      {
        question: "What massage styles do you offer?",
        answer:
          "Rahma Therapy offers relaxing massage, deep tissue massage, cupping massage and IASTM / Graston-style therapy options with an essential oil blend.",
      },
      {
        question: "Is 30 minutes enough?",
        answer:
          "A 30-minute session is best for one focused area such as back, neck, shoulders or legs. If you want multiple areas covered or a calmer full-body session, choose the 1-hour option.",
      },
      {
        question: "Can massage help with stress?",
        answer:
          "Many clients choose massage when stress shows up as tight shoulders, body tension or difficulty switching off. Massage can be described as supporting relaxation and everyday stress relief.",
      },
      {
        question: "Will I feel sore after deep tissue massage or IASTM?",
        answer:
          "Mild soreness, tiredness or redness can happen after deeper work. Severe, unusual or worsening pain should be checked.",
      },
      {
        question: "Does massage replace medical care?",
        answer:
          "No. Massage is a complementary wellness treatment and should not replace medical care for health concerns.",
      },
    ],
  },
  {
    id: "aftercare",
    label: "Aftercare",
    faqs: [
      {
        question: "What should I do straight after my session?",
        answer:
          "Rest briefly, drink water, avoid rushing into heavy activity and follow the aftercare advice for the treatment you received.",
      },
      {
        question: "Can I exercise after treatment?",
        answer:
          "Avoid strenuous exercise straight after hijama, cupping, deep tissue massage or IASTM-style work. Gentle movement is fine if comfortable.",
      },
      {
        question: "Can I shower after hijama?",
        answer:
          "Your therapist will advise based on your session. As hijama involves small superficial incisions, keep the treated areas clean and dry and avoid irritation while the skin settles.",
      },
      {
        question: "When should I contact Rahma Therapy or seek medical help?",
        answer:
          "Contact us or seek medical advice if you notice excessive bleeding, increasing redness, swelling, pus, fever, burns, blistering, severe pain or anything that feels unusual.",
      },
    ],
  },
] as const;

export const adviceItems = [
  "Bleeding that does not settle",
  "Increasing redness, swelling or heat",
  "Pus or yellow discharge",
  "Fever or feeling generally unwell",
  "Burns, blistering or severe skin irritation",
  "Severe, unusual or worsening pain",
  "Fainting, dizziness that does not settle, or anything that worries you",
] as const;

export const faqsAftercareDisclaimer =
  "Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care. If you have a medical condition, take medication, are pregnant, or are unsure whether treatment is suitable, please speak to a healthcare professional before booking.";
