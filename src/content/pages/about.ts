import { pageSeoByKey } from "@/content/site/seo";
import type { SiteImageKey } from "@/content/images";
import type { AboutPageContent } from "@/types/content";

export const aboutPageContent = {
  key: "about",
  seo: pageSeoByKey.about,
  hero: {
    eyebrow: "About Rahma Therapy",
    title: "Trusted Mobile Hijama, Cupping & Massage Therapy in Luton",
    description:
      "Rahma Therapy brings professional hijama, cupping, massage, and soft-tissue therapy directly to your home — with qualified male and female therapists available for a private, comfortable experience.",
    primaryCta: { label: "Book Your Session", href: "#book-now" },
    secondaryCta: { label: "View Our Services", href: "/services" },
    images: [
      {
        image: "sharedSessionPractitioner",
        alt: "Clean mobile hijama and cupping therapy setup by Rahma Therapy in Luton",
      },
      {
        image: "hijamaCta",
        alt: "Rahma Therapy mobile treatment equipment prepared for a home visit",
      },
    ],
    trustChips: [
      "Established in 2020",
      "500+ clients worked with",
      "CMA & IPHM approved",
      "Male and female therapists available",
      "Mobile appointments across Luton and surrounding areas",
    ],
  },
  proof: {
    items: [
      {
        value: "Since 2020",
        label: "Serving clients across Luton",
        description: "Serving clients across Luton with mobile therapy appointments.",
      },
      {
        value: "500+ Clients",
        label: "Trusted by hundreds",
        description: "Trusted by hundreds of clients for hijama, cupping, massage, and therapy packages.",
      },
      {
        value: "CMA & IPHM Approved",
        label: "Professional recognition",
        description: "Professional recognition through complementary and holistic therapy bodies.",
      },
      {
        value: "Male & Female Therapists",
        label: "Therapist options",
        description: "Clients can request the therapist option they feel most comfortable with.",
      },
      {
        value: "Mobile Home Visits",
        label: "Treatment brought to you",
        description: "Treatment brought directly to your chosen location.",
      },
    ],
  },
  whoWeAre: {
    title: "Care That Comes to You",
    description:
      "Rahma Therapy is a Luton-based mobile therapy service specialising in hijama, cupping, massage, and IASTM-style soft-tissue therapy.\n\nInstead of asking clients to travel to a clinic, we bring the treatment setup directly to your home, helping you feel more relaxed, private, and comfortable from the moment your session begins.\n\nOur approach is simple: professional care, clear communication, respectful treatment, and a calm experience from booking to aftercare.",
    image: {
      image: "sharedSessionPractitioner",
      alt: "Professional mobile therapy setup brought to a home visit",
    },
    cta: { label: "Explore Our Services", href: "/services" },
    caption: "Professional mobile therapy setup brought to your home.",
  },
  team: {
    title: "Meet the Team",
    description: "Rahma Therapy is built around professional mobile care, traditional therapy knowledge, and privacy-conscious home visits.",
    items: [
      {
        name: "Minhaj Rahman",
        role: "Co-Founder & Practitioner",
        description:
          "Minhaj is the co-founder of Rahma Therapy and has helped build the business around professional mobile care, traditional therapy knowledge, and a strong connection to the Luton community.\n\nAlongside his therapy work, Minhaj has a background in education, business studies, martial arts, and personal development, giving him a calm, clear, and supportive approach when working with clients.",
        image: {
          image: "sharedSessionPractitioner",
          alt: "Minhaj Rahman, co-founder of Rahma Therapy in Luton",
        },
        badges: ["Co-Founder", "Luton-Based", "Mobile Therapy", "Hijama & Cupping"],
      },
      {
        name: "Female Therapist Available",
        role: "Private Care for Female Clients",
        description:
          "Rahma Therapy offers female therapist availability for clients who prefer same-gender care. This is especially important for clients who value privacy, modesty, or a more comfortable home-treatment experience.\n\nFemale clients can request a female therapist when booking.",
        badges: ["Female Therapist Available", "Privacy-Focused", "Same-Gender Care", "Home Visits"],
        notes: ["Name and photo withheld until owner approval."],
      },
    ],
  },
  comfort: {
    title: "Why Clients Feel Comfortable With Rahma Therapy",
    description:
      "A mobile therapy appointment is personal. That is why Rahma Therapy focuses on privacy, clear communication, respectful care, and a calm experience from start to finish.",
    items: [
      {
        title: "Treatment at Home",
        description: "No waiting rooms, no travel, and no unfamiliar clinic setting. Your therapist brings the setup to you.",
      },
      {
        title: "Clear Explanation",
        description: "Before starting, we explain the treatment, what to expect, and how to prepare.",
      },
      {
        title: "Respectful Care",
        description: "Sessions are carried out professionally, calmly, and with respect for your comfort and privacy.",
      },
      {
        title: "Therapist Preference",
        description: "Male and female therapists are available, so clients can request the option they feel most comfortable with.",
      },
    ],
  },
  standards: {
    title: "Professional Standards You Can Feel Confident In",
    description:
      "Rahma Therapy is built around trust. Every appointment should feel professional, respectful, and carefully handled from the first message to aftercare guidance.",
    image: {
      image: "hijamaCta",
      alt: "Clean cupping therapy equipment used by Rahma Therapy",
    },
    caption: "Clean setup, clear communication, and aftercare guidance for every appointment.",
    items: [
      {
        title: "Qualified Practitioners",
        description:
          "Rahma Therapy presents itself as qualified and licensed in hijama and cupping therapy, with CMA and IPHM approval.",
      },
      {
        title: "Professional Conduct",
        description: "Sessions are built around clear communication, respectful care, client comfort, and a calm experience.",
      },
      {
        title: "Clean Treatment Setup",
        description:
          "The team follows appropriate hygiene procedures for each appointment and keeps the treatment setup clean and organised.",
      },
      {
        title: "Pre-Treatment Checks",
        description: "Before treatment, key details are checked to make sure the session is suitable for the client.",
      },
      {
        title: "Aftercare Guidance",
        description: "Clients receive simple aftercare guidance so they know what to do after their appointment.",
      },
    ],
  },
  timeline: {
    title: "Our Journey So Far",
    description:
      "Rahma Therapy started with a simple goal: to make professional hijama, cupping, and massage therapy more accessible to people across Luton — without asking clients to travel to a clinic.",
    items: [
      {
        date: "September 2020",
        title: "Rahma Therapy Begins",
        description: "Rahma Therapy is founded in Luton as a mobile therapy service.",
      },
      {
        date: "October 2020",
        title: "First Public Service Content",
        description: "Early content showcases treatments including deep tissue massage, dry cupping, and fire cupping.",
      },
      {
        date: "2021-2022",
        title: "Treatment Range Expands",
        description:
          "Services grow to include hijama, wet cupping, dry cupping, fire cupping, massage, and Graston-style soft-tissue therapy.",
      },
      {
        date: "2021-2022",
        title: "Professional Recognition",
        description: "Rahma Therapy gains CMA and IPHM approval, strengthening its professional trust signals.",
      },
      {
        date: "2023",
        title: "Educational Content Grows",
        description:
          "Rahma Therapy expands its online presence with treatment demonstrations, short-form videos, and educational content.",
      },
      {
        date: "2024",
        title: "500+ Clients Served",
        description:
          "The business continues to grow through client trust, word of mouth, and consistent mobile therapy appointments across Luton.",
      },
      {
        date: "October 2025",
        title: "RahmaTherapy Limited Incorporated",
        description:
          "RahmaTherapy Limited becomes a registered private limited company, marking a new stage in the business journey.",
      },
      {
        date: "2026 and Beyond",
        title: "Continuing to Serve Luton",
        description:
          "Rahma Therapy continues developing its mobile care experience, treatment education, and client support across Luton and surrounding areas.",
      },
    ],
  },
  appreciation: {
    title: "What Clients Appreciate Most",
    description:
      "Clients often mention the calm approach, clear explanations, friendly manner, and comfort of being treated at home.",
    items: [
      {
        title: "Clear Explanations",
        description: "Clients appreciate knowing what to expect before the treatment begins.",
      },
      {
        title: "Friendly Approach",
        description: "Rahma Therapy is often praised for creating a calm, welcoming experience.",
      },
      {
        title: "Comfortable Home Visits",
        description: "Mobile appointments help clients feel more relaxed in their own space.",
      },
      {
        title: "Professional Care",
        description: "Clients value the organised setup, respectful service, and aftercare guidance.",
      },
    ],
  },
  process: {
    title: "How a Mobile Appointment Works",
    description: "A simple four-step process helps you know what to expect before you book.",
    items: [
      {
        title: "Choose Your Treatment",
        description: "Select hijama, cupping, massage, IASTM therapy, or a package.",
      },
      {
        title: "Pick Your Preferred Therapist",
        description: "Choose male, female, or no preference when booking.",
      },
      {
        title: "We Come to You",
        description: "Your therapist arrives at your chosen location with the required setup.",
      },
      {
        title: "Receive Aftercare Guidance",
        description: "After your session, we explain simple aftercare steps so you know what to do next.",
      },
    ],
  },
  cta: {
    title: "Ready to Book a Mobile Therapy Session?",
    description:
      "Whether you are interested in hijama, cupping, massage, or a package, Rahma Therapy can help you choose the most suitable option before booking.\n\nMale and female therapists available. Home visits across Luton and surrounding areas.",
    primary: { label: "Book Now", href: "#book-now" },
    secondary: { label: "Message Us on WhatsApp", href: "https://wa.me/447503201669" },
  },
} as const satisfies AboutPageContent<SiteImageKey>;
