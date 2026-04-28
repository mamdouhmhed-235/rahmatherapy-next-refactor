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
  onOpenChange: (open: boolean) => void;
}

export function BookingDialog({
  open,
  currentStep,
  lastTriggerRef,
  contentGridRef,
  children,
  summary,
  onOpenChange,
}: BookingDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={styles.backdrop}
          onClick={() => onOpenChange(false)}
        />
        <Dialog.Popup
          className={styles.popup}
          aria-modal="true"
          finalFocus={() => lastTriggerRef.current || true}
        >
          <div className={styles.shell}>
            <header className={styles.header}>
              <div className={styles.brandLine}>
                <span className={styles.brandMark}>RT</span>
                <p className={styles.eyebrow}>Rahma Therapy</p>
              </div>
              <div className={styles.headerContent}>
                <Dialog.Title className={styles.title}>
                  Request a home appointment
                </Dialog.Title>
                <Dialog.Description className={styles.description}>
                  Choose your package, share your Luton home-visit details and
                  preferred time. Rahma Therapy will contact you to confirm
                  availability.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className={styles.closeButton}
                aria-label="Close booking form"
              >
                <X aria-hidden="true" size={20} />
              </Dialog.Close>
            </header>

            <BookingProgress currentStep={currentStep} />

            <div ref={contentGridRef} className={styles.contentGrid}>
              <main className={styles.mainPanel}>{children}</main>
              {summary}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
