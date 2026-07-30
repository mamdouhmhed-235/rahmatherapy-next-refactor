// Re-export — the enquiries triage card already exists as
// `ActiveEnquiriesCard` in `dashboard-cards.tsx` (brief §2.1: "EnquiriesTodoStripe
// ← Extracted from Business + Coord enquiries surfacing"). Re-exporting under
// the block's name reuses the existing, already-styled component instead of
// duplicating it (plan §1 Phase A: reuse, don't re-lift).
export { ActiveEnquiriesCard as EnquiriesTodoStripe } from "../dashboard-cards";
export type {
  ActiveEnquiryRow,
  ActiveEnquirySource,
  ActiveEnquiryStatus,
} from "../dashboard-cards";
