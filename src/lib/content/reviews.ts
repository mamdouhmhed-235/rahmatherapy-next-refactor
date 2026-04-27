// Rahma Therapy Reviews content
// Generated from the extracted Google review dataset.
// Keep review text exact. Do not rewrite client reviews in components.

export type ReviewCategorySlug = "all" | "hijama-cupping" | "supreme-combo-graston" | "massage" | "female-therapist" | "home-visits" | "first-time" | "pain-recovery" | "professional-explained" | "repeat-clients" | "general";

export type ReviewRiskLevel = "low" | "medium" | "high";

export type RahmaReview = {
  id: string;
  originalIndex: number;
  reviewerName: string;
  rating: 4 | 5;
  dateLabel: string;
  text: string;
  shortExcerpt: string;
  source: "Google Reviews";
  categories: ReviewCategorySlug[];
  serviceTags: string[];
  inferredServiceCategory: string;
  reviewTypeCategory: string;
  websiteStrength: string;
  recommendedUsage: string;
  riskLevel: ReviewRiskLevel;
  visibleByDefault: boolean;
  featured: boolean;
  featuredReason: string;
  heroFeatured: boolean;
  displayPriority: number;
};

export const googleReviewsUrl = "https://www.google.com/maps/place/Rahma+Therapy+-+Mobile+%7C+Massage+%7C+Cupping/@51.8753,-0.4146,17z/data=!4m8!3m7!1s0x4876499261ed8e8d:0x83c2c9c96e93f0c7!8m2!3d51.891106!4d-0.4279358!9m1!1b1!16s%2Fg%2F11lwxymf39?entry=ttu";

export const reviewsPageStats = {
  googleReviewCountAtExtraction: "177",
  extractedReviewRecords: "89",
  visibleTextReviews: "88",
  fiveStarReviewsInExtractedSet: "87",
  fourStarReviewsInExtractedSet: "2",
  clientsSupported: "500+",
  servingSince: "2020",
  note: "Confirm the live Google review count before publishing exact public numbers.",
} as const;

export const reviewCategoryFilters = [
  {
    "slug": "all",
    "label": "All reviews",
    "description": "Every visible review in the Rahma Therapy review wall.",
    "countHint": 88
  },
  {
    "slug": "hijama-cupping",
    "label": "Hijama & cupping",
    "description": "Reviews mentioning hijama, wet cupping, dry cupping or cupping therapy.",
    "countHint": 57
  },
  {
    "slug": "supreme-combo-graston",
    "label": "Supreme Combo / Graston",
    "description": "Reviews mentioning the Supreme Combo, Graston or IASTM-style work.",
    "countHint": 8
  },
  {
    "slug": "massage",
    "label": "Massage therapy",
    "description": "Reviews mentioning massage, relaxation massage or deep-tissue style support.",
    "countHint": 9
  },
  {
    "slug": "female-therapist",
    "label": "Female therapist",
    "description": "Reviews connected to female therapist appointments, same-gender comfort or female-client care.",
    "countHint": 28
  },
  {
    "slug": "home-visits",
    "label": "Home visits",
    "description": "Reviews mentioning mobile appointments, house visits or treatment from home.",
    "countHint": 8
  },
  {
    "slug": "first-time",
    "label": "First-time clients",
    "description": "Reviews from first-time, nervous or unsure clients.",
    "countHint": 26
  },
  {
    "slug": "pain-recovery",
    "label": "Pain & recovery",
    "description": "Client experiences mentioning pain, stiffness, training, recovery, back or shoulder issues. Display as experiences, not promises.",
    "countHint": 40
  },
  {
    "slug": "professional-explained",
    "label": "Professional & explained",
    "description": "Reviews mentioning professionalism, clear explanation, punctuality, guidance or knowledge.",
    "countHint": 63
  },
  {
    "slug": "repeat-clients",
    "label": "Repeat clients",
    "description": "Reviews mentioning repeat bookings, recommendations or ongoing use.",
    "countHint": 64
  }
] as const;

export const rahmaGoogleReviews: RahmaReview[] = [
  {
    "id": "review-001",
    "originalIndex": 1,
    "reviewerName": "nish r",
    "rating": 5,
    "dateLabel": "2 months ago",
    "text": "Fantastic customer service alhamdulillah, and they give you honest advice. The fact that all sessions I was able to plan around my timetable and from the comfort of my home was a huge benefit. I would recommend anyone who is considering reaching out to Rahma Therapy to give them a go!",
    "shortExcerpt": "Fantastic customer service alhamdulillah, and they give you honest advice. The fact that all sessions I was able to plan around my timetable and from the comfort of my home was a huge…",
    "source": "Google Reviews",
    "categories": [
      "home-visits",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Mobile Home Visit",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Mobile Home Visit / Convenience",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": true,
    "featuredReason": "home-visit-proof",
    "heroFeatured": true,
    "displayPriority": 1
  },
  {
    "id": "review-002",
    "originalIndex": 2,
    "reviewerName": "Shalim Miah",
    "rating": 5,
    "dateLabel": "2 months ago",
    "text": "This is a mobile therapist. First time used. Arrived in my house on time, will equipped, professional and knowledgeable. Very happy and pleased with the experience. Will definitely use again and highly recommended!",
    "shortExcerpt": "This is a mobile therapist. First time used. Arrived in my house on time, will equipped, professional and knowledgeable. Very happy and pleased with the experience. Will definitely use…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "home-visits",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Mobile Home Visit",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Mobile Home Visit / Convenience",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": true,
    "featuredReason": "professional-mobile-proof",
    "heroFeatured": true,
    "displayPriority": 2
  },
  {
    "id": "review-003",
    "originalIndex": 3,
    "reviewerName": "Duncan Djillali",
    "rating": 5,
    "dateLabel": "3 months ago",
    "text": "My first treatment today with Rahma therapy. Everything was explained to me so that I knew what was happening and the reasons why it was being done. Very professional, friendly and good service.",
    "shortExcerpt": "My first treatment today with Rahma therapy. Everything was explained to me so that I knew what was happening and the reasons why it was being done. Very professional, friendly and…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "first-time",
      "professional-explained"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": true,
    "featuredReason": "clear-explanation-proof",
    "heroFeatured": true,
    "displayPriority": 3
  },
  {
    "id": "review-004",
    "originalIndex": 4,
    "reviewerName": "Shamilah Khan",
    "rating": 5,
    "dateLabel": "8 months ago",
    "text": "I’ve been using the female cupping therapist at Rahma Therapy for a few years now and honestly, she is an absolute natural at what she does. Every session has been very comfortable and I always feel great afterwards with very quick healing.\n\nI also booked a package for my brother as a gift with the male therapist and he had a very good experience too.\n\nI’ve recommended Rahma Therapy to family/friends and will keep doing so. Highly recommend if you’re looking for someone professional who really knows what they’re doing.",
    "shortExcerpt": "I’ve been using the female cupping therapist at Rahma Therapy for a few years now and honestly, she is an absolute natural at what she does. Every session has been very comfortable and…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1004
  },
  {
    "id": "review-005",
    "originalIndex": 5,
    "reviewerName": "Habib Raj",
    "rating": 5,
    "dateLabel": "7 months ago",
    "text": "Absolutely brilliant service with brilliant conversation. My regular ailment fixers! A seized back here, a trapped nerve there, Rahma always come through and get me right. Very knowledgeable and make you feel extremely comfortable. I’ve used them myself but also for my female family members and their staff all have the same calming, holistic approach. Absolute pleasure as always, see you soon!",
    "shortExcerpt": "Absolutely brilliant service with brilliant conversation. My regular ailment fixers! A seized back here, a trapped nerve there, Rahma always come through and get me right. Very…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Pain Relief / Injury Recovery",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1005
  },
  {
    "id": "review-006",
    "originalIndex": 6,
    "reviewerName": "maahiul alam",
    "rating": 5,
    "dateLabel": "8 months ago",
    "text": "My go to Hijama company to use! My mum was having very bad pains in her legs and Rahma Therapy came and done some cupping on her legs and she had a lot of stagnant blood removed and they offered expert advice! They have female therapists too! Don't look elsewhere and book them!",
    "shortExcerpt": "My go to Hijama company to use! My mum was having very bad pains in her legs and Rahma Therapy came and done some cupping on her legs and she had a lot of stagnant blood removed and…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Pain relief outcome",
    "websiteStrength": "Review-carousel testimonial",
    "recommendedUsage": "Review carousel or slider",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1006
  },
  {
    "id": "review-007",
    "originalIndex": 7,
    "reviewerName": "Humera Akbur",
    "rating": 5,
    "dateLabel": "3 months ago",
    "text": "Booked a relaxation massage with a female therapist. She arrived on time and was professional. Great job 👏 …",
    "shortExcerpt": "Booked a relaxation massage with a female therapist. She arrived on time and was professional. Great job 👏 …",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "massage",
      "professional-explained"
    ],
    "serviceTags": [
      "Massage",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Massage Therapy",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": true,
    "featuredReason": "massage-proof",
    "heroFeatured": false,
    "displayPriority": 27
  },
  {
    "id": "review-008",
    "originalIndex": 8,
    "reviewerName": "Tazim Hoque",
    "rating": 5,
    "dateLabel": "8 months ago",
    "text": "Alhamdulillah, my first ever experience of Hijama with Rahma Therapy was excellent! I could not have asked for a better therapist than Nadim, who was very knowledgeable, calm, and explained the whole process clearly. The Supreme Package was also perfect, as I was looking to incorporate Graston therapy into my recovery as well.",
    "shortExcerpt": "Alhamdulillah, my first ever experience of Hijama with Rahma Therapy was excellent! I could not have asked for a better therapist than Nadim, who was very knowledgeable, calm, and…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "supreme-combo-graston"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": true,
    "featuredReason": "first-time-hijama-proof",
    "heroFeatured": false,
    "displayPriority": 28
  },
  {
    "id": "review-009",
    "originalIndex": 9,
    "reviewerName": "Salehah Awan",
    "rating": 5,
    "dateLabel": "8 months ago",
    "text": "I’ve been using Rahma Therapy for a while and highly recommend it. My first Hijama session was amazing — the therapist explained everything clearly and made me feel comfortable. I love the mobile service, and she’s always professional and reliable.\nI’ve noticed real benefits from the sessions and will definitely continue using their services. I highly recommend Rahma Therapy to anyone considering Hijama — you’ll be in great hands!",
    "shortExcerpt": "I’ve been using Rahma Therapy for a while and highly recommend it. My first Hijama session was amazing — the therapist explained everything clearly and made me feel comfortable. I love…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "home-visits",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Mobile Home Visit",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1009
  },
  {
    "id": "review-010",
    "originalIndex": 10,
    "reviewerName": "Pritten Chauhan",
    "rating": 5,
    "dateLabel": "",
    "text": "Probably the best service/treatment I’ve ever had, he guided me through everything he was doing, was a bit worried at first, was not painful at all, the sensation was unbelievable and would definatly recommend to others, I have had pinched nerve for a few weeks and now feel a bit loose and more at ease, will 100 percent use again",
    "shortExcerpt": "Probably the best service/treatment I’ve ever had, he guided me through everything he was doing, was a bit worried at first, was not painful at all, the sensation was unbelievable and…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "pain-recovery",
      "repeat-clients"
    ],
    "serviceTags": [
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Pain Relief / Injury Recovery",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1010
  },
  {
    "id": "review-011",
    "originalIndex": 11,
    "reviewerName": "Anjoom Sultan",
    "rating": 5,
    "dateLabel": "8 months ago",
    "text": "Excellent service, was my second time going back to them. On time, they do a good job and I highly recommend them!\n\nIf you’re around Luton and looking for hijama / cupping do check these GUYS out!!",
    "shortExcerpt": "Excellent service, was my second time going back to them. On time, they do a good job and I highly recommend them! If you’re around Luton and looking for hijama / cupping do check…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": true,
    "featuredReason": "repeat-client-proof",
    "heroFeatured": false,
    "displayPriority": 31
  },
  {
    "id": "review-012",
    "originalIndex": 12,
    "reviewerName": "Firose Sulleyman",
    "rating": 5,
    "dateLabel": "",
    "text": "Booked the supreme combo package and this was my 1st time having it done.\n\nBrother Nadeem explained each process so professionally and calmly. Really eased my nerves and helped with my arm issue, can't wait to book my next session!",
    "shortExcerpt": "Booked the supreme combo package and this was my 1st time having it done. Brother Nadeem explained each process so professionally and calmly. Really eased my nerves and helped with my…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "professional-explained",
      "repeat-clients",
      "supreme-combo-graston"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": true,
    "featuredReason": "supreme-combo-proof",
    "heroFeatured": false,
    "displayPriority": 32
  },
  {
    "id": "review-013",
    "originalIndex": 13,
    "reviewerName": "Awais Rafiq",
    "rating": 5,
    "dateLabel": "",
    "text": "I had pain in my right shoulder, no longer there now, pain was gone during the first session, finished my second session today. They explain what they're doing, all the process and everything which is good so you know what is happening while you're getting treated. They have all the equipment with them which is great. Very respectful and kind. They tell you all the information that you need to hear which is great. How to rest, what not to eat they provide water at the end of your session.",
    "shortExcerpt": "I had pain in my right shoulder, no longer there now, pain was gone during the first session, finished my second session today. They explain what they're doing, all the process and…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "pain-recovery"
    ],
    "serviceTags": [
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Pain Relief / Injury Recovery",
    "reviewTypeCategory": "Pain relief outcome",
    "websiteStrength": "Review-carousel testimonial",
    "recommendedUsage": "Review carousel or slider",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1013
  },
  {
    "id": "review-014",
    "originalIndex": 14,
    "reviewerName": "Aysha Khatoon",
    "rating": 5,
    "dateLabel": "8 months ago",
    "text": "The female therapist was amazing. Friendly and professional. Have used her a few times now.",
    "shortExcerpt": "The female therapist was amazing. Friendly and professional. Have used her a few times now.",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Review-carousel testimonial",
    "recommendedUsage": "Review carousel or slider",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": true,
    "featuredReason": "female-therapist-proof",
    "heroFeatured": false,
    "displayPriority": 34
  },
  {
    "id": "review-015",
    "originalIndex": 15,
    "reviewerName": "MoFoSidd",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Great service and exactly what I was after as it was my first time doing the cupping therapy. Therapist arrived on time, had a clean set up, clear and friendly guidance and instruction. Every step of the way therapist kept me aware of what was happening. After care guidance was shared with me and was also provided literature which was helpful. Definitely booking another session.",
    "shortExcerpt": "Great service and exactly what I was after as it was my first time doing the cupping therapy. Therapist arrived on time, had a clean set up, clear and friendly guidance and…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Trust-section testimonial",
    "recommendedUsage": "Trust/credibility section",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": true,
    "featuredReason": "clean-setup-proof",
    "heroFeatured": false,
    "displayPriority": 35
  },
  {
    "id": "review-016",
    "originalIndex": 16,
    "reviewerName": "Haroon",
    "rating": 4,
    "dateLabel": "Edited 4 years ago",
    "text": "This was my first time using  Rahma Therapy for my cupping , The brother was very knowledgeable and we had a good session with GOOD conversation.  No pain whatsoever and my friend was also very thankful that I arranged for us to getting cupping from This company . Only thing that was disappointing is that if I have pain in my legs and back I can only get one part of the body done if I want both then I have to make two appointments for one time (pay two times) which I don't think is fair . Iv had cupping since 2011 so I have had really good experience and some bad experience . Rahma therapy was a good experience just not 100% how I was expecting this is why I changes it from 5* to 4*",
    "shortExcerpt": "This was my first time using Rahma Therapy for my cupping , The brother was very knowledgeable and we had a good session with GOOD conversation. No pain whatsoever and my friend was…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "pain-recovery",
      "professional-explained"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Not recommended",
    "recommendedUsage": "Not recommended for website",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1016
  },
  {
    "id": "review-017",
    "originalIndex": 17,
    "reviewerName": "aishah moyeen",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "It was my first ever time getting the cupping process done and I was very nervous. The therapist and team were very welcoming and friendly, she made sure that she answered all my questions making me feel at ease. The procedure was very good and I will definitely be going back to Rahma Therapy when in need for a top up in the future Insha’Allah.",
    "shortExcerpt": "It was my first ever time getting the cupping process done and I was very nervous. The therapist and team were very welcoming and friendly, she made sure that she answered all my…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "pain-recovery"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1017
  },
  {
    "id": "review-018",
    "originalIndex": 18,
    "reviewerName": "Amir Malik",
    "rating": 5,
    "dateLabel": "2 years ago",
    "text": "",
    "shortExcerpt": "",
    "source": "Google Reviews",
    "categories": [
      "general"
    ],
    "serviceTags": [
      "General Rahma Therapy Experience"
    ],
    "inferredServiceCategory": "General Rahma Therapy Experience",
    "reviewTypeCategory": "General positive praise",
    "websiteStrength": "Not recommended",
    "recommendedUsage": "Not recommended for website",
    "riskLevel": "low",
    "visibleByDefault": false,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1018
  },
  {
    "id": "review-019",
    "originalIndex": 19,
    "reviewerName": "H B",
    "rating": 5,
    "dateLabel": "2 years ago",
    "text": "I’ve have 2-3 Hijama sessions (Dry & Wet Cupping) a year, and through that have experienced different therapists/practitioners.\n\nMy therapist arrived on time, came equipped and went through the relevant health questions/requirements and set up very quickly. A pre-hijama massage helped massively, 1- to feel relaxed and 2 - to get the blood stimulation going for the hijama, something most Hijama therapists don’t do ! He was very professional, friendly, used the perfect amount of pressure and targeted all the right areas and spent the right amount of time required in order to feel rejuvenated. Even got given a bottle of water at the end to promote the hydration required after such a session, great touch.\n\nPrice is very competitive, and worth every penny, will differently be using them again\n\nMany thanks !",
    "shortExcerpt": "I’ve have 2-3 Hijama sessions (Dry & Wet Cupping) a year, and through that have experienced different therapists/practitioners. My therapist arrived on time, came equipped and went…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "massage",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Massage",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Cupping/Hijama + Massage",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1019
  },
  {
    "id": "review-020",
    "originalIndex": 20,
    "reviewerName": "Omar Sultan",
    "rating": 5,
    "dateLabel": "8 months ago",
    "text": "Excellent first time experience. Nadim was great, experienced. 100% recommend",
    "shortExcerpt": "Excellent first time experience. Nadim was great, experienced. 100% recommend",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "repeat-clients"
    ],
    "serviceTags": [
      "General Rahma Therapy Experience"
    ],
    "inferredServiceCategory": "General Rahma Therapy Experience",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Review-carousel testimonial",
    "recommendedUsage": "Review carousel or slider",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1020
  },
  {
    "id": "review-021",
    "originalIndex": 21,
    "reviewerName": "Hammad Gilani",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "These guys are very Polite, Professional and committed. They booked my session at such a short notice and gave me very useful briefing prior to Hijama and shared aftercare informatiom too which came handy. I'll definitely refer them for massage and Cupping services.",
    "shortExcerpt": "These guys are very Polite, Professional and committed. They booked my session at such a short notice and gave me very useful briefing prior to Hijama and shared aftercare informatiom…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "massage",
      "professional-explained"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Massage",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Cupping/Hijama + Massage",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1021
  },
  {
    "id": "review-022",
    "originalIndex": 22,
    "reviewerName": "Hassanur Rahman",
    "rating": 5,
    "dateLabel": "3 years ago",
    "text": "Very professional and friendly, got cupping done due to body pains from training martial arts. This has definitely helped my recovery i feel so much more stronger and confident in training. I would recommend everyone to try this and mark my words you will not be disappointed!",
    "shortExcerpt": "Very professional and friendly, got cupping done due to body pains from training martial arts. This has definitely helped my recovery i feel so much more stronger and confident in…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1022
  },
  {
    "id": "review-023",
    "originalIndex": 23,
    "reviewerName": "Habib Ullah",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Very professional, extremely organised and prepared. I was a bit anxious at first, however, my therapist was very thorough in going through all the details with me step by step, which made me feel at ease.\n\nI will definitely be a returning customer and will recommend to all, my wife will be getting her back done soon.\n\nThank you.",
    "shortExcerpt": "Very professional, extremely organised and prepared. I was a bit anxious at first, however, my therapist was very thorough in going through all the details with me step by step, which…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "first-time",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1023
  },
  {
    "id": "review-024",
    "originalIndex": 24,
    "reviewerName": "Haroon Chaudry",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Had pain in my left shoulder for 2/3+ months. Pain through workouts that involved my shoulder directly. They had also done a massage too which took out some of the pain. My shoulder now feels much lighter and much more free straight after the blood cupping was done.  👍🏼 Highly recommended, extremely professional and knowledgeable.",
    "shortExcerpt": "Had pain in my left shoulder for 2/3+ months. Pain through workouts that involved my shoulder directly. They had also done a massage too which took out some of the pain. My shoulder…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "massage",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Massage",
      "Pain Relief/Injury Recovery",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Cupping/Hijama + Massage",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1024
  },
  {
    "id": "review-025",
    "originalIndex": 25,
    "reviewerName": "Nurun Ali",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Our experience with Rahima Therapy was very pleasant.  Very professional service provided.  The therapist was very communicative and totally made us feel at ease.  Very accommodating in meeting individual timing.  Jazakallah  Rahma Therapy.  We will be contacting you again soon.",
    "shortExcerpt": "Our experience with Rahima Therapy was very pleasant. Very professional service provided. The therapist was very communicative and totally made us feel at ease. Very accommodating in…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1025
  },
  {
    "id": "review-026",
    "originalIndex": 26,
    "reviewerName": "Manish Panjabi",
    "rating": 5,
    "dateLabel": "2 years ago",
    "text": "Amazing! My back was hurting and I could not sleep through the night. The graston therapy was exactly what was required for the muscle spasm or trapped nerve. Feels like all the pain has gone away in just 1 session. The technique used was perfect to release the tension and the cupping was the icing on the cake to release the stress. Really liked the session and will highly recommend the service. Thankyou very much for the excellent service. You are a 🌟 brother Nadim. HIGHLY RECOMMENDED!",
    "shortExcerpt": "Amazing! My back was hurting and I could not sleep through the night. The graston therapy was exactly what was required for the muscle spasm or trapped nerve. Feels like all the pain…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "repeat-clients",
      "supreme-combo-graston"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1026
  },
  {
    "id": "review-027",
    "originalIndex": 27,
    "reviewerName": "Hussnain Mohyuddin",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Contacted the brothers regarding my acl tear. Advised on what to do, got me booked in ASAP with great communication. Friendly service and pain free. Felt an instant difference Once the Hijama was complete.\n\nCouldn’t recommend more!",
    "shortExcerpt": "Contacted the brothers regarding my acl tear. Advised on what to do, got me booked in ASAP with great communication. Friendly service and pain free. Felt an instant difference Once the…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Service-page testimonial",
    "recommendedUsage": "Service-specific page (hijama, massage, pain relief)",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1027
  },
  {
    "id": "review-028",
    "originalIndex": 28,
    "reviewerName": "Sadia Malik",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "I had my very first hijama with sister Fahima yesterday and received exceptional service. Very warm and friendly at the same time professional and knowledgeable about the whole process, she instantly made me feel relaxed. I will definitely be booking further sessions for myself and other members of my family.",
    "shortExcerpt": "I had my very first hijama with sister Fahima yesterday and received exceptional service. Very warm and friendly at the same time professional and knowledgeable about the whole…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "hijama-cupping",
      "professional-explained"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1028
  },
  {
    "id": "review-029",
    "originalIndex": 29,
    "reviewerName": "Irfan Saleem",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "I got a next day appointment for myself and the Mrs, the experience was exceptional, very knowledgeable, professional and hygienic brothers. JazakAllah khair for accomodating me 😃\n\nI will definitely be booking again and highly recommend those who are looking for Hijama/cupping in the Luton area to check out Rahma Therapy for treatment in the comfort of your own home.",
    "shortExcerpt": "I got a next day appointment for myself and the Mrs, the experience was exceptional, very knowledgeable, professional and hygienic brothers. JazakAllah khair for accomodating me 😃 I…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "home-visits",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1029
  },
  {
    "id": "review-030",
    "originalIndex": 30,
    "reviewerName": "arshed siddiquee",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "The therapist was very polite and professional. He talked me through what was happening at every stage of the process. I had lower back pain before the session that was bugging me for a while and felt instant relief after the session. Would recommend to everyone as this service has many health benefits.",
    "shortExcerpt": "The therapist was very polite and professional. He talked me through what was happening at every stage of the process. I had lower back pain before the session that was bugging me for…",
    "source": "Google Reviews",
    "categories": [
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Pain Relief / Injury Recovery",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1030
  },
  {
    "id": "review-031",
    "originalIndex": 31,
    "reviewerName": "Absz M",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Had an amazing experience with rahma therapy. They are very professional with their approach and got back to me quickly. They catered my needs fabulously and their work really did make a difference. Highly recommend them for both brothers and sisters. Exceptional service and had a great time!!",
    "shortExcerpt": "Had an amazing experience with rahma therapy. They are very professional with their approach and got back to me quickly. They catered my needs fabulously and their work really did make…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1031
  },
  {
    "id": "review-032",
    "originalIndex": 32,
    "reviewerName": "Akmal Qamar",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "First time getting hijama done. Alhamdulillah it went well. I was explained everything that would happen to me in detail, including how to prepare for the session and after care. Very respectful and hygienic. Would recommend to anyone looking to get cupping done, definitely my go to from now on Insha’Allah",
    "shortExcerpt": "First time getting hijama done. Alhamdulillah it went well. I was explained everything that would happen to me in detail, including how to prepare for the session and after care. Very…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Service-page testimonial",
    "recommendedUsage": "Service-specific page (hijama, massage, pain relief)",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1032
  },
  {
    "id": "review-033",
    "originalIndex": 33,
    "reviewerName": "Rahath Ahmed",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Booked a session in for me and my father, booking was easy great communication and the service was outstanding. It was my first time trying Hijama, it was really relaxing and your muscles feel amazing at the end of the session. Will definitely be back soon!",
    "shortExcerpt": "Booked a session in for me and my father, booking was easy great communication and the service was outstanding. It was my first time trying Hijama, it was really relaxing and your…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "pain-recovery",
      "professional-explained"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1033
  },
  {
    "id": "review-034",
    "originalIndex": 34,
    "reviewerName": "sufian khan",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Firstly, I would like to thank RahmaTherepyLuton for the outstanding service. They made me feel comfortable as I was scared because it was my first time. It was in the comfort of my own home. I really appreciated the professionalism. I was reassured constantly and provided with some aftercare info. Definitely going to book again!",
    "shortExcerpt": "Firstly, I would like to thank RahmaTherepyLuton for the outstanding service. They made me feel comfortable as I was scared because it was my first time. It was in the comfort of my…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "first-time",
      "home-visits",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1034
  },
  {
    "id": "review-035",
    "originalIndex": 35,
    "reviewerName": "Owen Phillips",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "First session with Rahma Therapy - the service was great from booking all the way to the cupping itself. Minhajur made sure I was comfortable at all times and not once did the session feel rushed. Definitely felt the benefits from the supreme combo package, highly recommend!",
    "shortExcerpt": "First session with Rahma Therapy - the service was great from booking all the way to the cupping itself. Minhajur made sure I was comfortable at all times and not once did the session…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "repeat-clients",
      "supreme-combo-graston"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1035
  },
  {
    "id": "review-036",
    "originalIndex": 36,
    "reviewerName": "A D",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "My mum and I had Faheema as our therapist. Faheema was very clear on the process as this was our first time having cupping and the hijama therapy. Furthermore, she listened to our problems and explained the areas she was going to target and why. Very professional and made us feel very welcome! The company were clear on what to do before and after the session. Definitely feel better after the treatment. Highly recommend!!",
    "shortExcerpt": "My mum and I had Faheema as our therapist. Faheema was very clear on the process as this was our first time having cupping and the hijama therapy. Furthermore, she listened to our…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1036
  },
  {
    "id": "review-037",
    "originalIndex": 37,
    "reviewerName": "Bashir Ali",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Rahma Therapy is an actual quality service for Hijama and general well being services.\nI have used them before and as soon as I slept after the session, all my gym/injury pains disappeared.\n\nNot only this, but they come to you, which is very useful especially considering covid.\n\nWould definitely recommend them, and I also plan on using them again",
    "shortExcerpt": "Rahma Therapy is an actual quality service for Hijama and general well being services. I have used them before and as soon as I slept after the session, all my gym/injury pains…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1037
  },
  {
    "id": "review-038",
    "originalIndex": 38,
    "reviewerName": "Nasrul Gani",
    "rating": 5,
    "dateLabel": "Edited 4 years ago",
    "text": "Alhamdulillah, amazing service again from Rahma Therapy. I felt at ease, nothing to worry about, everything was well explained to me and I am already feeling the positive effects of the hijama. I was treated for IBS and lower back pain. Highly recommend, the service is second to none.",
    "shortExcerpt": "Alhamdulillah, amazing service again from Rahma Therapy. I felt at ease, nothing to worry about, everything was well explained to me and I am already feeling the positive effects of…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1038
  },
  {
    "id": "review-039",
    "originalIndex": 39,
    "reviewerName": "A W",
    "rating": 5,
    "dateLabel": "3 years ago",
    "text": "My Calf and hamstrings were in pain.\nI was going to wait till after Ramadan to do something about it, but the pain was getting too much.\n\nI explained my symptoms to the brother and he recommended a treatment.\nI Opted to go for the supreme combo package.\n\nWhilst fasting, I didn't know what to really expect - and how the treatment will effect my body while in a fasting state.\n\nSurprisingly, it wasnt too bad getting cupping done while I was fasting.\n\nI actually felt good afterwards, and I felt it was actually more effective getting treatment done while fasting.",
    "shortExcerpt": "My Calf and hamstrings were in pain. I was going to wait till after Ramadan to do something about it, but the pain was getting too much. I explained my symptoms to the brother and he…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients",
      "supreme-combo-graston"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Service-page testimonial",
    "recommendedUsage": "Service-specific page (hijama, massage, pain relief)",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1039
  },
  {
    "id": "review-040",
    "originalIndex": 40,
    "reviewerName": "Suhail Shaukat",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "I had my Cupping therapy on 08/04/2021. The therapist was very professional and had excellent knowledge. The treatment lasted 60 minutes, he talk through what he was doing and why he was doing it. Explained the health benefits and diet improvement advice.\nI have no hesitation in recommending Rehma Therapy.",
    "shortExcerpt": "I had my Cupping therapy on 08/04/2021. The therapist was very professional and had excellent knowledge. The treatment lasted 60 minutes, he talk through what he was doing and why he…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1040
  },
  {
    "id": "review-041",
    "originalIndex": 41,
    "reviewerName": "Sohail Ahmed",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Such an amazing Hijama session with Rahma Therapy today, it was a very pleasant and comfortable experience.  Great professional service and have already booked again.  Highly recommended.",
    "shortExcerpt": "Such an amazing Hijama session with Rahma Therapy today, it was a very pleasant and comfortable experience. Great professional service and have already booked again. Highly recommended.",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1041
  },
  {
    "id": "review-042",
    "originalIndex": 42,
    "reviewerName": "Mohammed Rahman",
    "rating": 5,
    "dateLabel": "3 years ago",
    "text": "The brother was very friendly and the service he provided it was simply amazing. After the first session I felt much better with my back pain. Alhamdulillah will do more sessions with Rahma Therapy.",
    "shortExcerpt": "The brother was very friendly and the service he provided it was simply amazing. After the first session I felt much better with my back pain. Alhamdulillah will do more sessions with…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "pain-recovery"
    ],
    "serviceTags": [
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Pain Relief / Injury Recovery",
    "reviewTypeCategory": "Pain relief outcome",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1042
  },
  {
    "id": "review-043",
    "originalIndex": 43,
    "reviewerName": "Shakeir Ahmed",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "The guys made me feel comfortable and ease throughout the whole experience. I was a little nervous at first and wasn't sure what to expect but the guys constantly communicated to me what was going on throughout the cupping treatment and I felt no pain! These guys clearly know their stuff and my back pain has improved so much from one session!! I will be going back to here!! Thank you guys so much",
    "shortExcerpt": "The guys made me feel comfortable and ease throughout the whole experience. I was a little nervous at first and wasn't sure what to expect but the guys constantly communicated to me…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "pain-recovery",
      "professional-explained"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Pain relief outcome",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1043
  },
  {
    "id": "review-044",
    "originalIndex": 44,
    "reviewerName": "Sebastian N.",
    "rating": 5,
    "dateLabel": "8 months ago",
    "text": "Great service, awesome chit-chat, and best of all — pain relief! Can’t recommend them enough!!",
    "shortExcerpt": "Great service, awesome chit-chat, and best of all — pain relief! Can’t recommend them enough!!",
    "source": "Google Reviews",
    "categories": [
      "pain-recovery",
      "repeat-clients"
    ],
    "serviceTags": [
      "Pain Relief/Injury Recovery",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Pain Relief / Injury Recovery",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Review-carousel testimonial",
    "recommendedUsage": "Review carousel or slider",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1044
  },
  {
    "id": "review-045",
    "originalIndex": 45,
    "reviewerName": "Usman Zafar",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "My first time using their services and I can honestly say from the first call I made to enquire I was made to feel at ease and the treatment was great and I was totally relaxed! Its been 2 days since my treatment and alhamdulillah I feel great and cannot wait till my next session!",
    "shortExcerpt": "My first time using their services and I can honestly say from the first call I made to enquire I was made to feel at ease and the treatment was great and I was totally relaxed! Its…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "repeat-clients"
    ],
    "serviceTags": [
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Male Therapist Option",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Review-carousel testimonial",
    "recommendedUsage": "Review carousel or slider",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1045
  },
  {
    "id": "review-046",
    "originalIndex": 46,
    "reviewerName": "Aqil Ali",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "I used Rahma Therapy to help with my rehabilitation after a shoulder surgery. The cupping therapy genuinely improved my mobility and reduced stiffness almost instantly after my session. Highly recommend!",
    "shortExcerpt": "I used Rahma Therapy to help with my rehabilitation after a shoulder surgery. The cupping therapy genuinely improved my mobility and reduced stiffness almost instantly after my…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1046
  },
  {
    "id": "review-047",
    "originalIndex": 47,
    "reviewerName": "Dark 123",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "First time having sister Faheema for my session of hijama. Was a really good informative session. She asked some questions and was willing to listen to my concerns for some health issues I was having. Alhamdulillah she asked during each  Wil hopefully be booking her again when i need.step if everything was OK and had a good conversation with her too.",
    "shortExcerpt": "First time having sister Faheema for my session of hijama. Was a really good informative session. She asked some questions and was willing to listen to my concerns for some health…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "first-time",
      "hijama-cupping",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Review-carousel testimonial",
    "recommendedUsage": "Review carousel or slider",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1047
  },
  {
    "id": "review-048",
    "originalIndex": 48,
    "reviewerName": "mohammed Shahim",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "The brother was very professional and punctual.\nFeeling very good after the session.\nThe fact that they are mobile is definitely a plus point.\nHighly recommend to anyone looking to have cupping/hijama therapy.\nKeep up the good work!",
    "shortExcerpt": "The brother was very professional and punctual. Feeling very good after the session. The fact that they are mobile is definitely a plus point. Highly recommend to anyone looking to…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "home-visits",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Mobile Home Visit",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1048
  },
  {
    "id": "review-049",
    "originalIndex": 49,
    "reviewerName": "Hina Shafi",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Rahma Therepy made me feel comfortable as I was really nervous. They explained in depth the benefits of the different cups and how they will help with my pain. I was informed about each step before it occurred- this put me at ease.\n\nAfter the session, I was given a water bottle and a date, along with some aftercare info. They definitely exceeded my expectations! I will be booking again",
    "shortExcerpt": "Rahma Therepy made me feel comfortable as I was really nervous. They explained in depth the benefits of the different cups and how they will help with my pain. I was informed about…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1049
  },
  {
    "id": "review-050",
    "originalIndex": 50,
    "reviewerName": "Mohammed Mahedi",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "First ever Hijama session done! I must say, the level of professionalism was quality, reassured me through the session to see if I’m doing well and most importantly, the section that I got my cupping done on , I feel there’s improvements already\n\nI will definitely be booking again 👍👍👍👍",
    "shortExcerpt": "First ever Hijama session done! I must say, the level of professionalism was quality, reassured me through the session to see if I’m doing well and most importantly, the section that I…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1050
  },
  {
    "id": "review-051",
    "originalIndex": 51,
    "reviewerName": "Ali Malik",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "This was my first time having a session with Rahma therapy. I can honestly say, as a professional athlete, this was the most informative and relaxing cupping (hijama) session I have ever experienced. The brother was very reassuring about the treatment and answered all questions with regards to before, during and after care treatment. I highly recommend Rahma therapy to anyone looking for a general detox or to ease muscle tension.",
    "shortExcerpt": "This was my first time having a session with Rahma therapy. I can honestly say, as a professional athlete, this was the most informative and relaxing cupping (hijama) session I have…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1051
  },
  {
    "id": "review-052",
    "originalIndex": 52,
    "reviewerName": "Gary Towsey",
    "rating": 4,
    "dateLabel": "5 years ago",
    "text": "Great service really friendly and the therapy is secind to none, never felt so good to lift weights loosened up my whole body,  would recommend to anyone suffering with pain or just needs to detox there body. The fire cupping and dry cupping treatment worked so much better than general massage for me.\nThank you so much will be in touch in the near future\nGary",
    "shortExcerpt": "Great service really friendly and the therapy is secind to none, never felt so good to lift weights loosened up my whole body, would recommend to anyone suffering with pain or just…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "massage",
      "pain-recovery",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Massage",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Cupping/Hijama + Massage",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Not recommended",
    "recommendedUsage": "Not recommended for website",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1052
  },
  {
    "id": "review-053",
    "originalIndex": 53,
    "reviewerName": "Zee Khan",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Professional, informative and on time!\n\nI have been struggling with upper back and neck pain for a number of weeks. Many restless nights and lack of general mobility. I had been treating  the pain applying heat patches, ice packs and the ocassional massarge only providing mild relief before the ache and trapped nerve pain returned.\nRahma Therapy was able to give me a same day appointment. The representative thay atrended my residence was punctual, polite and very attentive.\nI was advised on a treatment plan and all the benefits that would come from opting for Wet Cupping. I felt at ease and very comfortbale with the information provided. I felt instant relief and welcomed the return of greater mobility in my neck and shoulders.\n\nI opted for the Supreme Combo Package. This began with some stretching followed by some deeper tissue work through Granston Therapy. The representative proceeded to massarge the troubled area with oil and some fire cupping. Moving the cup along my back and shoulder muscle loosening it providing great relief. This ended with multiple cups being applied and blood extracted from the area in question.\n\nThey were highly recommended and they did not disappoint!",
    "shortExcerpt": "Professional, informative and on time! I have been struggling with upper back and neck pain for a number of weeks. Many restless nights and lack of general mobility. I had been…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients",
      "supreme-combo-graston"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1053
  },
  {
    "id": "review-054",
    "originalIndex": 54,
    "reviewerName": "Adil M",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Excellent service from brother Minhaj. Alhumdulillah felt a difference immediately after the cupping session. Ive tried cupping from various places and can say Rahma Therapy is outstanding from start to finish. In sha Allah will be re booking very soon. Jzk",
    "shortExcerpt": "Excellent service from brother Minhaj. Alhumdulillah felt a difference immediately after the cupping session. Ive tried cupping from various places and can say Rahma Therapy is…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "General positive praise",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1054
  },
  {
    "id": "review-055",
    "originalIndex": 55,
    "reviewerName": "mohammed Khan",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "First every time trying hijama, was an amazing experience. The brother spoke me through the whole procedure step by step. Whole Procedure was comfortable and i can already feel the benefit it had done to my body. Highly recommend.",
    "shortExcerpt": "First every time trying hijama, was an amazing experience. The brother spoke me through the whole procedure step by step. Whole Procedure was comfortable and i can already feel the…",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1055
  },
  {
    "id": "review-056",
    "originalIndex": 56,
    "reviewerName": "Keiron Boyce",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "The treatment that I had from Rahma Therapy was first rate. I had multiple ailments and areas of stiffness along my back that have been remedied. My neck mobility is now as good as it has been in years. The specialist that treated me was extremely knowledgeable, very detailed with his explanation of the varying steps of the treatment and thoroughly professional throughout. This has to be an essential part of body maintenance going forward.\n\nI can’t thank the team enough!",
    "shortExcerpt": "The treatment that I had from Rahma Therapy was first rate. I had multiple ailments and areas of stiffness along my back that have been remedied. My neck mobility is now as good as it…",
    "source": "Google Reviews",
    "categories": [
      "pain-recovery",
      "professional-explained"
    ],
    "serviceTags": [
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Pain Relief / Injury Recovery",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1056
  },
  {
    "id": "review-057",
    "originalIndex": 57,
    "reviewerName": "Usman Ali",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "VERY PROFESSIONAL. Really liked the communication before the appointment and the information provided for aftercare.\n\nBooked due to lower back pain and can already feel the affects of the massage and the cupping therapy",
    "shortExcerpt": "VERY PROFESSIONAL. Really liked the communication before the appointment and the information provided for aftercare. Booked due to lower back pain and can already feel the affects of…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "massage",
      "pain-recovery",
      "professional-explained"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Massage",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Cupping/Hijama + Massage",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1057
  },
  {
    "id": "review-058",
    "originalIndex": 58,
    "reviewerName": "Humza",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Amazing experience, Hijama specialist knew exactly what he was doing. Gave me lots of knowledge about the benefits and the science behind it. Really pleased with the overall experience, will 100% be going back.",
    "shortExcerpt": "Amazing experience, Hijama specialist knew exactly what he was doing. Gave me lots of knowledge about the benefits and the science behind it. Really pleased with the overall…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "General positive praise",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1058
  },
  {
    "id": "review-059",
    "originalIndex": 59,
    "reviewerName": "Forid Uddin",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "The service and experience I received was 10/10. Brother Minhajur was professional throughout the entire session. He was very knowledgeable and explained every step of the session. I will definitely book myself in again in a couple months.",
    "shortExcerpt": "The service and experience I received was 10/10. Brother Minhajur was professional throughout the entire session. He was very knowledgeable and explained every step of the session. I…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1059
  },
  {
    "id": "review-060",
    "originalIndex": 60,
    "reviewerName": "TTV_Total8Ultra",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Ladies are so professional and communicate every action, prior to conducting it. After months of aches and sleepless nights, I finally slept like a baby. Would definitely recommend them and will seek their hijama services again!",
    "shortExcerpt": "Ladies are so professional and communicate every action, prior to conducting it. After months of aches and sleepless nights, I finally slept like a baby. Would definitely recommend…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1060
  },
  {
    "id": "review-061",
    "originalIndex": 61,
    "reviewerName": "Moahmmed Miah",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Excellent professional service. Three people in my family have received treatment from Rahma Therapy and all three have reported positive changes health wise. Highly recommend Rahma Therapy. جزاك الله خيرًا",
    "shortExcerpt": "Excellent professional service. Three people in my family have received treatment from Rahma Therapy and all three have reported positive changes health wise. Highly recommend Rahma…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1061
  },
  {
    "id": "review-062",
    "originalIndex": 62,
    "reviewerName": "Saqib Hussain",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Had a great experience from contacting Rahma therapy and booking myself in all the way to the treatment itself. I would recommend this to everyone and anyone! Inshallah will carry on with regular treatments with these guys!",
    "shortExcerpt": "Had a great experience from contacting Rahma therapy and booking myself in all the way to the treatment itself. I would recommend this to everyone and anyone! Inshallah will carry on…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Service-page testimonial",
    "recommendedUsage": "Service-specific page (hijama, massage, pain relief)",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1062
  },
  {
    "id": "review-063",
    "originalIndex": 63,
    "reviewerName": "Mohammed Khan",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "An absolutely great experience from the team at Rahma Therapy. Answered all my questions and made me feel comfortable and at ease. Very professional too. I will definitely be coming back!",
    "shortExcerpt": "An absolutely great experience from the team at Rahma Therapy. Answered all my questions and made me feel comfortable and at ease. Very professional too. I will definitely be coming…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "pain-recovery",
      "professional-explained"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1063
  },
  {
    "id": "review-064",
    "originalIndex": 64,
    "reviewerName": "Saghar Najib",
    "rating": 5,
    "dateLabel": "2 years ago",
    "text": "Thank you sis Rahma\nIt was beautiful experience as i had really back pain the way she explained the treatment was incredible. she was so nice and friendly and I already feel better jazakhallah khair",
    "shortExcerpt": "Thank you sis Rahma It was beautiful experience as i had really back pain the way she explained the treatment was incredible. she was so nice and friendly and I already feel better…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "pain-recovery",
      "professional-explained"
    ],
    "serviceTags": [
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Pain Relief / Injury Recovery",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1064
  },
  {
    "id": "review-065",
    "originalIndex": 65,
    "reviewerName": "Jay Khan",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "had a very pleasant experience. On time arrival, email confirmations, equipment, hygiene , the actual therapy everything was top notch. Highly recommended. Will definitely be using their service again.",
    "shortExcerpt": "had a very pleasant experience. On time arrival, email confirmations, equipment, hygiene , the actual therapy everything was top notch. Highly recommended. Will definitely be using…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1065
  },
  {
    "id": "review-066",
    "originalIndex": 66,
    "reviewerName": "Amran Ali",
    "rating": 5,
    "dateLabel": "Edited 2 years ago",
    "text": "Just had supreme package done very professional and knowledgeable on the subject of Hijama. Will definitely book again!",
    "shortExcerpt": "Just had supreme package done very professional and knowledgeable on the subject of Hijama. Will definitely book again!",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "professional-explained",
      "repeat-clients",
      "supreme-combo-graston"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1066
  },
  {
    "id": "review-067",
    "originalIndex": 67,
    "reviewerName": "R Ahmed",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Very professional service. Great price. Had terrible neck pains the cupping and graston therapy has definitely eased the pain  and loosened up my stiff neck. Defiently recommend",
    "shortExcerpt": "Very professional service. Great price. Had terrible neck pains the cupping and graston therapy has definitely eased the pain and loosened up my stiff neck. Defiently recommend",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "professional-explained",
      "repeat-clients",
      "supreme-combo-graston"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1067
  },
  {
    "id": "review-068",
    "originalIndex": 68,
    "reviewerName": "Shohab Ahmed",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "I just had my cupping done and it was the best feeling and the person who did my cupping was very friendly and calm. He has a lot of experience with this. He took it step by step in a calm and relaxing manner.",
    "shortExcerpt": "I just had my cupping done and it was the best feeling and the person who did my cupping was very friendly and calm. He has a lot of experience with this. He took it step by step in a…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "professional-explained"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Friendly service",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1068
  },
  {
    "id": "review-069",
    "originalIndex": 69,
    "reviewerName": "nedžad kalić",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Excellent experience. Brothers and sisters were very professional and friendly. Would 100% recommend them.\n\nLooking forward to having hijamah done again by them.",
    "shortExcerpt": "Excellent experience. Brothers and sisters were very professional and friendly. Would 100% recommend them. Looking forward to having hijamah done again by them.",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1069
  },
  {
    "id": "review-070",
    "originalIndex": 70,
    "reviewerName": "saiful alam",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Friendly Therapist, great communication. Had a great experience doing Hijama first time would recommend to anyone.",
    "shortExcerpt": "Friendly Therapist, great communication. Had a great experience doing Hijama first time would recommend to anyone.",
    "source": "Google Reviews",
    "categories": [
      "first-time",
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Trust-section testimonial",
    "recommendedUsage": "Trust/credibility section",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1070
  },
  {
    "id": "review-071",
    "originalIndex": 71,
    "reviewerName": "zain ali mahmood",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Amazing service and very knowledgeable. Got hijamah done for myself and mother and both male and female were amazing. Would definitely get it done again and recommend to others",
    "shortExcerpt": "Amazing service and very knowledgeable. Got hijamah done for myself and mother and both male and female were amazing. Would definitely get it done again and recommend to others",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1071
  },
  {
    "id": "review-072",
    "originalIndex": 72,
    "reviewerName": "Sadia",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Thank you to the lovely Faheemah for doing my first Hijama/cupping session I had such a relaxing yet educational experience and will definitely be booking you again.",
    "shortExcerpt": "Thank you to the lovely Faheemah for doing my first Hijama/cupping session I had such a relaxing yet educational experience and will definitely be booking you again.",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "hijama-cupping",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1072
  },
  {
    "id": "review-073",
    "originalIndex": 73,
    "reviewerName": "Saniya Hussain",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Excellent service from the female hijama therapist faheeba my mum was in bed for 10days suffering with sciatica after her first cupping session she felt much better and walking after the first treatment fabeeha came home with all the equipment and did a  massage before doing dry cupping\nVery professional at what she does and does a great job\nDefinitely recommend them and will be using again\nThankyou",
    "shortExcerpt": "Excellent service from the female hijama therapist faheeba my mum was in bed for 10days suffering with sciatica after her first cupping session she felt much better and walking after…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "first-time",
      "hijama-cupping",
      "home-visits",
      "massage",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Massage",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Cupping/Hijama + Massage",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1073
  },
  {
    "id": "review-074",
    "originalIndex": 74,
    "reviewerName": "Waseem Azam",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Highly recommended, I have recently started getting hijama from Rahma therapy and the service they provide is amazing, from the comfort of your own home I will definitely be booking sessions on a regular basis, thanks to the brothers who came out , they make you feel very comfortable and explain everything in detail before and while the sessions are going on, always reassuring you.",
    "shortExcerpt": "Highly recommended, I have recently started getting hijama from Rahma therapy and the service they provide is amazing, from the comfort of your own home I will definitely be booking…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "home-visits",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1074
  },
  {
    "id": "review-075",
    "originalIndex": 75,
    "reviewerName": "Asma Kamal",
    "rating": 5,
    "dateLabel": "5 years ago",
    "text": "Fantastic service, would highly recommend.\nVery proffessional and great knowledge.\n\nPut me as ease from the beggining, was happy to answer all my questions. Explained step by step. So glad i found rahma therapy.\nWould be booking again for more cupping. 5 star service.",
    "shortExcerpt": "Fantastic service, would highly recommend. Very proffessional and great knowledge. Put me as ease from the beggining, was happy to answer all my questions. Explained step by step. So…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1075
  },
  {
    "id": "review-076",
    "originalIndex": 76,
    "reviewerName": "Shahida Rahman",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Great service, felt very comfortable and welcomed by Faheemah. Went to a few other places for cupping and massage in Luton, glad to say none other come close. Thank you very much!",
    "shortExcerpt": "Great service, felt very comfortable and welcomed by Faheemah. Went to a few other places for cupping and massage in Luton, glad to say none other come close. Thank you very much!",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "hijama-cupping",
      "massage"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Massage",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Cupping/Hijama + Massage",
    "reviewTypeCategory": "Islamic/modesty/privacy comfort",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1076
  },
  {
    "id": "review-077",
    "originalIndex": 77,
    "reviewerName": "Juhel Miah",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Very Knowledgeable staff, makes you feel relaxed at all times. Amazing experience and will be looking to book further cupping session. Would highly recommend.",
    "shortExcerpt": "Very Knowledgeable staff, makes you feel relaxed at all times. Amazing experience and will be looking to book further cupping session. Would highly recommend.",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1077
  },
  {
    "id": "review-078",
    "originalIndex": 78,
    "reviewerName": "Ahseem Khan",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Had brother nadeem provide the cupping service. Very well equipped and good knowledge. One session has already made a difference! Jzk",
    "shortExcerpt": "Had brother nadeem provide the cupping service. Very well equipped and good knowledge. One session has already made a difference! Jzk",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "professional-explained"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "General positive praise",
    "websiteStrength": "Review-carousel testimonial",
    "recommendedUsage": "Review carousel or slider",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1078
  },
  {
    "id": "review-079",
    "originalIndex": 79,
    "reviewerName": "Mohammed Miah",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Recommend him to everyone good deep tissue massage along with cupping I couldn’t stand or walk after one session more flexible pain has come down honestly best in the game",
    "shortExcerpt": "Recommend him to everyone good deep tissue massage along with cupping I couldn’t stand or walk after one session more flexible pain has come down honestly best in the game",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "massage",
      "pain-recovery",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Massage",
      "Pain Relief/Injury Recovery",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Cupping/Hijama + Massage",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1079
  },
  {
    "id": "review-080",
    "originalIndex": 80,
    "reviewerName": "Ali Ahamed",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "this is a only alternate therpey treatement for many health problems ,\npain reduction,boost the immune system ,elimination of toxins trapped in the tissues by cupping also makes feels better...etc",
    "shortExcerpt": "this is a only alternate therpey treatement for many health problems , pain reduction,boost the immune system ,elimination of toxins trapped in the tissues by cupping also makes feels…",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Pain Relief/Injury Recovery",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Pain relief outcome",
    "websiteStrength": "Review-carousel testimonial",
    "recommendedUsage": "Review carousel or slider",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1080
  },
  {
    "id": "review-081",
    "originalIndex": 81,
    "reviewerName": "Shakeel Ahmed",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Amazing experience, with the brother providing me a lot of knowledge on the whole cupping procedure. Back and shoulder feels much better already",
    "shortExcerpt": "Amazing experience, with the brother providing me a lot of knowledge on the whole cupping procedure. Back and shoulder feels much better already",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Female Therapist Option",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Pain relief outcome",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "medium",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1081
  },
  {
    "id": "review-082",
    "originalIndex": 82,
    "reviewerName": "SPECIALISTSAJ",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Very Respectfull And Intelligent Person Who Did My Cuppin...💯 I Honestly Recommend Evryone To Try.. No Pain And Completely Comfortable... 👍Our Beloved Prophet Practise It.. So Do It! 💯😉",
    "shortExcerpt": "Very Respectfull And Intelligent Person Who Did My Cuppin...💯 I Honestly Recommend Evryone To Try.. No Pain And Completely Comfortable... 👍Our Beloved Prophet Practise It.. So Do It! 💯😉",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "pain-recovery",
      "repeat-clients"
    ],
    "serviceTags": [
      "Pain Relief/Injury Recovery",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Pain Relief / Injury Recovery",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1082
  },
  {
    "id": "review-083",
    "originalIndex": 83,
    "reviewerName": "Ajay Memhi",
    "rating": 5,
    "dateLabel": "3 years ago",
    "text": "Great experience, felt amazing afterwards and relaxed as ever. Would recommend the cupping 100% 👍🏽 …",
    "shortExcerpt": "Great experience, felt amazing afterwards and relaxed as ever. Would recommend the cupping 100% 👍🏽 …",
    "source": "Google Reviews",
    "categories": [
      "hijama-cupping",
      "repeat-clients"
    ],
    "serviceTags": [
      "Cupping/Hijama",
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Hijama / Wet Cupping",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Review-carousel testimonial",
    "recommendedUsage": "Review carousel or slider",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1083
  },
  {
    "id": "review-084",
    "originalIndex": 84,
    "reviewerName": "Tom Kin786",
    "rating": 5,
    "dateLabel": "3 years ago",
    "text": "Booked sister Faheema for my mum. Was very friendly from what I heard and explained the process in a kind manner. Will defo be booking with Rahmatherapy again.",
    "shortExcerpt": "Booked sister Faheema for my mum. Was very friendly from what I heard and explained the process in a kind manner. Will defo be booking with Rahmatherapy again.",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Professionalism/trust",
    "websiteStrength": "Trust-section testimonial",
    "recommendedUsage": "Trust/credibility section",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1084
  },
  {
    "id": "review-085",
    "originalIndex": 85,
    "reviewerName": "Majestic Rides",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "It was a very relaxing session. Being the first time doing this therapy, I was made to very relaxed as every steps were explained to me in details.  A very amazing experience.  Will certainly do it again.",
    "shortExcerpt": "It was a very relaxing session. Being the first time doing this therapy, I was made to very relaxed as every steps were explained to me in details. A very amazing experience. Will…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "first-time",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "First-time customer reassurance",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1085
  },
  {
    "id": "review-086",
    "originalIndex": 86,
    "reviewerName": "Azeem Raja",
    "rating": 5,
    "dateLabel": "Edited 5 years ago",
    "text": "My second time at Rahma therapy this time i went for the ramadan detox.. what can i say honestly feel so good and straight away as soon as i got up felt light and good, the brother went through every step in detail of what hes doing explained it all properly from start to finish,  best service  provided definitely will be back after ramadan for another detox well recommended to everyone 👌",
    "shortExcerpt": "My second time at Rahma therapy this time i went for the ramadan detox.. what can i say honestly feel so good and straight away as soon as i got up felt light and good, the brother…",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "pain-recovery",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "high",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1086
  },
  {
    "id": "review-087",
    "originalIndex": 87,
    "reviewerName": "Faiz Ahmed",
    "rating": 5,
    "dateLabel": "3 years ago",
    "text": "Very professional and clean service. Brother explained everything clearly and answered all questions.\n\nWould highly recommend and will use again.",
    "shortExcerpt": "Very professional and clean service. Brother explained everything clearly and answered all questions. Would highly recommend and will use again.",
    "source": "Google Reviews",
    "categories": [
      "female-therapist",
      "professional-explained",
      "repeat-clients"
    ],
    "serviceTags": [
      "Female Therapist Option",
      "Male Therapist Option",
      "Professionalism"
    ],
    "inferredServiceCategory": "Female Therapist Option",
    "reviewTypeCategory": "Strong transformation/result",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1087
  },
  {
    "id": "review-088",
    "originalIndex": 88,
    "reviewerName": "Mr J",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "Amazing service from start to finish. Very detailed explanation about what was happening and ultimately very relaxing and soothing!",
    "shortExcerpt": "Amazing service from start to finish. Very detailed explanation about what was happening and ultimately very relaxing and soothing!",
    "source": "Google Reviews",
    "categories": [
      "general"
    ],
    "serviceTags": [
      "General Rahma Therapy Experience"
    ],
    "inferredServiceCategory": "General Rahma Therapy Experience",
    "reviewTypeCategory": "General positive praise",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1088
  },
  {
    "id": "review-089",
    "originalIndex": 89,
    "reviewerName": "Mumin Chaudhury",
    "rating": 5,
    "dateLabel": "4 years ago",
    "text": "The work is phenomenal, always punctual to my appointments and always make you comfortable every appointment. The most friendly customer service experience you’ll ever receive - 10/10",
    "shortExcerpt": "The work is phenomenal, always punctual to my appointments and always make you comfortable every appointment. The most friendly customer service experience you’ll ever receive - 10/10",
    "source": "Google Reviews",
    "categories": [
      "professional-explained"
    ],
    "serviceTags": [
      "Male Therapist Option"
    ],
    "inferredServiceCategory": "Male Therapist Option",
    "reviewTypeCategory": "Islamic/modesty/privacy comfort",
    "websiteStrength": "Hero-level testimonial",
    "recommendedUsage": "Homepage testimonial or featured case study",
    "riskLevel": "low",
    "visibleByDefault": true,
    "featured": false,
    "featuredReason": "",
    "heroFeatured": false,
    "displayPriority": 1089
  }
];
