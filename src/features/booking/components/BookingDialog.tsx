"use client";

import type { ReactNode, RefObject } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { BookingStep } from "../types";
import { BookingProgress } from "./BookingProgress";
import styles from "../BookingExperience.module.css";

interface BookingDialogProps {
  open: boolean;
  currentStep: BookingStep;
  lastTriggerRef: RefObject<HTMLElement | null>;
  contentGridRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  summary: ReactNode;
  footer: ReactNode;
  onOpenChange: (open: boolean) => void;
}

export function BookingDialog({
  open,
  currentStep,
  lastTriggerRef,
  contentGridRef,
  children,
  summary,
  footer,
  onOpenChange,
}: BookingDialogProps) {
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
            <header className={styles.header}>
              <div className={styles.headerContent}>
                <div className={styles.brandLine}>
                  <span className={styles.brandMark}>Z</span>
                  <p className={styles.eyebrow}>Zam Therapy</p>
                </div>
                <div>
                  <Dialog.Title className={styles.title}>
                    Book a therapy visit
                  </Dialog.Title>
                  <Dialog.Description className={styles.description}>
                    Choose your treatment, preferred time, and Barnet visit address.
                    Zam Therapy will contact you to confirm availability.
                  </Dialog.Description>
                </div>
                <div className={styles.headerPills} aria-label="Booking highlights">
                  <span>Service in Barnet</span>
                  <span>Personalised treatment plan</span>
                  <span>Confirmation by phone or email</span>
                </div>
              </div>
              <Dialog.Close
                className={styles.closeButton}
                aria-label="Close booking popup"
              >
                <X aria-hidden="true" size={20} />
              </Dialog.Close>
            </header>

            <BookingProgress currentStep={currentStep} />

            <div ref={contentGridRef} className={styles.contentGrid}>
              <main className={styles.mainPanel}>{children}</main>
              {summary}
            </div>

            {footer}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
