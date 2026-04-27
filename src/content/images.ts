import type { ImageAsset } from "@/types/content";

function localImage(options: {
  alt: string;
  publicPath: string;
  width: number;
  height: number;
  sizes?: string;
  loading?: "eager" | "lazy";
  priority?: boolean;
  note?: string;
}): ImageAsset {
  return {
    kind: "local",
    src: options.publicPath,
    alt: options.alt,
    width: options.width,
    height: options.height,
    publicPath: options.publicPath,
    sizes: options.sizes,
    loading: options.loading ?? (options.priority ? "eager" : "lazy"),
    priority: options.priority,
    note: options.note,
  };
}

export const siteImages = {
  rahmaLogoRefined: localImage({
    alt: "Rahma Therapy",
    publicPath: "/images/brand/rahma/logo-refined.svg",
    width: 1600,
    height: 587,
    sizes: "(max-width: 767px) 132px, 168px",
    priority: true,
  }),
  rahmaLogoMark: localImage({
    alt: "Rahma Therapy brand mark",
    publicPath: "/images/brand/rahma/logo-mark.svg",
    width: 512,
    height: 512,
    sizes: "72px",
  }),
  rahmaSocialPreview: localImage({
    alt: "Rahma Therapy",
    publicPath: "/images/brand/rahma/social-preview.png",
    width: 1200,
    height: 630,
    sizes: "1200px",
  }),
  homeHero: localImage({
    alt: "Sports Massage & Physiotherapy in Luton",
    publicPath: "/images/home/home-hero.avif",
    width: 2276,
    height: 1280,
    sizes: "100vw",
    loading: "eager",
    priority: true,
  }),
  homeServiceSportsMassage: localImage({
    alt: "Sports massage service card image",
    publicPath: "/images/home/service-sports-massage.avif",
    width: 2560,
    height: 1706,
    sizes: "(max-width: 768px) 100vw, 33vw",
  }),
  homeServicePhysiotherapy: localImage({
    alt: "Physiotherapy service card image",
    publicPath: "/images/home/service-physiotherapy.avif",
    width: 2688,
    height: 1536,
    sizes: "(max-width: 768px) 100vw, 33vw",
  }),
  homeServiceHijama: localImage({
    alt: "Hijama service card image",
    publicPath: "/images/home/service-hijama.avif",
    width: 2912,
    height: 4000,
    sizes: "(max-width: 768px) 100vw, 33vw",
  }),
  aboutZaheer: localImage({
    alt: "Therapist seated in treatment room",
    publicPath: "/images/home/about-zaheer.avif",
    width: 2048,
    height: 2048,
    sizes: "(max-width: 768px) 100vw, 40vw",
  }),
  painFreeMovement: localImage({
    alt: "Pain-free movement",
    publicPath: "/images/home/outcome-pain-free-movement.avif",
    width: 2688,
    height: 1536,
  }),
  eliteRecovery: localImage({
    alt: "Elite recovery",
    publicPath: "/images/home/outcome-elite-recovery.avif",
    width: 2688,
    height: 1536,
  }),
  reducedAnxiety: localImage({
    alt: "Reduced anxiety",
    publicPath: "/images/home/outcome-reduced-anxiety.avif",
    width: 2688,
    height: 1536,
  }),
  improvedPerformance: localImage({
    alt: "Improved performance",
    publicPath: "/images/home/outcome-improved-performance.avif",
    width: 2688,
    height: 1536,
  }),
  featuredHomeTestimonial: localImage({
    alt: "Featured testimonial portrait",
    publicPath: "/images/home/featured-testimonial.avif",
    width: 2688,
    height: 1536,
  }),
  homeLargeTestimonial: localImage({
    alt: "Massage treatment testimonial image",
    publicPath: "/images/home/large-testimonial.jpg",
    width: 8192,
    height: 8192,
    sizes: "(max-width: 768px) 100vw, 50vw",
    loading: "lazy",
  }),
  homeCtaMassage: localImage({
    alt: "Massage treatment close-up",
    publicPath: "/images/home/cta-massage.avif",
    width: 4000,
    height: 2280,
    sizes: "100vw",
  }),
  sharedSessionPractitioner: localImage({
    alt: "Therapist during a consultation session",
    publicPath: "/images/shared/session-practitioner.avif",
    width: 1248,
    height: 832,
    sizes: "(max-width: 768px) 100vw, 50vw",
  }),
  physiotherapyHeroPrimary: localImage({
    alt: "Physiotherapy in Luton",
    publicPath: "/images/physiotherapy/hero-primary.avif",
    width: 2048,
    height: 2048,
    sizes: "(max-width: 768px) 100vw, 36vw",
    loading: "eager",
    priority: true,
  }),
  physiotherapyHeroSecondary: localImage({
    alt: "Physiotherapy in Luton",
    publicPath: "/images/physiotherapy/hero-secondary.avif",
    width: 1728,
    height: 2368,
    sizes: "(max-width: 768px) 100vw, 32vw",
    loading: "eager",
    priority: true,
  }),
  physiotherapyPainRelief: localImage({
    alt: "Physiotherapy for pain relief",
    publicPath: "/images/physiotherapy/benefit-pain-relief.avif",
    width: 3000,
    height: 4000,
  }),
  physiotherapyBetterPosture: localImage({
    alt: "Physiotherapy for better posture",
    publicPath: "/images/physiotherapy/benefit-better-posture.avif",
    width: 2048,
    height: 2048,
  }),
  physiotherapyInjuryRecovery: localImage({
    alt: "Physiotherapy for injury recovery",
    publicPath: "/images/physiotherapy/benefit-injury-recovery.avif",
    width: 2688,
    height: 1536,
  }),
  physiotherapySportsPerformance: localImage({
    alt: "Physiotherapy for sports performance",
    publicPath: "/images/physiotherapy/benefit-sports-performance.avif",
    width: 1728,
    height: 2368,
  }),
  physiotherapyMobility: localImage({
    alt: "Physiotherapy for mobility",
    publicPath: "/images/physiotherapy/benefit-mobility.avif",
    width: 4000,
    height: 2288,
  }),
  physiotherapyStrength: localImage({
    alt: "Physiotherapy for strength and stability",
    publicPath: "/images/physiotherapy/benefit-strength.avif",
    width: 2496,
    height: 1664,
  }),
  physiotherapyStoryFrozenShoulder: localImage({
    alt: "Frozen shoulder recovery story image",
    publicPath: "/images/physiotherapy/story-frozen-shoulder.avif",
    width: 2048,
    height: 2048,
  }),
  physiotherapyStoryBackPain: localImage({
    alt: "Back pain relief story image",
    publicPath: "/images/physiotherapy/story-back-pain.avif",
    width: 2048,
    height: 2048,
  }),
  physiotherapyStoryStressRelief: localImage({
    alt: "Stress relief story image",
    publicPath: "/images/physiotherapy/story-stress-relief.avif",
    width: 2048,
    height: 2048,
  }),
  physiotherapyCta: localImage({
    alt: "Physiotherapy assistance",
    publicPath: "/images/physiotherapy/cta-assistance.avif",
    width: 2688,
    height: 1536,
    sizes: "100vw",
  }),
  physiotherapyOutcomes: localImage({
    alt: "Physiotherapy assistance",
    publicPath: "/images/physiotherapy/outcomes.avif",
    width: 2048,
    height: 2048,
    sizes: "(max-width: 2048px) 100vw, 2048px",
    loading: "lazy",
  }),
  sportsMassageHero: localImage({
    alt: "Sports massage hero treatment",
    publicPath: "/images/sports-massage/hero-primary.avif",
    width: 2688,
    height: 1536,
    sizes: "(max-width: 768px) 100vw, 52vw",
    loading: "eager",
    priority: true,
  }),
  sportsMassageHeroSecondary: localImage({
    alt: "Sports massage treatment close-up",
    publicPath: "/images/sports-massage/hero-secondary.avif",
    width: 1728,
    height: 2368,
    sizes: "(max-width: 768px) 100vw, 36vw",
    loading: "eager",
    priority: true,
  }),
  sportsMassageTension: localImage({
    alt: "Relief from chronic tension",
    publicPath: "/images/sports-massage/benefit-tension.avif",
    width: 4000,
    height: 4000,
  }),
  sportsMassageRecovery: localImage({
    alt: "Faster workout recovery",
    publicPath: "/images/sports-massage/benefit-recovery.avif",
    width: 2048,
    height: 2048,
  }),
  sportsMassagePain: localImage({
    alt: "Reduced muscle pain",
    publicPath: "/images/sports-massage/benefit-pain.avif",
    width: 2048,
    height: 2048,
  }),
  sportsMassageCirculation: localImage({
    alt: "Boosted circulation",
    publicPath: "/images/sports-massage/benefit-circulation.avif",
    width: 2048,
    height: 2048,
  }),
  sportsMassageExpectations: localImage({
    alt: "Sports massage expectations image",
    publicPath: "/images/physiotherapy/benefit-sports-performance.avif",
    width: 1728,
    height: 2368,
  }),
  sportsMassageStoryRunnerRecovery: localImage({
    alt: "Runner recovery story image",
    publicPath: "/images/sports-massage/story-runner-recovery.avif",
    width: 2048,
    height: 2048,
  }),
  sportsMassageStoryLowerBackRelief: localImage({
    alt: "Lower back relief story image",
    publicPath: "/images/sports-massage/story-lower-back-relief.avif",
    width: 2048,
    height: 2048,
  }),
  sportsMassageStorySleepImprovement: localImage({
    alt: "Sleep improvement story image",
    publicPath: "/images/sports-massage/story-sleep-improvement.avif",
    width: 2048,
    height: 2048,
  }),
  sportsMassageCta: localImage({
    alt: "Sports massage call to action image",
    publicPath: "/images/sports-massage/cta-kickboxer.avif",
    width: 2688,
    height: 1536,
    sizes: "100vw",
  }),
  hijamaHero: localImage({
    alt: "Hijama hero treatment",
    publicPath: "/images/hijama/hero-primary.avif",
    width: 4000,
    height: 4000,
    sizes: "(max-width: 768px) 100vw, 52vw",
    loading: "eager",
    priority: true,
  }),
  hijamaHeroCloseup: localImage({
    alt: "Hijama treatment close-up",
    publicPath: "/images/hijama/hero-secondary.avif",
    width: 4000,
    height: 4000,
    sizes: "(max-width: 768px) 100vw, 36vw",
    loading: "eager",
    priority: true,
  }),
  hijamaPainRelief: localImage({
    alt: "Relief from chronic pain",
    publicPath: "/images/hijama/benefit-pain-relief.avif",
    width: 1728,
    height: 2304,
  }),
  hijamaDetox: localImage({
    alt: "Detox and cleansing",
    publicPath: "/images/hijama/benefit-detox.avif",
    width: 2048,
    height: 2048,
  }),
  hijamaCirculation: localImage({
    alt: "Better circulation",
    publicPath: "/images/hijama/benefit-circulation.avif",
    width: 2048,
    height: 2048,
  }),
  hijamaStoryFatigueEnergy: localImage({
    alt: "Fatigue to energy story image",
    publicPath: "/images/hijama/story-fatigue-energy.avif",
    width: 2048,
    height: 2048,
  }),
  hijamaStoryHeadachesStress: localImage({
    alt: "Headaches and stress relief story image",
    publicPath: "/images/hijama/story-headaches-stress.avif",
    width: 2048,
    height: 2048,
  }),
  hijamaStoryBackPainRelief: localImage({
    alt: "Hijama back pain relief story image",
    publicPath: "/images/hijama/story-back-pain-relief.avif",
    width: 2048,
    height: 2048,
  }),
  hijamaCta: localImage({
    alt: "Hijama benefits image",
    publicPath: "/images/hijama/cta-benefits.avif",
    width: 2048,
    height: 2048,
    sizes: "100vw",
  }),
} as const satisfies Record<string, ImageAsset>;

export type SiteImageKey = keyof typeof siteImages;

export function getSiteImage(key: SiteImageKey) {
  return siteImages[key];
}
