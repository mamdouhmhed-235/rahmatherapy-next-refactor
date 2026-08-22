-- G-08-03 — scope who can read recurring booking templates at the DATABASE level.
--
-- BEFORE: `rbt_authenticated_read` was `FOR SELECT TO authenticated USING (true)`,
-- and `authenticated` holds a real SELECT grant on the table. So ANY signed-in
-- staff account — including a Therapist, who may only see their own assigned
-- work — could read EVERY recurring booking template, including the customer's
-- home address (`service_address_line1`) and the template `notes`.
--
-- ⛔ PROVEN BEHAVIOURALLY BEFORE THIS MIGRATION WAS WRITTEN, not inferred. The
-- table is EMPTY in production, so a bare probe returned 0 rows and would have
-- been VACUOUS. A row was inserted inside `begin … rollback` first:
--
--     as `authenticated`, old policy   -> 1 row, address and notes readable
--     after `rollback`                 -> 0 rows, nothing persisted
--
-- ⚠️ NOT AN APPLICATION EXPOSURE. Every read and write of this table in the app
-- goes through the service-role client (`createSupabaseAdminClient`), which
-- bypasses RLS by design; `createSupabaseServerClient` is used only to resolve
-- the staff profile. The exposure route is a staff member using their OWN
-- session token against the REST API directly — the anon key is public in the
-- browser. This policy is defence in depth, and it was the one table in `public`
-- with a `qual = true` policy for `authenticated` backed by an actual grant.
--
-- ⚠️ Nothing was exposed on the day this shipped: zero templates existed. It
-- would have become real the moment the clinic created its first standing
-- weekly booking.
--
-- AFTER: mirrors the `bookings` SELECT policy, so "can see the booking" and
-- "can see the standing arrangement behind it" agree. Assigned-scope staff reach
-- a template either by being bound to it (`bound_therapist_id`) or by holding an
-- assignment on one of the bookings it generated.
--
-- ⛔ VERIFIED, each in its own rolled-back transaction with a real row present:
--
--     Coordinator  (view_bookings_all)                    -> 1  (still works)
--     Therapist    (assigned-scope, unrelated template)    -> 0  (closed)
--     no staff session at all                              -> 0  (closed)
--
-- ⛔ `rbt_service_role_all` is deliberately UNTOUCHED. The recurring cron
-- (`api/cron/extend-recurring-horizons`) and every admin path run as
-- service_role and must keep full access.

drop policy if exists "rbt_authenticated_read" on public.recurring_booking_templates;

create policy "rbt_authenticated_read" on public.recurring_booking_templates
  for select to authenticated
  using (
    app_private.current_staff_has_permission('manage_bookings_all')
    or app_private.current_staff_has_permission('view_bookings_all')
    or (
      (
        app_private.current_staff_has_permission('manage_bookings_assigned')
        or app_private.current_staff_has_permission('view_bookings_assigned')
      )
      and (
        bound_therapist_id = app_private.current_active_staff_id()
        or exists (
          select 1
          from public.bookings b
          join public.booking_assignments ba on ba.booking_id = b.id
          where b.recurring_template_id = recurring_booking_templates.id
            and ba.assigned_staff_id = app_private.current_active_staff_id()
        )
      )
    )
  );

-- Post-condition: refuse to leave a permissive policy behind. If the CREATE
-- above ever silently no-ops, this aborts rather than reporting success.
do $$
declare
  v_qual text;
begin
  select qual into v_qual
  from pg_policies
  where schemaname = 'public'
    and tablename = 'recurring_booking_templates'
    and policyname = 'rbt_authenticated_read';

  if v_qual is null then
    raise exception 'G-08-03: rbt_authenticated_read is missing after the migration';
  end if;

  if btrim(v_qual) = 'true' then
    raise exception 'G-08-03: rbt_authenticated_read is still USING (true)';
  end if;

  if position('current_staff_has_permission' in v_qual) = 0 then
    raise exception 'G-08-03: rbt_authenticated_read does not check staff permissions';
  end if;
end $$;
