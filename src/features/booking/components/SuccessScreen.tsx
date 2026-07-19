"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CheckCircle2 } from "lucide-react";
import styles from "../BookingExperience.module.css";

export function SuccessScreen({
  bookingId,
  manageUrl,
  onStartOver,
}: {
  bookingId: string | null;
  manageUrl: string | null;
  onStartOver: () => void;
}) {
  return (
    <section className={styles.successWrap} aria-labelledby="success-heading">
      <div className={styles.successIcon}>
        <CheckCircle2 aria-hidden="true" size={40} />
      </div>
      <h2 id="success-heading" className={styles.successTitle} tabIndex={-1}>
        Booking request submitted
      </h2>
      {bookingId ? (
        <p className={styles.bookingReference}>
          Reference: <strong>{bookingId}</strong>
        </p>
      ) : null}
      <p className={styles.successBody}>
        Your service, participant details, visit area and preferred time have
        been sent to Rahma Therapy. We will confirm availability before any
        appointment is final.
      </p>
      <div className={styles.successNotes}>
        <p>A confirmation email has been sent to your email address.</p>
        <p>Payment is taken in person by cash or card.</p>
      </div>
      {manageUrl ? (
        <div className={styles.manageLinkPanel}>
          <a
            className={styles.primaryButton}
            href={manageUrl}
            target="_blank"
            rel="noreferrer"
          >
            Manage this booking
          </a>
          <p>Save this link if you need to request a change or cancellation.</p>
          <code>{manageUrl}</code>
        </div>
      ) : (
        <p className={styles.successBody}>
          Keep your confirmation email safe; the manage link in it may be
          needed for changes or cancellation.
        </p>
      )}
      <div className={styles.successActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onStartOver}
        >
          Start a new request
        </button>
        <Dialog.Close className={styles.primaryButton}>Close</Dialog.Close>
      </div>
    </section>
  );
}
