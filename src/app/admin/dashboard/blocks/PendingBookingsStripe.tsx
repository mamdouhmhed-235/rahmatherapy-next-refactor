// Re-export — the "Needs your attention" panel already exists as
// `UrgentAttentionPanel` in `dashboard-cards.tsx`. Brief §9.1 Q9.1 locks the
// V-01 reconciliation: this panel is promoted to the primary actionable
// stripe and renamed `PendingBookingsStripe`. Re-exporting under the new
// name reuses the existing, already-styled severity-sorting implementation
// rather than duplicating it (plan §1 Phase A: reuse, don't re-lift).
export { UrgentAttentionPanel as PendingBookingsStripe } from "../dashboard-cards";
export type {
  AttentionGroup,
  AttentionSummaryRow,
  AttentionSeverity,
} from "../dashboard-cards";
