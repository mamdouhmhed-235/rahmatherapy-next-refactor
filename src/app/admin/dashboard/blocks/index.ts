// Barrel export — C-11 Phase A shared dashboard blocks library.
//
// All blocks are render-only (data via props, no data fetching, no side
// effects, no server actions). Phase B (3b) wired the Business composition
// from this barrel, Phase C wired CoordinatorDashboard.tsx, and Phase D
// re-pointed TherapistDashboard.tsx — all three variants now compose from
// here.
//
// REMOVED 2026-07-31 — `RevenueStripe` and `RecentActivityStripe`. Phase A
// built, tested and exported both, but no variant ever mounted them. Wiring
// `RevenueStripe` as brief §4.1 draws it (fixed Today/Week/Month/Lifetime
// tiles) needs 3-4 extra `getDashboardData` calls, which breaks brief §8's
// "C-11 doesn't introduce new fetches" lock and SHARED-NOTES §11's <=6-per-load
// budget. Owner decision: honour §8, defer the feature to C-12+, delete the
// dead code. Both files were working, tested code — recover them verbatim from
// `git show 4e18fa9:src/app/admin/dashboard/blocks/<name>.tsx` (specs under
// `blocks/__tests__/`) rather than rebuilding from scratch.

export { DashboardHeader } from "./DashboardHeader";

export { EmptyState } from "./EmptyState";

export { QuickHelpPanel } from "./QuickHelpPanel";
export type { QuickHelpPanelProps } from "./QuickHelpPanel";

export { MobileStickyActionBar } from "./MobileStickyActionBar";
export type { MobileStickyActionBarProps } from "./MobileStickyActionBar";

export { EnquiriesTodoStripe } from "./EnquiriesTodoStripe";
export type {
  ActiveEnquiryRow,
  ActiveEnquirySource,
  ActiveEnquiryStatus,
} from "./EnquiriesTodoStripe";

export { ClaimQueueStripe } from "./ClaimQueueStripe";
export type {
  ClaimQueueBooking,
  ClaimQueueStripeProps,
} from "./ClaimQueueStripe";

export { PendingBookingsStripe } from "./PendingBookingsStripe";
export type {
  AttentionGroup,
  AttentionSummaryRow,
  AttentionSeverity,
} from "./PendingBookingsStripe";

export { ScheduleGapStripe } from "./ScheduleGapStripe";
export type { ScheduleGap, ScheduleGapStripeProps } from "./ScheduleGapStripe";
