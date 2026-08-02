// TEST SUPPORT ONLY — not imported by application code.
//
// `unstable_cache` is inert outside a Next.js request scope, so a vitest run
// against the real implementation would re-run the fetcher every time and the
// C-09 Step 7 assertions (miss runs / hit does not re-run / tag invalidation
// re-runs) would all pass vacuously. This is a faithful-enough in-memory stand
// in: same signature, keyed by the key-parts array plus the call arguments,
// with tag-scoped eviction.
//
// Usage (the vi.mock factory is hoisted above imports, so build the harness in
// a `vi.hoisted` block and hand the mock its `unstable_cache`):
//
//   const cacheHarness = await vi.hoisted(async () => {
//     const { createFakeUnstableCache } = await import(
//       "@/lib/cache/__tests__/fake-unstable-cache"
//     );
//     return createFakeUnstableCache();
//   });
//   vi.mock("next/cache", () => ({ unstable_cache: cacheHarness.unstable_cache }));

type AnyFetcher = (...args: never[]) => Promise<unknown>;

interface Entry {
  value: unknown;
  tags: string[];
}

export interface FakeUnstableCache {
  /** Drop-in replacement for `next/cache`'s `unstable_cache`. */
  unstable_cache: <T extends AnyFetcher>(
    fetcher: T,
    keyParts?: string[],
    options?: { revalidate?: number | false; tags?: string[] }
  ) => T;
  /** Evict every entry whose wrap listed `tag` — mirrors `updateTag(tag)`. */
  invalidateTag: (tag: string) => void;
  /** Drop everything (call in `beforeEach`). */
  clear: () => void;
  /** Number of live entries — handy for asserting distinct cache keys. */
  size: () => number;
}

export function createFakeUnstableCache(): FakeUnstableCache {
  const store = new Map<string, Entry>();

  const unstable_cache = (<T extends AnyFetcher>(
    fetcher: T,
    keyParts: string[] = [],
    options: { revalidate?: number | false; tags?: string[] } = {}
  ): T => {
    const wrapped = async (...args: never[]) => {
      const key = JSON.stringify([keyParts, args]);
      const hit = store.get(key);
      if (hit) return hit.value;
      const value = await fetcher(...args);
      store.set(key, { value, tags: options.tags ?? [] });
      return value;
    };
    return wrapped as unknown as T;
  }) as FakeUnstableCache["unstable_cache"];

  return {
    unstable_cache,
    invalidateTag(tag: string) {
      for (const [key, entry] of store) {
        if (entry.tags.includes(tag)) store.delete(key);
      }
    },
    clear() {
      store.clear();
    },
    size() {
      return store.size;
    },
  };
}
