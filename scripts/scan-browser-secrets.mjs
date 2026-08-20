// ⛔ NO SHEBANG HERE, DELIBERATELY. This file is imported by
// scan-browser-secrets.test.ts, and Vite/rolldown cannot strip a shebang that
// ends in CRLF — it hoists the node: import shim onto the same line and the
// build fails with `Invalid Character !`. This repo has core.autocrlf=true and
// no .gitattributes, so a shebang written with LF would be converted back to
// CRLF on the next checkout and the test would break again for a reason nobody
// would connect to line endings.
//
// Nothing is lost: package.json invokes this as
// `node scripts/scan-browser-secrets.mjs`, never as `./scripts/...`, so the
// shebang was decorative. gen-image-manifest.mjs already omits one.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env");
const SCAN_ROOTS = [".next/static", ".open-next/assets", "public"];

// PASSWORD and CREDENTIAL added 2026-08-20: neither was listed, so an
// `ADMIN_PASSWORD=` in .env was never even considered by this scanner.
export const SENSITIVE_KEY_PATTERN =
  /(SERVICE_ROLE|SECRET|TOKEN|RESEND|SENTRY_AUTH|CLOUDFLARE|PRIVATE|API_KEY|PASSWORD|CREDENTIAL)/i;

/**
 * Keys that MATCH the sensitive pattern but are genuinely meant to ship to every
 * browser. Each needs a stated reason.
 *
 * ⛔ ADDING TO THIS LIST IS A DELIBERATE DECISION TO PUBLISH A VALUE TO EVERY
 * VISITOR. Never add a key here to make a failing run go green — that is exactly
 * what the old blanket `NEXT_PUBLIC_` exemption did, silently, for everything.
 */
export const PUBLISHABLE_EXCEPTIONS = new Set([
  // Google Maps BROWSER keys are designed to live in client-side code — the Maps
  // JS API cannot work otherwise. They are protected by HTTP-referrer
  // restrictions configured in the Google Cloud console, NOT by secrecy. It
  // matched the pattern only via "API_KEY".
  //
  // ⚠️ This key's safety therefore depends on those referrer restrictions
  // actually being set. This scanner cannot check that — it is a console
  // setting, not a repo fact.
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
]);

/**
 * Is this env key one whose VALUE must never appear in a browser bundle?
 *
 * ⛔ THE EXEMPTION THAT USED TO BE HERE WAS BACKWARDS. The previous version
 * skipped any key matching `/^NEXT_PUBLIC_|ANON/i` BEFORE asking whether it
 * looked sensitive. But `NEXT_PUBLIC_` is precisely the prefix Next.js INLINES
 * into client bundles, so `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` — the single
 * worst name a real secret could carry — was the one case guaranteed to be
 * ignored. Sensitive now wins, and the only way past it is the explicit,
 * reasoned allow-list above.
 *
 * A name that does not look sensitive is skipped by the pattern test regardless
 * of prefix, which is what the old exemption was really achieving for
 * `NEXT_PUBLIC_SUPABASE_URL` and friends.
 */
export function isSecretKey(key) {
  if (PUBLISHABLE_EXCEPTIONS.has(key.toUpperCase())) return false;
  return SENSITIVE_KEY_PATTERN.test(key);
}

function readEnvSecrets() {
  if (!fs.existsSync(ENV_FILE)) return [];

  return fs
    .readFileSync(ENV_FILE, "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        return [];
      }

      const separatorIndex = trimmed.indexOf("=");
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^"|"$/g, "")
        .replace(/^'|'$/g, "");

      if (!isSecretKey(key) || value.length < 12) {
        return [];
      }

      return [{ key, value }];
    });
}

function walkFiles(relativeRoot) {
  const absoluteRoot = path.join(ROOT, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];

  const files = [];
  const stack = [absoluteRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function main() {
  const secrets = readEnvSecrets();
  const files = SCAN_ROOTS.flatMap(walkFiles);
  const findings = [];

  for (const file of files) {
    let content = "";
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    for (const secret of secrets) {
      if (content.includes(secret.value) || content.includes(secret.key)) {
        findings.push({
          key: secret.key,
          file: path.relative(ROOT, file),
        });
      }
    }
  }

  if (findings.length > 0) {
    console.error("Browser secret scan failed:");
    for (const finding of findings) {
      console.error(`- ${finding.key} found in ${finding.file}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Browser secret scan passed: ${secrets.length} sensitive env keys checked across ${SCAN_ROOTS.join(", ")}.`
  );
}

// ---------- CLI entry point ----------
// Guarded so `import`ing this module (its own test) never triggers a full bundle
// scan, console output, or an exit-code side effect — only running it directly
// (`node scripts/scan-browser-secrets.mjs`) does. Same idiom as
// measure-admin-contrast.mjs. Without this the test cannot import it at all.
const isMain = (() => {
  try {
    return (
      process.argv[1] &&
      import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
    );
  } catch {
    return false;
  }
})();

if (isMain) {
  main();
}
