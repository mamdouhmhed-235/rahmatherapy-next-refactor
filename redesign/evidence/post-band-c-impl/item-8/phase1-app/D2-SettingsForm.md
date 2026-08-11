# D2 — SettingsForm.tsx read-only derivation

Target: `src/app/admin/settings/SettingsForm.tsx` (790 lines, read in full).
Also read: `src/app/admin/settings/page.tsx` (56 lines), `src/app/admin/settings/settings-data.ts` (113 lines), `src/app/admin/settings/actions.ts` (119 lines), and `src/lib/auth/rbac.ts` lines 1–70, all read-only.

**Headline: every line-number claim in the brief for this file checked out exactly.** No drift found in this file, which is the opposite of the usual pattern for this workstream — noted explicitly per the instruction that a passing claim is as reportable as a failing one. The one thing genuinely absent from the codebase is the *destination* for the new field: `PERMISSIONS.MANAGE_TRAVEL_ORIGIN` does not exist in `rbac.ts` yet, and nothing in `src/` references `free_travel_cities`, `mileage_origin`, or `manage_travel_origin` (`grep` across `src/` returned zero hits for all three). This file is virgin ground for the new column.

---

## 1. Settings-shape interface (claimed `allowed_cities` at :27)

CONFIRMED exact. Byte-exact, lines 19–29:

```
19	interface BusinessSettings {
20	  company_name: string;
21	  contact_email: string | null;
22	  contact_phone: string | null;
23	  booking_window_days: number;
24	  buffer_time_mins: number;
25	  minimum_notice_hours: number;
26	  customer_cancellation_cutoff_hours: number;
27	  allowed_cities: string[];
28	  booking_status_enabled: boolean;
29	}
```

`allowed_cities: string[];` is at line 27 exactly, as claimed.

This interface is **module-private** — not imported from `settings-data.ts`. See item 8.

---

## 2. useState init, dirty-check baseline, error prop, hidden input

All four claims CONFIRMED exact.

**useState init (claimed :59) — line 59, exact:**
```
59	  const [cities, setCities] = useState<string[]>(settings.allowed_cities);
```

**Dirty-check baseline object (claimed :76) — inside the `initial` `useMemo`, lines 73–86; the cities line is at 76, exact:**
```
73	  const initial = useMemo(
74	    () => ({
75	      intakeOn: settings.booking_status_enabled,
76	      cities: settings.allowed_cities,
77	      windowDays: String(settings.booking_window_days),
78	      noticeHours: String(settings.minimum_notice_hours),
79	      bufferMins: String(settings.buffer_time_mins),
80	      cancelHours: String(settings.customer_cancellation_cutoff_hours),
81	      companyName: settings.company_name,
82	      contactPhone: settings.contact_phone ?? "",
83	      contactEmail: settings.contact_email ?? "",
84	    }),
85	    [settings]
86	  );
```
The dirty check itself (line 90) reads `cities.join("\n") !== initial.cities.join("\n")`.

**Error prop (claimed :388) — line 388, exact, in the `ServiceAreaField` call at lines 381–390:**
```
381	            <ServiceAreaField
382	              cities={cities}
383	              draft={cityDraft}
384	              onDraftChange={setCityDraft}
385	              onKeyDown={handleCityKeyDown}
386	              onAdd={() => addCity(cityDraft)}
387	              onRemove={removeCity}
388	              error={state.fieldErrors?.allowed_cities}
389	              disabled={isPending}
390	            />
```

**Hidden input (claimed :393–397 with `name="allowed_cities"` at :395) — exact:**
```
392	            {/* Hidden input preserves the original server contract: newline-delimited. */}
393	            <input
394	              type="hidden"
395	              name="allowed_cities"
396	              value={cities.join("\n")}
397	            />
```
The element spans lines 393–397 (5 lines including the closing `/>`) exactly as claimed, and `name="allowed_cities"` is at line 395 exactly.

---

## 3. `ServiceAreaField` (claimed starts ~:674)

CONFIRMED exact — the function starts at line 674, not merely "~674". Full component, byte-exact, lines 674–789:

```
674	function ServiceAreaField({
675	  cities,
676	  draft,
677	  onDraftChange,
678	  onKeyDown,
679	  onAdd,
680	  onRemove,
681	  error,
682	  disabled,
683	}: {
684	  cities: string[];
685	  draft: string;
686	  onDraftChange: (next: string) => void;
687	  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
688	  onAdd: () => void;
689	  onRemove: (index: number) => void;
690	  error?: string;
691	  disabled?: boolean;
692	}) {
693	  const autoId = useId();
694	  const errorId = `${autoId}-error`;
695	  const helperId = `${autoId}-helper`;
696	
697	  return (
698	    <div className="grid gap-3">
699	      <label htmlFor={autoId} className="sr-only">
700	        Service areas
701	      </label>
702	
703	      {cities.length === 0 ? (
704	        <div
705	          role="status"
706	          className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] px-3 py-2 text-xs text-[oklch(26%_0.13_55)]"
707	        >
708	          <span>
709	            No service areas yet. The booking form will currently turn every
710	            customer away. Add at least one city below.
711	          </span>
712	        </div>
713	      ) : (
714	        <ul className="flex list-none flex-wrap gap-1.5 p-0">
715	          {cities.map((city, index) => (
716	            <li key={`${city}-${index}`}>
717	              <span
718	                title="Service area. Customers within this area can book."
719	                className="inline-flex items-center gap-1 rounded-full border border-[oklch(88%_0.012_280)] bg-[oklch(94%_0.008_280)] py-1 pl-3 pr-1 text-xs text-[oklch(30%_0.02_280)] transition-colors hover:bg-[oklch(91%_0.012_280)]"
720	              >
721	                <span>{city}</span>
722	                <button
723	                  type="button"
724	                  onClick={() => onRemove(index)}
725	                  disabled={disabled}
726	                  aria-label={`Remove ${city}`}
727	                  title={`Remove ${city}`}
728	                  className="relative inline-flex size-5 items-center justify-center rounded-full text-[oklch(30%_0.02_280)] outline-none transition-colors hover:bg-[oklch(85%_0.012_280)] hover:text-[oklch(20%_0.02_280)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50 before:absolute before:inset-[-8px] before:content-['']"
729	                >
730	                  <X
731	                    className="size-3.5 shrink-0"
732	                    style={{ minWidth: 14 }}
733	                    strokeWidth={2.5}
734	                    aria-hidden="true"
735	                  />
736	                </button>
737	              </span>
738	            </li>
739	          ))}
740	        </ul>
741	      )}
742	
743	      <div className="flex flex-col gap-2 sm:flex-row">
744	        <input
745	          id={autoId}
746	          type="text"
747	          value={draft}
748	          onChange={(event) => onDraftChange(event.target.value)}
749	          onKeyDown={onKeyDown}
750	          placeholder="Add a city or town and press Enter"
751	          disabled={disabled}
752	          aria-describedby={cn(error ? errorId : undefined, helperId)}
753	          aria-invalid={error ? "true" : undefined}
754	          className={cn(
755	            "h-10 w-full flex-1 scroll-mb-24 rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50",
756	            error
757	              ? "border-[oklch(26%_0.14_25)]"
758	              : "border-[var(--admin-border-form)]"
759	          )}
760	        />
761	        <button
762	          type="button"
763	          onClick={onAdd}
764	          disabled={disabled || !draft.trim()}
765	          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50"
766	        >
767	          <Plus className="size-4" aria-hidden="true" />
768	          Add
769	        </button>
770	      </div>
771	
772	      {error ? (
773	        <p
774	          id={errorId}
775	          role="alert"
776	          aria-live="polite"
777	          aria-atomic="true"
778	          className="text-xs text-[oklch(26%_0.14_25)]"
779	        >
780	          {error}
781	        </p>
782	      ) : (
783	        <p id={helperId} className="text-xs text-[var(--admin-text-muted)]">
784	          {cities.length} {cities.length === 1 ? "area" : "areas"} configured.
785	        </p>
786	      )}
787	    </div>
788	  );
789	}
```

This is a full, sequentially-numbered, byte-exact transcription of lines 674–789 (double-checked against the Read tool's line-numbered output line by line, no gaps or merges — an earlier draft of this report had two duplicated line-number labels around 719–721 and 755–759 which have been corrected).

---

## 4. The three copy strings

All three CONFIRMED byte-exact, at the claimed locations.

- **:378** — line 378, exact:
  ```
  378	              description="Cities and towns where the team will travel. Customers booking outside these areas see a helpful message instead of a closed door."
  ```
  (Part of the `AdminPanelHeader` call at lines 376–379, panel title `"Service areas"`.)

- **:708–711** — CONFIRMED, the `<span>...</span>` wrapper spans exactly lines 708–711:
  ```
  708	          <span>
  709	            No service areas yet. The booking form will currently turn every
  710	            customer away. Add at least one city below.
  711	          </span>
  ```

- **:718** — line 718, exact:
  ```
  718	                title="Service area. Customers within this area can book."
  ```

**Semantic caveat (not a byte-match issue, worth flagging for the caller):** these three strings describe `allowed_cities` as *the* booking gate ("turn every customer away" / "customers within this area can book"). Under Decision 9 (expand-contract, not rename), that description stays literally true right now — `allowed_cities` really is still what `create_booking_request` gates on, and this form still only reads/writes `allowed_cities` (see §2's hidden-input evidence: `name="allowed_cities"`, not `free_travel_cities`). Nothing in this file currently touches `free_travel_cities` at all. So these strings aren't "false" today — they become misleading only if/when this panel is repointed to display `free_travel_cities` while the booking gate stays on `allowed_cities`, which is a decision for whoever implements this panel's change, not something already broken in the file.

---

## 5. Closest existing precedent for a plain optional text field

The precedent to mirror is **`contact_phone`** (plain text, no `type` override — closer to what a free-text `mileage_origin` address/postcode field would need than `contact_email`, which forces `type="email"`). Below is the complete pattern across all five touch points, byte-exact.

**a. `useState` declaration — line 70:**
```
70	  const [contactPhone, setContactPhone] = useState(settings.contact_phone ?? "");
```

**b. Dirty-check baseline — line 82 (inside the `initial` `useMemo`, see full block in §2 above):**
```
82	      contactPhone: settings.contact_phone ?? "",
```

**c. Dirty-check comparison — line 96:**
```
96	    contactPhone !== initial.contactPhone ||
```

**d. `discardChanges` reset — line 133:**
```
133	    setContactPhone(initial.contactPhone);
```

**e. JSX usage — lines 281–290, inside Panel 2 "Clinic identity":**
```
281	                <FieldRow
282	                  name="contact_phone"
283	                  label="Contact phone"
284	                  helper="Shown to customers in confirmation emails."
285	                  error={state.fieldErrors?.contact_phone}
286	                  value={contactPhone}
287	                  onChange={setContactPhone}
288	                  placeholder="01582 …"
289	                  disabled={isPending}
290	                />
```

**f. Section/card it sits in — Panel 2, lines 258–308 (the `<FieldRow>` above is one child of the `md:grid-cols-2` grid at line 268; `contact_phone`'s `<FieldRow>` is NOT wrapped in an extra `md:col-span-2` div — that wrapper is only used for `contact_email`, see line 292 below — `contact_phone` sits directly in the two-column grid as a single-column cell):**
```
258	        {/* ─── Panel 2: Clinic identity ─────────────────────────── */}
259	        <AdminPanel>
260	          <div className="grid gap-4">
261	            <AdminPanelHeader
262	              title="Clinic identity"
263	              description="Shown to customers in emails and on the booking page footer."
264	            />
265	
266	            <fieldset className="m-0 min-w-0 border-0 p-0">
267	              <legend className="sr-only">Clinic identity</legend>
268	              <div className="grid gap-4 md:grid-cols-2">
269	                <FieldRow
270	                  name="company_name"
271	                  label="Clinic name"
272	                  required
273	                  helper="Appears in confirmation emails as the sender name."
274	                  error={state.fieldErrors?.company_name}
275	                  value={companyName}
276	                  onChange={setCompanyName}
277	                  placeholder="Rahma Therapy"
278	                  disabled={isPending}
279	                />
280	
281	                <FieldRow
282	                  name="contact_phone"
283	                  label="Contact phone"
284	                  helper="Shown to customers in confirmation emails."
285	                  error={state.fieldErrors?.contact_phone}
286	                  value={contactPhone}
287	                  onChange={setContactPhone}
288	                  placeholder="01582 …"
289	                  disabled={isPending}
290	                />
291	
292	                <div className="md:col-span-2">
293	                  <FieldRow
294	                    name="contact_email"
295	                    label="Contact email"
296	                    type="email"
297	                    helper="Shown to customers as the reply-to address."
298	                    error={state.fieldErrors?.contact_email}
299	                    value={contactEmail}
300	                    onChange={setContactEmail}
301	                    placeholder="hello@example.com"
302	                    disabled={isPending}
303	                  />
304	                </div>
305	              </div>
306	            </fieldset>
307	          </div>
308	        </AdminPanel>
309	```

**g. How the field/error is actually rendered — the shared `FieldRow` component, byte-exact, lines 519–590 (this is the piece that owns the label markup, the input wiring, and the fieldError-vs-helper branch a new field must reuse verbatim by just calling `<FieldRow name="mileage_origin" ... />`):**
```
519	function FieldRow({
520	  name,
521	  label,
522	  helper,
523	  error,
524	  value,
525	  onChange,
526	  type = "text",
527	  placeholder,
528	  required = false,
529	  disabled,
530	}: {
531	  name: string;
532	  label: string;
533	  helper: string;
534	  error?: string;
535	  value: string;
536	  onChange: (next: string) => void;
537	  type?: string;
538	  placeholder?: string;
539	  required?: boolean;
540	  disabled?: boolean;
541	}) {
542	  const autoId = useId();
543	  const errorId = `${autoId}-error`;
544	  const helperId = `${autoId}-helper`;
545	
546	  return (
547	    <div className="grid gap-1.5">
548	      <label
549	        htmlFor={autoId}
550	        className="text-sm font-medium text-[var(--admin-heading)]"
551	      >
552	        {label}
553	        {required ? requiredMark : null}
554	      </label>
555	      <input
556	        id={autoId}
557	        name={name}
558	        type={type}
559	        value={value}
560	        onChange={(event) => onChange(event.target.value)}
561	        placeholder={placeholder}
562	        disabled={disabled}
563	        required={required}
564	        aria-describedby={cn(error ? errorId : undefined, helper ? helperId : undefined) || undefined}
565	        aria-invalid={error ? "true" : undefined}
566	        className={cn(
567	          "flex h-10 w-full scroll-mb-24 rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50",
568	          error
569	            ? "border-[oklch(26%_0.14_25)]"
570	            : "border-[var(--admin-border-form)]"
571	        )}
572	      />
573	      {error ? (
574	        <p
575	          id={errorId}
576	          role="alert"
577	          aria-live="polite"
578	          aria-atomic="true"
579	          className="text-xs text-[oklch(26%_0.14_25)]"
580	        >
581	          {error}
582	        </p>
583	      ) : (
584	        <p id={helperId} className="text-xs text-[var(--admin-text-muted)]">
585	          {helper}
586	        </p>
587	      )}
588	    </div>
589	  );
590	}
```

Note `required` defaults to `false` and is simply omitted from the `contact_phone`/`contact_email` call sites (neither passes `required`); a new optional `mileage_origin` field should likewise omit the `required` prop rather than pass `required={false}`, to match house style exactly.

Also note: since `contact_phone`/`contact_email` are `string | null` in the `BusinessSettings` interface but `FieldRow`'s `value` prop is typed plain `string`, both existing fields coerce with `?? ""` at the `useState` call (see items a, and the `contactEmail` equivalent at line 71). A new `mileage_origin` field (also nullable per the live schema) would need the identical `?? ""` coercion at its `useState` and `initial` sites.

---

## 6. How is the form gated/disabled today? Any per-field permission notion?

**No per-field permission concept exists anywhere in this component.** Confirmed by reading the full file and its imports:

- The only `disabled` conditions in the whole file are `disabled={isPending}` (React `useTransition` pending state — a save-in-flight lock, not a permission gate) and, on the "Add" button in `ServiceAreaField`, `disabled={disabled || !draft.trim()}` (line 764, same `isPending` value passed through as the `disabled` prop plus an empty-draft guard).
- `SettingsForm.tsx`'s imports (lines 1–17) include no `rbac`, no `PERMISSIONS`, no `canManage*` anything, and no `StaffProfile`. The component receives no permission-shaped prop today (see §7 — its only props are `settings` and `lastChange`).
- Gating is entirely binary and happens one layer up, in `page.tsx` (lines 32–39): if `!profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS)`, the whole page renders `<AdminAccessDenied .../>` instead of `<SettingsForm>` — the form is never mounted at all for a non-permitted staff member. There is no partial-render / some-fields-editable state anywhere in this admin surface today.

**Implication:** there is no existing pattern in this file to copy for "some fields editable, one field locked to Owner." Whoever implements the `mileage_origin` field is inventing this pattern for the first time in `SettingsForm.tsx` — e.g. a new boolean prop threaded in (see §7) used to either conditionally render the field, or render it `disabled` with an explanatory `title`/helper text. Nothing here dictates which of those two approaches to take; that's a design decision the brief does not resolve, and this file offers no in-house convention to defer to.

---

## 7. Props `SettingsForm` receives, and threading trace

**Props interface — lines 37–40, exact:**
```
37	interface SettingsFormProps {
38	  settings: BusinessSettings;
39	  lastChange?: LastChange | null;
40	}
```
Consumed via the destructured function signature at line 51:
```
51	export function SettingsForm({ settings, lastChange }: SettingsFormProps) {
```

**Trace to `page.tsx`:**

`page.tsx` lines 24–56, in full (this is the entire file):
```
24	export default async function SettingsPage() {
25	  const supabase = await createSupabaseServerClient();
26	  const profile = await getStaffProfile(supabase);
27	
28	  if (!profile || !profile.active) {
29	    redirect("/admin/login");
30	  }
31	
32	  if (!profile.permissions.has(PERMISSIONS.MANAGE_SETTINGS)) {
33	    return (
34	      <AdminAccessDenied
35	        title="Settings access limited"
36	        message="Settings are restricted to the practice owner. Ask the owner if you need a policy changed."
37	      />
38	    );
39	  }
40	
41	  const { settings, lastChange } = await getSettingsPageData();
42	
43	  return (
44	    <div>
45	      <AdminPageHeader
46	        title="Settings"
47	        description="Booking window, service areas, buffers, and the intake switch the customer-facing form reads."
48	      />
49	
50	      <SettingsForm
51	        settings={settings ?? fallbackSettings}
52	        lastChange={lastChange}
53	      />
54	    </div>
55	  );
56	}
```
`settings` comes from `getSettingsPageData()` (in `settings-data.ts`), which is `BusinessSettingsRow | null`; if `null`, `page.tsx`'s local `fallbackSettings` object literal (lines 12–22) is substituted. `lastChange` comes from the same call, typed `SettingsLastChange | null`.

**Where a new `canManageTravelOrigin` boolean prop would need to be threaded (three points, all in files outside the write-restricted target but load-bearing context):**

1. `src/app/admin/settings/SettingsForm.tsx` — add `canManageTravelOrigin: boolean;` to the `SettingsFormProps` interface (lines 37–40) and destructure it in the function signature (line 51).
2. `src/app/admin/settings/page.tsx` — compute it from the already-fetched `profile` (available at line 26, no new fetch needed) and pass it at the `<SettingsForm>` call site (lines 50–53), e.g. `canManageTravelOrigin={profile.permissions.has(PERMISSIONS.MANAGE_TRAVEL_ORIGIN)}`.
3. **Prerequisite, not yet present:** `src/lib/auth/rbac.ts` does not currently define a `MANAGE_TRAVEL_ORIGIN` key in the `PERMISSIONS` const object (lines 6–50; confirmed by direct read — the object has 34 keys ending at `MANAGE_ACCOUNT_PASSWORD_REQUESTS: "manage_account_requests"` on line 49, no `TRAVEL_ORIGIN` entry anywhere). The DB-side permission row `manage_travel_origin` exists per the task's live-schema note, but the TypeScript-side constant that `page.tsx` would need to reference (`PERMISSIONS.MANAGE_TRAVEL_ORIGIN`) does not exist in code yet and would have to be added to this object first. A repo-wide `grep` for `MANAGE_TRAVEL_ORIGIN|manage_travel_origin` under `src/` returned zero matches — this is greenfield.

---

## 8. Imports from `settings-data.ts` or a shared type

**No.** `SettingsForm.tsx`'s full import block (lines 1–17):
```
1	"use client";
2	
3	import { useEffect, useId, useMemo, useState, useTransition } from "react";
4	import { useRouter } from "next/navigation";
5	import { Dialog as BaseDialog } from "@base-ui/react/dialog";
6	import { CheckCircle, Loader2, Lock, Plus, Save, X, XCircle } from "lucide-react";
7	import { toast } from "sonner";
8	import {
9	  AdminPanel,
10	  AdminPanelHeader,
11	} from "@/app/admin/components/admin-ui";
12	import { Switch } from "@/components/ui/switch";
13	import { cn } from "@/lib/utils";
14	import {
15	  updateBusinessSettings,
16	  type SettingsActionState,
17	} from "./actions";
```
There is no `import ... from "./settings-data"` anywhere in the file. The `BusinessSettings` interface (§1, lines 19–29) is declared locally in `SettingsForm.tsx` and is a **structural duplicate**, not a shared/imported type, of `BusinessSettingsRow` declared independently in `settings-data.ts` (lines 39–49). `settings-data.ts` documents this duplication explicitly in its own comment (lines 34–37):
```
34	/**
35	 * The `business_settings` columns SettingsForm consumes. Declared here rather
36	 * than imported because SettingsForm's copy is module-private; the shapes are
37	 * structurally identical, which is what the assignment in page.tsx relies on.
38	 */
```
(Comment numbering here reflects the file's own line numbers 34–37, quoted verbatim from `settings-data.ts`.)

**Consequence for adding `mileage_origin`:** because there is no shared type, adding the field requires editing the interface **twice, independently**, in two different files that only line up by structural typing, not by import:
- `src/app/admin/settings/SettingsForm.tsx` — `BusinessSettings` interface, lines 19–29 (add `mileage_origin: string | null;`).
- `src/app/admin/settings/settings-data.ts` — `BusinessSettingsRow` interface, lines 39–49 (same addition, independently).
- `src/app/admin/settings/page.tsx` — the local `fallbackSettings` object literal, lines 12–22, is assigned to the `settings` prop typed `BusinessSettings` at the `<SettingsForm>` call; TypeScript's structural assignability means this literal must also gain a `mileage_origin` key (e.g. `null`) or the `settings ?? fallbackSettings` expression at line 51 will fail to typecheck against `BusinessSettingsRow | typeof fallbackSettings`. This file is outside my write scope, but the caller needs to know this third edit point exists — it will not surface as an error inside `SettingsForm.tsx` itself, only where the prop is passed.

Neither of the last two files (`settings-data.ts`, `page.tsx`) is the write-restricted target of this task; they're reported here only because the interface-duplication risk directly affects how a change to the target file's `BusinessSettings` interface must be coordinated.

---

## Context gathered outside the target file (for the caller's situational awareness, not verified against the "claims" in the brief since the brief didn't cite it)

- `src/app/admin/settings/actions.ts` (`updateBusinessSettings`, lines 27–119) still parses and writes **only** `allowed_cities` (line 48–50, 92) — it does not yet touch `free_travel_cities` or `mileage_origin` at all. Whatever implements Decision 9's dual-write will need to change this file too; as of this read, no dual-write exists anywhere in the app layer.
- The DB-side permission `manage_travel_origin` (per the task's live-schema note) has no application-layer counterpart yet in `rbac.ts`, `SettingsForm.tsx`, or `page.tsx` — confirmed by `grep` (zero hits repo-wide under `src/`).
