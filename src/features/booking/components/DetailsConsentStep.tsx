"use client";

import type { UseFormReturn } from "react-hook-form";
import { ClipboardList, CreditCard, FileCheck2, ShieldCheck } from "lucide-react";
import type { BookingDetailsFormValues } from "../schemas/booking-schema";
import { Field } from "./Field";
import styles from "../BookingExperience.module.css";

interface DetailsConsentStepProps {
  form: UseFormReturn<BookingDetailsFormValues>;
}

export function DetailsConsentStep({ form }: DetailsConsentStepProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <section className={styles.stepSection} aria-labelledby="details-heading">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>5 of 7</p>
          <h3 id="details-heading">Details and consent</h3>
          <p>
            Add only the health or safety context needed for this home visit and
            confirm the practical expectations.
          </p>
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formNotice}>
          <ShieldCheck aria-hidden="true" size={18} />
          <p>
            This is not a full medical intake. Share anything that could affect
            safe treatment, comfort, access, or therapist preparation.
          </p>
        </div>

        <div className={styles.fullWidth}>
          <Field
            label="Treatment notes"
            icon={<ClipboardList size={16} />}
          >
            <textarea
              rows={4}
              placeholder="E.g. back pain, neck and shoulder tension, hijama, massage, sports recovery, or what you want help with."
              {...register("notes")}
            />
          </Field>
        </div>

        <div className={styles.fullWidth}>
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
        </div>

        <div className={styles.fullWidth}>
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

        <div className={styles.fullWidth}>
          <label className={styles.acknowledgement}>
            <input
              type="checkbox"
              aria-invalid={Boolean(errors.paymentAcknowledged)}
              {...register("paymentAcknowledged")}
            />
            <span>
              I understand payment is taken in person by cash or card and the
              amount due is based on the selected service and participant count.
            </span>
          </label>
          {errors.paymentAcknowledged?.message ? (
            <p className={styles.fieldError} role="alert" aria-live="polite">
              {errors.paymentAcknowledged.message}
            </p>
          ) : null}
        </div>

        <div className={styles.fullWidth}>
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

        <div className={styles.formNotice}>
          <CreditCard aria-hidden="true" size={18} />
          <p>
            Online checkout is not part of this request. Your confirmation or
            follow-up will explain the in-person payment expectation.
          </p>
        </div>

        <div className={styles.formNotice}>
          <FileCheck2 aria-hidden="true" size={18} />
          <p>
            Confirmation is still subject to therapist availability and any
            safety checks needed for the treatment.
          </p>
        </div>
      </div>
    </section>
  );
}
