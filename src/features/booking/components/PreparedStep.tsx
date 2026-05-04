"use client";

import { CheckCircle2 } from "lucide-react";
import styles from "../BookingExperience.module.css";

export function PreparedStep({
  bookingId,
  manageUrl,
  onStartOver,
}: {
  bookingId: string | null;
  manageUrl: string | null;
  onStartOver: () => void;
}) {
  return (
    <section className={styles.preparedStep} aria-labelledby="prepared-heading">
      <div className={styles.successIcon}>
        <CheckCircle2 aria-hidden="true" size={44} />
      </div>
      <p className={styles.sectionKicker}>7 of 7</p>
      <h3 id="prepared-heading">Booking request submitted</h3>
      {bookingId ? (
        <p className={styles.bookingReference}>
          Reference: <strong>{bookingId}</strong>
        </p>
      ) : null}
      <p>
        Your service, participant details, visit area and preferred time have
        been sent to Rahma Therapy. We will confirm availability before any
        appointment is final.
      </p>
      <div className={styles.preparedNextSteps}>
        <p>A confirmation email has been sent to your email address.</p>
        <p>Payment is taken in person by cash or card.</p>
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
            <p>
              Save this link if you need to request a change or cancellation.
            </p>
            <code>{manageUrl}</code>
          </div>
        ) : (
          <p>
            Keep your confirmation email safe; the manage link in it may be
            needed for changes or cancellation.
          </p>
        )}
      </div>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={onStartOver}
      >
        Start a new request
      </button>
    </section>
  );
}
