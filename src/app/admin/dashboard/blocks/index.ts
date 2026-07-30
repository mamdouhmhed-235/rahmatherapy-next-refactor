// Barrel export — C-11 Phase A shared dashboard blocks library.
//
// All blocks are render-only (data via props, no data fetching, no side
// effects, no server actions). DORMANT until Phase B/C wire them into
// BusinessDashboard.tsx / CoordinatorDashboard.tsx — do not import this
// barrel from page.tsx or TherapistDashboard.tsx yet.

export { DashboardHeader } from "./DashboardHeader";

export { EmptyState } from "./EmptyState";

export { QuickHelpPanel } from "./QuickHelpPanel";
export type { QuickHelpPanelProps } from "./QuickHelpPanel";

export { MobileStickyActionBar } from "./MobileStickyActionBar";
export type { MobileStickyActionBarProps } from "./MobileStickyActionBar";

export { RevenueStripe } from "./RevenueStripe";
export type { RevenueStripeTile, RevenueStripeProps } from "./RevenueStripe";

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

export { RecentActivityStripe } from "./RecentActivityStripe";
export type { RecentActivityStripeProps } from "./RecentActivityStripe";
