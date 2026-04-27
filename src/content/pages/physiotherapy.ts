import { faqsByPage } from "@/content/faqs";
import {
  physiotherapyFeaturedTestimonial,
  physiotherapyTestimonials,
} from "@/content/testimonials";
import { bookingLink, contactLinks } from "@/content/site/contact";
import { pageSeoByKey } from "@/content/site/seo";
import type { ServicePageContent } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

export const physiotherapyPageContent = {
  key: "physiotherapy",
  seo: pageSeoByKey.physiotherapy,
  hero: {
    title: "Sports Massage & Physiotherapy in Luton",
    subtitle: "Restore movement. Recover faster. Live pain-free.",
    description:
      "Physiotherapy sessions designed to relieve pain, prevent injuries, and help you move with confidence again.",
    primaryCta: {
      label: "Book a Physiotherapy Session",
      href: "#book-now",
      variant: "primary",
    },
    images: [
      {
        image: "physiotherapyHeroSecondary",
      },
      {
        image: "physiotherapyHeroPrimary",
      },
    ],
  },
  benefits: {
    title: "Your body, rebalanced",
    items: [
      {
        title: "Lasting pain relief",
        description:
          "Targeted treatment helps reduce and manage chronic aches in the back, neck, shoulders, and joints — so you can live without constant discomfort.",
        image: { image: "physiotherapyPainRelief" },
      },
      {
        title: "Better posture",
        description:
          "Guided exercises and manual therapy relieve tension caused by poor posture, especially for desk workers and drivers.",
        image: { image: "physiotherapyBetterPosture" },
      },
      {
        title: "Faster injury recovery",
        description:
          "Evidence-based techniques support healing after sports injuries, accidents, or surgery, helping you get back on your feet sooner.",
        image: { image: "physiotherapyInjuryRecovery" },
      },
      {
        title: "Enhanced sports performance",
        description:
          "Athletes benefit from improved movement efficiency, reduced fatigue, and faster recovery between training sessions.",
        image: { image: "physiotherapySportsPerformance" },
      },
      {
        title: "Restored mobility",
        description:
          "Physiotherapy improves flexibility and joint range of motion, making daily tasks and workouts easier and less restrictive.",
        image: { image: "physiotherapyMobility" },
      },
      {
        title: "Improved strength and stability",
        description:
          "Tailored exercise programs build long-term muscle support for your joints, creating a stronger, more resilient body.",
        image: { image: "physiotherapyStrength" },
      },
    ],
  },
  expectations: {
    title: "What to expect during your session",
    description:
      "Your journey begins with a comprehensive consultation and assessment. Follow-up sessions will include guided exercises, manual therapy, and tailored aftercare guidance.",
    items: [
      {
        description: "Session 1: A detailed consultation, assessment, and advice.",
      },
      {
        description:
          "Follow-up sessions (1hr): Guided exercises, progress reassessment, manual therapy, and lifestyle advice",
      },
      {
        description:
          "Reassessments and aftercare plan with recommended stretches or exercises.",
      },
    ],
    cta: {
      label: "Book a Physiotherapy Session",
      href: "#book-now",
      variant: "primary",
    },
    image: {
      image: "sharedSessionPractitioner",
    },
  },
  stories: {
    title: "Real stories, real results",
    description:
      "The best proof comes from the people we’ve helped. Here are a few examples of how our treatments have transformed lives",
    items: [
      {
        title: "From frozen shoulder to freedom",
        description:
          "A client came to us unable to lift their arm properly and we were able to diagnose them with frozen shoulder. Through targeted exercises and stretched alongside manual therapy, we were able to massively improve their range of motion and reduce pain, helping them return back to activity.",
        image: {
          image: "physiotherapyStoryFrozenShoulder",
        },
      },
      {
        title: "Back pain relief for desk work",
        description:
          "Long hours at the office left another client with constant lower back and glute pain. With sports massage sessions and guided stretches, clients notice significant improvements in flexibility and almost no pain when sitting or standing.",
        image: {
          image: "physiotherapyStoryBackPain",
        },
      },
      {
        title: "Everyday stress, lifted",
        description:
          "Clients managing high stress and poor sleep often find relief through relaxation massage. Many report better rest, less tension, and more energy.",
        image: {
          image: "physiotherapyStoryStressRelief",
        },
      },
    ],
  },
  featuredTestimonial: physiotherapyFeaturedTestimonial,
  recoveryPath: {
    title: "Your path to recovery",
    description:
      "Starting your healing journey is easy and efficient. Follow our simple steps to get the care you need.",
    items: [
      {
        eyebrow: "01",
        title: "Book online in 60 seconds",
        description:
          "Secure your appointment in less than 60 seconds. Enjoy the convenience of booking from anywhere.",
      },
      {
        eyebrow: "02",
        title: "Attend your first session",
        description:
          "Experience a personalized consultation and assessment tailored to your needs. Our expert physiotherapist will create a treatment plan just for you.",
      },
      {
        eyebrow: "03",
        title: "Follow your tailored plan",
        description:
          "Stay committed to your recovery with guided exercises and regular reassessments. Our team will support you every step of the way.",
      },
      {
        eyebrow: "04",
        title: "Feel the results",
        description:
          "Experience the benefits of consistent sessions and dedicated aftercare. Your journey to improved mobility and pain relief is just beginning.",
      },
    ],
  },
  pricing: {
    title: "Hourly pricing and package deals",
    plans: [
      {
        title: "30 min consultation",
        priceLabel: "£35",
        meta: "Try us out",
        includes: [
          "Initial consultation and assessment",
          "Personalized treatment plan",
          "Follow-up support included",
        ],
        cta: {
          label: "Select a date",
          href: "#book-now",
          variant: "secondary",
        },
      },
      {
        title: "Consultation + 30min sports massage",
        priceLabel: "£60",
        meta: "Try us out",
        includes: [
          "Initial consultation and assessment",
          "Personalized treatment plan",
          "Follow-up support included",
          "Expert therapeutic techniques",
        ],
        cta: {
          label: "Choose your sessions",
          href: "#book-now",
          variant: "secondary",
        },
      },
    ],
  },
  testimonials: {
    title: "Hear from our satisfied clients about their experiences",
    items: physiotherapyTestimonials,
  },
  outcomes: {
    title: "Benefits of physiotherapy",
    description:
      "Experience profound benefits that go beyond relaxation. Our deep tissue massage promotes pain relief, better posture, and faster recovery, empowering you to live your best life.",
    image: {
      image: "physiotherapyOutcomes",
    },
    items: [
      {
        title: "Better management of chronic conditions",
        description: "",
      },
      {
        title: "Improved mobility and movement",
        description: "",
      },
      {
        title: "Full recovery from injury",
        description: "",
      },
      {
        title: "Sport specific movement training",
        description: "",
      },
      {
        title: "Injury prevention",
        description: "",
      },
    ],
  },
  cta: {
    title: "Ready to restore your body’s balance?",
    description: "Book your physio session",
    primary: bookingLink,
    secondary: {
      label: "Drop us an email",
      href: contactLinks.email.href,
      variant: "secondary",
    },
    image: {
      image: "physiotherapyCta",
    },
  },
  faq: {
    title: "Frequently asked questions",
    items: faqsByPage.physiotherapy,
  },
} as const satisfies ServicePageContent<SiteImageKey>;
