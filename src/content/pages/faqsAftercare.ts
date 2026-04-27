import { pageSeoByKey } from "@/content/site/seo";
import type { SiteImageKey } from "@/content/images";
import type { FaqsAftercarePageContent } from "@/types/content";

export const faqsAftercarePageContent = {
  key: "faqs-aftercare",
  seo: pageSeoByKey["faqs-aftercare"],
  hero: {
    eyebrow: "FAQs & Aftercare",
    title: "Feel prepared before and after your mobile therapy visit.",
    description:
      "Find clear answers about booking, home visits, hijama, cupping, massage, therapist options and aftercare.",
    primaryCta: { label: "Book a mobile visit", href: "#book-now" },
    secondaryCta: { label: "Explore services", href: "/services" },
    image: { image: "sharedSessionPractitioner" },
  },
  reassurance: {
    title: "Quick reassurance",
    items: [
      { title: "Mobile service", description: "Rahma Therapy travels to your chosen location in Luton or the surrounding area." },
      { title: "Therapist options", description: "Male and female therapists are available and can be requested when booking." },
      { title: "Clear explanation", description: "Your therapist explains what will happen before treatment begins." },
      { title: "Aftercare included", description: "Aftercare guidance is included so you know what to expect." },
    ],
  },
  beforeAppointment: {
    title: "Before your appointment",
    description:
      "A little preparation helps your appointment feel smoother, calmer and more comfortable. Your therapist will confirm any specific instructions when booking.",
    image: { image: "hijamaCta" },
    items: [
      { title: "Choose a private space", description: "Pick a clean, private area where the therapist can set up and move around comfortably." },
      { title: "Share health information", description: "Mention medical conditions, medication, allergies, pregnancy or skin sensitivity." },
      { title: "Ask before treatment", description: "If you are unsure about hijama, cupping, massage or IASTM, ask before the session begins." },
      { title: "Follow therapist guidance", description: "If specific preparation is needed, follow your therapist's instructions." },
    ],
  },
  aftercare: {
    title: "Aftercare by treatment type",
    description: "Aftercare varies by treatment. Follow your therapist's instructions if they differ from this general guidance.",
    tabs: [
      {
        id: "hijama",
        label: "Hijama",
        title: "Aftercare for Hijama / Wet Cupping",
        description: "Hijama aftercare focuses on keeping the treated area clean and following dressing instructions.",
        items: ["Follow the dressing and aftercare instructions given by your therapist.", "Avoid touching or picking the treated area.", "Contact Rahma Therapy if you are unsure about any aftercare step."],
      },
      {
        id: "dry-cupping",
        label: "Dry Cupping",
        title: "Aftercare for Dry Cupping",
        description: "Dry cupping may leave temporary circular marks or mild tenderness where cups were placed.",
        items: ["Keep the area clean.", "Avoid scratching temporary marks.", "Follow any specific instructions your therapist gives you."],
      },
      {
        id: "fire-cupping",
        label: "Fire Cupping",
        title: "Aftercare for Fire Cupping",
        description: "Fire cupping aftercare should be simple, calm and based on your therapist's guidance.",
        items: ["Follow your therapist's instructions after the session.", "Tell Rahma Therapy if anything feels unusual.", "Avoid adding unsupported aftercare steps."],
      },
      {
        id: "massage",
        label: "Massage",
        title: "Aftercare for Massage Therapy",
        description: "Massage aftercare is generally about comfort and following any personalised guidance.",
        items: ["Follow any guidance your therapist gives you.", "Expect that some tenderness can happen after deeper work.", "Message Rahma Therapy if you are unsure."],
      },
      {
        id: "iastm",
        label: "IASTM",
        title: "Aftercare for IASTM / Graston-Style Therapy",
        description: "IASTM-style therapy may leave temporary tenderness, redness or sensitivity in the area worked on.",
        items: ["Follow your therapist's aftercare instructions.", "Let the therapist know if you have skin sensitivity.", "Ask before treatment if you have concerns."],
      },
    ],
  },
  faq: {
    title: "Full FAQ accordion",
    description: "Search or filter questions by topic.",
    categories: ["All", "Booking", "Treatments", "Therapist Options", "Safety", "Before", "Aftercare", "Pricing"],
    items: [
      { question: "Do you offer mobile appointments?", answer: "Yes. Rahma Therapy is a mobile service, which means your therapist travels to your chosen location in Luton or the surrounding area.", category: "Booking" },
      { question: "How do I book?", answer: "You can book through the website by choosing your treatment, preferred therapist option, preferred time and location details.", category: "Booking" },
      { question: "What treatments do you offer?", answer: "Rahma Therapy offers hijama/wet cupping, dry cupping, fire cupping, massage therapy, IASTM/Graston-style therapy, cupping massage and treatment packages.", category: "Treatments" },
      { question: "Do you offer male and female therapists?", answer: "Yes. Rahma Therapy offers male and female therapist availability. You can request your preferred therapist option when booking.", category: "Therapist Options" },
      { question: "Are the therapists qualified?", answer: "Rahma Therapy presents itself as qualified and licensed in hijama/cupping therapy, with CMA and IPHM approval referenced as text until owner-approved certificate assets exist.", category: "Safety" },
      { question: "What should I tell the therapist before treatment?", answer: "Tell the therapist about medical conditions, medication, allergies, pregnancy, skin conditions, recent illness or anything else that may affect suitability.", category: "Before" },
      { question: "What aftercare should I follow after hijama?", answer: "Follow the aftercare instructions given by your therapist. Keep the treated area clean and contact Rahma Therapy if you are unsure about any step.", category: "Aftercare" },
      { question: "How much do treatments cost?", answer: "Current listed prices are Supreme Combo Package £55, Hijama Package £45, Fire Package £40, and Massage Therapy £40 for 30 minutes or £60 for 1 hour.", category: "Pricing" },
    ],
  },
  safety: {
    title: "When to get help",
    description:
      "This page offers general aftercare information only and is not a substitute for medical advice from a qualified healthcare professional.",
    items: [
      { title: "Share concerns early", description: "Tell Rahma Therapy before booking or treatment if you have health concerns." },
      { title: "Follow professional advice", description: "If you need medical advice, speak to a qualified healthcare professional." },
      { title: "Use therapist guidance", description: "Follow the aftercare instructions provided for your appointment." },
    ],
  },
  unsureCta: {
    title: "Still unsure?",
    description: "If you are not sure which treatment is suitable, ask before booking.",
    primary: { label: "View services", href: "/services" },
    secondary: { label: "Start booking", href: "#book-now" },
  },
  cta: {
    title: "Ready to book?",
    description: "Choose your treatment, preferred therapist and appointment details.",
    primary: { label: "Book a mobile visit", href: "#book-now" },
    secondary: { label: "About Rahma Therapy", href: "/about" },
  },
} as const satisfies FaqsAftercarePageContent<SiteImageKey>;
