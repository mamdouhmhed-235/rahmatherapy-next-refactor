"use client";

import type { BookingPackage } from "../data/booking-packages";
import type { BookingDetailsFormValues } from "../schemas/booking-schema";
import { formatDateLabel, formatPrice } from "../utils/format";
import styles from "../BookingExperience.module.css";

interface ReviewStepProps {
  details: BookingDetailsFormValues;
  submissionError?: string;
  selectedPackages: BookingPackage[];
  perPersonTotal: number;
  total: number;
  preferredDate: string | null;
  preferredTime: string | null;
}

function getParticipantRows(details: BookingDetailsFormValues) {
  const genders =
    details.numberOfPeople > 1
      ? details.participantGenders.slice(0, details.numberOfPeople)
      : [details.clientGender];

  return genders.map((gender, index) => ({
    gender,
    name:
      details.bookingFor === "self" && index === 0
        ? details.fullName
        : details.participantNames[index]?.trim() || `Participant ${index + 1}`,
    note: details.participantNotes[index]?.trim() ?? "",
  }));
}

export function ReviewStep({
  details,
  submissionError,
  selectedPackages,
  perPersonTotal,
  total,
  preferredDate,
  preferredTime,
}: ReviewStepProps) {
  const participantRows = getParticipantRows(details);
  const durationLabel = selectedPackages
    .map((item) => item.durationLabel)
    .filter(Boolean)
    .join(" + ");

  return (
    <section className={styles.stepSection} aria-labelledby="review-heading">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>6 of 7</p>
          <h3 id="review-heading">Review your request</h3>
          <p>
            Check the service, participant summary, address, matched time and
            payment expectations before sending.
          </p>
        </div>
      </div>

      <div className={styles.reviewGrid}>
        <ReviewBlock title="Selected service">
          {selectedPackages.map((item) => (
            <div className={styles.reviewLine} key={item.id}>
              <span>{item.name}</span>
              <strong>{formatPrice(item.price)} per person</strong>
            </div>
          ))}
          {durationLabel ? <p>Duration: {durationLabel}</p> : null}
          <div className={styles.reviewLine}>
            <span>Participants</span>
            <strong>
              {details.numberOfPeople}{" "}
              {details.numberOfPeople === 1 ? "person" : "people"}
            </strong>
          </div>
          <div className={styles.reviewLine}>
            <span>Per-person price</span>
            <strong>{formatPrice(perPersonTotal)}</strong>
          </div>
          <div className={styles.reviewTotal}>
            <span>Total group price</span>
            <strong>{formatPrice(total)}</strong>
          </div>
        </ReviewBlock>

        <ReviewBlock title="Matched appointment">
          <p>{formatDateLabel(preferredDate)}</p>
          <p>{preferredTime || "Time not chosen"}</p>
          <p>
            This time matches the therapist availability needed for the selected
            service, location and participant gender.
          </p>
        </ReviewBlock>

        <ReviewBlock title="Contact snapshot">
          <p>{details.fullName}</p>
          <p>{details.phone}</p>
          <p>{details.email}</p>
          <p>
            {details.bookingFor === "self"
              ? "Booking for self"
              : details.bookingFor === "someone_else"
                ? "Booking for someone else"
                : "Group booking"}
          </p>
        </ReviewBlock>

        <ReviewBlock title="Participant summary">
          {participantRows.map((participant, index) => (
            <div className={styles.participantReviewLine} key={`${participant.name}-${index}`}>
              <strong>{participant.name}</strong>
              <span>{participant.gender === "male" ? "Male" : "Female"}</span>
              {participant.note ? <p>{participant.note}</p> : null}
            </div>
          ))}
        </ReviewBlock>

        <ReviewBlock title="Home visit address">
          <p>{details.address}</p>
          <p>{details.city}</p>
          <p>{details.area}</p>
          <p>{details.postcode}</p>
          {details.accessNotes.trim() ? <p>{details.accessNotes}</p> : null}
          {details.parkingNotes.trim() ? <p>{details.parkingNotes}</p> : null}
        </ReviewBlock>

        <ReviewBlock title="Consent and payment">
          <p>Consent confirmed.</p>
          <p>Payment expected in person by cash or card.</p>
          <p>
            Confirmation and manage/cancellation details may be sent after the
            request is reviewed.
          </p>
        </ReviewBlock>
      </div>

      {details.notes.trim() ? (
        <div className={styles.notesReview}>
          <strong>Treatment notes</strong>
          <p>{details.notes}</p>
        </div>
      ) : null}

      {details.healthNotes.trim() ? (
        <div className={styles.notesReview}>
          <strong>Health or safety notes</strong>
          <p>{details.healthNotes}</p>
        </div>
      ) : null}

      {submissionError ? (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {submissionError}
        </p>
      ) : null}
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
