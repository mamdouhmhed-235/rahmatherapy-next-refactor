"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { submitBookingRequest } from "./actions";
import { AboutYouStep } from "./components/AboutYouStep";
import { BookingActionBar } from "./components/BookingActionBar";
import { BookingDialog } from "./components/BookingDialog";
import { getStepIndex } from "./components/BookingProgress";
import { BookingSummary } from "./components/BookingSummary";
import { ConfirmStep } from "./components/ConfirmStep";
import { MotionStep } from "./components/MotionStep";
import { PackageSelectionStep } from "./components/PackageSelectionStep";
import { ScheduleStep } from "./components/ScheduleStep";
import { SuccessScreen } from "./components/SuccessScreen";
import {
  getPackageSelectionError,
  getPackageTotal,
  getSelectedPackages,
} from "./data/booking-packages";
import type { BookingTimeSlot } from "./data/time-slots";
import { useBookingUrlState } from "./hooks/useBookingUrlState";
import {
  clearReturningCustomer,
  loadReturningCustomer,
  saveReturningCustomer,
} from "./utils/returning-customer";
import {
  bookingAcknowledgementSchema,
  bookingDetailsSchema,
  bookingVisitSchema,
  type BookingDetailsFormValues,
} from "./schemas/booking-schema";
import { useBookingDraftStore } from "./store/booking-store";
import {
  BOOKING_STEPS,
  emptyBookingDetails,
  type BookingDetails,
  type BookingStep,
} from "./types";

import styles from "./BookingExperience.module.css";

const SCHEDULE_FIELDS = ["preferredDate", "preferredTime"];

export function BookingExperience() {
  // This component is client-only (ssr: false), so the URL is readable at
  // first render. Initializing synchronously keeps the URL-sync effect from
  // ever seeing an open deep link while `open` is still false — the dev
  // StrictMode double-effect used to strip ?booking=1 through that gap.
  const [open, setOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      new URL(window.location.href).searchParams.get("booking") === "1"
  );
  const [packageError, setPackageError] = useState<string | undefined>();
  const [scheduleError, setScheduleError] = useState<string | undefined>();
  const [submissionError, setSubmissionError] = useState<string | undefined>();
  const [submittedBookingId, setSubmittedBookingId] = useState<string | null>(null);
  const [submittedManageUrl, setSubmittedManageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [navDirection, setNavDirection] = useState(1);
  const [attemptedStep, setAttemptedStep] = useState<BookingStep | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [summarySheetOpen, setSummarySheetOpen] = useState(false);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const contentGridRef = useRef<HTMLDivElement | null>(null);
  const prefillAttemptedRef = useRef(false);

  const {
    selectedPackageIds,
    currentStep,
    preferredDate,
    preferredTime,
    togglePackage,
    clearPackages,
    setSelectedPackageIds,
    setCurrentStep,
    setPreferredDate,
    setPreferredTime,
    resetDraft,
  } = useBookingDraftStore();

  const form = useForm<BookingDetailsFormValues>({
    defaultValues: emptyBookingDetails,
    mode: "onSubmit",
  });

  const selectedPackages = useMemo(
    () => getSelectedPackages(selectedPackageIds),
    [selectedPackageIds]
  );
  const packageTotal = useMemo(
    () => getPackageTotal(selectedPackageIds),
    [selectedPackageIds]
  );
  const selectedDate = preferredDate ? parseISO(preferredDate) : undefined;
  const stepIndex = getStepIndex(currentStep);
  const watchedDetails = useWatch({ control: form.control });
  const detailsPreview = useMemo<BookingDetails>(
    () => ({
      ...emptyBookingDetails,
      ...watchedDetails,
      numberOfPeople: Number(
        watchedDetails.numberOfPeople ?? emptyBookingDetails.numberOfPeople
      ),
      participantGenders:
        watchedDetails.participantGenders ??
        emptyBookingDetails.participantGenders,
    }),
    [watchedDetails]
  );
  const participantCount = Math.max(1, detailsPreview.numberOfPeople);
  const estimatedTotal = packageTotal * participantCount;
  const availabilityParticipantGenders = useMemo(
    () =>
      (detailsPreview.numberOfPeople > 1
        ? detailsPreview.participantGenders.slice(0, detailsPreview.numberOfPeople)
        : [detailsPreview.clientGender]
      ).filter((gender): gender is "male" | "female" =>
        gender === "male" || gender === "female"
      ),
    [
      detailsPreview.clientGender,
      detailsPreview.numberOfPeople,
      detailsPreview.participantGenders,
    ]
  );
  const availabilityInputsKey = useMemo(
    () =>
      [
        selectedPackageIds.join(","),
        availabilityParticipantGenders.join(","),
        detailsPreview.city.trim().toLowerCase(),
      ].join("|"),
    [availabilityParticipantGenders, detailsPreview.city, selectedPackageIds]
  );
  const previousAvailabilityInputsRef = useRef<string | null>(null);
  const clearPreferredTime = useCallback(() => {
    setPreferredTime(null);
  }, [setPreferredTime]);

  useBookingUrlState({
    open,
    currentStep,
    selectedPackageIds,
    lastTriggerRef,
    setOpen,
    setCurrentStep,
    setSelectedPackageIds,
  });

  useEffect(() => {
    if (open) {
      window.setTimeout(() => {
        contentGridRef.current?.scrollTo({ top: 0 });
      }, 0);
    }
    setSummarySheetOpen(false);
  }, [open, currentStep]);

  // Move focus to the step heading (or the first field on About) once the
  // step transition has settled, so keyboard and screen-reader users land in
  // the right place instead of on the dialog chrome.
  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      const popup = contentGridRef.current;
      if (!popup) {
        return;
      }

      const invalidField = popup.querySelector<HTMLElement>(
        '[aria-invalid="true"]'
      );
      if (invalidField) {
        invalidField.focus();
        return;
      }

      if (currentStep === "about") {
        const nameInput = popup.querySelector<HTMLInputElement>(
          'input[name="fullName"]'
        );
        if (nameInput && !nameInput.value) {
          nameInput.focus();
          return;
        }
      }

      popup.querySelector<HTMLElement>("h2[tabindex]")?.focus();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [open, currentStep]);

  // After a failed Continue, keep re-checking just that step's rules as the
  // customer types so errors clear the moment they are fixed. Untouched steps
  // are never validated early.
  useEffect(() => {
    if (!attemptedStep || attemptedStep !== currentStep) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (attemptedStep === "about") {
        const result = bookingDetailsSchema.safeParse(form.getValues());
        applyFormIssues(result.success ? [] : result.error.issues);
      } else if (attemptedStep === "confirm") {
        const values = form.getValues();
        const ackResult = bookingAcknowledgementSchema.safeParse(values);
        const visitResult = bookingVisitSchema.safeParse({
          ...values,
          preferredDate: preferredDate ?? "",
          preferredTime: preferredTime ?? "",
        });
        applyFormIssues([
          ...(ackResult.success ? [] : ackResult.error.issues),
          ...(visitResult.success
            ? []
            : visitResult.error.issues.filter(
                (issue) => !SCHEDULE_FIELDS.includes(String(issue.path[0]))
              )),
        ]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedDetails, attemptedStep, currentStep, preferredDate, preferredTime]);

  useEffect(() => {
    if (previousAvailabilityInputsRef.current === null) {
      previousAvailabilityInputsRef.current = availabilityInputsKey;
      return;
    }

    if (previousAvailabilityInputsRef.current !== availabilityInputsKey) {
      previousAvailabilityInputsRef.current = availabilityInputsKey;
      setPreferredDate(null);
    }
  }, [availabilityInputsKey, setPreferredDate]);

  useEffect(() => {
    const shellElements = document.querySelectorAll<HTMLElement>(
      "body > header, body > main, body > footer"
    );

    shellElements.forEach((element) => {
      if (open) {
        element.setAttribute("inert", "");
      } else {
        element.removeAttribute("inert");
      }
    });

    // The takeover covers the full viewport; lock both root scrollers (html
    // AND body — the site has a dual scroll root) so no page scrollbar shows
    // behind it and the background cannot scroll.
    document.documentElement.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";

    return () => {
      shellElements.forEach((element) => element.removeAttribute("inert"));
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [open]);

  // Prefill contact + address from the customer's last successful booking,
  // once per session and only while the form is still pristine.
  useEffect(() => {
    if (!open || prefillAttemptedRef.current) {
      return;
    }
    prefillAttemptedRef.current = true;

    const stored = loadReturningCustomer();
    if (!stored) {
      return;
    }

    const values = form.getValues();
    const pristine =
      !form.formState.isDirty &&
      !values.fullName &&
      !values.phone &&
      !values.email &&
      !values.address;
    if (!pristine) {
      return;
    }

    form.reset({ ...emptyBookingDetails, ...stored });
    setPrefilled(true);
  }, [open, form]);

  const clearPrefill = () => {
    clearReturningCustomer();
    const current = form.getValues();
    form.reset({
      ...current,
      fullName: "",
      phone: "",
      email: "",
      clientGender: "",
      participantGenders:
        current.numberOfPeople > 1 ? current.participantGenders : [""],
      city: "",
      area: "",
      postcode: "",
      address: "",
      accessNotes: "",
      parkingNotes: "",
    });
    setPrefilled(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      lastTriggerRef.current?.focus();
    }
  };

  const clearStepErrors = () => {
    setPackageError(undefined);
    setScheduleError(undefined);
    setSubmissionError(undefined);
  };

  const handlePackageToggle = (id: (typeof selectedPackageIds)[number]) => {
    togglePackage(id);
    setPreferredDate(null);
    setSubmittedBookingId(null);
    setSubmittedManageUrl(null);
    clearStepErrors();
  };

  const applyFormIssues = (issues: { path: PropertyKey[]; message: string }[]) => {
    form.clearErrors();
    issues.forEach((issue) => {
      const field = issue.path[0];
      if (
        typeof field === "string" &&
        field in emptyBookingDetails
      ) {
        form.setError(field as FieldPath<BookingDetailsFormValues>, {
          type: "manual",
          message: issue.message,
        });
      }
    });
  };

  const focusFirstInvalid = () => {
    window.setTimeout(() => {
      const element = contentGridRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]'
      );
      if (element) {
        element.focus();
        element.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }, 80);
  };

  const goToAbout = () => {
    const selectionError = getPackageSelectionError(selectedPackageIds);

    if (selectionError) {
      setPackageError(selectionError);
      return;
    }

    clearStepErrors();
    setAttemptedStep(null);
    setNavDirection(1);
    setCurrentStep("about");
  };

  const goToTime = () => {
    const detailsResult = bookingDetailsSchema.safeParse(form.getValues());

    if (!detailsResult.success) {
      applyFormIssues(detailsResult.error.issues);
      setAttemptedStep("about");
      focusFirstInvalid();
      return;
    }

    form.clearErrors();
    clearStepErrors();
    setAttemptedStep(null);
    setNavDirection(1);
    setCurrentStep("time");
  };

  const goToConfirm = () => {
    const visitResult = bookingVisitSchema.safeParse({
      ...form.getValues(),
      preferredDate: preferredDate ?? "",
      preferredTime: preferredTime ?? "",
    });

    if (visitResult.success) {
      form.clearErrors();
      clearStepErrors();
      setAttemptedStep(null);
      setNavDirection(1);
      setCurrentStep("confirm");
      return;
    }

    const scheduleIssue = visitResult.error.issues.find((issue) =>
      SCHEDULE_FIELDS.includes(String(issue.path[0]))
    );
    const fieldIssues = visitResult.error.issues.filter(
      (issue) => !SCHEDULE_FIELDS.includes(String(issue.path[0]))
    );

    setScheduleError(scheduleIssue?.message);
    applyFormIssues(fieldIssues);

    if (!scheduleIssue && fieldIssues.length > 0) {
      // Something from the About step became invalid after going back and
      // editing — return the customer to the step that owns those fields.
      setAttemptedStep("about");
      setNavDirection(-1);
      setCurrentStep("about");
    }
  };

  const handleConfirmSubmit = async () => {
    const values = form.getValues();
    const acknowledgementResult = bookingAcknowledgementSchema.safeParse(values);
    const visitResult = bookingVisitSchema.safeParse({
      ...values,
      preferredDate: preferredDate ?? "",
      preferredTime: preferredTime ?? "",
    });

    const scheduleIssue = visitResult.success
      ? undefined
      : visitResult.error.issues.find((issue) =>
          SCHEDULE_FIELDS.includes(String(issue.path[0]))
        );
    const fieldIssues = [
      ...(acknowledgementResult.success
        ? []
        : acknowledgementResult.error.issues),
      ...(visitResult.success
        ? []
        : visitResult.error.issues.filter(
            (issue) => !SCHEDULE_FIELDS.includes(String(issue.path[0]))
          )),
    ];

    setScheduleError(scheduleIssue?.message);
    applyFormIssues(fieldIssues);

    if (scheduleIssue) {
      setNavDirection(-1);
      setCurrentStep("time");
      return;
    }

    if (fieldIssues.length > 0) {
      setAttemptedStep("confirm");
      focusFirstInvalid();
      return;
    }

    setSubmitting(true);
    setSubmissionError(undefined);
    try {
      const result = await submitBookingRequest({
        selectedPackageIds,
        selectedPackages,
        details: values as BookingDetailsFormValues,
        preferredDate: visitResult.success ? visitResult.data.preferredDate : "",
        preferredTime: visitResult.success ? visitResult.data.preferredTime : "",
        estimatedTotal,
      });
      setSubmittedBookingId(result.bookingId);
      setSubmittedManageUrl(result.manageUrl);
      saveReturningCustomer(values as BookingDetailsFormValues);
      clearStepErrors();
      setAttemptedStep(null);
      setNavDirection(1);
      setCurrentStep("success");
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "Unable to submit booking request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setNavDirection(-1);
    setCurrentStep(BOOKING_STEPS[Math.max(0, stepIndex - 1)]);
  };

  const goBackToStep = (step: BookingStep) => {
    if (BOOKING_STEPS.indexOf(step) < stepIndex) {
      setNavDirection(-1);
      setCurrentStep(step);
    }
  };

  const startOver = () => {
    resetDraft();
    form.reset(emptyBookingDetails);
    setSubmittedBookingId(null);
    setSubmittedManageUrl(null);
    clearStepErrors();
  };

  const handleStepSubmit = () => {
    if (submitting) {
      return;
    }

    if (currentStep === "service") {
      goToAbout();
    } else if (currentStep === "about") {
      goToTime();
    } else if (currentStep === "time") {
      goToConfirm();
    } else if (currentStep === "confirm") {
      void handleConfirmSubmit();
    }
  };

  return (
    <BookingDialog
      open={open}
      currentStep={currentStep}
      lastTriggerRef={lastTriggerRef}
      contentGridRef={contentGridRef}
      onOpenChange={handleOpenChange}
      onStepBack={goBackToStep}
      onSubmit={handleStepSubmit}
      summary={
        currentStep === "success" ? null : (
          <BookingSummary
            selectedPackages={selectedPackages}
            perPersonTotal={packageTotal}
            estimatedTotal={estimatedTotal}
            details={detailsPreview}
            preferredDate={preferredDate}
            preferredTime={preferredTime}
          />
        )
      }
      actionBar={
        <BookingActionBar
          currentStep={currentStep}
          submitting={submitting}
          estimatedTotal={estimatedTotal}
          participantCount={participantCount}
          hasSelection={selectedPackages.length > 0}
          summaryOpen={summarySheetOpen}
          onToggleSummary={() => setSummarySheetOpen((value) => !value)}
          onBack={goBack}
        />
      }
      overlay={
        summarySheetOpen && currentStep !== "success" ? (
          <div
            className={styles.sheetScrim}
            onClick={() => setSummarySheetOpen(false)}
          >
            <div
              id="booking-summary-sheet"
              className={styles.summarySheet}
              role="dialog"
              aria-label="Booking request summary"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setSummarySheetOpen(false);
                }
              }}
            >
              <div className={styles.sheetHeader}>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => setSummarySheetOpen(false)}
                >
                  Close
                </button>
              </div>
              <BookingSummary
                selectedPackages={selectedPackages}
                perPersonTotal={packageTotal}
                estimatedTotal={estimatedTotal}
                details={detailsPreview}
                preferredDate={preferredDate}
                preferredTime={preferredTime}
              />
            </div>
          </div>
        ) : null
      }
    >
      <AnimatePresence mode="wait" custom={navDirection}>
        {currentStep === "service" && (
          <MotionStep key="service" direction={navDirection}>
            <PackageSelectionStep
              selectedPackageIds={selectedPackageIds}
              error={packageError}
              onToggle={handlePackageToggle}
              onClear={() => {
                clearPackages();
                clearStepErrors();
              }}
            />
          </MotionStep>
        )}

        {currentStep === "about" && (
          <MotionStep key="about" direction={navDirection}>
            <AboutYouStep
              form={form}
              prefilled={prefilled}
              onClearPrefill={clearPrefill}
            />
          </MotionStep>
        )}

        {currentStep === "time" && (
          <MotionStep key="time" direction={navDirection}>
            <ScheduleStep
              preferredDate={selectedDate}
              preferredTime={preferredTime}
              scheduleError={scheduleError}
              onDateChange={(date) => {
                setPreferredDate(date ? format(date, "yyyy-MM-dd") : null);
                setPreferredTime(null);
                clearStepErrors();
              }}
              serviceIds={selectedPackageIds}
              participantGenders={availabilityParticipantGenders}
              city={detailsPreview.city}
              onTimeClear={clearPreferredTime}
              onTimeChange={(time: BookingTimeSlot) => {
                setPreferredTime(time);
                clearStepErrors();
              }}
            />
          </MotionStep>
        )}

        {currentStep === "confirm" && (
          <MotionStep key="confirm" direction={navDirection}>
            <ConfirmStep
              form={form}
              details={detailsPreview}
              submissionError={submissionError}
              selectedPackages={selectedPackages}
              perPersonTotal={packageTotal}
              total={estimatedTotal}
              preferredDate={preferredDate}
              preferredTime={preferredTime}
              onEditStep={goBackToStep}
            />
          </MotionStep>
        )}

        {currentStep === "success" && (
          <MotionStep key="success" direction={navDirection}>
            <SuccessScreen
              bookingId={submittedBookingId}
              manageUrl={submittedManageUrl}
              onStartOver={startOver}
            />
          </MotionStep>
        )}
      </AnimatePresence>
    </BookingDialog>
  );
}
