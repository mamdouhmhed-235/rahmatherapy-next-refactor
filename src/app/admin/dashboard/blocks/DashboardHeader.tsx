// Re-export — C-11 Phase A build-reality (plan §1 Phase A, C11-F8):
// `DashboardHeader` already exists at `dashboard/dashboard-header.tsx` and is
// consumed directly by `page.tsx` and `TherapistDashboard.tsx`. Relocating it
// would break those imports; blocks/ re-exports the canonical implementation
// instead of re-lifting it ("prefer re-export from blocks/ over relocating
// the file").
export { DashboardHeader } from "../dashboard-header";
