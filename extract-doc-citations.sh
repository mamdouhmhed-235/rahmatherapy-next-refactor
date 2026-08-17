#!/usr/bin/env bash
# extract-doc-citations.sh
#
# Reusable extractor: finds every documentation path cited from a comment
# (or string literal) anywhere under src/, scripts/, e2e/, supabase/, and the
# root config files, and reports whether each cited path resolves today.
#
# Usage:  bash extract-doc-citations.sh            (from repo root)
#
# Pass/fail after a deletion pass:
#   bash extract-doc-citations.sh | awk -F'\t' 'NR>1 && $4=="DANGLING"'
#   empty output = nothing broke
#
# Output columns (tab-separated): CITING_FILE:LINE <TAB> RAW_TOKEN <TAB> NORMALIZED_PATH <TAB> STATUS
#   STATUS is RESOLVES, RESOLVES(dir), RESOLVES(basename: <path>), or DANGLING.
#
# Provenance: extracted verbatim from
# redesign/declutter-2026-08-17/FINDINGS-A5-reference-graph.md §3, which is the
# only place this script existed until 2026-08-17. Committed as a tracked file
# because DECLUTTER-2026-08-17-plan.md §8 uses it as a verification gate, and a
# gate that lives inside a document nobody runs is not a gate.
#
# Method notes:
#  - Only searches files tracked by git (git grep), so build artifacts,
#    node_modules, .next etc. are never scanned.
#  - Catches three citation forms: explicit repo-relative paths beginning
#    redesign/, docs/, or implementation-plans/; and bare *.md filenames
#    (e.g. "DESIGN.md", "BUILD-create-role.md") that carry no path prefix.
#  - Strips a leading "/" (some comments write "/redesign/..." as if repo-root-absolute).
#  - PUNCTUATION TRAP: strips trailing sentence punctuation (. , ) ] } : ' " `)
#    from every extracted token before testing existence, and re-strips after
#    removing a trailing paren in case a second punctuation mark follows it
#    (e.g. "...brief.md)." -> "...brief.md"). Without this a naive matcher
#    reports false-positive dangling links for ordinary sentence-final periods.
#    (This project's prior run produced exactly that false alarm.)
#  - A token ending in "/" (or that resolves to a directory) is checked as a
#    directory prefix against the tracked-file list, not as a file.
#  - A bare filename (no "/") that doesn't resolve as a literal repo-root path
#    gets a repo-wide basename fallback search before being called dangling.

set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

ROOT_CONFIG_FILES="next.config.ts tsconfig.json eslint.config.mjs playwright.config.ts vitest.config.ts wrangler.jsonc package.json postcss.config.mjs components.json open-next.config.ts pnpm-workspace.yaml"

strip_punct() {
  local s="$1"
  s="${s%.}"; s="${s%,}"; s="${s%)}"; s="${s%:}"; s="${s%\'}"; s="${s%\"}"; s="${s%\`}"; s="${s%]}"; s="${s%\}}"
  s="${s%.}"; s="${s%,}"; s="${s%)}"; s="${s%:}"; s="${s%\'}"; s="${s%\"}"; s="${s%\`}"; s="${s%]}"; s="${s%\}}"
  printf '%s' "$s"
}

resolve_status() {
  local p="$1"
  p="${p#/}"
  if [ -f "$p" ]; then echo "RESOLVES"; return; fi
  local dirp="${p%/}/"
  if git ls-files -- "$dirp*" | grep -q .; then echo "RESOLVES(dir)"; return; fi
  case "$p" in
    */*) : ;;
    *)
      local hit
      hit="$(git ls-files | grep -F "/$p" | head -1)"
      [ -z "$hit" ] && hit="$(git ls-files | grep -E "^$p\$" | head -1)"
      if [ -n "$hit" ]; then echo "RESOLVES(basename: $hit)"; return; fi
      ;;
  esac
  echo "DANGLING"
}

printf 'CITING_FILE:LINE\tRAW_TOKEN\tNORMALIZED_PATH\tSTATUS\n'

git grep -n -E '(redesign/|docs/|implementation-plans/|[A-Za-z0-9_-]+\.md)' \
    -- src scripts e2e supabase $ROOT_CONFIG_FILES |
while IFS=: read -r file line rest; do
  echo "$rest" | grep -oE '(redesign/[A-Za-z0-9_./-]+|docs/[A-Za-z0-9_./-]+|implementation-plans/[A-Za-z0-9_./-]+|[A-Za-z0-9_-]+\.md)' |
  while read -r raw; do
    norm="$(strip_punct "$raw")"
    [ -z "$norm" ] && continue
    status="$(resolve_status "$norm")"
    printf '%s:%s\t%s\t%s\t%s\n' "$file" "$line" "$raw" "$norm" "$status"
  done
done
