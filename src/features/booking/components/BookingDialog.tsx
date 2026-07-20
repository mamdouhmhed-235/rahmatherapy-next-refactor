"use client";

import type { FormEvent, ReactNode, RefObject } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { BrandLogo } from "@/components/media/BrandLogo";
import {
  BOOKING_STEPS,
  STEP_LABELS,
  type BookingStage,
  type BookingStep,
} from "../types";
import { BookingProgress } from "./BookingProgress";
import styles from "../BookingExperience.module.css";

interface BookingDialogProps {
  open: boolean;
  currentStep: BookingStage;
  lastTriggerRef: RefObject<HTMLElement | null>;
  contentGridRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  summary: ReactNode;
  actionBar: ReactNode;
  overlay?: ReactNode;
  onOpenChange: (open: boolean) => void;
  onStepBack: (step: BookingStep) => void;
  onSubmit: () => void;
}

export function BookingDialog({
  open,
  currentStep,
  lastTriggerRef,
  contentGridRef,
  children,
  summary,
  actionBar,
  overlay,
  onOpenChange,
  onStepBack,
  onSubmit,
}: BookingDialogProps) {
  const isSuccess = currentStep === "success";
  const stepIndex = BOOKING_STEPS.indexOf(currentStep as BookingStep);
  const stepAnnouncement = isSuccess
    ? "Booking request submitted"
    : stepIndex >= 0
      ? `Step ${stepIndex + 1} of ${BOOKING_STEPS.length} — ${STEP_LABELS[currentStep as BookingStep]}`
      : "";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup
          className={styles.popup}
          aria-modal="true"
          finalFocus={() => lastTriggerRef.current || true}
        >
          <div className={styles.shell}>
            <header className={styles.topBar}>
              <div className={styles.topBarRow}>
                <div className={styles.brandBox}>
                  <BrandLogo
                    width={1600}
                    height={587}
                    priority
                    className={styles.bookingLogo}
                    sizes="120px"
                    style={{ width: "auto", height: "100%", objectFit: "contain" }}
                  />
                </div>
                <Dialog.Title className={styles.title}>
                  Request a home appointment
                </Dialog.Title>
                <Dialog.Close
                  className={styles.closeButton}
                  aria-label="Close booking form"
                >
                  <X aria-hidden="true" size={18} />
                </Dialog.Close>
              </div>
              <Dialog.Description className={styles.srOnly}>
                Choose your service, add participant details, confirm the visit
                area, then request a preferred date and time.
              </Dialog.Description>
              <p className={styles.srOnly} aria-live="polite">
                {stepAnnouncement}
              </p>
              {isSuccess ? (
                <p className={styles.sentBadge}>Request sent</p>
              ) : (
                <BookingProgress
                  currentStep={currentStep}
                  onStepBack={onStepBack}
                />
              )}
            </header>

            <form className={styles.formRows} onSubmit={handleSubmit}>
              <div ref={contentGridRef} className={styles.contentGrid}>
                <div
                  className={
                    isSuccess
                      ? `${styles.contentInner} ${styles.contentInnerSingle}`
                      : styles.contentInner
                  }
                >
                  <main className={styles.mainPanel}>{children}</main>
                  {summary}
                </div>
              </div>
              {actionBar}
            </form>
            {overlay}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
