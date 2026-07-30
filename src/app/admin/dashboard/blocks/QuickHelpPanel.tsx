// Re-export — C-11 Phase A build-reality (plan §1 Phase A): `QuickHelpPanel`
// already exists at `dashboard/QuickHelpPanel.tsx` and already accepts a
// `links` array prop (verified — no further extension needed). Its sole
// consumer, `TherapistDashboard.tsx`, keeps importing the original path;
// blocks/ re-exports rather than relocating.
export { QuickHelpPanel } from "../QuickHelpPanel";
export type { QuickHelpPanelProps } from "../QuickHelpPanel";
