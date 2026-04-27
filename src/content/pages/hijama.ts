import { faqsByPage } from "@/content/faqs";
import {
  hijamaFeaturedTestimonial,
  hijamaTestimonials,
} from "@/content/testimonials";
import { bookingLink, contactLinks } from "@/content/site/contact";
import { pageSeoByKey } from "@/content/site/seo";
import type { ServicePageContent } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

export const hijamaPageContent = {
  key: "hijama",
  seo: pageSeoByKey.hijama,
  hero: {
    title: "Hijama Cupping Therapy in Luton",
    subtitle: "Cleanse. Restore. Rebalance.",
    description:
      "Hijama (cupping therapy) is a traditional treatment that supports circulation, relieves chronic pain, and restores balance to body and mind.",
    primaryCta: {
      label: "Book a Hijama Session",
      href: "?booking=1&services=hijama-package",
      variant: "primary",
    },
    images: [
      {
        image: "hijamaHero",
      },
      {
        image: "hijamaHeroCloseup",
      },
    ],
  },
  benefits: {
    title: "Lighter, stronger, rebalanced",
    items: [
      {
        title: "Relief from chronic pain",
        description:
          "Hijama helps ease back, neck, and joint pain by reducing deep muscle tension and improving blood flow.",
        image: { image: "hijamaPainRelief" },
      },
      {
        title: "Detox and cleansing",
        description:
          "The therapy naturally draws out stagnant blood and toxins, leaving you feeling lighter and refreshed.",
        image: { image: "hijamaDetox" },
      },
      {
        title: "Better circulation",
        description:
          "Cupping stimulates blood flow, helping speed recovery and reduce inflammation.",
        image: { image: "hijamaCirculation" },
      },
    ],
  },
  expectations: {
    title: "What to expect during your session",
    description:
      "Your journey begins with a comprehensive consultation and assessment followed by cupping - either dry or wet.",
    items: [
      {
        description: "Session 1: Detailed consultation, cupping – wet or dry",
      },
      {
        description:
          "Follow up sessions (1hr): Review of previous session, Health and symptom check in, targeted cur placements, lighter or more precise incisions",
      },
      {
        description: "Reassessments and aftercare plan with recommended advice.",
      },
    ],
    cta: {
      label: "Book a Hijama Session",
      href: "?booking=1&services=hijama-package",
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
        title: "From fatigue to energy",
        description:
          "A client struggling with low energy noticed a major boost in vitality after just one session, leaving them feeling lighter and more active throughout the day.",
        image: {
          image: "hijamaStoryFatigueEnergy",
        },
      },
      {
        title: "Headaches and stress, lifted",
        description:
          "Frequent headaches and high stress left a client drained. Hijama sessions eased tension, resulting in fewer headaches and a calmer, more balanced state of mind.",
        image: {
          image: "hijamaStoryHeadachesStress",
        },
      },
      {
        title: "Back pain relief",
        description:
          "One client suffering from persistent lower back pain experienced significant reduction in discomfort after a series of Hijama treatments, paired with simple aftercare.",
        image: {
          image: "hijamaStoryBackPainRelief",
        },
      },
    ],
  },
  featuredTestimonial: hijamaFeaturedTestimonial,
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
        title: "Unlimited cups",
        priceLabel: "£45",
        meta: "45 Mins",
        includes: [
          "Initial consultation and assessment",
          "Follow-up support included",
        ],
        cta: {
          label: "Select a date",
          href: "?booking=1&services=hijama-package",
          variant: "secondary",
        },
      },
      {
        title: "Hijama + 30min Sports massage",
        priceLabel: "£70",
        meta: "75 Mins",
        includes: [
          "Initial consultation and assessment",
          "Follow-up support included",
          "Dry and fire cupping included",
        ],
        cta: {
          label: "Select a date",
          href: "?booking=1&services=hijama-package,massage-30",
          variant: "secondary",
        },
      },
      {
        title: "Hijama + 60min Sports massage",
        priceLabel: "£95",
        meta: "90 Mins",
        includes: [
          "Initial consultation and assessment",
          "Follow-up support included",
          "Dry and fire cupping included",
        ],
        cta: {
          label: "Select a date",
          href: "?booking=1&services=hijama-package,massage-60",
          variant: "secondary",
        },
      },
    ],
  },
  testimonials: {
    title: "Hear from our satisfied clients about their experiences",
    items: hijamaTestimonials,
  },
  outcomes: {
    title: "Healing you can feel",
    description:
      "Hijama is more than a traditional therapy, it’s a way to reset your body and mind. By improving circulation, easing tension, and helping remove toxins, clients often leave each session feeling lighter, clearer, and more energised.",
    image: {
      image: "hijamaCta",
    },
    items: [
      {
        title: "Immediate relief and lightness",
        description: "",
      },
      {
        title: "Pain reduction",
        description: "",
      },
      {
        title: "Improved energy and focus",
        description: "",
      },
      {
        title: "A lighter, more energised body",
        description: "",
      },
    ],
  },
  cta: {
    title: "Ready to restore your body’s balance?",
    description:
      "Book your hijama session today and experience the benefits of this time-tested therapy.",
    primary: bookingLink,
    secondary: {
      label: "Drop us an email",
      href: contactLinks.email.href,
      variant: "secondary",
    },
    image: {
      image: "hijamaCta",
    },
  },
  faq: {
    title: "Frequently asked questions",
    items: faqsByPage.hijama,
  },
} as const satisfies ServicePageContent<SiteImageKey>;
