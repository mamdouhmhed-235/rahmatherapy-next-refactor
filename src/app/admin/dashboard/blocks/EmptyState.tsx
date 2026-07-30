// Re-export — the canonical `EmptyState` primitive lives at
// `admin/components/EmptyState.tsx` and is already consumed by 25+ files
// across the whole admin tree (bookings, clients, staff, calendar,
// availability, etc.), not just the dashboard. Re-exporting here satisfies
// the blocks/ library contract without relocating a shared admin-wide
// primitive (C-11 Phase A plan §1: "prefer re-export from blocks/ over
// relocating the file").
export { EmptyState } from "../../components/EmptyState";
