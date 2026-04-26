"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { useForm, type FieldPath } from "react-hook-form";
import { submitBookingRequest } from "./actions/submitBookingRequest";
import { BookingDialog } from "./components/BookingDialog";
import { getStepIndex } from "./components/BookingProgress";
import { BookingSummary } from "./components/BookingSummary";
import { MotionStep } from "./components/MotionStep";
import { PackageSelectionStep } from "./components/PackageSelectionStep";
import { PreparedStep } from "./components/PreparedStep";
import { ReviewStep } from "./components/ReviewStep";
import { VisitDetailsStep } from "./components/VisitDetailsStep";
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
  bookingVisitSchema,
  type BookingDetailsFormValues,
} from "./schemas/booking-schema";
import { useBookingDraftStore } from "./store/booking-store";
import { BOOKING_STEPS, emptyBookingDetails } from "./types";
import { formatPrice } from "./utils/format";
import styles from "./BookingExperience.module.css";

export function BookingExperience() {
  const [open, setOpen] = useState(false);
  const [packageError, setPackageError] = useState<string | undefined>();
  const [scheduleError, setScheduleError] = useState<string | undefined>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgementError, setAcknowledgementError] = useState<
    string | undefined
  >();
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
  };

  const handlePackageToggle = (id: (typeof selectedPackageIds)[number]) => {
    togglePackage(id);
    clearStepErrors();
  };

  const goToDetails = () => {
    const selectionError = getPackageSelectionError(selectedPackageIds);

    if (selectionError) {
      setPackageError(selectionError);
      return;
    }

    clearStepErrors();
    setCurrentStep("details");
  };

  const validateDetailsForm = () => {
    const detailsResult = bookingDetailsSchema.safeParse(form.getValues());

    form.clearErrors();
    if (detailsResult.success) {
      return true;
    }

    detailsResult.error.issues.forEach((issue) => {
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

    return false;
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
      setCurrentStep("details");
      setScheduleError(visitResult.error.issues[0]?.message);
      return;
    }

    setSubmitting(true);
    try {
      await submitBookingRequest({
        selectedPackageIds,
        selectedPackages,
        details: form.getValues(),
        preferredDate: visitResult.data.preferredDate,
        preferredTime: visitResult.data.preferredTime,
        estimatedTotal: packageTotal,
      });
      clearStepErrors();
      setCurrentStep("prepared");
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
      <span id="book-now" className={styles.anchorTarget} aria-hidden="true" />
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
            preferredDate={preferredDate}
            preferredTime={preferredTime}
          />
        }
        footer={
          <BookingFooter
            currentStep={currentStep}
            stepIndex={stepIndex}
            packageTotal={packageTotal}
            selectedCount={selectedPackages.length}
            submitting={submitting}
            onBack={() =>
              setCurrentStep(BOOKING_STEPS[Math.max(0, stepIndex - 1)])
            }
            onGoToDetails={goToDetails}
            onGoToReview={goToReview}
            onPrepareRequest={prepareRequest}
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

          {currentStep === "details" && (
            <MotionStep key="details">
              <VisitDetailsStep
                form={form}
                preferredDate={selectedDate}
                preferredTime={preferredTime}
                scheduleError={scheduleError}
                onDateChange={(date) => {
                  setPreferredDate(date ? format(date, "yyyy-MM-dd") : null);
                  clearStepErrors();
                }}
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
                details={form.getValues()}
                acknowledged={acknowledged}
                acknowledgementError={acknowledgementError}
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

interface BookingFooterProps {
  currentStep: (typeof BOOKING_STEPS)[number];
  stepIndex: number;
  packageTotal: number;
  selectedCount: number;
  submitting: boolean;
  onBack: () => void;
  onGoToDetails: () => void;
  onGoToReview: () => void;
  onPrepareRequest: () => void;
}

function BookingFooter({
  currentStep,
  packageTotal,
  selectedCount,
  submitting,
  onBack,
  onGoToDetails,
  onGoToReview,
  onPrepareRequest,
}: BookingFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerSummary}>
        <span className={styles.footerLabel}>Estimated total</span>
        <span>
          <strong>{formatPrice(packageTotal)}</strong>
          <span>
            {selectedCount} treatment{selectedCount === 1 ? "" : "s"}
          </span>
        </span>
      </div>

      <div className={styles.footerActions}>
        {currentStep !== "packages" && currentStep !== "prepared" && (
          <button type="button" className={styles.secondaryButton} onClick={onBack}>
            <ArrowLeft aria-hidden="true" size={17} />
            Back
          </button>
        )}

        {currentStep === "packages" && (
          <button type="button" className={styles.primaryButton} onClick={onGoToDetails}>
            Continue
          </button>
        )}

        {currentStep === "details" && (
          <button type="button" className={styles.primaryButton} onClick={onGoToReview}>
            Review details
          </button>
        )}

        {currentStep === "review" && (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={submitting}
            onClick={onPrepareRequest}
          >
            Finish request
          </button>
        )}

        {currentStep === "prepared" && (
          <Dialog.Close className={styles.primaryButton}>Done</Dialog.Close>
        )}
      </div>
    </footer>
  );
}
