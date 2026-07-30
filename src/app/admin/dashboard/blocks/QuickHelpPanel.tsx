// Re-export — C-11 Phase A build-reality (plan §1 Phase A): `QuickHelpPanel`
// already exists at `dashboard/QuickHelpPanel.tsx` and already accepts a
// `links` array prop (verified — no further extension needed). blocks/
// re-exports rather than relocating; its consumers (`TherapistDashboard.tsx`
// since Phase D, plus both Business/Coordinator variants) import from here.
export { QuickHelpPanel } from "../QuickHelpPanel";
export type { QuickHelpPanelProps } from "../QuickHelpPanel";
