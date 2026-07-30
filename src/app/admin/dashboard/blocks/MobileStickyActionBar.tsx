// Re-export — C-11 Phase A build-reality (plan §1 Phase A, C11-F8):
// `MobileStickyActionBar` ALREADY EXISTS as a render-only component at
// `dashboard/MobileStickyActionBar.tsx` and is consumed twice by
// `page.tsx` ("Move/re-export the existing component into blocks/ rather
// than re-lifting"). `page.tsx` keeps its existing import path; blocks/
// re-exports the canonical implementation.
export { MobileStickyActionBar } from "../MobileStickyActionBar";
export type { MobileStickyActionBarProps } from "../MobileStickyActionBar";
