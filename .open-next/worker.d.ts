// Type shim for the OpenNext-generated worker bundle.
//
// `.open-next/worker.js` is produced at build time by
// `opennextjs-cloudflare build` and is therefore .gitignored. This .d.ts
// is committed (whitelisted past .gitignore) so the Next.js TypeScript
// pass can resolve `./.open-next/worker.js` from `worker-entrypoint.ts`
// without needing the build artifact to exist on a fresh checkout.
//
// Runtime values come from the generated .js. Types here are intentionally
// loose because the generated module's surface is not stable contract.

declare const openNextWorker: {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response>;
};

export default openNextWorker;
export const DOQueueHandler: unknown;
export const DOShardedTagCache: unknown;
export const BucketCachePurge: unknown;
