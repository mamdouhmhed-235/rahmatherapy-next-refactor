#!/usr/bin/env python3
"""
Fix mojibake from Win-1252 -> UTF-8 round-trip corruption via targeted
substitution. Each pair is the corrupted byte sequence -> correct character.

Run from project root:  python scripts/fix-mojibake.py [--dry-run]
"""

import sys
from pathlib import Path

ROOT = Path("src")

# Substitution table. Each entry: corrupted-bytes -> correct-character-bytes.
# Ordering matters: longer/more-specific patterns must come BEFORE shorter
# ones (e.g. `â€"` 8 bytes before `â€` 5 bytes).
SUBS: list[tuple[bytes, bytes]] = [
    # 8-byte em-dash / en-dash (most specific first)
    (b"\xc3\xa2\xe2\x82\xac\xe2\x80\x9d", b"\xe2\x80\x94"),  # em-dash —
    (b"\xc3\xa2\xe2\x82\xac\xe2\x80\x9c", b"\xe2\x80\x93"),  # en-dash –
    (b"\xc3\xa2\xe2\x82\xac\xe2\x80\x9e", b"\xe2\x80\x9e"),  # double low-9
    (b"\xc3\xa2\xe2\x82\xac\xe2\x84\xa2", b"\xe2\x80\x99"),  # right single quote ’
    (b"\xc3\xa2\xe2\x82\xac\xcb\x9c", b"\xe2\x80\x98"),       # left single quote ‘
    (b"\xc3\xa2\xe2\x82\xac\xc5\x93", b"\xe2\x80\x9c"),       # left double quote “
    (b"\xc3\xa2\xe2\x82\xac\xc2\x9d", b"\xe2\x80\x9d"),       # right double quote ”
    (b"\xc3\xa2\xe2\x82\xac\xc2\xa6", b"\xe2\x80\xa6"),       # ellipsis …
    (b"\xc3\xa2\xe2\x82\xac\xc2\xa2", b"\xe2\x80\xa2"),       # bullet •
    # Bare â€ (close double quote) — must come AFTER all the variants above
    (b"\xc3\xa2\xe2\x82\xac", b"\xe2\x80\x9d"),               # ”

    # Comparison operators
    (b"\xc3\xa2\xe2\x80\xb0\xc2\xa5", b"\xe2\x89\xa5"),       # ≥
    (b"\xc3\xa2\xe2\x80\xb0\xc2\xa4", b"\xe2\x89\xa4"),       # ≤

    # Arrows
    (b"\xc3\xa2\xe2\x80\xa0\xe2\x80\x99", b"\xe2\x86\x92"),  # →
    (b"\xc3\xa2\xe2\x80\xa0\xe2\x80\x98", b"\xe2\x86\x90"),  # ←
    (b"\xc3\xa2\xe2\x80\xa0\xe2\x80\x91", b"\xe2\x86\x91"),  # ↑
    (b"\xc3\xa2\xe2\x80\xa0\xe2\x80\x93", b"\xe2\x86\x93"),  # ↓

    # Command symbol — ⌘ (U+2318) mojibake variants
    (b"\xc3\xa2\xc5\x92\xcb\x98", b"\xe2\x8c\x98"),           # ⌘ (breve variant)
    (b"\xc3\xa2\xc5\x92\xcb\x9c", b"\xe2\x8c\x98"),           # ⌘ (small-tilde variant — what AdminTopNav had)

    # Box drawing horizontal (`â”€`)
    (b"\xc3\xa2\xe2\x80\x9d\xe2\x82\xac", b"\xe2\x94\x80"),  # ─

    # Latin-1 punctuation (2-byte mojibake)
    (b"\xc3\x82\xc2\xa3", b"\xc2\xa3"),                       # £
    (b"\xc3\x82\xc2\xb7", b"\xc2\xb7"),                       # ·
    (b"\xc3\x82\xc2\xb0", b"\xc2\xb0"),                       # °
    (b"\xc3\x82\xc2\xa7", b"\xc2\xa7"),                       # §
    (b"\xc3\x82\xc2\xa2", b"\xc2\xa2"),                       # ¢
    (b"\xc3\x82\xc2\xa5", b"\xc2\xa5"),                       # ¥
    (b"\xc3\x82\xc2\xa9", b"\xc2\xa9"),                       # ©
    (b"\xc3\x82\xc2\xae", b"\xc2\xae"),                       # ®
    (b"\xc3\x82\xc2\xb1", b"\xc2\xb1"),                       # ±
    (b"\xc3\x82\xc2\xb2", b"\xc2\xb2"),                       # ²
    (b"\xc3\x82\xc2\xb3", b"\xc2\xb3"),                       # ³
    (b"\xc3\x82\xc2\xb6", b"\xc2\xb6"),                       # ¶
    (b"\xc3\x82\xc2\xbf", b"\xc2\xbf"),                       # ¿
    (b"\xc3\x82\xc2\xa0", b"\xc2\xa0"),                       # NBSP

    # Euro
    (b"\xc3\xa2\xe2\x80\x9a\xc2\xac", b"\xe2\x82\xac"),       # €
]


def fix_file(raw: bytes) -> bytes:
    """Apply all substitutions in order. Returns possibly-modified bytes."""
    for corrupted, correct in SUBS:
        raw = raw.replace(corrupted, correct)
    return raw


def main():
    dry_run = "--dry-run" in sys.argv
    files = list(ROOT.rglob("*.tsx")) + list(ROOT.rglob("*.ts"))

    fixed_count = 0
    untouched_count = 0

    for f in files:
        try:
            raw = f.read_bytes()
        except OSError:
            continue

        fixed = fix_file(raw)
        if fixed == raw:
            untouched_count += 1
            continue

        if dry_run:
            print(f"WOULD FIX: {f}  ({len(raw)} -> {len(fixed)} bytes)")
        else:
            f.write_bytes(fixed)
            print(f"FIXED: {f}  ({len(raw)} -> {len(fixed)} bytes)")
        fixed_count += 1

    print(f"\n--- Summary: {fixed_count} fixed, {untouched_count} untouched")


if __name__ == "__main__":
    main()
