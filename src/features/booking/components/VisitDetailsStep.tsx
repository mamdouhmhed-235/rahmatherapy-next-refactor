"use client";

import type { UseFormReturn } from "react-hook-form";
import { ClipboardList, Mail, MapPin, Phone, ShieldCheck, Users } from "lucide-react";
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
  const city = watch("city");

  // Temporary coverage check (will eventually fetch from backend allowed_cities)
  const isOutsideCoverage =
    city &&
    city.length > 2 &&
    !["luton", "dunstable", "houghton regis"].some((allowed) =>
      city.toLowerCase().includes(allowed)
    );

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
          label="Number of people"
          error={errors.numberOfPeople?.message}
          icon={<Users size={16} />}
        >
          <select
            aria-invalid={Boolean(errors.numberOfPeople)}
            {...register("numberOfPeople")}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <option key={num} value={num}>
                {num} {num === 1 ? "person" : "people"}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="City / Town"
          error={errors.city?.message}
          icon={<MapPin size={16} />}
        >
          <input
            autoComplete="address-level2"
            placeholder="e.g. Luton"
            aria-invalid={Boolean(errors.city)}
            {...register("city")}
          />
        </Field>

        <Field
          label="Area / County"
          error={errors.area?.message}
          icon={<MapPin size={16} />}
        >
          <input
            autoComplete="address-level1"
            placeholder="e.g. Bedfordshire"
            aria-invalid={Boolean(errors.area)}
            {...register("area")}
          />
        </Field>

        <Field
          label="Postcode"
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

        {isOutsideCoverage && (
          <div className={`${styles.fullWidth} ${styles.formNotice}`}>
            <MapPin aria-hidden="true" size={18} />
            <p>
              <strong>Note:</strong> It looks like you are outside our standard coverage area. You may still submit a request, but we cannot guarantee availability and a travel fee may apply.
            </p>
          </div>
        )}
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
