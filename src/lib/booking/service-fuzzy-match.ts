// C-03 (enquiry → booking conversion) — pure fuzzy-match helper.
// Given an enquiry's free-text service_interest and the active services
// list, picks the best-matching service slug so the conversion form can
// pre-select it. No DB access, no I/O — safe to import from server or
// client code.

export interface ServiceForMatching {
  slug: string;
  name: string;
  group_category: string | null;
}

export function fuzzyMatchService(
  interest: string,
  services: ServiceForMatching[]
): string | null {
  const normalised = interest.trim().toLowerCase();
  if (!normalised || services.length === 0) return null;

  const scored = services.map((svc) => ({
    slug: svc.slug,
    score: scoreMatch(normalised, svc.name.toLowerCase(), svc.group_category?.toLowerCase()),
  }));
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0];
  const runnerUp = scored[1];
  const margin = runnerUp ? top.score - runnerUp.score : 1.0;

  if (top.score >= 0.8 && margin >= 0.15) {
    return top.slug;
  }
  return null;
}

function scoreMatch(needle: string, haystackName: string, haystackCategory?: string): number {
  if (haystackName === needle) return 1.0;
  if (haystackName.includes(needle) || needle.includes(haystackName)) return 0.9;
  if (haystackCategory && (haystackCategory === needle || needle.includes(haystackCategory))) return 0.75;

  const needleTokens = new Set(needle.split(/\s+/).filter(Boolean));
  const haystackTokens = new Set(haystackName.split(/\s+/).filter(Boolean));
  if (needleTokens.size === 0 || haystackTokens.size === 0) return 0;
  const intersection = [...needleTokens].filter((t) => haystackTokens.has(t)).length;
  const union = needleTokens.size + haystackTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
