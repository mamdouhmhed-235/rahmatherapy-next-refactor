#!/usr/bin/env bash
# extract-doc-doc-citations.sh
#
# The SECOND citation direction: paths referenced FROM one document TO another
# file. extract-doc-citations.sh only scans src/scripts/e2e/supabase/config, so
# it is structurally blind to a document that only other documents cite.
# DECLUTTER-2026-08-17-plan.md §8 requires both directions.
#
# Usage:
#   bash extract-doc-doc-citations.sh            # every dangling doc reference, sorted, unique
#   bash extract-doc-doc-citations.sh --all      # every reference with its status
#
# The pass criterion is a SET DIFFERENCE, not a count and not zero:
#   bash extract-doc-doc-citations.sh > /tmp/before.txt      # capture the baseline
#   ...perform a deletion...
#   bash extract-doc-doc-citations.sh > /tmp/after.txt
#   comm -13 /tmp/before.txt /tmp/after.txt                  # NEW dangling refs only
#   empty output = nothing newly broke
#
# ~125 references already dangle before any deletion, mostly prescriptive output
# paths inside recipes ("save the screenshot to X"). Requiring zero would fail on
# day one and teach everyone to ignore the gate.
#
# Method notes:
#  - Resolves against the FILESYSTEM (-e), not `git ls-files`. This is deliberate:
#    a tracked-list resolver is blind to every untracked deletion, which is most of
#    this plan.
#  - ⛔ NO EXTENSION ALTERNATION. A prior run used `ts|tsx`, which captured every
#    `page.tsx` as `page.ts` and reported 353 false dangling entries. This matches
#    the path shape and then strips punctuation instead, so no ordering bug is
#    possible.
#  - Strips trailing sentence punctuation TWICE (catches "...brief.md).").
#  - Accepts a leading "/" (docs here write "/redesign/..." as repo-root-absolute).
#  - Tests -e, so a directory reference resolves as well as a file.

set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

SHOW_ALL=0
[ "${1:-}" = "--all" ] && SHOW_ALL=1

TOPDIRS='redesign|src|scripts|e2e|supabase|docs|public|implementation-plans|brand-logo-assets|rahma-therapy-image-replacements'

strip_punct() {
  local s="$1"
  for _ in 1 2 3; do
    s="${s%.}"; s="${s%,}"; s="${s%\)}"; s="${s%:}"; s="${s%\;}"
    s="${s%\'}"; s="${s%\"}"; s="${s%\`}"; s="${s%\]}"; s="${s%\}}"
    s="${s%\*}"; s="${s%>}"
  done
  printf '%s' "$s"
}

git ls-files '*.md' '*.html' | while IFS= read -r f; do
  grep -ohE "/?($TOPDIRS)/[A-Za-z0-9_.@/-]+" "$f" 2>/dev/null |
  while IFS= read -r raw; do
    p="$(strip_punct "$raw")"
    p="${p#/}"
    [ -z "$p" ] && continue
    case "$p" in */) p="${p%/}";; esac
    if [ -e "$p" ]; then
      [ "$SHOW_ALL" = 1 ] && printf '%s\tRESOLVES\t%s\n' "$p" "$f"
    else
      if [ "$SHOW_ALL" = 1 ]; then
        printf '%s\tDANGLING\t%s\n' "$p" "$f"
      else
        printf '%s\n' "$p"
      fi
    fi
  done
done | sort -u
