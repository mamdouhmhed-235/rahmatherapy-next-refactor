"use client";

import { Check } from "lucide-react";
import {
  BOOKING_STEPS,
  STEP_LABELS,
  type BookingStage,
  type BookingStep,
} from "../types";
import styles from "../BookingExperience.module.css";

export function getStepIndex(step: BookingStage) {
  return Math.max(0, BOOKING_STEPS.indexOf(step as BookingStep));
}

interface BookingProgressProps {
  currentStep: BookingStage;
  onStepBack?: (step: BookingStep) => void;
}

export function BookingProgress({ currentStep, onStepBack }: BookingProgressProps) {
  if (currentStep === "success") {
    return null;
  }

  const currentIndex = getStepIndex(currentStep);

  return (
    <nav className={styles.progress} aria-label="Booking progress">
      <ol className={styles.steps}>
        {BOOKING_STEPS.map((step, index) => {
          const completed = index < currentIndex;
          const isCurrent = step === currentStep;
          const className = isCurrent
            ? styles.stepCurrent
            : completed
              ? styles.stepDone
              : styles.step;

          return (
            <li
              key={step}
              className={className}
              aria-current={isCurrent ? "step" : undefined}
            >
              {completed && onStepBack ? (
                <button
                  type="button"
                  className={styles.stepButton}
                  onClick={() => onStepBack(step)}
                  aria-label={`Go back to step ${index + 1}: ${STEP_LABELS[step]}`}
                >
                  <span className={styles.stepDot}>
                    <Check aria-hidden="true" size={12} />
                  </span>
                  <span className={styles.stepLabel}>{STEP_LABELS[step]}</span>
                </button>
              ) : (
                <span className={styles.stepStatic}>
                  <span className={styles.stepDot}>
                    {completed ? <Check aria-hidden="true" size={12} /> : index + 1}
                  </span>
                  <span className={styles.stepLabel}>{STEP_LABELS[step]}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className={styles.progressCompact} aria-hidden="true">
        Step {currentIndex + 1} of {BOOKING_STEPS.length} ·{" "}
        {STEP_LABELS[currentStep as BookingStep]}
      </p>
      <div className={styles.progressTrack} aria-hidden="true">
        <div
          className={styles.progressFill}
          style={{
            width: `${((currentIndex + 1) / BOOKING_STEPS.length) * 100}%`,
          }}
        />
      </div>
    </nav>
  );
}
