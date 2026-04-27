import type { FeaturedQuote, Testimonial } from "@/types/content";

export const homeFeaturedTestimonial = {
  quote:
    "“I noticed a real improvement in mobility afterward. Less stiffness, better range of motion and a huge difference in how I felt during my workouts”",
  author: "Khayyam Butt",
} as const satisfies FeaturedQuote;

export const homeTestimonials = [
  {
    quote:
      "“Excellent full body massage. Very informative and mindful of injuries. Helped aiding my speedy recovery after vigorous sports.”",
    author: "Ismail S",
    role: "Semi-Pro Footballer",
    rating: 5,
  },
  {
    quote:
      "\"Working 5 days in the office and weekly football caused back and knee pain. With a sports massage at Rahma Therapy I felt so much better. I noticed a difference from the first session.\"",
    author: "Saif S",
    role: "Accountant",
    rating: 5,
  },
] as const satisfies readonly Testimonial[];

export const physiotherapyFeaturedTestimonial = {
  quote:
    "“The physio was incredibly skilled in targeting my shoulder injury. With massage, the precise pressure and techniques helped ease the tension and pain.”",
  author: "Naik Mohammad",
  role: "Cricketer",
} as const satisfies FeaturedQuote;

export const physiotherapyTestimonials = [
  {
    quote:
      "Excellent physiotherapy and massage. Targeted my quads and hips form football. Transformed my recovery process.",
    author: "Fuad M",
    role: "Office Worker",
    rating: 5,
  },
  {
    quote: "\"I finally found relief from my chronic back pain!\"",
    author: "Faisal M",
    role: "Plumber",
    rating: 5,
  },
  {
    quote:
      "Excellent physiotherapy session with Maryam. She targeted all areas I was struggling with. Very informative in the consultation prior and gave me exercises to follow",
    author: "Amina P",
    role: "Doctor",
    rating: 5,
  },
] as const satisfies readonly Testimonial[];

export const sportsMassageFeaturedTestimonial = {
  quote:
    "\"Great sports massage! Helped me relieve tightness in my lower back and hamstrings - Highly recommended\"",
  author: "Ismael E Q",
  role: "Personal Trainer",
} as const satisfies FeaturedQuote;

export const sportsMassageTestimonials = [
  {
    quote:
      "\"Highly recommend for anyone who needs a deep tissue massage to reduce aches and pains\"",
    author: "Homam Limam",
    role: "?",
    rating: 5,
  },
  {
    quote:
      "\"feel much better than I did before so definitely recommend this service\"",
    author: "Faraz H",
    role: "Office Manager",
    rating: 5,
  },
  {
    quote: "\"Excellent session to help me regain my mobility\"",
    author: "Kieran W",
    role: "Accountant",
    rating: 5,
  },
] as const satisfies readonly Testimonial[];

export const hijamaFeaturedTestimonial = {
  quote: "\"Hijama left me feeling lighter, with improved energy and less back pain.”",
  author: "Ammar G",
} as const satisfies FeaturedQuote;

export const hijamaTestimonials = [
  {
    quote: "\"Felt energised and slept great that evening\"",
    author: "Khadija A",
    rating: 5,
  },
  {
    quote: "\"Recommend this treatment, relief from back pain\"",
    author: "Yasmin K",
    rating: 5,
  },
  {
    quote:
      "\"First time doing cupping therapy, very professional and made me feel comfortable\"",
    author: "Mark S",
    rating: 5,
  },
] as const satisfies readonly Testimonial[];
