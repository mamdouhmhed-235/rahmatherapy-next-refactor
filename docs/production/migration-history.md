# Supabase Migration History

This note records the Phase 1 migration hygiene baseline. It documents the known live migration versions and their corresponding checked-in local migration files without renaming already-applied production migrations.

## Rule For Future Migrations

- Use a new chronological timestamp for every future migration.
- Do not rename migrations that may already be applied in production.
- If a non-production environment must be reset, document that reset separately before changing historical filenames.
- Before launch, run Supabase migration status through Supabase MCP or Supabase CLI and compare it with this file.

## Live To Local Mapping

| Live version | Live name | Checked-in local file |
| --- | --- | --- |
| `20260502052439` | `phase2_group1_enums_and_rbac` | `supabase/migrations/20260502052439_phase2_group1_enums_and_rbac.sql` |
| `20260502052452` | `phase2_group2_staff_profiles` | `supabase/migrations/20260502052452_phase2_group2_staff_profiles.sql` |
| `20260502052500` | `phase2_group3_services` | `supabase/migrations/20260502052500_phase2_group3_services.sql` |
| `20260502052516` | `phase2_group4_clients_and_bookings` | `supabase/migrations/20260502052516_phase2_group4_clients_and_bookings.sql` |
| `20260502052529` | `phase2_group5_availability` | `supabase/migrations/20260502052529_phase2_group5_availability.sql` |
| `20260502052540` | `phase2_group6_settings_and_audit` | `supabase/migrations/20260502052540_phase2_group6_settings_and_audit.sql` |
| `20260502052558` | `phase2_group7_rls_policies` | `supabase/migrations/20260502052558_phase2_group7_rls_policies.sql` |
| `20260502122835` | `phase2_fix_updated_at_search_path` | `supabase/migrations/20260502122835_phase2_fix_updated_at_search_path.sql` |
| `20260502135039` | `phase5_seed_default_services` | `supabase/migrations/20260502150000_phase5_seed_default_services.sql` |
| `20260502141542` | `phase6_seed_business_settings_and_global_availability` | `supabase/migrations/20260502160000_phase6_seed_business_settings_and_global_availability.sql` |
| `20260502165759` | `restore_phase8_service_role_read_grants` | No exact local filename. Related local file: `supabase/migrations/20260502183000_restore_api_role_grants.sql` |
| `20260502170527` | `restore_phase8_service_role_permissions_read_grant` | No exact local filename. Related local file: `supabase/migrations/20260502183000_restore_api_role_grants.sql` |
| `20260502171737` | `phase9_prerequisite_booking_write_grants` | `supabase/migrations/20260502192000_phase9_prerequisite_booking_write_grants.sql` |
| `20260502175213` | `phase10_booking_management_grants` | `supabase/migrations/20260502194500_phase10_booking_management_grants.sql` |
| `20260502182152` | `phase11_assignment_claiming_grants` | `supabase/migrations/20260502201000_phase11_assignment_claiming_grants.sql` |
| `20260503080416` | `phase15_safety_consent_notes` | `supabase/migrations/20260503090000_phase15_safety_consent_notes.sql` |
| `20260503083710` | `phase16_rls_hardening` | `supabase/migrations/20260503093000_phase16_rls_hardening.sql` |
| `20260503084016` | `phase16_service_role_grants` | `supabase/migrations/20260503094000_phase16_service_role_grants.sql` |
| `20260503084351` | `phase16_private_rls_helpers` | `supabase/migrations/20260503095000_phase16_private_rls_helpers.sql` |
| `20260503152053` | `phase2_booking_atomic_snapshots` | `supabase/migrations/20260503150000_phase2_booking_atomic_snapshots.sql` |
| `20260503160109` | `phase4_customer_manage_email_readiness` | `supabase/migrations/20260503170000_phase4_customer_manage_email_readiness.sql` |
| `20260503180025` | `phase7_crm_enquiries_ops` | `supabase/migrations/20260503210000_phase7_crm_enquiries_ops.sql` |
| `20260503181504` | `phase7_crm_enquiries_rls` | `supabase/migrations/20260503211000_phase7_crm_enquiries_rls.sql` |
| `20260503192817` | `phase8_operational_visibility` | `supabase/migrations/20260503220000_phase8_operational_visibility.sql` |
| `20260503212506` | `phase9_privacy_rls_hardening` | `supabase/migrations/20260503230000_phase9_privacy_rls_hardening.sql` |
| `20260503212905` | `phase9_revoke_operational_event_auth_writes` | `supabase/migrations/20260503231000_phase9_revoke_operational_event_auth_writes.sql` |

## Current Risk

The live database has the expected logical migration set, but several live versions differ from local filenames. A developer can still understand the mapping from this document, but fresh environment setup should be verified before launch.

Issue #55 tracks this migration-history bookkeeping risk.
