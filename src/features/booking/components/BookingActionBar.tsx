"use client";

import { ArrowLeft } from "lucide-react";
import { formatPrice } from "../utils/format";
import type { BookingStage } from "../types";
import styles from "../BookingExperience.module.css";

interface BookingActionBarProps {
  currentStep: BookingStage;
  submitting: boolean;
  estimatedTotal: number;
  participantCount: number;
  hasSelection: boolean;
  onBack: () => void;
}

export function BookingActionBar({
  currentStep,
  submitting,
  estimatedTotal,
  participantCount,
  hasSelection,
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

        <div className={styles.totalStack}>
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
          </span>
        </div>

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
