// Generates src/lib/media/image-manifest.ts — the list of content images that
// actually exist in public/images.
//
// WHY THIS EXISTS. Five image wrappers used to answer "does this photo exist?"
// with `existsSync(path.join(process.cwd(), "public", src))`. Cloudflare Workers
// have no filesystem, so in production that call answered "no" for every image
// and each wrapper rendered an ImagePlaceholder instead of the photo. Locally,
// Node has a filesystem, so the same code showed every image — which is why the
// bug survived: it is invisible in dev and total in production.
//
// The question is legitimate; asking the filesystem at request time is not. So
// it is answered once, at build time, on a machine that does have a filesystem,
// and the answer ships as data.
//
// ⛔ THE GENERATED FILE MUST STAY CLIENT-SAFE. `PackageFinder.tsx` and
// `AftercareTabs.tsx` are "use client" and render these wrappers, so the module
// they import can never pull in `node:fs` or `node:path`. That constraint is
// what forced two of the wrappers to hand-maintain a hardcoded list in the first
// place. The emitted file is therefore plain data and imports nothing.
//
// Run automatically by `pnpm build` (inline, NOT a `prebuild` hook — this repo
// has no .npmrc and pnpm >= 7 disables pre/post scripts by default, so a hook
// would silently never fire and ship a stale manifest). `scripts/
// gen-image-manifest.test.ts` fails if the committed file drifts from disk.
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMAGES_DIR = path.join(ROOT, "public", "images");
const OUT_FILE = path.join(ROOT, "src", "lib", "media", "image-manifest.ts");

// Only what `next/image` can actually render. `next.config.ts` restricts
// optimisation to `/images/**` via `images.localPatterns`, so scanning wider
// would list paths that would fail at the Image layer anyway.
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"]);

export function collectImagePaths(dir = IMAGES_DIR, base = "/images") {
  const found = [];
  for (const entry of readdirSync(dir).sort()) {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) {
      found.push(...collectImagePaths(absolute, `${base}/${entry}`));
    } else if (IMAGE_EXTENSIONS.has(path.extname(entry).toLowerCase())) {
      found.push(`${base}/${entry}`);
    }
  }
  return found;
}

export function renderManifest(paths) {
  // Sorted so regeneration is deterministic: an unordered walk would churn the
  // diff on every build and make a real change impossible to spot in review.
  const entries = [...paths].sort().map((p) => `  ${JSON.stringify(p)},`).join("\n");
  return `// GENERATED FILE — do not edit by hand.
// Run \`node scripts/gen-image-manifest.mjs\` (or \`pnpm build\`) to regenerate.
//
// Every content image present in public/images at build time. Wrappers consult
// this instead of asking the filesystem, because the filesystem does not exist
// on Cloudflare Workers — see scripts/gen-image-manifest.mjs for the full story.
//
// Plain data, no imports: "use client" components render these wrappers, so this
// module must never reach for a node builtin.

export const PUBLIC_IMAGE_PATHS = [
${entries}
] as const;

const PUBLIC_IMAGE_SET: ReadonlySet<string> = new Set(PUBLIC_IMAGE_PATHS);

/**
 * Does this \`/images/...\` path exist in the build?
 *
 * Answers the question the wrappers used to put to \`existsSync\`, with the same
 * meaning and without a filesystem. A miss is not an error: it renders an
 * \`ImagePlaceholder\`, which is how a page still being photographed advertises
 * what it is waiting for.
 */
export function publicImageExists(src: string): boolean {
  return PUBLIC_IMAGE_SET.has(src);
}
`;
}

function main() {
  const paths = collectImagePaths();
  const next = renderManifest(paths);
  let current = "";
  try {
    current = readFileSync(OUT_FILE, "utf8");
  } catch {
    current = "";
  }
  if (current === next) {
    console.log(`image manifest already current (${paths.length} images)`);
    return;
  }
  writeFileSync(OUT_FILE, next, "utf8");
  console.log(`image manifest written: ${paths.length} images -> ${path.relative(ROOT, OUT_FILE)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
