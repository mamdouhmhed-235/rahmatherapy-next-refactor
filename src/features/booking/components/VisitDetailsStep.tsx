"use client";

import type { UseFormReturn } from "react-hook-form";
import { ClipboardList, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import type { BookingTimeSlot } from "../data/time-slots";
import type { BookingDetailsFormValues } from "../schemas/booking-schema";
import { DatePickerField } from "./DatePickerField";
import { Field } from "./Field";
import { TimeSlotPicker } from "./TimeSlotPicker";
import styles from "../BookingExperience.module.css";

interface VisitDetailsStepProps {
  form: UseFormReturn<BookingDetailsFormValues>;
  preferredDate: Date | undefined;
  preferredTime: string | null;
  scheduleError?: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: BookingTimeSlot) => void;
}

export function VisitDetailsStep({
  form,
  preferredDate,
  preferredTime,
  scheduleError,
  onDateChange,
  onTimeChange,
}: VisitDetailsStepProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const clientGender = watch("clientGender");

  return (
    <section className={styles.stepSection} aria-labelledby="details-heading">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>2 of 4</p>
          <h3 id="details-heading">Your contact and home visit details</h3>
          <p>
            Tell us how to contact you, where to visit, and anything we should
            know before treatment.
          </p>
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formNotice}>
          <ShieldCheck aria-hidden="true" size={18} />
          <p>
            Your details are handled confidentially and used only to respond to
            this booking request. Female clients are treated by a female therapist.
          </p>
        </div>

        <Field
          label="Phone / WhatsApp number"
          error={errors.phone?.message}
          icon={<Phone size={16} />}
        >
          <input
            inputMode="tel"
            autoComplete="tel"
            placeholder="07700 000000"
            aria-invalid={Boolean(errors.phone)}
            {...register("phone")}
          />
        </Field>

        <Field label="Email address" error={errors.email?.message} icon={<Mail size={16} />}>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <div className={styles.fullWidth}>
          <Field label="What would you like help with?" icon={<ClipboardList size={16} />}>
            <textarea
              rows={4}
              placeholder="E.g. back pain, neck and shoulder tension, hijama, massage, female therapist preference, gym recovery, or any health details we should know."
              {...register("notes")}
            />
          </Field>
        </div>

        <fieldset className={styles.segmentField}>
          <legend>Client gender</legend>
          <div className={styles.segmentGroup}>
            {(["male", "female"] as const).map((gender) => (
              <button
                key={gender}
                type="button"
                className={
                  clientGender === gender
                    ? styles.segmentButtonActive
                    : styles.segmentButton
                }
                aria-pressed={clientGender === gender}
                onClick={() =>
                  setValue("clientGender", gender, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {gender === "male" ? "Male" : "Female"}
              </button>
            ))}
          </div>
          {errors.clientGender?.message && (
            <p className={styles.fieldError} role="alert" aria-live="polite">
              {errors.clientGender.message}
            </p>
          )}
        </fieldset>

        <Field
          label="Luton postcode"
          error={errors.postcode?.message}
          icon={<MapPin size={16} />}
        >
          <input
            autoComplete="postal-code"
            placeholder="e.g. LU1 1AA"
            aria-invalid={Boolean(errors.postcode)}
            {...register("postcode")}
          />
        </Field>

        <div className={styles.fullWidth}>
          <Field
            label="Home visit address"
            error={errors.address?.message}
            icon={<MapPin size={16} />}
          >
            <input
              autoComplete="street-address"
              placeholder="House number and street"
              aria-invalid={Boolean(errors.address)}
              {...register("address")}
            />
          </Field>
        </div>
      </div>

      <div className={styles.schedulerGrid}>
        <DatePickerField selected={preferredDate} onSelect={onDateChange} />
        <TimeSlotPicker
          selectedTime={preferredTime}
          error={scheduleError}
          onSelect={onTimeChange}
        />
      </div>
    </section>
  );
}
