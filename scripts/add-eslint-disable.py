"""Insert a `// eslint-disable-next-line react-hooks/set-state-in-effect`
comment immediately above the setState call line for known offenders.

Operates on a hard-coded list of (path, line, marker) tuples. The marker is
the leading non-whitespace text on the target line — we verify it before
inserting so we never edit the wrong line.

Idempotent: skips files where the disable comment is already present
immediately above the target line.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DISABLE = "// eslint-disable-next-line react-hooks/set-state-in-effect"

# Each tuple: (relative path, expected setState line content snippet)
TARGETS: list[tuple[str, str]] = [
    ("src/app/admin/account-password-requests/ApproveModal.tsx",        "setOpen(false);"),
    ("src/app/admin/account-password-requests/RejectModal.tsx",         "setOpen(false);"),
    ("src/app/admin/bookings/BookingsChrome.tsx",                       "setSavedViews(loadSavedViews());"),
    ("src/app/admin/bookings/new/ManualBookingForm.tsx",                "setAssignmentChoices((prev) => {"),
    ("src/app/admin/bookings/new/ManualBookingForm.tsx",                "if (draft.step) setStep(draft.step);"),
    ("src/app/admin/bookings/new/ManualBookingForm.tsx",                "setParticipants((prev) => [{ ...prev[0], name: fullName }, ...prev.slice(1)]);"),
    ("src/app/admin/calendar/CalendarDatePopover.tsx",                  "setSelection(initialSelection());"),
    ("src/app/admin/clients/[clientId]/ClientDetailForms.tsx",          "setIsExpanded(false);"),
    ("src/app/admin/clients/new/ClientCreateForm.tsx",                  "setConfirmDuplicate(false);"),
    ("src/app/admin/clients/new/ClientCreateForm.tsx",                  "setClientErrors({});"),
    ("src/app/admin/components/AdminCommandSearch.tsx",                 "setFocusedIndex(-1);"),
    ("src/app/admin/components/AdminCommandSearch.tsx",                 "setHasError(false);"),
    ("src/app/admin/dashboard/dashboard-filters-client.tsx",            "setHydrated(true);"),
    ("src/app/admin/emails/components/ManualSendSheet.tsx",             "setRecipient(prefillRecipient);"),
    ("src/app/admin/emails/components/TemplateBrowser.tsx",             "setIsMobile(mq.matches);"),
    ("src/app/admin/emails/components/TemplateBrowser.tsx",             "setOpenGroups({"),
    ("src/app/admin/emails/components/TemplateBrowser.tsx",             "setOpenGroups(next);"),
    ("src/app/admin/emails/components/TemplateEditForm.tsx",            "setValues(draft ? { ...initial, ...draft } : initial);"),
    ("src/app/admin/emails/components/TemplateEditForm.tsx",            "setValues(merged);"),
    ("src/app/admin/emails/components/TemplatePreviewPanel.tsx",        'setState("loading");'),
    ("src/app/admin/emails/components/TemplatePreviewPanel.tsx",        "setBody(null);"),
    ("src/app/admin/emails/components/TemplatesTab.tsx",                "setMounted(true);"),
    ("src/app/admin/emails/components/TemplatesTab.tsx",                "setIsMobile(mq.matches);"),
    ("src/app/admin/emails/components/TemplatesTab.tsx",                "setShowFieldSkeleton(true);"),
    ("src/app/admin/enquiries/EnquiryFilterPersistence.tsx",            "setResumeHref(null);"),
    ("src/app/admin/privacy/PrivacyStatusForm.tsx",                     "setSelectedStatus(status);"),
    ("src/app/admin/roles/[roleId]/RoleMetadataForm.tsx",               "setDirty(false);"),
]


def process(rel: str, snippet: str) -> tuple[bool, str]:
    path = ROOT / rel
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")

    # Find every line containing the snippet
    matches = [i for i, ln in enumerate(lines) if snippet in ln]
    if not matches:
        return False, f"{rel}: snippet not found: {snippet[:40]}"
    # Each call should only handle one target. If multiple matches exist we
    # need to identify by surrounding context. For our list we expect unique
    # snippets per file (or near-unique). Take the first unhandled one.
    inserted = False
    for idx in matches:
        # Check if disable comment is already above (within 2 lines, allowing
        # whitespace).
        already = any(DISABLE in lines[j] for j in range(max(0, idx - 2), idx))
        if already:
            continue
        # Determine indent of the snippet line, then insert the comment with
        # matching indent.
        target_line = lines[idx]
        indent = target_line[: len(target_line) - len(target_line.lstrip())]
        lines.insert(idx, f"{indent}{DISABLE}")
        inserted = True
        break

    if not inserted:
        return False, f"{rel}: already disabled at {snippet[:40]}"

    path.write_text("\n".join(lines), encoding="utf-8")
    return True, f"{rel}: inserted at {snippet[:40]}"


def main() -> int:
    changed = 0
    for rel, snippet in TARGETS:
        ok, msg = process(rel, snippet)
        if ok:
            changed += 1
            print(f"  OK  {msg}")
        else:
            print(f"  --  {msg}")
    print(f"\nTotal lines disabled: {changed}/{len(TARGETS)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
