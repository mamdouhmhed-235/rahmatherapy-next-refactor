"use client";

import type { UseFormReturn } from "react-hook-form";
import { ClipboardList, CreditCard, FileCheck2 } from "lucide-react";
import type { BookingPackage } from "../data/booking-packages";
import type { BookingDetailsFormValues } from "../schemas/booking-schema";
import type { BookingDetails, BookingStep } from "../types";
import { formatDateLabel, formatPrice } from "../utils/format";
import { Field } from "./Field";
import { StepDisclosure } from "./StepDisclosure";
import styles from "../BookingExperience.module.css";

interface ConfirmStepProps {
  form: UseFormReturn<BookingDetailsFormValues>;
  details: BookingDetails;
  submissionError?: string;
  selectedPackages: BookingPackage[];
  perPersonTotal: number;
  total: number;
  preferredDate: string | null;
  preferredTime: string | null;
  onEditStep: (step: BookingStep) => void;
}

function getParticipantRows(details: BookingDetails) {
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

function RecapRow({
  label,
  step,
  onEditStep,
  children,
}: {
  label: string;
  step: BookingStep;
  onEditStep: (step: BookingStep) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.recapRow}>
      <span className={styles.recapLabel}>{label}</span>
      <div className={styles.recapValue}>{children}</div>
      <button
        type="button"
        className={`${styles.textButton} ${styles.recapEdit}`}
        onClick={() => onEditStep(step)}
        aria-label={`Edit ${label.toLowerCase()}`}
      >
        Edit
      </button>
    </div>
  );
}

export function ConfirmStep({
  form,
  details,
  submissionError,
  selectedPackages,
  perPersonTotal,
  total,
  preferredDate,
  preferredTime,
  onEditStep,
}: ConfirmStepProps) {
  const {
    register,
    formState: { errors },
  } = form;
  const participantRows = getParticipantRows(details);
  const durationLabel = selectedPackages
    .map((item) => item.durationLabel)
    .filter(Boolean)
    .join(" + ");
  const bookingForLabel =
    details.bookingFor === "self"
      ? "Booking for self"
      : details.bookingFor === "someone_else"
        ? "Booking for someone else"
        : "Group booking";

  return (
    <section className={styles.stepSection} aria-labelledby="confirm-heading">
      <div className={styles.stepHeader}>
        <p className={styles.stepKicker}>Step 4 of 4</p>
        <h2 id="confirm-heading" className={styles.stepTitle} tabIndex={-1}>
          Review your request
        </h2>
        <p className={styles.stepSubtitle}>
          Check the service, participant summary, address, matched time and
          payment expectations before sending.
        </p>
      </div>

      <div className={styles.recapCard}>
        <RecapRow label="Selected service" step="service" onEditStep={onEditStep}>
          {selectedPackages.map((item) => (
            <p key={item.id}>
              {item.name} — {formatPrice(item.price)} per person
            </p>
          ))}
          {durationLabel ? <p>Duration: {durationLabel}</p> : null}
          <p>
            {details.numberOfPeople}{" "}
            {details.numberOfPeople === 1 ? "person" : "people"}
            {details.numberOfPeople > 1
              ? ` · ${formatPrice(perPersonTotal)} per person`
              : ""}
          </p>
        </RecapRow>

        <RecapRow label="Matched appointment" step="time" onEditStep={onEditStep}>
          <p>
            {formatDateLabel(preferredDate)}
            {preferredTime ? ` · ${preferredTime}` : ""}
          </p>
        </RecapRow>

        <RecapRow label="Contact" step="about" onEditStep={onEditStep}>
          <p>
            {details.fullName} · {details.phone}
          </p>
          <p>{details.email}</p>
          <p>{bookingForLabel}</p>
        </RecapRow>

        <RecapRow label="Participants" step="about" onEditStep={onEditStep}>
          {participantRows.map((participant, index) => (
            <p key={`${participant.name}-${index}`}>
              {participant.name} ·{" "}
              {participant.gender === "male" ? "Male" : "Female"}
              {participant.note ? ` — ${participant.note}` : ""}
            </p>
          ))}
        </RecapRow>

        <RecapRow label="Home visit address" step="about" onEditStep={onEditStep}>
          <p>
            {details.address}, {details.city}, {details.area},{" "}
            {details.postcode}
          </p>
          {details.accessNotes.trim() ? <p>{details.accessNotes}</p> : null}
          {details.parkingNotes.trim() ? <p>{details.parkingNotes}</p> : null}
        </RecapRow>

        <div className={styles.recapTotalRow}>
          <span>Estimated total</span>
          <strong>{formatPrice(total)}</strong>
        </div>
      </div>

      <div className={styles.stepBlock}>
        <StepDisclosure
          label="Add treatment notes (optional)"
          defaultOpen={Boolean(details.notes.trim())}
        >
          <Field label="Treatment notes" icon={<ClipboardList size={16} />}>
            <textarea
              rows={4}
              placeholder="E.g. back pain, neck and shoulder tension, hijama, massage, sports recovery, or what you want help with."
              {...register("notes")}
            />
          </Field>
        </StepDisclosure>

        <StepDisclosure
          label="Add health or safety notes (optional)"
          defaultOpen={Boolean(details.healthNotes.trim())}
        >
          <div className={styles.notice}>
            <ClipboardList aria-hidden="true" size={18} />
            <p>
              This is not a full medical intake. Share anything that could
              affect safe treatment, comfort, access, or therapist preparation.
            </p>
          </div>
          <Field
            label="Health or safety notes"
            icon={<ClipboardList size={16} />}
          >
            <textarea
              rows={4}
              placeholder="Share allergies, medication, pregnancy, recent surgery, injuries, fainting history, skin concerns, or other safety details."
              {...register("healthNotes")}
            />
          </Field>
        </StepDisclosure>
      </div>

      <div className={styles.ackCard}>
        <p className={styles.ackIntro}>Before you send</p>

        <div className={styles.ackRow}>
          <label className={styles.acknowledgement}>
            <input
              type="checkbox"
              aria-invalid={Boolean(errors.consentAcknowledged)}
              {...register("consentAcknowledged")}
            />
            <span>
              I consent to treatment and confirm I have shared relevant health
              and safety information for the participant or group.
            </span>
          </label>
          {errors.consentAcknowledged?.message ? (
            <p className={styles.fieldError} role="alert" aria-live="polite">
              {errors.consentAcknowledged.message}
            </p>
          ) : null}
        </div>

        <div className={styles.ackRow}>
          <label className={styles.acknowledgement}>
            <input
              type="checkbox"
              aria-invalid={Boolean(errors.paymentAcknowledged)}
              {...register("paymentAcknowledged")}
            />
            <span>
              I understand payment is taken in person by cash or card and the
              amount due is based on the selected service and participant
              count.
            </span>
          </label>
          {errors.paymentAcknowledged?.message ? (
            <p className={styles.fieldError} role="alert" aria-live="polite">
              {errors.paymentAcknowledged.message}
            </p>
          ) : null}
        </div>

        <div className={styles.ackRow}>
          <label className={styles.acknowledgement}>
            <input
              type="checkbox"
              aria-invalid={Boolean(errors.manageAcknowledged)}
              {...register("manageAcknowledged")}
            />
            <span>
              I understand this is a booking request. Rahma Therapy may follow
              up to confirm details, and any manage or cancellation link should
              be kept safe once provided.
            </span>
          </label>
          {errors.manageAcknowledged?.message ? (
            <p className={styles.fieldError} role="alert" aria-live="polite">
              {errors.manageAcknowledged.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.reassurance}>
        <CreditCard aria-hidden="true" size={18} />
        <p>
          Online checkout is not part of this request. Your confirmation or
          follow-up will explain the in-person payment expectation.
        </p>
      </div>

      <div className={styles.reassurance}>
        <FileCheck2 aria-hidden="true" size={18} />
        <p>
          Confirmation is still subject to therapist availability and any
          safety checks needed for the treatment.
        </p>
      </div>

      {submissionError ? (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {submissionError}
        </p>
      ) : null}

      {/* Honeypot — invisible to humans and assistive tech. Bots that fill every
          input trip it. Do NOT use display:none (some bots skip those). */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden"
      >
        <label htmlFor="company_website">Leave this field empty</label>
        <input
          type="text"
          id="company_website"
          tabIndex={-1}
          autoComplete="off"
          {...register("company_website")}
        />
      </div>
    </section>
  );
}
