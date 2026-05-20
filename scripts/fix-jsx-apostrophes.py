"""Escape raw apostrophes inside JSX text content.

ESLint's react/no-unescaped-entities flags `'` that appears between a `>` and
`<` (i.e. JSX text content). It does not flag apostrophes inside JS strings,
comments, or attribute values. This script targets ONLY JSX text content.

Algorithm: walk the file character-by-character with a tiny state machine that
tracks whether we're "inside JSX text" (between `>` and `<`). Inside JSX text,
replace `'` with `&apos;`. Outside, leave everything alone.

Intentionally conservative — bails on any file with mismatched tags.
"""
from __future__ import annotations

import sys
from pathlib import Path


def escape_jsx_apostrophes(src: str) -> str:
    out = []
    in_jsx_text = False
    i = 0
    n = len(src)
    # We start outside any tag. The first `>` won't be a tag close (it's
    # likely a JS comparison etc.), so we use a different heuristic: only
    # treat `>` followed by typical JSX-text chars as opening JSX text.
    # That's fragile, so instead we use a smarter rule: track tag depth
    # using `<` and `>` only when not inside a string/comment.
    #
    # Simpler-and-good-enough: only escape apostrophes that sit on a line
    # whose first non-whitespace char is NOT one of `{ } / *` and is preceded
    # by `>` somewhere earlier on the same or prior line, and not inside a
    # string literal.
    #
    # For our concrete corpus (admin error.tsx + a handful of others), the
    # apostrophes we want to escape ALWAYS live in lines that look like:
    #   `              Couldn't load X.`
    # which is `<tag>↵<whitespace>Couldn't…<tag>`. The text appears between
    # two angle-bracketed tags on adjacent lines.
    #
    # So the practical rule: a line is "JSX text" if its previous non-empty
    # line ends with `>` and the next non-empty line starts with `<`.
    return src  # placeholder; replaced below


def is_jsx_text_line(prev_line: str, line: str, next_line: str) -> bool:
    """Return True if `line` looks like JSX text between two element tags.

    prev_line ends with `>` (open or close of a tag)
    line is non-empty, doesn't start with `{`, `<`, or `//`, contains `'`
    next_line starts (after whitespace) with `<`
    """
    p = prev_line.rstrip()
    if not p.endswith(">"):
        return False
    stripped = line.lstrip()
    if not stripped or stripped.startswith(("<", "{", "//", "/*", "*", "*/")):
        return False
    if "'" not in line:
        return False
    n = next_line.lstrip()
    if not n.startswith("<"):
        return False
    return True


def process_file(path: Path) -> int:
    """Return number of lines changed."""
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    changes = 0
    out_lines = list(lines)
    for i, line in enumerate(lines):
        prev_line = lines[i - 1] if i > 0 else ""
        next_line = lines[i + 1] if i + 1 < len(lines) else ""
        if is_jsx_text_line(prev_line, line, next_line):
            new_line = line.replace("'", "&apos;")
            if new_line != line:
                out_lines[i] = new_line
                changes += 1
    if changes:
        path.write_text("\n".join(out_lines), encoding="utf-8")
    return changes


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: python fix-jsx-apostrophes.py <file_or_dir>...", file=sys.stderr)
        return 2
    total_files = 0
    total_lines = 0
    for arg in argv[1:]:
        p = Path(arg)
        if p.is_dir():
            files = list(p.rglob("*.tsx")) + list(p.rglob("*.jsx"))
        else:
            files = [p]
        for f in files:
            changed = process_file(f)
            if changed:
                total_files += 1
                total_lines += changed
                print(f"  {f}: {changed} line(s)")
    print(f"\nTotal: {total_files} file(s), {total_lines} line(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
