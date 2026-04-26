"use client";

import type { BookingPackage } from "../data/booking-packages";
import type { BookingDetails } from "../types";
import { formatDateLabel, formatPrice } from "../utils/format";
import styles from "../BookingExperience.module.css";

interface ReviewStepProps {
  details: BookingDetails;
  acknowledged: boolean;
  acknowledgementError?: string;
  selectedPackages: BookingPackage[];
  total: number;
  preferredDate: string | null;
  preferredTime: string | null;
  onAcknowledgedChange: (value: boolean) => void;
}

export function ReviewStep({
  details,
  acknowledged,
  acknowledgementError,
  selectedPackages,
  total,
  preferredDate,
  preferredTime,
  onAcknowledgedChange,
}: ReviewStepProps) {
  return (
    <section className={styles.stepSection} aria-labelledby="review-heading">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>3 of 4</p>
          <h3 id="review-heading">Review your request</h3>
          <p>Check the treatment, contact details, visit address, and preferred time.</p>
        </div>
      </div>

      <div className={styles.reviewGrid}>
        <ReviewBlock title="Packages">
          {selectedPackages.map((item) => (
            <div className={styles.reviewLine} key={item.id}>
              <span>{item.name}</span>
              <strong>{formatPrice(item.price)}</strong>
            </div>
          ))}
          <div className={styles.reviewTotal}>
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>
        </ReviewBlock>

        <ReviewBlock title="Preferred visit">
          <p>{formatDateLabel(preferredDate)}</p>
          <p>{preferredTime || "Time not selected"}</p>
          <p>This is a preferred date/time, not confirmed availability.</p>
        </ReviewBlock>

        <ReviewBlock title="Contact">
          <p>{details.phone}</p>
          <p>{details.email}</p>
          <p>{details.clientGender === "male" ? "Male client" : "Female client"}</p>
        </ReviewBlock>

        <ReviewBlock title="Location">
          <p>{details.postcode}</p>
          <p>{details.address}</p>
        </ReviewBlock>
      </div>

      {details.notes.trim() && (
        <div className={styles.notesReview}>
          <strong>Booking notes</strong>
          <p>{details.notes}</p>
        </div>
      )}

      <label className={styles.acknowledgement}>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onAcknowledgedChange(event.target.checked)}
        />
        <span>
          I understand this request is not a confirmed appointment until the therapist
          contacts me and confirms availability.
        </span>
      </label>
      {acknowledgementError && (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {acknowledgementError}
        </p>
      )}
    </section>
  );
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.reviewBlock}>
      <h4>{title}</h4>
      {children}
    </section>
  );
}
