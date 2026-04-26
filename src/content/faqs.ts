import type { FaqItem, SiteRouteKey } from "@/types/content";

export const faqsByPage = {
  home: [
    {
      question: "What types of massage do you offer?",
      answer:
        "We offer a variety of massage therapy styles, including Sports massage, deep tissue and Swedish (relaxation). Each session is tailored to your individual needs and goals.",
    },
    {
      question: "Do I need to book in advance?",
      answer:
        "Yes, we recommend booking in advance to ensure availability. Same-day appointments may be available, but cannot be guaranteed.",
    },
    {
      question: "What should I expect during my first session?",
      answer:
        "At your first visit, we’ll start with a short consultation to understand your health history, concerns, and goals. This helps us customise your massage. You’ll have privacy to undress to your comfort level, and you’ll be fully draped during the session except for the area being worked on.",
    },
    {
      question: "What should I wear?",
      answer:
        "Wear comfortable clothing. For the massage, you'll be asked to undress to your comfort level, and you'll be covered with a sheet or towel throughout the session. Physio may be done fully clothed.",
    },
    {
      question: "Will the massage hurt?",
      answer:
        "Massage should not be painful. Some deeper work such as Sports Massage may cause discomfort and soreness over the following day, but we always stay within your comfort zone. Communication is key—please let us know if anything feels too intense.",
    },
  ],
  physiotherapy: [
    {
      question: "What types of massage do you offer?",
      answer:
        "We offer a variety of massage therapy styles, including Swedish (relaxation), deep tissue and sports massage. Each session is tailored to your individual needs and goals.",
    },
    {
      question: "Do I need to book in advance?",
      answer:
        "Yes, we recommend booking in advance to ensure availability. Same-day appointments may be available, but cannot be guaranteed.",
    },
    {
      question: "What should I expect during my first session?",
      answer:
        "At your first visit, we’ll start with a short consultation to understand your health history, concerns, and goals. This helps us customise your massage. You’ll have privacy to undress to your comfort level, and you’ll be fully draped during the session except for the area being worked on.",
    },
    {
      question: "What should I wear?",
      answer:
        "Wear comfortable clothing. For the massage, you'll be asked to undress to your comfort level, and you'll be covered with a sheet or towel throughout the session. Physio may be done fully clothed.",
    },
    {
      question: "Will the massage hurt?",
      answer:
        "Massage should not be painful. Some deeper work such as Sports Massage may cause discomfort and soreness over the following day, but we always stay within your comfort zone. Communication is key—please let us know if anything feels too intense.",
    },
  ],
  "sports-massage-barnet": [
    {
      question: "What types of massage do you offer?",
      answer:
        "We offer a variety of massage therapy styles, including Swedish (relaxation), deep tissue and sports massage. Each session is tailored to your individual needs and goals.",
    },
    {
      question: "Do I need to book in advance?",
      answer:
        "Yes, we recommend booking in advance to ensure availability. Same-day appointments may be available, but cannot be guaranteed.",
    },
    {
      question: "What should I expect during my first session?",
      answer:
        "At your first visit, we’ll start with a short consultation to understand your health history, concerns, and goals. This helps us customise your massage. You’ll have privacy to undress to your comfort level, and you'll be fully draped during the session except for the area being worked on.",
    },
    {
      question: "What should I wear?",
      answer:
        "Wear comfortable clothing. For the massage, you'll be asked to undress to your comfort level, and you'll be covered with a sheet or towel throughout the session. Physio may be done fully clothed.",
    },
    {
      question: "Will the massage hurt?",
      answer:
        "Massage should not be painful. Some deeper work such as Sports Massage may cause discomfort and soreness over the following day, but we always stay within your comfort zone. Communication is key—please let us know if anything feels too intense.",
    },
  ],
  hijama: [
    {
      question: "What type of cupping do you offer?",
      answer:
        "There are several types of cupping, with the most common being dry cupping (suction only) and wet cupping (Hijama), which involves light skin incisions to draw out a small amount of blood.",
    },
    {
      question: "Do I need to book in advance?",
      answer:
        "Yes, we recommend booking in advance to ensure availability. Same-day appointments may be available, but cannot be guaranteed.",
    },
    {
      question: "How should I prepare for session?",
      answer:
        "Before your hijama, shower and trim any hair around the area that will be cupped to level 1. Do not eat 3 hours before.",
    },
    {
      question: "What should I do after the session?",
      answer:
        "Drink plenty of water. For 24 hours, avoid exercise, caffeine, red meats and dairy products. Avoid hot temperatures, baths, saunas, hot tubs for 24 hours. Hijama scars heal in from 2/3 days up to a week – sometimes even up to 2 weeks. Apply olive oil and black seed oil.",
    },
  ],
} as const satisfies Record<SiteRouteKey, readonly FaqItem[]>;
