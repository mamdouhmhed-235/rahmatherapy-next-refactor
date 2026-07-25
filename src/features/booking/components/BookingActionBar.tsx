"use client";

import { ArrowLeft, ChevronUp } from "lucide-react";
import { formatPrice } from "../utils/format";
import type { BookingStage } from "../types";
import styles from "../BookingExperience.module.css";

interface BookingActionBarProps {
  currentStep: BookingStage;
  submitting: boolean;
  estimatedTotal: number;
  participantCount: number;
  hasSelection: boolean;
  summaryOpen: boolean;
  onToggleSummary: () => void;
  onBack: () => void;
}

export function BookingActionBar({
  currentStep,
  submitting,
  estimatedTotal,
  participantCount,
  hasSelection,
  summaryOpen,
  onToggleSummary,
  onBack,
}: BookingActionBarProps) {
  if (currentStep === "success") {
    return null;
  }

  const isConfirm = currentStep === "confirm";
  const showBack = currentStep !== "service";

  return (
    <div className={styles.actionBar}>
      <div className={styles.actionBarInner}>
        {showBack ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onBack}
          >
            <ArrowLeft aria-hidden="true" size={17} />
            Back
          </button>
        ) : (
          <span className={styles.actionBarSpacer} aria-hidden="true" />
        )}

        <button
          type="button"
          className={styles.totalStack}
          onClick={onToggleSummary}
          aria-expanded={summaryOpen}
          aria-controls="booking-summary-sheet"
          aria-label="Show booking summary"
        >
          <span className={styles.totalLabel}>Estimated total</span>
          <span className={styles.totalValue}>
            {hasSelection ? (
              <>
                {formatPrice(estimatedTotal)}
                {participantCount > 1 ? (
                  <small> · {participantCount} people</small>
                ) : null}
              </>
            ) : (
              "—"
            )}
            <ChevronUp
              aria-hidden="true"
              size={15}
              className={styles.totalChevron}
            />
          </span>
        </button>

        <button
          type="submit"
          className={styles.primaryButton}
          disabled={submitting}
        >
          {submitting ? (
            <span className={styles.buttonSpinner} aria-hidden="true" />
          ) : null}
          {isConfirm ? "Submit booking request" : "Continue"}
        </button>
      </div>
    </div>
  );
}
