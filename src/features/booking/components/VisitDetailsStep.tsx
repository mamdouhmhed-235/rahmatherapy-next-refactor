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
          <h3 id="details-heading">Contact and visit details</h3>
          <p>Share the details needed to arrange a respectful mobile appointment.</p>
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formNotice}>
          <ShieldCheck aria-hidden="true" size={18} />
          <p>
            Your appointment details are handled confidentially and used only to respond
            to this request.
          </p>
        </div>

        <Field
          label="Phone number"
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

        <Field label="Email" error={errors.email?.message} icon={<Mail size={16} />}>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <div className={styles.fullWidth}>
          <Field label="Reason for visit" icon={<ClipboardList size={16} />}>
            <textarea
              rows={4}
              placeholder="Briefly describe the treatment you need, any areas of concern, or preferences for the visit."
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
          label="Postcode"
          error={errors.postcode?.message}
          icon={<MapPin size={16} />}
        >
          <input
            autoComplete="postal-code"
            placeholder="e.g. EN5 5AA"
            aria-invalid={Boolean(errors.postcode)}
            {...register("postcode")}
          />
        </Field>

        <div className={styles.fullWidth}>
          <Field
            label="Address"
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
