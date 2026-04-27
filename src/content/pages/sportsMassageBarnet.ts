import { faqsByPage } from "@/content/faqs";
import {
  sportsMassageFeaturedTestimonial,
  sportsMassageTestimonials,
} from "@/content/testimonials";
import { bookingLink, contactLinks } from "@/content/site/contact";
import { pageSeoByKey } from "@/content/site/seo";
import type { ServicePageContent } from "@/types/content";
import type { SiteImageKey } from "@/content/images";

export const sportsMassageBarnetPageContent = {
  key: "sports-massage-barnet",
  seo: pageSeoByKey["sports-massage-barnet"],
  hero: {
    title: "Sports Massage in Luton",
    subtitle: "Release tension. Relieve pain. Restore balance.",
    description:
      "Sports massage is designed to enhance athletic performance, speed up recovery, and prevent injuries by relieving muscle tension and improving circulation.",
    primaryCta: {
      label: "Book a Sports Massage",
      href: "#book-now",
      variant: "primary",
    },
    images: [
      {
        image: "sportsMassageHero",
      },
      {
        image: "sportsMassageHeroSecondary",
      },
    ],
  },
  benefits: {
    title: "From tension to total balance",
    items: [
      {
        title: "Relief from chronic tension",
        description:
          "Targets deep layers of muscle to ease long-standing knots and stiffness in the back, shoulders, and neck.",
        image: { image: "sportsMassageTension" },
      },
      {
        title: "Faster workout recovery",
        description:
          "Reduce soreness, flush out lactic acid, and bounce back quicker.",
        image: { image: "sportsMassageRecovery" },
      },
      {
        title: "Reduced muscle pain",
        description:
          "Eases lower back pain, sciatica, and repetitive strain by addressing muscle imbalances.",
        image: { image: "sportsMassagePain" },
      },
      {
        title: "Boosted circulation",
        description:
          "Encourages blood flow to sore or tight areas, aiding healing and reducing inflammation.",
        image: { image: "sportsMassageCirculation" },
      },
    ],
  },
  expectations: {
    title: "What to expect during your session",
    description:
      "Your journey begins with a comprehensive consultation and assessment to see what kind of massage you require.",
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
      label: "Book a massage",
      href: "#book-now",
      variant: "primary",
    },
    image: {
      image: "sportsMassageExpectations",
    },
  },
  stories: {
    title: "Real stories, real results",
    description:
      "The best proof comes from the people we’ve helped. Here are a few examples of how our treatments have transformed lives",
    items: [
      {
        title: "Through sports massage and recovery advice",
        description:
          "An amateur runner struggled with tight calves that made training painful. Through targeted deep tissue massage and recovery advice, they were able to return to training with improved mobility and less soreness.",
        image: {
          image: "sportsMassageStoryRunnerRecovery",
        },
      },
      {
        title: "Lower back pain relieved",
        description:
          "A client dealing with chronic lower back pain from heavy lifting at work noticed significant relief after a series of sessions. With reduced stiffness and improved mobility, they could bend and move more comfortably.",
        image: {
          image: "sportsMassageStoryLowerBackRelief",
        },
      },
      {
        title: "Overnight sleep improvment",
        description:
          "Another client booked sessions mainly for stress relief. After regular treatments, they noticed not only less muscle tension but also improved sleep and a calmer mindset.",
        image: {
          image: "sportsMassageStorySleepImprovement",
        },
      },
    ],
  },
  featuredTestimonial: sportsMassageFeaturedTestimonial,
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
        title: "1 Hour Session",
        priceLabel: "£60",
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
        title: "5 Sessions",
        priceLabel: "£240",
        meta: "1 Free Session",
        includes: [
          "Expert therapeutic techniques",
          "Home exercise recommendations",
          "Progress tracking included",
          "5 one-hour sessions",
          "Personalised treatment plans",
        ],
        cta: {
          label: "Choose your sessions",
          href: "#book-now",
          variant: "secondary",
        },
      },
      {
        title: "10 Sessions",
        priceLabel: "£480",
        meta: "2Free Sessions",
        includes: [
          "Pain relief strategies",
          "Postural analysis included",
          "Tailored aftercare guidance",
          "10 one-hour sessions",
          "Personalised treatment plans",
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
    items: sportsMassageTestimonials,
  },
  outcomes: {
    title: "Amazing outcome from deep tissue massage",
    description:
      "Experience profound benefits that go beyond relaxation. Our deep tissue massage promotes pain relief, better posture, and faster recovery, empowering you to live your best life.",
    image: {
      image: "sportsMassageHero",
    },
    items: [
      {
        title: "Relief from stubborn aches and tension",
        description: "",
      },
      {
        title: "Increased mobility and flexibility",
        description: "",
      },
      {
        title: "Faster post-exercise recovery",
        description: "",
      },
      {
        title: "Reduced stress and better sleep quality",
        description: "",
      },
      {
        title: "A lighter, more energised body",
        description: "",
      },
    ],
  },
  cta: {
    title: "Ready to restore? Book your massage session today",
    description:
      "Book your hijama session today and experience the benefits of this time-tested therapy.",
    primary: bookingLink,
    secondary: {
      label: "Drop us an email",
      href: contactLinks.email.href,
      variant: "secondary",
    },
    image: {
      image: "sportsMassageCta",
    },
  },
  faq: {
    title: "Frequently asked questions",
    items: faqsByPage["sports-massage-barnet"],
  },
} as const satisfies ServicePageContent<SiteImageKey>;
