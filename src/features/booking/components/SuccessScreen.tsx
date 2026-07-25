"use client";

import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { CheckCircle2, Copy } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  const copyManageUrl = async () => {
    if (!manageUrl) return;

    try {
      await navigator.clipboard.writeText(manageUrl);
      setCopied(true);
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the visible URL below remains selectable.
    }
  };

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
          <div className={styles.manageUrlRow}>
            <code>{manageUrl}</code>
            <button
              type="button"
              className={styles.copyButton}
              onClick={copyManageUrl}
            >
              <Copy aria-hidden="true" size={14} />
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
          <span className={styles.srOnly} aria-live="polite">
            {copied ? "Manage link copied to clipboard" : ""}
          </span>
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
