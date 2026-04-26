"use client";

import { BOOKING_STEPS, STEP_LABELS, type BookingStep } from "../types";
import styles from "../BookingExperience.module.css";

export function getStepIndex(step: BookingStep) {
  return Math.max(0, BOOKING_STEPS.indexOf(step));
}

export function BookingProgress({ currentStep }: { currentStep: BookingStep }) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <ol className={styles.steps} aria-label="Booking progress">
      {BOOKING_STEPS.map((step, index) => (
        <li
          key={step}
          className={index <= currentIndex ? styles.stepActive : styles.step}
          aria-current={step === currentStep ? "step" : undefined}
        >
          <span>{index + 1}</span>
          {STEP_LABELS[step]}
        </li>
      ))}
    </ol>
  );
}
