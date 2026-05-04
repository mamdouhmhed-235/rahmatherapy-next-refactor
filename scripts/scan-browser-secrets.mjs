#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env");
const SCAN_ROOTS = [".next/static", ".open-next/assets", "public"];
const SENSITIVE_KEY_PATTERN =
  /(SERVICE_ROLE|SECRET|TOKEN|RESEND|SENTRY_AUTH|CLOUDFLARE|PRIVATE|API_KEY)/i;
const PUBLIC_KEY_PATTERN = /^NEXT_PUBLIC_|ANON/i;

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

      if (
        PUBLIC_KEY_PATTERN.test(key) ||
        !SENSITIVE_KEY_PATTERN.test(key) ||
        value.length < 12
      ) {
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

main();
