"use client";

import { useActionState, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarX,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AdminButton,
  AdminInput,
  AdminMobileActionBar,
  AdminPanel,
} from "@/app/admin/components/admin-ui";
import { DuplicateWarningBanner } from "@/app/admin/clients/components/DuplicateWarningBanner";
import { createManualBooking, type ManualBookingState } from "../actions";

// ─── Step-4 review helpers (hoisted so React doesn't re-create the component
//     on every render of the parent form) ─────────────────────────────────────

function SummaryCard({
  heading,
  onEdit,
  children,
}: {
  heading: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <AdminPanel
      title={heading}
      actions={
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-xs font-medium text-[var(--admin-primary)] transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          Edit <ChevronRight className="size-3" aria-hidden="true" />
        </button>
      }
    >
      {children}
    </AdminPanel>
  );
}

function dl(label: string, value: string | undefined | null) {
  if (!value) return null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-medium text-[var(--admin-text-muted)]">{label}</dt>
      <dd className="break-words text-sm text-[var(--admin-body)]">{value}</dd>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ParticipantGender = "male" | "female" | "";

interface Participant {
  name: string;
  gender: ParticipantGender;
  packageSlug: string; // "" | "supreme-combo" | "hijama-package" | "fire-package"
  massageEnabled: boolean;
  massageSlug: string; // "" | "massage-30" | "massage-60"
  differentAddress: boolean;
  overrideAddress: string;
  overridePostcode: string;
}

function participantServices(p: Participant): string[] {
  return [
    ...(p.packageSlug ? [p.packageSlug] : []),
    ...(p.massageEnabled && p.massageSlug ? [p.massageSlug] : []),
  ];
}

interface ServiceOption {
  slug: string;
  name: string;
  price: number | string;
  duration_mins: number;
  gender_restrictions: string;
}

interface PrefillClient {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  area: string | null;
}

interface EnquiryPrefill {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  service_interest: string | null;
  notes: string | null;
}

interface AvailableSlot {
  time: string;
  availableStaffByGender: { male: number; female: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Contact", heading: "Contact & source" },
  { n: 2, label: "Services", heading: "Services & participants" },
  { n: 3, label: "Location", heading: "Location & time" },
  { n: 4, label: "Confirm", heading: "Review & confirm" },
] as const;

const SOURCE_OPTIONS = [
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "admin", label: "Repeat client" },
  { value: "other", label: "Other" },
];

const MAX_PARTICIPANTS = 6;
const DRAFT_KEY = "booking-new-draft";
const CREATED_KEY = "booking-new-created-toast";

const PACKAGE_OPTIONS = [
  {
    slug: "supreme-combo",
    name: "Supreme Combo Package",
    price: "£55",
    description: "Pre-Cupping massage / IASTM · Dry Cupping · Fire Cupping · Wet Cupping",
  },
  {
    slug: "hijama-package",
    name: "Hijama Package",
    price: "£45",
    description: "Pre-Cupping massage · Dry Cupping · Wet Cupping",
  },
  {
    slug: "fire-package",
    name: "Fire Package",
    price: "£40",
    description: "Pre-Cupping massage with essential oils · Dry / Fire Cupping",
  },
] as const;

const MASSAGE_OPTIONS = [
  { slug: "massage-30", label: "30 minutes", price: "£40" },
  { slug: "massage-60", label: "1 hour", price: "£60" },
] as const;

function emptyParticipant(name = ""): Participant {
  return {
    name,
    gender: "",
    packageSlug: "",
    massageEnabled: false,
    massageSlug: "",
    differentAddress: false,
    overrideAddress: "",
    overridePostcode: "",
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(
  step: number,
  vals: FormValues
): Record<string, string> {
  const errs: Record<string, string> = {};

  if (step === 1) {
    if (!vals.fullName.trim()) errs.full_name = "Add the client's name so we know who to book.";
    if (!vals.phone.trim()) errs.phone = "Phone number is too short. Include the area code.";
    if (!vals.bookingSource) errs.booking_source = "Pick where this booking came from.";
    if (!vals.email.trim()) errs.email = "Add an email address so we can send confirmations.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals.email.trim()))
      errs.email = "Email needs an @. For example, sara@example.com.";
  }

  if (step === 2) {
    vals.participants.forEach((p, i) => {
      if (!p.name.trim())
        errs[`participant_name_${i}`] = `Label this person so the therapist knows who's who (e.g. "Client 1", "Husband").`;
      if (!p.gender)
        errs[`participant_gender_${i}`] = "Pick the client's gender so we can match the right therapist.";
      if (!p.packageSlug && !(p.massageEnabled && p.massageSlug))
        errs[`participant_services_${i}`] = "Pick at least one package or massage for this person.";
    });
  }

  if (step === 3) {
    if (!vals.address.trim()) errs.address = "Street address is needed so the therapist can find them.";
    if (!vals.postcode.trim()) errs.postcode = "Postcode doesn't look right. Try the format LU1 1AA.";
    if (!vals.city.trim()) errs.city = "Add a city so we can find available appointment times.";
    if (!vals.bookingDate) errs.booking_date = "Pick a date from today onwards.";
    if (!vals.startTime) errs.start_time = "Pick a start time.";
  }

  if (step === 4) {
    if (!vals.consentAcknowledged)
      errs.consent_acknowledged = "Confirm the consent box before booking.";
  }

  return errs;
}

// ─── FormValues ───────────────────────────────────────────────────────────────

interface FormValues {
  bookingSource: string;
  fullName: string;
  email: string;
  phone: string;
  bookingForMode: "self" | "someone_else" | "group";
  participants: Participant[];
  address: string;
  postcode: string;
  city: string;
  area: string;
  accessNotes: string;
  parkingNotes: string;
  bookingDate: string;
  startTime: string;
  overrideAvailability: boolean;
  customerNotes: string;
  healthNotes: string;
  consentAcknowledged: boolean;
  sendConfirmationEmail: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepRail({ current, onNavigate }: { current: number; onNavigate: (step: number) => void }) {
  return (
    <>
      {/* Desktop step rail */}
      <nav aria-label="Booking steps" className="hidden sm:block">
        <ol className="flex items-start gap-0">
          {STEPS.map((step, idx) => {
            const done = current > step.n;
            const active = current === step.n;
            // Active circle is larger and has a halo ring to distinguish from completed
            const circleClasses = cn(
              "relative flex shrink-0 items-center justify-center rounded-full font-semibold transition-[background-color,color,box-shadow,border-color] duration-300",
              done
                ? "size-8 border-2 border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)] text-xs"
                : active
                ? "size-10 border-2 border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)] text-sm ring-4 ring-[var(--admin-primary)]/15 ring-offset-2 ring-offset-[var(--admin-canvas)]"
                : "size-8 border-2 border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-text-muted)] text-xs"
            );
            return (
              <li key={step.n} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full items-center">
                  {/* Left track — 2px for presence */}
                  {idx > 0 && (
                    <div
                      className={cn(
                        "h-[2px] flex-1 transition-colors duration-300",
                        done || active ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-border)]"
                      )}
                    />
                  )}
                  {/* Circle — clickable when completed, static otherwise */}
                  {done ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(step.n)}
                      title={`Step ${step.n}: done`}
                      aria-label={`Go back to step ${step.n}: ${step.label}`}
                      className={cn(circleClasses, "hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-1")}
                    >
                      <Check className="size-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <div
                      className={circleClasses}
                      aria-current={active ? "step" : undefined}
                      title={active ? `Step ${step.n}: current` : `Step ${step.n}: not yet`}
                    >
                      <span>{step.n}</span>
                    </div>
                  )}
                  {/* Right track — 2px for presence */}
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-[2px] flex-1 transition-colors duration-300",
                        done ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-border)]"
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "text-center leading-tight transition-colors duration-300",
                    active
                      ? "text-sm font-semibold text-[var(--admin-primary)]"
                      : done
                      ? "text-xs font-medium text-[var(--admin-body)]"
                      : "text-xs font-medium text-[var(--admin-text-muted)]"
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile step progress */}
      <div className="sm:hidden">
        <p className="mb-2 text-sm font-medium text-[var(--admin-body)]">
          Step {current} of {STEPS.length}: {STEPS[current - 1].label}
        </p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--admin-border)]">
          <div
            className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-300"
            style={{ width: `${(current / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
}

function PreFillChip({
  source,
  tooltip,
}: {
  source: "client" | "enquiry";
  tooltip: string;
}) {
  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
      style={{
        background: "oklch(94% 0.008 280)",
        color: "oklch(30% 0.02 280)",
      }}
    >
      {source === "client" ? "From client profile" : "From enquiry"}
    </span>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--admin-heading)]">
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">
          *
        </span>
      )}
    </label>
  );
}

function FieldError({ error, id }: { error?: string; id: string }) {
  if (!error) return null;
  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center gap-1.5 text-xs text-[oklch(26%_0.14_25)]"
    >
      <X className="size-3.5 shrink-0" aria-hidden="true" />
      {error}
    </div>
  );
}

function SelectField({
  id,
  label,
  required,
  error,
  hint,
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"select"> & {
  id: string;
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label && <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>}
      <select
        id={id}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? "true" : undefined}
        className={cn(
          "flex h-10 w-full rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30",
          error ? "border-[oklch(26%_0.14_25)]" : "border-[var(--admin-border-form)]"
        )}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p className="text-xs text-[var(--admin-text-muted)]">{hint}</p>}
      <FieldError error={error} id={errorId} />
    </div>
  );
}

function TextareaField({
  id,
  label,
  error,
  hint,
  rows = 3,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"textarea"> & {
  id: string;
  label?: string;
  error?: string;
  hint?: string;
  rows?: number;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <textarea
        id={id}
        rows={rows}
        className="flex w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 resize-none"
        {...props}
      />
      {hint && !error && <p className="text-xs text-[var(--admin-text-muted)]">{hint}</p>}
      {error && <FieldError error={error} id={`${id}-error`} />}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AssignableStaffMember {
  id: string;
  name: string;
  gender: string;
  can_take_bookings: boolean;
}

export function ManualBookingForm({
  prefillClient,
  enquiry,
  prefillFailed = false,
  canAssign = false,
  assignableStaff = [],
  currentUserId = "",
  currentUserGender = "",
  currentUserName = "",
  currentUserIsBookable = false,
}: {
  services: ServiceOption[];
  prefillClient: PrefillClient | null;
  enquiry: EnquiryPrefill | null;
  prefillFailed?: boolean;
  canAssign?: boolean;
  assignableStaff?: AssignableStaffMember[];
  currentUserId?: string;
  currentUserGender?: string;
  currentUserName?: string;
  currentUserIsBookable?: boolean;
}) {
  const [state, action, pending] = useActionState(createManualBooking, {} as ManualBookingState);

  const [step, setStep] = useState(1);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [stepBannerError, setStepBannerError] = useState("");
  const [prefillEdited, setPrefillEdited] = useState<Set<string>>(new Set());
  const [confirmDuplicate, setConfirmDuplicate] = useState<boolean>(false);

  // reset the acknowledgement whenever a new duplicate match comes back
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfirmDuplicate(false);
  }, [state.duplicateWarning]);

  // Form values
  const [bookingSource, setBookingSource] = useState(
    enquiry?.source && SOURCE_OPTIONS.some((o) => o.value === enquiry.source)
      ? enquiry.source
      : "phone"
  );
  const [fullName, setFullName] = useState(prefillClient?.full_name ?? enquiry?.full_name ?? "");
  const [email, setEmail] = useState(prefillClient?.email ?? enquiry?.email ?? "");
  const [phone, setPhone] = useState(prefillClient?.phone ?? enquiry?.phone ?? "");
  const [bookingForMode, setBookingForMode] = useState<"self" | "someone_else" | "group">("self");

  const [participants, setParticipants] = useState<Participant[]>([
    emptyParticipant(prefillClient?.full_name ?? enquiry?.full_name ?? ""),
  ]);

  const [address, setAddress] = useState(prefillClient?.address ?? "");
  const [postcode, setPostcode] = useState(prefillClient?.postcode ?? "");
  const [city, setCity] = useState(prefillClient?.city ?? "");
  const [area, setArea] = useState(prefillClient?.area ?? "");
  const [accessNotes, setAccessNotes] = useState("");
  const [parkingNotes, setParkingNotes] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [overrideAvailability, setOverrideAvailability] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const leaveDialogRef = useRef<HTMLDivElement>(null);
  const leaveDialogReturnFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap + first-focus + restore-focus for the Leave dialog (WCAG 2.4.3, 2.1.2).
  const trapLeaveDialogFocus = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowLeaveDialog(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = leaveDialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    []
  );

  useEffect(() => {
    if (showLeaveDialog) {
      leaveDialogReturnFocusRef.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => {
        const focusables = leaveDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        focusables?.[0]?.focus();
      });
    } else if (leaveDialogReturnFocusRef.current) {
      leaveDialogReturnFocusRef.current.focus();
      leaveDialogReturnFocusRef.current = null;
    }
  }, [showLeaveDialog]);

  // Postcode lookup
  const [postcodeLookupError, setPostcodeLookupError] = useState("");

  // Same-gender group availability (or single participant)
  const [availSlots, setAvailSlots] = useState<AvailableSlot[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availChecked, setAvailChecked] = useState(false);
  const [availReason, setAvailReason] = useState("");

  // Mixed-gender group availability (Option C Phase 1 — two sections, one start_time)
  const [femaleAvailSlots, setFemaleAvailSlots] = useState<AvailableSlot[]>([]);
  const [maleAvailSlots, setMaleAvailSlots] = useState<AvailableSlot[]>([]);
  const [femaleAvailLoading, setFemaleAvailLoading] = useState(false);
  const [maleAvailLoading, setMaleAvailLoading] = useState(false);
  const [femaleAvailChecked, setFemaleAvailChecked] = useState(false);
  const [maleAvailChecked, setMaleAvailChecked] = useState(false);
  const [femaleAvailReason, setFemaleAvailReason] = useState("");
  const [maleAvailReason, setMaleAvailReason] = useState("");
  const [showFemaleOverrideConfirm, setShowFemaleOverrideConfirm] = useState(false);
  const [showMaleOverrideConfirm, setShowMaleOverrideConfirm] = useState(false);
  const [femaleOverride, setFemaleOverride] = useState(false);
  const [maleOverride, setMaleOverride] = useState(false);

  const [customerNotes, setCustomerNotes] = useState(
    enquiry ? [enquiry.service_interest, enquiry.notes].filter(Boolean).join("\n\n") : ""
  );
  const [healthNotes, setHealthNotes] = useState("");
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState(true);

  // Per-participant assignment choices for step 4
  type AssignmentChoice = "unassigned" | "assign" | "self";
  const [assignmentChoices, setAssignmentChoices] = useState<AssignmentChoice[]>([]);
  const [assignmentStaffIds, setAssignmentStaffIds] = useState<string[]>([]);

  // Keep assignment arrays sized to participant count
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssignmentChoices((prev) => {
      const next = [...prev];
      while (next.length < participants.length) next.push("unassigned");
      return next.slice(0, participants.length);
    });
    setAssignmentStaffIds((prev) => {
      const next = [...prev];
      while (next.length < participants.length) next.push("");
      return next.slice(0, participants.length);
    });
  }, [participants.length]);

  // Derived
  const hasPrefill = !!(prefillClient || enquiry);
  const prefillSource = prefillClient ? "client" : enquiry ? "enquiry" : null;
  const prefillTooltip = prefillClient
    ? `Loaded from ${prefillClient.full_name}'s profile`
    : enquiry
    ? `Loaded from enquiry ${enquiry.id.slice(0, 8)}`
    : "";

  const formVals: FormValues = {
    bookingSource, fullName, email, phone, bookingForMode,
    participants, address, postcode, city, area, accessNotes, parkingNotes,
    bookingDate, startTime, overrideAvailability,
    customerNotes, healthNotes, consentAcknowledged, sendConfirmationEmail,
  };

  // All selected services (union across participants — max 2 per participant)
  const allSelectedSlugs = Array.from(
    new Set(participants.flatMap(participantServices))
  );

  // Mixed-gender group detection
  const femaleParticipants = participants.filter((p) => p.gender === "female");
  const maleParticipants = participants.filter((p) => p.gender === "male");
  const isMixedGenderGroup =
    bookingForMode === "group" &&
    femaleParticipants.length > 0 &&
    maleParticipants.length > 0;

  // Availability check prerequisites
  const canCheckAvailability =
    city.trim().length >= 2 &&
    participants.some((p) => p.gender === "male" || p.gender === "female") &&
    allSelectedSlugs.length > 0 &&
    participants.every((p) => participantServices(p).length > 0);

  const checkAvailability = useCallback(
    async (date: string) => {
      if (!date || !canCheckAvailability) return;

      async function fetchSlotsForGenders(genders: ("male" | "female")[]) {
        try {
          const res = await fetch("/api/availability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, serviceIds: allSelectedSlugs, participantGenders: genders, city: city.trim() }),
          });
          if (!res.ok) return { slots: [], reason: "Couldn't check availability. Try again." };
          const data = await res.json();
          return { slots: (data.slots ?? []) as AvailableSlot[], reason: (data.reason ?? "") as string };
        } catch {
          return { slots: [], reason: "Connection error. Check your network and try again." };
        }
      }

      setStartTime("");

      if (isMixedGenderGroup) {
        // Option C Phase 1: two independent checks
        setFemaleAvailLoading(true); setFemaleAvailChecked(false);
        setMaleAvailLoading(true); setMaleAvailChecked(false);

        const femaleGenders = femaleParticipants.map(() => "female" as const);
        const maleGenders = maleParticipants.map(() => "male" as const);

        fetchSlotsForGenders(femaleGenders).then(({ slots, reason }) => {
          setFemaleAvailSlots(slots);
          setFemaleAvailReason(reason);
          setFemaleAvailLoading(false);
          setFemaleAvailChecked(true);
        });
        fetchSlotsForGenders(maleGenders).then(({ slots, reason }) => {
          setMaleAvailSlots(slots);
          setMaleAvailReason(reason);
          setMaleAvailLoading(false);
          setMaleAvailChecked(true);
        });
      } else {
        const validGenders = participants
          .map((p) => p.gender)
          .filter((g): g is "male" | "female" => g === "male" || g === "female");

        setAvailLoading(true);
        setAvailChecked(false);

        fetchSlotsForGenders(validGenders).then(({ slots, reason }) => {
          setAvailSlots(slots);
          setAvailReason(reason);
          setAvailLoading(false);
          setAvailChecked(true);
        });
      }
    },
    [canCheckAvailability, allSelectedSlugs, city, participants, isMixedGenderGroup,
     femaleParticipants, maleParticipants]
  );

  // Session storage draft
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw && !hasPrefill) {
        const draft = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (draft.step) setStep(draft.step);
        if (draft.bookingSource) setBookingSource(draft.bookingSource);
        if (draft.fullName) setFullName(draft.fullName);
        if (draft.email) setEmail(draft.email);
        if (draft.phone) setPhone(draft.phone);
        if (draft.bookingForMode) setBookingForMode(draft.bookingForMode);
        if (draft.participants?.length) setParticipants(draft.participants);
        if (draft.address) setAddress(draft.address);
        if (draft.postcode) setPostcode(draft.postcode);
        if (draft.city) setCity(draft.city);
        if (draft.area) setArea(draft.area);
        if (draft.customerNotes) setCustomerNotes(draft.customerNotes);
        if (draft.healthNotes) setHealthNotes(draft.healthNotes);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        step, bookingSource, fullName, email, phone, bookingForMode,
        participants, address, postcode, city, area, customerNotes, healthNotes,
      }));
    } catch {}
  }, [step, bookingSource, fullName, email, phone, bookingForMode, participants, address, postcode, city, area, customerNotes, healthNotes]);

  // Keep first participant name in sync when "Themself" is selected
  useEffect(() => {
    if (bookingForMode === "self") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setParticipants((prev) => [{ ...prev[0], name: fullName }, ...prev.slice(1)]);
    }
  }, [fullName, bookingForMode]);

  // Warn browser on unload when form has data
  const formHasData = !!(fullName.trim() || phone.trim() || email.trim() || address.trim());
  useEffect(() => {
    if (!formHasData) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formHasData]);

  // Pre-fill failure toast — fires once on mount if the server fetch for clientId/enquiryId failed
  useEffect(() => {
    if (prefillFailed) {
      toast.warning("Couldn't load client details. Fill in manually.", { duration: 6000 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server error toast — persistent, fires when the server action returns an error
  const prevErrorRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (state.error && state.error !== prevErrorRef.current) {
      toast.error("Something went wrong. Your details are still here. Try again.", { duration: Infinity });
    }
    prevErrorRef.current = state.error;
  }, [state.error]);

  // Participant helpers
  function updateParticipant(index: number, patch: Partial<Participant>) {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  function setParticipantMassageEnabled(index: number, enabled: boolean) {
    updateParticipant(index, {
      massageEnabled: enabled,
      massageSlug: enabled ? (participants[index]?.massageSlug || "") : "",
    });
  }

  function setParticipantMassageSlug(index: number, slug: string) {
    updateParticipant(index, { massageSlug: slug });
  }

  // Booking-for mode change — drives participant structure
  function handleBookingForChange(mode: "self" | "someone_else" | "group") {
    setBookingForMode(mode);
    if (mode === "self") {
      setParticipants([emptyParticipant(fullName)]);
    } else if (mode === "someone_else") {
      setParticipants([emptyParticipant()]);
    } else {
      // Group: ensure at least 2 participants
      setParticipants((prev) =>
        prev.length >= 2 ? prev : [...prev, emptyParticipant()]
      );
    }
  }

  function addParticipant() {
    if (participants.length >= MAX_PARTICIPANTS) return;
    setParticipants((prev) => [...prev, emptyParticipant()]);
  }

  function removeParticipant(index: number) {
    if (participants.length <= 1) return;
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  // Postcode auto-fill via postcodes.io
  async function handlePostcodeBlur() {
    const raw = postcode.trim().replace(/\s/g, "").toUpperCase();
    if (raw.length < 5) return;
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${raw}`);
      if (!res.ok) {
        setPostcodeLookupError("Postcode not found. Fill in city and area manually.");
        return;
      }
      const data = await res.json();
      const toTitleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      if (!city.trim()) setCity(toTitleCase(data.result?.post_town ?? ""));
      // Area is NOT auto-filled — postcodes.io admin_district is inaccurate for local areas
      setPostcodeLookupError("");
    } catch {
      setPostcodeLookupError("Couldn't check postcode. Fill in city and area manually.");
    }
  }

  // Step navigation
  function handleContinue() {
    const errs = validateStep(step, formVals);
    const errCount = Object.keys(errs).length;
    if (errCount > 0) {
      setStepErrors(errs);
      setStepBannerError(errCount >= 3 ? "Check the highlighted fields before continuing." : "");
      const firstKey = Object.keys(errs)[0];
      document.getElementById(firstKey)?.focus();
      return;
    }
    setStepErrors({});
    setStepBannerError("");
    setStep((s) => Math.min(s + 1, 4));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setStepErrors({});
    setStepBannerError("");
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFormSubmit() {
    try {
      sessionStorage.setItem(CREATED_KEY, Date.now().toString());
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {}
  }

  function markEdited(field: string) {
    setPrefillEdited((prev) => new Set([...prev, field]));
  }

  function isPrefilled(field: string) {
    return hasPrefill && !prefillEdited.has(field);
  }

  // Availability slot label
  function slotLabel(slot: AvailableSlot) {
    const { male, female } = slot.availableStaffByGender;
    const parts = [];
    if (male > 0) parts.push(`${male} male therapist${male === 1 ? "" : "s"}`);
    if (female > 0) parts.push(`${female} female therapist${female === 1 ? "" : "s"}`);
    return parts.length > 0 ? parts.join(", ") : "available";
  }

  // ─── Step readiness (drives aria-disabled on Continue) ───────────────────────

  const isStepReady: boolean = (() => {
    if (step === 1) return !!(fullName.trim() && phone.trim() && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
    if (step === 2) return participants.every(
      (p) => p.name.trim() && p.gender && (p.packageSlug || (p.massageEnabled && p.massageSlug))
    );
    if (step === 3) return !!(
      address.trim() && postcode.trim() && city.trim() &&
      bookingDate && startTime
    );
    if (step === 4) return consentAcknowledged;
    return false;
  })();

  // A duplicate match blocks submission until the admin acknowledges it.
  const duplicateBlocked = Boolean(state.duplicateWarning) && !confirmDuplicate;
  const submitDisabled = pending || !isStepReady || duplicateBlocked;

  // ─── Hidden inputs for server action ─────────────────────────────────────────

  const hiddenInputs = (
    <>
      {enquiry && <input type="hidden" name="enquiry_id" value={enquiry.id} />}
      {prefillClient && <input type="hidden" name="client_id" value={prefillClient.id} />}
      <input type="hidden" name="booking_source" value={bookingSource} />
      <input type="hidden" name="full_name" value={fullName} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="booking_for" value={bookingForMode === "group" || participants.length > 1 ? "group" : bookingForMode} />
      <input type="hidden" name="number_of_people" value={participants.length} />
      {participants.flatMap((p, i) => {
        const slugs = participantServices(p);
        return [
          <input key={`pn${i}`} type="hidden" name={`participant_name_${i}`} value={p.name} />,
          <input key={`pg${i}`} type="hidden" name={`participant_gender_${i}`} value={p.gender} />,
          <input key={`pnt${i}`} type="hidden" name={`participant_note_${i}`} value={
            p.differentAddress && p.overrideAddress
              ? `Visit address: ${p.overrideAddress}, ${p.overridePostcode}`
              : ""
          } />,
          ...slugs.map((slug) => (
            <input key={`ps${i}-${slug}`} type="hidden" name={`participant_services_${i}[]`} value={slug} />
          )),
        ];
      })}
      {allSelectedSlugs.map((slug) => (
        <input key={slug} type="hidden" name="service_slugs" value={slug} />
      ))}
      <input type="hidden" name="address" value={address} />
      <input type="hidden" name="postcode" value={postcode} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="access_notes" value={accessNotes} />
      <input type="hidden" name="parking_notes" value={parkingNotes} />
      <input type="hidden" name="booking_date" value={bookingDate} />
      <input type="hidden" name="start_time" value={startTime} />
      {(overrideAvailability || femaleOverride || maleOverride) && (
        <input type="hidden" name="override_availability" value="on" />
      )}
      <input type="hidden" name="customer_notes" value={customerNotes} />
      <input type="hidden" name="health_notes" value={healthNotes} />
      <input type="hidden" name="consent_acknowledged" value={consentAcknowledged ? "on" : ""} />
      <input type="hidden" name="send_confirmation_email" value={sendConfirmationEmail ? "on" : ""} />
      {participants.map((_, i) => {
        const choice = assignmentChoices[i] ?? "unassigned";
        const staffId =
          choice === "self" ? currentUserId :
          choice === "assign" ? (assignmentStaffIds[i] ?? "") :
          "";
        return <input key={`ta${i}`} type="hidden" name={`therapist_assignment_${i}`} value={staffId} />;
      })}
    </>
  );

  // ─── Step panels ──────────────────────────────────────────────────────────────

  const multiErrorBanner = stepBannerError ? (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center gap-2.5 rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] px-3 py-3 text-sm text-[oklch(26%_0.14_25)]"
    >
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      {stepBannerError}
    </div>
  ) : null;

  const step1 = (
    <div className={step === 1 ? "grid gap-4" : "hidden"} aria-hidden={step !== 1}>
      {step === 1 && multiErrorBanner}
      <AdminPanel title="Contact & source">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="booking_source"
            label="Booking source"
            required
            error={stepErrors.booking_source}
            value={bookingSource}
            onChange={(e) => setBookingSource(e.target.value)}
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </SelectField>

          <div className="grid gap-1.5">
            <FieldLabel htmlFor="full_name" required>Full name</FieldLabel>
            <input
              id="full_name"
              required
              aria-describedby={stepErrors.full_name ? "full_name-error" : undefined}
              aria-invalid={stepErrors.full_name ? "true" : undefined}
              value={fullName}
              placeholder="As the client would like it on their record"
              maxLength={100}
              onChange={(e) => { setFullName(e.target.value); markEdited("full_name"); }}
              className={cn(
                "flex h-10 w-full rounded-[var(--admin-radius-control)] border px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30",
                stepErrors.full_name ? "border-[oklch(26%_0.14_25)]" : "border-[var(--admin-border-form)]",
                isPrefilled("full_name") ? "bg-[var(--admin-selected-sky)]" : "bg-[var(--admin-surface-input)]"
              )}
            />
            {isPrefilled("full_name") && prefillSource && (
              <PreFillChip source={prefillSource} tooltip={prefillTooltip} />
            )}
            <FieldError error={stepErrors.full_name} id="full_name-error" />
          </div>

          <div className="grid gap-1.5">
            <FieldLabel htmlFor="email" required>Email address</FieldLabel>
            <input
              id="email"
              type="email"
              required
              value={email}
              placeholder="sara@example.com"
              maxLength={254}
              aria-describedby={stepErrors.email ? "email-error" : undefined}
              aria-invalid={stepErrors.email ? "true" : undefined}
              onChange={(e) => { setEmail(e.target.value); markEdited("email"); }}
              className={cn(
                "flex h-10 w-full rounded-[var(--admin-radius-control)] border px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30",
                stepErrors.email ? "border-[oklch(26%_0.14_25)]" : "border-[var(--admin-border-form)]",
                isPrefilled("email") ? "bg-[var(--admin-selected-sky)]" : "bg-[var(--admin-surface-input)]"
              )}
            />
            <p className="text-xs text-[var(--admin-text-muted)]">Used for confirmations and reminders.</p>
            {isPrefilled("email") && prefillSource && (
              <PreFillChip source={prefillSource} tooltip={prefillTooltip} />
            )}
            <FieldError error={stepErrors.email} id="email-error" />
          </div>

          <div className="grid gap-1.5">
            <FieldLabel htmlFor="phone" required>Phone number</FieldLabel>
            <input
              id="phone"
              required
              aria-describedby={stepErrors.phone ? "phone-error" : undefined}
              aria-invalid={stepErrors.phone ? "true" : undefined}
              value={phone}
              placeholder="07…"
              maxLength={20}
              onChange={(e) => { setPhone(e.target.value); markEdited("phone"); }}
              className={cn(
                "flex h-10 w-full rounded-[var(--admin-radius-control)] border px-3 py-2 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30",
                stepErrors.phone ? "border-[oklch(26%_0.14_25)]" : "border-[var(--admin-border-form)]",
                isPrefilled("phone") ? "bg-[var(--admin-selected-sky)]" : "bg-[var(--admin-surface-input)]"
              )}
            />
            <p className="text-xs text-[var(--admin-text-muted)]">Used for WhatsApp and SMS.</p>
            {isPrefilled("phone") && prefillSource && (
              <PreFillChip source={prefillSource} tooltip={prefillTooltip} />
            )}
            <FieldError error={stepErrors.phone} id="phone-error" />
          </div>
        </div>

        <fieldset className="mt-4 border-0 p-0">
          <legend className="mb-2 text-sm font-medium text-[var(--admin-heading)]">
            Booking for
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              { value: "self" as const, label: "Themself", desc: "Caller is the client" },
              { value: "someone_else" as const, label: "Someone else", desc: "A single person, not the caller" },
              { value: "group" as const, label: "A group of people", desc: "Two or more participants" },
            ]).map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[var(--admin-radius-card)] border p-3 transition-colors",
                  bookingForMode === opt.value
                    ? "border-[var(--admin-primary)] bg-[oklch(93.5%_0.038_155)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-panel)] hover:border-[var(--admin-primary)]/30"
                )}
              >
                <input
                  type="radio"
                  name="booking_for_display"
                  value={opt.value}
                  checked={bookingForMode === opt.value}
                  onChange={() => handleBookingForChange(opt.value)}
                  className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                />
                <span>
                  <span className={cn("block text-sm font-medium", bookingForMode === opt.value ? "text-[var(--admin-primary)]" : "text-[var(--admin-body)]")}>
                    {opt.label}
                  </span>
                  <span className="block text-xs text-[var(--admin-text-muted)]">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </AdminPanel>
    </div>
  );

  const step2 = (
    <div className={step === 2 ? "grid gap-4" : "hidden"} aria-hidden={step !== 2}>
      {step === 2 && multiErrorBanner}
      <AdminPanel title="Services & participants">
        {participants.map((participant, idx) => (
          <div
            key={idx}
            className={cn(
              "grid gap-4",
              idx > 0 && "border-t border-[var(--admin-border)] pt-4"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--admin-heading)]">
                {participants.length > 1 ? `Person ${idx + 1}` : "Participant"}
              </p>
              {bookingForMode === "group" && participants.length > 2 && idx > 0 && (
                <button
                  type="button"
                  onClick={() => removeParticipant(idx)}
                  className="flex items-center gap-1 rounded-[var(--admin-radius-control)] px-2 py-1 text-xs text-[var(--admin-text-muted)] transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[oklch(26%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                  aria-label={`Remove person ${idx + 1}`}
                  title={`Remove this person from the booking`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Remove
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminInput
                id={`participant_name_${idx}`}
                label="Name or label"
                required
                placeholder={idx === 0 ? "Client 1" : `Person ${idx + 1}`}
                maxLength={80}
                value={participant.name}
                error={stepErrors[`participant_name_${idx}`]}
                onChange={(e) => updateParticipant(idx, { name: e.target.value })}
              />

              <div className="grid gap-1.5">
                <SelectField
                  id={`participant_gender_${idx}`}
                  label="Client's gender"
                  required
                  error={stepErrors[`participant_gender_${idx}`]}
                  value={participant.gender}
                  onChange={(e) => updateParticipant(idx, { gender: e.target.value as ParticipantGender })}
                >
                  <option value="">Choose gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </SelectField>
              </div>
            </div>

            {/* Services — package + massage as co-equal options */}
            <fieldset
              className="border-0 p-0"
              aria-describedby={
                stepErrors[`participant_services_${idx}`]
                  ? `participant_services_${idx}-error`
                  : undefined
              }
            >
              <legend className="mb-1 text-sm font-medium text-[var(--admin-heading)]">
                Services
                <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">*</span>
              </legend>
              <p className="mb-3 text-xs text-[var(--admin-text-muted)]">Pick a package, add massage therapy, or choose both.</p>
              {stepErrors[`participant_services_${idx}`] && (
                <div className="mb-3">
                  <FieldError error={stepErrors[`participant_services_${idx}`]} id={`participant_services_${idx}-error`} />
                </div>
              )}

              {/* Package subsection */}
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">Package</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {PACKAGE_OPTIONS.map((pkg) => {
                  const selected = participant.packageSlug === pkg.slug;
                  return (
                    <label
                      key={pkg.slug}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-[var(--admin-radius-card)] border p-3 transition-[background-color,border-color,box-shadow,color] duration-150",
                        selected
                          ? "border-[var(--admin-primary)] bg-[oklch(93.5%_0.038_155)] ring-1 ring-[var(--admin-primary)]/20"
                          : "border-[var(--admin-border)] bg-[var(--admin-panel)] hover:border-[var(--admin-primary)]/40 hover:bg-[var(--admin-hover-mist)]"
                      )}
                    >
                      <input
                        type="radio"
                        name={`pkg_radio_${idx}`}
                        checked={selected}
                        onChange={() => { if (!selected) updateParticipant(idx, { packageSlug: pkg.slug }); }}
                        onClick={() => { if (selected) updateParticipant(idx, { packageSlug: "" }); }}
                        className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                      />
                      <span>
                        <span className={cn("block text-sm font-semibold", selected ? "text-[var(--admin-primary)]" : "text-[var(--admin-body)]")}>
                          {pkg.name}
                        </span>
                        <span className="block text-xs font-medium text-[var(--admin-text-muted)]">{pkg.price}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-[var(--admin-text-muted)]">{pkg.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Massage subsection */}
              <div className="mt-4 border-t border-[var(--admin-border)] pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">Massage therapy</p>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--admin-body)]">
                  <input
                    type="checkbox"
                    checked={participant.massageEnabled}
                    onChange={(e) => setParticipantMassageEnabled(idx, e.target.checked)}
                    className="shrink-0 accent-[var(--admin-primary)]"
                  />
                  Add massage therapy to this booking
                </label>
                {participant.massageEnabled && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {MASSAGE_OPTIONS.map((m) => {
                      const mSelected = participant.massageSlug === m.slug;
                      return (
                        <label
                          key={m.slug}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-[var(--admin-radius-card)] border p-3 transition-[background-color,border-color,box-shadow,color] duration-150",
                            mSelected
                              ? "border-[var(--admin-primary)] bg-[oklch(93.5%_0.038_155)] ring-1 ring-[var(--admin-primary)]/20"
                              : "border-[var(--admin-border)] bg-[var(--admin-panel)] hover:border-[var(--admin-primary)]/40"
                          )}
                        >
                          <input
                            type="radio"
                            name={`massage_radio_${idx}`}
                            checked={mSelected}
                            onChange={() => setParticipantMassageSlug(idx, m.slug)}
                            className="shrink-0 accent-[var(--admin-primary)]"
                          />
                          <span>
                            <span className={cn("block text-sm font-semibold", mSelected ? "text-[var(--admin-primary)]" : "text-[var(--admin-body)]")}>
                              {m.label}
                            </span>
                            <span className="block text-xs text-[var(--admin-text-muted)]">{m.price}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </fieldset>

            {idx > 0 && (
              <div className="border-t border-[var(--admin-border)] pt-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--admin-body)]">
                  <input
                    type="checkbox"
                    checked={participant.differentAddress}
                    onChange={(e) => updateParticipant(idx, { differentAddress: e.target.checked })}
                    className="accent-[var(--admin-primary)]"
                  />
                  Different address for this person?
                </label>
                {participant.differentAddress && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <AdminInput
                      id={`p${idx}-override-address`}
                      label="Address"
                      placeholder="Street name and number"
                      value={participant.overrideAddress}
                      onChange={(e) => updateParticipant(idx, { overrideAddress: e.target.value })}
                    />
                    <AdminInput
                      id={`p${idx}-override-postcode`}
                      label="Postcode"
                      placeholder="LU1 1AA"
                      value={participant.overridePostcode}
                      onChange={(e) => updateParticipant(idx, { overridePostcode: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {bookingForMode === "group" && participants.length < MAX_PARTICIPANTS && (
          <AdminButton
            variant="ghost"
            size="sm"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={addParticipant}
            className="mt-4 appearance-none border-0 text-[var(--admin-primary)] hover:bg-[oklch(93.5%_0.038_155)] hover:text-[var(--admin-primary)]"
          >
            Add another person
          </AdminButton>
        )}
        {bookingForMode === "group" && participants.length >= MAX_PARTICIPANTS && (
          <p className="mt-3 text-xs text-[var(--admin-text-muted)]">
            Maximum 6 per booking. For larger groups, contact the owner to arrange.
          </p>
        )}
      </AdminPanel>
    </div>
  );

  const step3 = (
    <div className={step === 3 ? "grid gap-4" : "hidden"} aria-hidden={step !== 3}>
      {step === 3 && multiErrorBanner}
      <AdminPanel title="Location">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          {/* Postcode first — auto-fills city + area */}
          <AdminInput
            id="postcode"
            label="Postcode"
            required
            placeholder="LU1 1AA"
            maxLength={10}
            value={postcode}
            error={stepErrors.postcode || postcodeLookupError || undefined}
            className={cn("sm:col-span-1", isPrefilled("postcode") ? "[&_input]:bg-[var(--admin-selected-sky)]" : "")}
            onChange={(e) => { setPostcode(e.target.value); markEdited("postcode"); setPostcodeLookupError(""); }}
            onBlur={handlePostcodeBlur}
          />
          <AdminInput
            id="city"
            label="City"
            required
            placeholder="Luton"
            maxLength={60}
            value={city}
            error={stepErrors.city}
            className={isPrefilled("city") ? "[&_input]:bg-[var(--admin-selected-sky)]" : ""}
            onChange={(e) => { setCity(e.target.value); markEdited("city"); setBookingDate(""); setStartTime(""); setAvailChecked(false); setAvailSlots([]); setFemaleAvailChecked(false); setMaleAvailChecked(false); }}
          />
          <AdminInput
            id="area"
            label="Area"
            placeholder="e.g. Bury Park"
            maxLength={80}
            value={area}
            className={isPrefilled("area") ? "[&_input]:bg-[var(--admin-selected-sky)]" : ""}
            onChange={(e) => { setArea(e.target.value); markEdited("area"); }}
          />
          <AdminInput
            id="address"
            label="Address"
            required
            placeholder="Street name and number"
            maxLength={200}
            value={address}
            error={stepErrors.address}
            className={isPrefilled("address") ? "[&_input]:bg-[var(--admin-selected-sky)]" : ""}
            onChange={(e) => { setAddress(e.target.value); markEdited("address"); }}
          />
          <TextareaField
            id="access_notes"
            label="Access notes"
            placeholder="e.g. side door, ring the bell twice"
            rows={2}
            maxLength={400}
            value={accessNotes}
            onChange={(e) => setAccessNotes(e.target.value)}
          />
          <TextareaField
            id="parking_notes"
            label="Parking notes"
            placeholder="e.g. free on-street after 6pm"
            rows={2}
            maxLength={400}
            value={parkingNotes}
            onChange={(e) => setParkingNotes(e.target.value)}
          />
        </div>
        {hasPrefill && prefillSource && (
          <div className="mt-3">
            <PreFillChip source={prefillSource} tooltip={prefillTooltip} />
          </div>
        )}
      </AdminPanel>

      <AdminPanel
        title="Date & time"
        actions={
          <button
            type="button"
            onClick={() => setShowOverrideConfirm(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--admin-text-muted)] transition-colors hover:text-[var(--admin-body)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <CalendarX className="size-3.5" aria-hidden="true" />
            Override availability
          </button>
        }
      >
        {!canCheckAvailability && !overrideAvailability && (
          <div className="rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel-muted)] p-4 text-center">
            <Clock className="mx-auto mb-2 size-5 text-[var(--admin-text-muted)]" aria-hidden="true" />
            <p className="text-sm text-[var(--admin-text-muted)]">
              Fill in the city, participant genders, and services above to see available times.
            </p>
          </div>
        )}

        {/* Date picker (shared across all cases when prerequisites met) */}
        {canCheckAvailability && !overrideAvailability && !isMixedGenderGroup && (
          <div className="grid gap-4">
            <AdminInput
              id="booking_date"
              label="Date"
              required
              type="date"
              value={bookingDate}
              error={stepErrors.booking_date}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => { const d = e.target.value; setBookingDate(d); setStartTime(""); if (d) checkAvailability(d); }}
            />
            {availLoading && (
              <div className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />Checking availability…
              </div>
            )}
            {availChecked && !availLoading && availSlots.length === 0 && (
              <div className="rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-[oklch(26%_0.13_55)]" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-[oklch(26%_0.13_55)]">No therapists available on this date. Pick another date, or override.</p>
                    {availReason && <p className="mt-0.5 text-xs text-[oklch(26%_0.13_55)]/80">{availReason}</p>}
                    <button type="button" onClick={() => setShowOverrideConfirm(true)} className="mt-2 text-xs font-semibold text-[oklch(26%_0.13_55)] underline underline-offset-2 hover:no-underline">Override this date</button>
                  </div>
                </div>
              </div>
            )}
            {availChecked && !availLoading && availSlots.length > 0 && (
              <div>
                <p className="mb-3 text-sm font-medium text-[var(--admin-heading)]">
                  Available times <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">*</span>
                </p>
                {stepErrors.start_time && <FieldError error={stepErrors.start_time} id="start_time-error" />}
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {availSlots.map((slot) => (
                    <button key={slot.time} type="button" onClick={() => setStartTime(slot.time)}
                      className={cn("flex flex-col items-center rounded-[var(--admin-radius-control)] border p-3 text-center transition-[background-color,border-color,box-shadow,color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                        startTime === slot.time ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-[0_2px_8px_oklch(23%_0.073_155/0.25)] ring-2 ring-[var(--admin-primary)]/20"
                          : "border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:border-[var(--admin-primary)]/40 hover:bg-[var(--admin-selected-sky)]"
                      )}>
                      <span className="text-sm font-bold leading-none">{slot.time}</span>
                      <span className={cn("mt-1 text-[10px]", startTime === slot.time ? "text-[var(--admin-on-primary)]/80" : "text-[var(--admin-text-muted)]")}>{slotLabel(slot)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Option C Phase 1: mixed-gender group — two independent availability sections */}
        {canCheckAvailability && !overrideAvailability && !femaleOverride && !maleOverride && isMixedGenderGroup && (
          <div className="grid gap-6">
            <AdminInput
              id="booking_date"
              label="Date"
              required
              type="date"
              value={bookingDate}
              error={stepErrors.booking_date}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => { const d = e.target.value; setBookingDate(d); setStartTime(""); if (d) checkAvailability(d); }}
            />
            {bookingDate && (
              <p className="text-xs text-[var(--admin-text-muted)] -mt-2">
                Both groups will share the same appointment time. Support for different times per group is coming soon.
              </p>
            )}

            {/* Female participants section */}
            <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--admin-heading)]">
                Female participants ({femaleParticipants.length})
              </p>
              {femaleAvailLoading && <div className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Checking availability for female participants…</div>}
              {femaleAvailChecked && !femaleAvailLoading && femaleAvailSlots.length === 0 && (
                <div className="rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-[oklch(26%_0.13_55)]" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-[oklch(26%_0.13_55)]">No female therapists available on this date. Pick another date, or override.</p>
                      {femaleAvailReason && <p className="mt-0.5 text-xs text-[oklch(26%_0.13_55)]/80">{femaleAvailReason}</p>}
                      <button type="button" onClick={() => setShowFemaleOverrideConfirm(true)} className="mt-2 text-xs font-semibold text-[oklch(26%_0.13_55)] underline underline-offset-2 hover:no-underline">Override for female participants</button>
                    </div>
                  </div>
                </div>
              )}
              {femaleAvailChecked && !femaleAvailLoading && femaleAvailSlots.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {femaleAvailSlots.map((slot) => (
                    <button key={slot.time} type="button" onClick={() => setStartTime(slot.time)}
                      className={cn("flex flex-col items-center rounded-[var(--admin-radius-control)] border p-2 text-center transition-[background-color,border-color,box-shadow,color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                        startTime === slot.time ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)] ring-2 ring-[var(--admin-primary)]/20"
                          : "border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:border-[var(--admin-primary)]/40 hover:bg-[var(--admin-selected-sky)]"
                      )}>
                      <span className="text-sm font-bold leading-none">{slot.time}</span>
                      <span className={cn("mt-1 text-[10px]", startTime === slot.time ? "text-[var(--admin-on-primary)]/80" : "text-[var(--admin-text-muted)]")}>{slot.availableStaffByGender.female} available</span>
                    </button>
                  ))}
                </div>
              )}
              {showFemaleOverrideConfirm && (
                <div className="mt-3 rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] p-3">
                  <p className="text-sm font-semibold text-[oklch(26%_0.13_55)]">Skip availability for female participants?</p>
                  <p className="mt-1 text-xs text-[oklch(26%_0.13_55)]/80">No availability will be checked. A female therapist will need to accept this booking.</p>
                  <div className="mt-2 flex gap-2">
                    <AdminButton size="sm" onClick={() => { setFemaleOverride(true); setShowFemaleOverrideConfirm(false); }} className="bg-[oklch(26%_0.13_55)] text-[var(--admin-on-primary)] hover:bg-[oklch(22%_0.12_55)]">Override</AdminButton>
                    <AdminButton size="sm" variant="ghost" onClick={() => setShowFemaleOverrideConfirm(false)}>Cancel</AdminButton>
                  </div>
                </div>
              )}
            </div>

            {/* Male participants section */}
            <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--admin-heading)]">
                Male participants ({maleParticipants.length})
              </p>
              {maleAvailLoading && <div className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Checking availability for male participants…</div>}
              {maleAvailChecked && !maleAvailLoading && maleAvailSlots.length === 0 && (
                <div className="rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-[oklch(26%_0.13_55)]" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-[oklch(26%_0.13_55)]">No male therapists available on this date. Pick another date, or override.</p>
                      {maleAvailReason && <p className="mt-0.5 text-xs text-[oklch(26%_0.13_55)]/80">{maleAvailReason}</p>}
                      <button type="button" onClick={() => setShowMaleOverrideConfirm(true)} className="mt-2 text-xs font-semibold text-[oklch(26%_0.13_55)] underline underline-offset-2 hover:no-underline">Override for male participants</button>
                    </div>
                  </div>
                </div>
              )}
              {maleAvailChecked && !maleAvailLoading && maleAvailSlots.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {maleAvailSlots.map((slot) => (
                    <button key={slot.time} type="button" onClick={() => setStartTime(slot.time)}
                      className={cn("flex flex-col items-center rounded-[var(--admin-radius-control)] border p-2 text-center transition-[background-color,border-color,box-shadow,color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                        startTime === slot.time ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)] ring-2 ring-[var(--admin-primary)]/20"
                          : "border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-body)] hover:border-[var(--admin-primary)]/40 hover:bg-[var(--admin-selected-sky)]"
                      )}>
                      <span className="text-sm font-bold leading-none">{slot.time}</span>
                      <span className={cn("mt-1 text-[10px]", startTime === slot.time ? "text-[var(--admin-on-primary)]/80" : "text-[var(--admin-text-muted)]")}>{slot.availableStaffByGender.male} available</span>
                    </button>
                  ))}
                </div>
              )}
              {showMaleOverrideConfirm && (
                <div className="mt-3 rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] p-3">
                  <p className="text-sm font-semibold text-[oklch(26%_0.13_55)]">Skip availability for male participants?</p>
                  <p className="mt-1 text-xs text-[oklch(26%_0.13_55)]/80">No availability will be checked. A male therapist will need to accept this booking.</p>
                  <div className="mt-2 flex gap-2">
                    <AdminButton size="sm" onClick={() => { setMaleOverride(true); setShowMaleOverrideConfirm(false); }} className="bg-[oklch(26%_0.13_55)] text-[var(--admin-on-primary)] hover:bg-[oklch(22%_0.12_55)]">Override</AdminButton>
                    <AdminButton size="sm" variant="ghost" onClick={() => setShowMaleOverrideConfirm(false)}>Cancel</AdminButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Override mode (single group or combined) */}
        {(overrideAvailability || (isMixedGenderGroup && (femaleOverride || maleOverride))) && (
          <div className="grid gap-4">
            <div className="flex items-start justify-between gap-3 rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] px-3 py-3">
              <div className="flex items-start gap-2.5 text-sm text-[oklch(26%_0.13_55)]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div>
                  <span className="font-medium">No availability checked.</span>
                  <span className="ml-1">This booking will be unassigned until a therapist accepts it.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOverrideAvailability(false);
                  setFemaleOverride(false);
                  setMaleOverride(false);
                  setBookingDate("");
                  setStartTime("");
                  setAvailChecked(false);
                  setAvailSlots([]);
                  setFemaleAvailChecked(false);
                  setMaleAvailChecked(false);
                }}
                className="shrink-0 text-xs font-medium text-[oklch(26%_0.13_55)] underline underline-offset-2 hover:no-underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Check available slots instead
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminInput id="booking_date" label="Date" required type="date" value={bookingDate} error={stepErrors.booking_date} min={new Date().toISOString().split("T")[0]} onChange={(e) => setBookingDate(e.target.value)} />
              <AdminInput id="start_time" label="Start time" required type="time" value={startTime} error={stepErrors.start_time} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
        )}

        {showOverrideConfirm && (
          <div className="mt-4 rounded-[var(--admin-radius-card)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] p-4">
            <p className="text-sm font-semibold text-[oklch(26%_0.13_55)]">Override availability?</p>
            <p className="mt-1 text-sm text-[oklch(26%_0.13_55)]/80">
              This booking will be created unassigned. A therapist will need to accept it before the visit.
            </p>
            <div className="mt-3 flex gap-2">
              <AdminButton size="sm" onClick={() => { setOverrideAvailability(true); setShowOverrideConfirm(false); }} className="bg-[oklch(26%_0.13_55)] text-[var(--admin-on-primary)] hover:bg-[oklch(22%_0.12_55)]">Override</AdminButton>
              <AdminButton size="sm" variant="ghost" onClick={() => setShowOverrideConfirm(false)}>Cancel</AdminButton>
            </div>
          </div>
        )}
      </AdminPanel>
    </div>
  );

  const editStep = (target: number) => () => setStep(target);

  const step4 = (
    <div className={step === 4 ? "grid gap-4" : "hidden"} aria-hidden={step !== 4}>
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid gap-4">
          <SummaryCard heading="Contact & source" onEdit={editStep(1)}>
            <dl className="grid gap-3 sm:grid-cols-2">
              {dl("Source", SOURCE_OPTIONS.find((o) => o.value === bookingSource)?.label)}
              {dl("Name", fullName)}
              {dl("Email", email || "Not provided")}
              {dl("Phone", phone)}
              {dl("Booking for", participants.length > 1 ? `Group (${participants.length} people)` : "Themself")}
            </dl>
          </SummaryCard>

          <SummaryCard heading="Services & participants" onEdit={editStep(2)}>
            {participants.map((p, i) => (
              <div key={i} className={cn("grid gap-1", i > 0 && "mt-3 border-t border-[var(--admin-border)] pt-3")}>
                <p className="text-xs font-semibold text-[var(--admin-heading)]">
                  {participants.length > 1 ? `Person ${i + 1}: ${p.name || "—"}` : p.name || "—"}
                </p>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {dl("Gender", p.gender || "Not set")}
                  {dl("Services", (() => {
                    const names: string[] = [];
                    if (p.packageSlug) {
                      const pkg = PACKAGE_OPTIONS.find((o) => o.slug === p.packageSlug);
                      if (pkg) names.push(pkg.name);
                    }
                    if (p.massageEnabled && p.massageSlug) {
                      const m = MASSAGE_OPTIONS.find((o) => o.slug === p.massageSlug);
                      if (m) names.push(`Massage ${m.label}`);
                    }
                    return names.join(", ") || "None selected";
                  })())}
                </dl>
              </div>
            ))}
          </SummaryCard>

          <SummaryCard heading="Location & time" onEdit={editStep(3)}>
            <dl className="grid gap-3 sm:grid-cols-2">
              {dl("Address", [address, area, postcode, city].filter(Boolean).join(", "))}
              {dl("Date", bookingDate)}
              {dl("Start time", startTime)}
              {overrideAvailability && dl("Note", "Booking created unassigned. No availability check.")}
            </dl>
          </SummaryCard>
        </div>

        <div className="grid content-start gap-4 md:w-72">
          <AdminPanel title="Notes">
            <div className="grid gap-4">
              <TextareaField
                id="customer_notes"
                label="Customer notes"
                placeholder="Anything the client should know before their visit."
                maxLength={1000}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
              <TextareaField
                id="health_notes"
                label="Health notes"
                placeholder="Anything the therapist should know: injuries, conditions, medications."
                hint="Treated confidentially. Only the assigned therapist sees this."
                maxLength={2000}
                value={healthNotes}
                onChange={(e) => setHealthNotes(e.target.value)}
              />
            </div>
          </AdminPanel>

          {/* ── Assignment panel ── */}
          <AdminPanel
            title="Booking assignment"
            description="Optionally assign a therapist now. You can always change this later from the booking page."
          >
            <div className="grid gap-4">
              {participants.map((p, i) => {
                const choice = assignmentChoices[i] ?? "unassigned";
                // "Take myself" eligibility: current user is bookable and gender-matches this participant
                const selfEligible =
                  currentUserIsBookable &&
                  p.gender &&
                  (currentUserGender === p.gender);
                // Gender-filtered staff for "assign" option
                const eligibleStaff = assignableStaff.filter((s) =>
                  !p.gender || s.gender === p.gender
                );

                return (
                  <div
                    key={i}
                    className={cn(
                      "grid gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] p-4",
                      i > 0 && "mt-1"
                    )}
                  >
                    {participants.length > 1 && (
                      <p className="text-xs font-semibold text-[var(--admin-heading)]">
                        {p.name || `Person ${i + 1}`}
                        {p.gender && (
                          <span className="ml-1 font-normal text-[var(--admin-text-muted)]">
                            ({p.gender} therapist required)
                          </span>
                        )}
                      </p>
                    )}

                    {/* Option: Leave unassigned */}
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input
                        type="radio"
                        name={`assignment_choice_${i}`}
                        value="unassigned"
                        checked={choice === "unassigned"}
                        onChange={() => setAssignmentChoices((prev) => { const n = [...prev]; n[i] = "unassigned"; return n; })}
                        className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                      />
                      <span>
                        <span className="block font-medium text-[var(--admin-body)]">Leave unassigned</span>
                        <span className="block text-xs text-[var(--admin-text-muted)]">Sent as an open request. A therapist will claim it.</span>
                      </span>
                    </label>

                    {/* Option: Assign to a therapist (high-permission only) */}
                    {canAssign && eligibleStaff.length > 0 && (
                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input
                          type="radio"
                          name={`assignment_choice_${i}`}
                          value="assign"
                          checked={choice === "assign"}
                          onChange={() => setAssignmentChoices((prev) => { const n = [...prev]; n[i] = "assign"; return n; })}
                          className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                        />
                        <span className="flex-1">
                          <span className="block font-medium text-[var(--admin-body)]">Assign to a therapist</span>
                          {choice === "assign" && (
                            <select
                              value={assignmentStaffIds[i] ?? ""}
                              onChange={(e) => setAssignmentStaffIds((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                              className="mt-2 flex h-10 w-full rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30"
                            >
                              <option value="">Choose a therapist…</option>
                              {eligibleStaff.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          )}
                        </span>
                      </label>
                    )}

                    {/* Option: Take myself */}
                    {selfEligible && (
                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input
                          type="radio"
                          name={`assignment_choice_${i}`}
                          value="self"
                          checked={choice === "self"}
                          onChange={() => setAssignmentChoices((prev) => { const n = [...prev]; n[i] = "self"; return n; })}
                          className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                        />
                        <span>
                          <span className="block font-medium text-[var(--admin-body)]">Take this booking myself</span>
                          <span className="block text-xs text-[var(--admin-text-muted)]">Assigned to you ({currentUserName})</span>
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </AdminPanel>

          <AdminPanel title="Confirmation">
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    id="consent_acknowledged"
                    checked={consentAcknowledged}
                    onChange={(e) => setConsentAcknowledged(e.target.checked)}
                    className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                  />
                  <span className="text-[var(--admin-body)]">
                    I confirm that the client&apos;s details and consent have been obtained.
                    <span aria-hidden="true" className="ml-0.5 text-[oklch(26%_0.14_25)]">*</span>
                  </span>
                </label>
                {stepErrors.consent_acknowledged && (
                  <FieldError error={stepErrors.consent_acknowledged} id="consent_acknowledged-error" />
                )}
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={sendConfirmationEmail}
                  onChange={(e) => setSendConfirmationEmail(e.target.checked)}
                  className="mt-0.5 shrink-0 accent-[var(--admin-primary)]"
                />
                <span className="text-[var(--admin-body)]">Send confirmation email to client</span>
              </label>
            </div>
          </AdminPanel>
        </div>
      </div>

      {/* Unassigned note — always shown on step 4 */}
      {step === 4 && (
        <div className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.06_65)] bg-[oklch(95%_0.05_65)] px-3 py-3 text-sm text-[oklch(26%_0.13_55)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {overrideAvailability || femaleOverride || maleOverride
              ? "No availability checked. A therapist must be assigned before the visit."
              : "Once submitted, this booking will be unassigned until a therapist accepts it."}
          </span>
        </div>
      )}

      {state.error && (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] border border-[oklch(88%_0.045_20)] bg-[oklch(95.5%_0.028_20)] px-3 py-3 text-sm text-[oklch(26%_0.14_25)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {state.error} Your details are still here. Try again.
          </span>
        </div>
      )}
    </div>
  );

  // ─── Desktop navigation strip ─────────────────────────────────────────────────

  const navStrip = (
    <div className="hidden items-center justify-between gap-3 md:flex">
      {step > 1 ? (
        <AdminButton variant="secondary" onClick={handleBack}>
          Back
        </AdminButton>
      ) : formHasData ? (
        <AdminButton variant="ghost" onClick={() => setShowLeaveDialog(true)}>
          Cancel
        </AdminButton>
      ) : (
        <Link href="/admin/bookings" className="text-sm font-medium text-[var(--admin-text-muted)] transition-colors hover:text-[var(--admin-body)]">
          Cancel
        </Link>
      )}
      {step < 4 ? (
        <AdminButton
          variant="primary"
          onClick={handleContinue}
          disabled={!isStepReady}
          aria-disabled={!isStepReady || undefined}
        >
          Continue
        </AdminButton>
      ) : (
        <button
          type="submit"
          disabled={submitDisabled}
          aria-busy={pending || undefined}
          aria-disabled={((!isStepReady || duplicateBlocked) && !pending) || undefined}
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60 min-h-10"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Submit booking request
        </button>
      )}
    </div>
  );

  // ─── Leave dialog ──────────────────────────────────────────────────────────────

  const leaveDialog = showLeaveDialog ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-dialog-heading"
      ref={leaveDialogRef}
      onKeyDown={trapLeaveDialogFocus}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div className="fixed inset-0 bg-[oklch(12%_0.01_165)]/35" onClick={() => setShowLeaveDialog(false)} />
      <div className="relative z-10 w-full max-w-sm rounded-t-[var(--admin-radius-lg)] bg-[var(--admin-panel)] p-6 shadow-[0_8px_24px_oklch(23%_0.073_155/0.12)] sm:rounded-[var(--admin-radius-card)]">
        <h2 id="leave-dialog-heading" className="font-display text-base font-semibold text-[var(--admin-heading)]">
          Leave this booking?
        </h2>
        <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
          Your progress will be lost.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Link
            href="/admin/bookings"
            className="inline-flex items-center justify-center rounded-[var(--admin-radius-control)] bg-[oklch(40%_0.14_25)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-colors hover:bg-[oklch(33%_0.14_25)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Leave
          </Link>
          <AdminButton variant="secondary" onClick={() => setShowLeaveDialog(false)}>
            Keep going
          </AdminButton>
        </div>
      </div>
    </div>
  ) : null;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-6">
      {leaveDialog}
      <StepRail current={step} onNavigate={(n) => { setStepErrors({}); setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

      <form action={action} onSubmit={handleFormSubmit} className="grid gap-4 pb-20 md:pb-0">
        {hiddenInputs}
        {state.duplicateWarning ? (
          <DuplicateWarningBanner
            message={state.duplicateWarning}
            checked={confirmDuplicate}
            onCheckedChange={setConfirmDuplicate}
            acknowledgeLabel="Use the existing client record for this booking."
          />
        ) : null}
        {step1}
        {step2}
        {step3}
        {step4}
        {navStrip}

        {/* Mobile action bar — hidden at md+ where inline navStrip shows */}
        <div className="md:hidden">
        <AdminMobileActionBar submitting={pending}>
          {step > 1 && (
            <AdminButton variant="secondary" className="flex-1" onClick={handleBack}>
              Back
            </AdminButton>
          )}
          {step < 4 ? (
            <AdminButton
              variant="primary"
              className="flex-1"
              onClick={handleContinue}
              disabled={!isStepReady}
              aria-disabled={!isStepReady || undefined}
            >
              Continue
            </AdminButton>
          ) : (
            <button
              type="submit"
              disabled={submitDisabled}
              aria-busy={pending || undefined}
              aria-disabled={((!isStepReady || duplicateBlocked) && !pending) || undefined}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60 min-h-10"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Submit booking request
            </button>
          )}
        </AdminMobileActionBar>
        </div>
      </form>
    </div>
  );
}
