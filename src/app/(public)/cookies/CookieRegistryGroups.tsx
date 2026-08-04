import {
  type CookieRegistryEntry,
  type StorageMechanism,
  groupRegistryByPurpose,
} from "@/lib/consent/cookie-registry";

const TYPE_LABELS: Record<StorageMechanism, string> = {
  cookie: "Cookie",
  localStorage: "Browser storage (stays until cleared or it expires)",
  sessionStorage: "Browser storage (this browser tab/session only)",
};

function EntryCard({ entry }: { entry: CookieRegistryEntry }) {
  return (
    <article className="rounded-2xl border border-rahma-border bg-white/95 p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-mono text-sm font-semibold text-rahma-charcoal sm:text-base">
          {entry.name}
        </h4>
        <span className="rounded-full border border-rahma-border bg-rahma-ivory px-2.5 py-0.5 text-xs font-semibold text-rahma-green">
          {TYPE_LABELS[entry.type]}
        </span>
        {entry.dormant ? (
          <span className="rounded-full border border-rahma-border bg-rahma-sand px-2.5 py-0.5 text-xs font-semibold text-rahma-charcoal">
            Not currently active
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-7 text-rahma-muted sm:text-base">
        {entry.description}
      </p>
      {entry.dormant ? (
        <p className="mt-2 text-sm leading-6 text-rahma-muted">
          This item is part of a feature that is switched off today, so nothing is currently
          being stored under this name. It stays listed here because it starts again the moment
          that feature is switched back on.
        </p>
      ) : null}
      <dl className="mt-4 grid gap-1 text-sm text-rahma-muted sm:text-base">
        <div className="flex gap-2">
          <dt className="font-semibold text-rahma-charcoal">Set by:</dt>
          <dd>{entry.provider}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-rahma-charcoal">How long:</dt>
          <dd>{entry.duration}</dd>
        </div>
      </dl>
      {entry.provisionalNote ? (
        <p className="mt-4 rounded-xl border border-rahma-gold/40 bg-rahma-gold/10 px-4 py-3 text-sm leading-6 text-rahma-charcoal">
          <span className="font-semibold">Under review: </span>
          How we classify this item is still being finalised — we&apos;ll update this page once
          that&apos;s settled.
        </p>
      ) : null}
    </article>
  );
}

/**
 * Renders COOKIE_REGISTRY (src/lib/consent/cookie-registry.ts) grouped by
 * purpose. This is the ONLY place the /cookies page describes individual
 * cookies/storage items — there is no separate hand-maintained list, so this
 * component and the registry cannot drift apart. The preferences panel
 * (src/components/consent/ConsentPreferencesPanel.tsx) renders the same
 * per-item detail from the same `groupRegistryByPurpose()` call.
 */
export function CookieRegistryGroups() {
  const groups = groupRegistryByPurpose();

  return (
    <div className="grid gap-10">
      {groups.map((group) => (
        <div key={group.purpose}>
          <div className="flex flex-wrap items-baseline gap-3">
            <h3 className="font-display text-xl font-semibold text-rahma-charcoal sm:text-2xl">
              {group.label}
            </h3>
            {group.purpose === "essential" ? (
              <span className="text-sm font-semibold text-rahma-green">
                Always on — can&apos;t be switched off here
              </span>
            ) : (
              <span className="text-sm font-semibold text-rahma-muted">
                On today whichever way you choose
              </span>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-rahma-muted sm:text-base">
            {group.description}
          </p>
          <div className="mt-5 grid gap-4">
            {group.entries.map((entry) => (
              <EntryCard key={entry.name} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
