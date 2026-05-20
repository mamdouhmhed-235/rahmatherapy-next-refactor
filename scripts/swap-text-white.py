"""Swap raw `text-white` Tailwind class for the `text-[var(--admin-on-primary)]`
token across admin source. Extends Gate 7 polish addendum (P3-A6) which had
only swept notification-bell.tsx + attention-group-client.tsx; this catches the
remaining ~100 callsites on primary/destructive/status backgrounds.

Idempotent: re-running finds no `text-white` left to replace.

Substring replacement is safe because `text-white` is a specific Tailwind
utility class. The replacement correctly handles:
  - `text-white`              -> `text-[var(--admin-on-primary)]`
  - `text-white/80`           -> `text-[var(--admin-on-primary)]/80`
  - `hover:text-white`        -> `hover:text-[var(--admin-on-primary)]`
  - `group-hover:text-white`  -> `group-hover:text-[var(--admin-on-primary)]`
  - `!text-white`             -> `!text-[var(--admin-on-primary)]`
And does NOT touch:
  - `bg-white/15`, `ring-white/35`  (different utility prefix)
  - `rgba(255,255,255,...)`         (inline style strings)
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ADMIN_ROOT = ROOT / "src" / "app" / "admin"
OLD = "text-white"
NEW = "text-[var(--admin-on-primary)]"


def process(path: Path) -> int:
    """Return number of occurrences replaced (0 if file unchanged)."""
    text = path.read_text(encoding="utf-8")
    if OLD not in text:
        return 0
    count = text.count(OLD)
    new_text = text.replace(OLD, NEW)
    path.write_text(new_text, encoding="utf-8")
    return count


def main() -> int:
    if not ADMIN_ROOT.exists():
        print(f"ERROR: {ADMIN_ROOT} not found", file=sys.stderr)
        return 2
    total_files = 0
    total_occ = 0
    for path in sorted(ADMIN_ROOT.rglob("*.tsx")):
        n = process(path)
        if n:
            total_files += 1
            total_occ += n
            print(f"  {path.relative_to(ROOT)}: {n}")
    print(f"\nReplaced {total_occ} occurrence(s) across {total_files} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
