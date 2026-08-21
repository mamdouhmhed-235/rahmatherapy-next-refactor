-- ============================================================================
-- PR-011 — make `create_booking_request` RECORD WHAT IT CHARGES FOR.
--
-- Owner ruling D-034: "make the engine always record what was sold, so price
-- and record can never disagree again."
--
-- ── The defect ────────────────────────────────────────────────────────────
--
-- The function filtered `services` TWICE, on DIFFERENT rules:
--
--     price + duration sum   ... where slug = any(p_service_slugs)
--                                  and is_active = true
--     booking_items insert   ... and services.is_active = true
--                                and services.is_visible_on_frontend = true   <-- extra
--
-- So a service that was ACTIVE but HIDDEN contributed its price and its minutes
-- to the booking and then produced NO LINE ITEM: the customer charged for
-- something that left no record of what it was, with therapist time still
-- reserved.
--
-- PROVEN before this migration, against the live function, with a control
-- (supabase/tests/11-service-visibility.sql):
--
--     hidden  hijama-package   charged 45.00 · 60 mins · line_items 0 · itemised 0.00
--     control massage-30       charged 40.00 · 30 mins · line_items 1 · itemised 40.00
--     visible hijama-package   charged 45.00 · 60 mins · line_items 1 · itemised 45.00
--
-- MEASURED AFTER this patch, same probes, inside a rolled-back transaction:
--
--     hidden  hijama-package   charged 45.00 · line_items 1 · itemised 45.00   ✅
--     control massage-30       charged 40.00 · line_items 1 · itemised 40.00   ✅
--
-- ── Why this direction, and not "refuse a hidden service here" ────────────
--
-- ⚠️ Deliberate. The Owner was offered an engine-level refusal as part of D-033
-- and chose instead to block hidden services in the APPLICATION, which is done:
-- `assertServicesBookable` guards both booking entry points and
-- `createRecurringSeries` (5b76f8e, da5f91e). This function's job is therefore
-- CONSISTENCY, not enforcement — whatever it charges for, it records.
--
-- ⛔ Nothing here makes a hidden service bookable that was not already. The
-- price sum has ALWAYS accepted `is_active` alone; this only stops the matching
-- line item going missing.
--
-- ── Why the body is patched in SQL rather than re-stated ──────────────────
--
-- The definition is ~24 KB. ⛔ The Supabase MCP double-escapes backslashes in
-- its results, and this run has already recorded that transcribing a function
-- body from rendered output writes the WRONG THING into a migration. So the
-- text is never carried out of the database: it is read, one exact line is
-- removed, and it is executed. Same idiom as the four existing
-- function-patching migrations.
--
-- ⛔ Guarded at BOTH ends. The pre-condition pins the body this was authored
-- against; the post-condition proves the ONLY difference is the line intended —
-- by rebuilding the expected text and comparing md5, so a mangled body cannot
-- pass as a success.
--
-- ⚠️ Migration count becomes 83. The D-025 rebuild proof covered 82 files.
-- State that caveat wherever the rebuild result is reported.
-- ============================================================================

do $pr011$
declare
  v_before   text;
  v_expected text;
  v_after    text;
  v_target   text := chr(10) || '      and services.is_visible_on_frontend = true';
begin
  select pg_get_functiondef(p.oid) into v_before
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_booking_request';

  if v_before is null then
    raise exception 'PR-011: public.create_booking_request does not exist';
  end if;

  -- ⛔ PRE-CONDITION. The body this migration was written against.
  if md5(v_before) <> '54768d85d98aa98cdd34f3597d989c49' then
    raise exception
      'PR-011: live body is not the expected definition (md5 %). Re-derive the patch before applying.',
      md5(v_before);
  end if;

  -- ⛔ ASSERT THE ANCHOR MATCHED before asserting anything about what it matched.
  -- A guard that misses its anchor otherwise reports the wrong failure entirely.
  if position(v_target in v_before) = 0 then
    raise exception 'PR-011: the visibility filter line was not found in the body';
  end if;

  v_expected := replace(v_before, v_target, '');

  if v_expected = v_before then
    raise exception 'PR-011: replace() changed nothing';
  end if;

  execute v_expected;

  -- ⛔ POST-CONDITION. Read the body BACK from the catalog and prove it is
  -- exactly the expected text — not merely "no error was raised".
  select pg_get_functiondef(p.oid) into v_after
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_booking_request';

  if md5(v_after) <> md5(v_expected) then
    raise exception
      'PR-011: post-condition failed - body after patch (md5 %) is not the expected text (md5 %)',
      md5(v_after), md5(v_expected);
  end if;

  if position('is_visible_on_frontend' in v_after) <> 0 then
    raise exception 'PR-011: the visibility filter is still present after patching';
  end if;

  -- ⚠️ Both service filters must now be the SAME rule. If a future edit
  -- reintroduces a mismatch, that is the defect returning.
  if (select count(*) from regexp_matches(v_after, 'services\.is_active = true', 'g')) < 1 then
    raise exception 'PR-011: the booking_items insert lost its is_active filter';
  end if;

  raise notice 'PR-011: create_booking_request patched - price and line items now agree.';
end
$pr011$;
