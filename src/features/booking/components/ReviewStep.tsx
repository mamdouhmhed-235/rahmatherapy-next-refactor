"use client";

import type { BookingPackage } from "../data/booking-packages";
import type { BookingDetailsFormValues } from "../schemas/booking-schema";
import { formatDateLabel, formatPrice } from "../utils/format";
import styles from "../BookingExperience.module.css";

interface ReviewStepProps {
  details: BookingDetailsFormValues;
  acknowledged: boolean;
  consentAcknowledged: boolean;
  acknowledgementError?: string;
  consentError?: string;
  submissionError?: string;
  selectedPackages: BookingPackage[];
  total: number;
  preferredDate: string | null;
  preferredTime: string | null;
  onAcknowledgedChange: (value: boolean) => void;
  onConsentAcknowledgedChange: (value: boolean) => void;
}

export function ReviewStep({
  details,
  acknowledged,
  consentAcknowledged,
  acknowledgementError,
  consentError,
  submissionError,
  selectedPackages,
  total,
  preferredDate,
  preferredTime,
  onAcknowledgedChange,
  onConsentAcknowledgedChange,
}: ReviewStepProps) {
  const participantGenders =
    details.numberOfPeople > 1
      ? details.participantGenders.slice(0, details.numberOfPeople)
      : [details.clientGender];

  return (
    <section className={styles.stepSection} aria-labelledby="review-heading">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>5 of 6</p>
          <h3 id="review-heading">Review your request</h3>
          <p>
            Check your service, participant details, home visit address and
            preferred appointment time.
          </p>
        </div>
      </div>

      <div className={styles.reviewGrid}>
        <ReviewBlock title="Selected service">
          {selectedPackages.map((item) => (
            <div className={styles.reviewLine} key={item.id}>
              <span>{item.name}</span>
              <strong>{formatPrice(item.price)}</strong>
            </div>
          ))}
          <div className={styles.reviewTotal}>
            <span>Estimated total</span>
            <strong>{formatPrice(total)}</strong>
          </div>
        </ReviewBlock>

        <ReviewBlock title="Preferred appointment">
          <p>{formatDateLabel(preferredDate)}</p>
          <p>{preferredTime || "Time not chosen"}</p>
          <p>
            This is your preferred date and time. Rahma Therapy will confirm
            availability before the appointment is final.
          </p>
        </ReviewBlock>

        <ReviewBlock title="Contact & client">
          <p>{details.fullName}</p>
          <p>{details.phone}</p>
          <p>{details.email}</p>
          <p>
            {details.numberOfPeople}{" "}
            {details.numberOfPeople === 1 ? "person" : "people"}
          </p>
          {participantGenders.map((gender, index) => (
            <p key={`${gender}-${index}`}>
              Person {index + 1}: {gender === "male" ? "Male" : "Female"}
            </p>
          ))}
        </ReviewBlock>

        <ReviewBlock title="Home visit address">
          <p>{details.city}</p>
          <p>{details.area}</p>
          <p>{details.address}</p>
          <p>{details.postcode}</p>
        </ReviewBlock>
      </div>

      {details.notes.trim() && (
        <div className={styles.notesReview}>
          <strong>Treatment notes</strong>
          <p>{details.notes}</p>
        </div>
      )}

      {details.healthNotes.trim() && (
        <div className={styles.notesReview}>
          <strong>Health notes</strong>
          <p>{details.healthNotes}</p>
        </div>
      )}

      <label className={styles.acknowledgement}>
        <input
          type="checkbox"
          checked={acknowledged}
          aria-invalid={Boolean(acknowledgementError)}
          onChange={(event) => onAcknowledgedChange(event.target.checked)}
        />
        <span>
          I understand this is a booking request, not a confirmed appointment,
          and Rahma Therapy will contact me to confirm availability.
        </span>
      </label>
      {acknowledgementError && (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {acknowledgementError}
        </p>
      )}
      <label className={styles.acknowledgement}>
        <input
          type="checkbox"
          checked={consentAcknowledged}
          aria-invalid={Boolean(consentError)}
          onChange={(event) => onConsentAcknowledgedChange(event.target.checked)}
        />
        <span>
          I consent to treatment, understand Rahma Therapy may refuse or adapt
          treatment for safety reasons, and have shared relevant health details.
        </span>
      </label>
      {consentError && (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {consentError}
        </p>
      )}
      {submissionError && (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {submissionError}
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
