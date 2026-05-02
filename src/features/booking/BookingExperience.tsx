"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { submitBookingRequest } from "./actions";
import { BookingDialog } from "./components/BookingDialog";
import { getStepIndex } from "./components/BookingProgress";
import { BookingSummary } from "./components/BookingSummary";
import { LocationDetailsStep } from "./components/LocationDetailsStep";
import { MotionStep } from "./components/MotionStep";
import { PackageSelectionStep } from "./components/PackageSelectionStep";
import { ParticipantDetailsStep } from "./components/ParticipantDetailsStep";
import { PreparedStep } from "./components/PreparedStep";
import { ReviewStep } from "./components/ReviewStep";
import { ScheduleStep } from "./components/ScheduleStep";
import {
  getPackageSelectionError,
  getPackageTotal,
  getSelectedPackages,
} from "./data/booking-packages";
import type { BookingTimeSlot } from "./data/time-slots";
import { useBookingUrlState } from "./hooks/useBookingUrlState";
import {
  bookingAcknowledgementSchema,
  bookingDetailsSchema,
  bookingLocationSchema,
  bookingParticipantSchema,
  bookingVisitSchema,
  type BookingDetailsFormValues,
} from "./schemas/booking-schema";
import { useBookingDraftStore } from "./store/booking-store";
import { BOOKING_STEPS, emptyBookingDetails, type BookingDetails } from "./types";

import styles from "./BookingExperience.module.css";

export function BookingExperience() {
  const [open, setOpen] = useState(false);
  const [packageError, setPackageError] = useState<string | undefined>();
  const [scheduleError, setScheduleError] = useState<string | undefined>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgementError, setAcknowledgementError] = useState<
    string | undefined
  >();
  const [submissionError, setSubmissionError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const contentGridRef = useRef<HTMLDivElement | null>(null);

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
  }, [open, currentStep]);

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

    return () => {
      shellElements.forEach((element) => element.removeAttribute("inert"));
    };
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      lastTriggerRef.current?.focus();
    }
  };

  const clearStepErrors = () => {
    setPackageError(undefined);
    setScheduleError(undefined);
    setAcknowledgementError(undefined);
    setSubmissionError(undefined);
  };

  const handlePackageToggle = (id: (typeof selectedPackageIds)[number]) => {
    togglePackage(id);
    setPreferredDate(null);
    clearStepErrors();
  };

  const goToParticipants = () => {
    const selectionError = getPackageSelectionError(selectedPackageIds);

    if (selectionError) {
      setPackageError(selectionError);
      return;
    }

    clearStepErrors();
    setCurrentStep("participants");
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

  const validateParticipantsForm = () => {
    const participantResult = bookingParticipantSchema.safeParse(form.getValues());

    if (participantResult.success) {
      form.clearErrors();
      return true;
    }

    applyFormIssues(participantResult.error.issues);
    return false;
  };

  const validateLocationForm = () => {
    const locationResult = bookingLocationSchema.safeParse(form.getValues());

    if (locationResult.success) {
      form.clearErrors();
      return true;
    }

    applyFormIssues(locationResult.error.issues);
    return false;
  };

  const validateDetailsForm = () => {
    const detailsResult = bookingDetailsSchema.safeParse(form.getValues());

    if (detailsResult.success) {
      form.clearErrors();
      return true;
    }

    applyFormIssues(detailsResult.error.issues);
    return false;
  };

  const goToLocation = () => {
    if (!validateParticipantsForm()) {
      return;
    }

    clearStepErrors();
    setCurrentStep("location");
  };

  const goToSchedule = () => {
    if (!validateLocationForm()) {
      return;
    }

    clearStepErrors();
    setCurrentStep("schedule");
  };

  const goToReview = () => {
    const detailsValid = validateDetailsForm();
    const visitResult = bookingVisitSchema.safeParse({
      ...form.getValues(),
      preferredDate: preferredDate ?? "",
      preferredTime: preferredTime ?? "",
    });

    const scheduleIssue = visitResult.success
      ? undefined
      : visitResult.error.issues.find((issue) =>
          ["preferredDate", "preferredTime"].includes(String(issue.path[0]))
        );

    setScheduleError(scheduleIssue?.message);

    if (!detailsValid || !visitResult.success) {
      return;
    }

    clearStepErrors();
    setCurrentStep("review");
  };

  const prepareRequest = async () => {
    const acknowledgementResult = bookingAcknowledgementSchema.safeParse({
      acknowledged,
    });

    if (!acknowledgementResult.success) {
      setAcknowledgementError(acknowledgementResult.error.issues[0]?.message);
      return;
    }

    const visitResult = bookingVisitSchema.safeParse({
      ...form.getValues(),
      preferredDate: preferredDate ?? "",
      preferredTime: preferredTime ?? "",
    });

    if (!visitResult.success) {
      setCurrentStep("schedule");
      setScheduleError(visitResult.error.issues[0]?.message);
      return;
    }

    setSubmitting(true);
    setSubmissionError(undefined);
    try {
      await submitBookingRequest({
        selectedPackageIds,
        selectedPackages,
        details: form.getValues() as BookingDetailsFormValues,
        preferredDate: visitResult.data.preferredDate,
        preferredTime: visitResult.data.preferredTime,
        estimatedTotal: packageTotal,
      });
      clearStepErrors();
      setCurrentStep("prepared");
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

  const startOver = () => {
    resetDraft();
    form.reset(emptyBookingDetails);
    setAcknowledged(false);
    clearStepErrors();
  };

  return (
    <>
      <BookingDialog
        open={open}
        currentStep={currentStep}
        lastTriggerRef={lastTriggerRef}
        contentGridRef={contentGridRef}
        onOpenChange={handleOpenChange}
        summary={
          <BookingSummary
            selectedPackages={selectedPackages}
            packageTotal={packageTotal}
            details={detailsPreview}
            preferredDate={preferredDate}
            preferredTime={preferredTime}
            actions={
              <BookingSummaryActions
                currentStep={currentStep}
                submitting={submitting}
                onBack={() =>
                  setCurrentStep(BOOKING_STEPS[Math.max(0, stepIndex - 1)])
                }
                onGoToParticipants={goToParticipants}
                onGoToLocation={goToLocation}
                onGoToSchedule={goToSchedule}
                onGoToReview={goToReview}
                onPrepareRequest={prepareRequest}
              />
            }
          />
        }
      >
        <AnimatePresence mode="wait">
          {currentStep === "packages" && (
            <MotionStep key="packages">
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

          {currentStep === "participants" && (
            <MotionStep key="participants">
              <ParticipantDetailsStep form={form} />
            </MotionStep>
          )}

          {currentStep === "location" && (
            <MotionStep key="location">
              <LocationDetailsStep form={form} />
            </MotionStep>
          )}

          {currentStep === "schedule" && (
            <MotionStep key="schedule">
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

          {currentStep === "review" && (
            <MotionStep key="review">
              <ReviewStep
                details={form.getValues() as BookingDetailsFormValues}
                acknowledged={acknowledged}
                acknowledgementError={acknowledgementError}
                submissionError={submissionError}
                selectedPackages={selectedPackages}
                total={packageTotal}
                preferredDate={preferredDate}
                preferredTime={preferredTime}
                onAcknowledgedChange={(value) => {
                  setAcknowledged(value);
                  setAcknowledgementError(undefined);
                }}
              />
            </MotionStep>
          )}

          {currentStep === "prepared" && (
            <MotionStep key="prepared">
              <PreparedStep onStartOver={startOver} />
            </MotionStep>
          )}
        </AnimatePresence>
      </BookingDialog>
    </>
  );
}

interface BookingSummaryActionsProps {
  currentStep: (typeof BOOKING_STEPS)[number];
  submitting: boolean;
  onBack: () => void;
  onGoToParticipants: () => void;
  onGoToLocation: () => void;
  onGoToSchedule: () => void;
  onGoToReview: () => void;
  onPrepareRequest: () => void;
}

function BookingSummaryActions({
  currentStep,
  submitting,
  onBack,
  onGoToParticipants,
  onGoToLocation,
  onGoToSchedule,
  onGoToReview,
  onPrepareRequest,
}: BookingSummaryActionsProps) {
  return (
    <>
      {currentStep !== "packages" && currentStep !== "prepared" && (
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={17} />
          Back
        </button>
      )}

      {currentStep === "packages" && (
        <button type="button" className={styles.primaryButton} onClick={onGoToParticipants}>
          Continue to clients
        </button>
      )}

      {currentStep === "participants" && (
        <button type="button" className={styles.primaryButton} onClick={onGoToLocation}>
          Continue to location
        </button>
      )}

      {currentStep === "location" && (
        <button type="button" className={styles.primaryButton} onClick={onGoToSchedule}>
          Continue to times
        </button>
      )}

      {currentStep === "schedule" && (
        <button type="button" className={styles.primaryButton} onClick={onGoToReview}>
          Review request
        </button>
      )}

      {currentStep === "review" && (
        <button
          type="button"
          className={styles.primaryButton}
          disabled={submitting}
          onClick={onPrepareRequest}
        >
          Submit booking request
        </button>
      )}

      {currentStep === "prepared" && (
        <Dialog.Close className={styles.primaryButton}>Close</Dialog.Close>
      )}
    </>
  );
}
