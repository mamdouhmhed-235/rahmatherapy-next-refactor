import { faqsByPage } from "@/content/faqs";
import { serviceSummaries } from "@/content/services";
import {
  homeFeaturedTestimonial,
  homeTestimonials,
} from "@/content/testimonials";
import { contactLinks, bookingLink } from "@/content/site/contact";
import { pageSeoByKey } from "@/content/site/seo";
import type { HomePageContent } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

export const homePageContent = {
  key: "home",
  seo: pageSeoByKey.home,
  hero: {
    title: "Sports Massage & Physiotherapy in Luton",
    subtitle: "Relax, recharge, renew: Your wellness journey",
    description:
      "Personalised massage and physiotherapy in Luton. Eliminating pain, enhancing mobility and powering your performance to unlock your full potential",
    primaryCta: bookingLink,
    image: {
      image: "homeHero",
    },
  },
  services: {
    title: "Expert care for lasting relief and recovery.",
    items: serviceSummaries,
  },
  trust: {
    title:
      "We combine expert skills with a personalised, holistic approach, so you feel cared for, supported, and restored.",
    items: [
      {
        eyebrow: "01",
        title: "Personalised Care",
        description:
          "Our team consists of highly trained professionals with extensive experience. We ensure a personalized approach to every session.",
      },
      {
        eyebrow: "02",
        title: "Certified Therapists",
        description:
          "We create tailored treatment plans that address your specific concerns. This ensures you receive the most effective care possible.",
      },
      {
        eyebrow: "03",
        title: "Luton mobile therapy",
        description:
          "Our services are available throughout London for your convenience. Enjoy professional massage therapy close to home or work.",
      },
      {
        eyebrow: "04",
        title: "Proven Results",
        description:
          "Take the first step towards relaxation and recovery. Schedule your appointment with us now and feel the difference.",
      },
    ],
  },
  about: {
    title: "Expert therapists dedicated to wellness and recovery",
    description:
      "At Rahma Therapy, we know what it’s like to struggle with pain and limited movement. Having recovered from sports injuries ourselves, we’ve experienced the power of expert therapy firsthand. That’s why our mission is simple: to help you heal, relax, and thrive through safe, skilled, and holistic treatments.",
    image: {
      image: "aboutZaheer",
    },
  },
  outcomes: {
    title: "Experience lasting relief",
    items: [
      {
        title: "Pain-free movement",
        description: "Move freely without discomfort or limitations.",
        image: { image: "painFreeMovement" },
      },
      {
        title: "Elite recovery",
        description: "Enjoy restful nights and rejuvenated mornings.",
        image: { image: "eliteRecovery" },
      },
      {
        title: "Reduced anxiety",
        description: "Calm your mind and enhance your well-being.",
        image: { image: "reducedAnxiety" },
      },
      {
        title: "Improved performance",
        description: "Boost your strength and endurance effectively.",
        image: { image: "improvedPerformance" },
      },
    ],
    asideTitle: "Serving clients across Luton and the surrounding area",
    asideDescription:
      "We help busy professionals, athletes, seniors, and anyone dealing with pain or stress.",
  },
  featuredTestimonial: homeFeaturedTestimonial,
  testimonials: {
    title: "Transformative experience with an exceptional service",
    items: homeTestimonials,
  },
  cta: {
    title: "Ready to feel better?",
    description:
      "Booking takes less than 60 seconds, alternatively, drop us a line.",
    primary: bookingLink,
    secondary: {
      label: "Drop us an email",
      href: contactLinks.email.href,
      variant: "secondary",
    },
    image: {
      image: "homeCtaMassage",
    },
  },
  faq: {
    title: "Frequently asked questions",
    items: faqsByPage.home,
  },
} as const satisfies HomePageContent<SiteImageKey>;
