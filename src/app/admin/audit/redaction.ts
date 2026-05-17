// Redaction visibility helper for /admin/audit.
// The matching regex is preserved verbatim from RECON §6.2.
const REDACTION_REGEX = /note|health|treatment|consent|token|secret|key|payload|body/i;

export interface RedactionSummary {
  keysHidden: string[];
  count: number;
}

function collectRedactedKeys(state: Record<string, unknown> | null | undefined): string[] {
  if (!state) return [];
  return Object.keys(state).filter((key) => REDACTION_REGEX.test(key));
}

export function summariseRedactions(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): RedactionSummary {
  const keys = new Set<string>([...collectRedactedKeys(before), ...collectRedactedKeys(after)]);
  return { keysHidden: [...keys].sort(), count: keys.size };
}

export function isRedactedKey(key: string): boolean {
  return REDACTION_REGEX.test(key);
}

export function redactStatePayload(
  state: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!state) return null;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    next[key] = isRedactedKey(key) ? "[redacted]" : value;
  }
  return next;
}
