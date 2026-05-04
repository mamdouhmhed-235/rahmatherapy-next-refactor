"use client";

import type { UseFormReturn } from "react-hook-form";
import { Car, DoorOpen, MapPin, ShieldCheck } from "lucide-react";
import {
  BOOKING_ALLOWED_CITIES,
  type BookingDetailsFormValues,
} from "../schemas/booking-schema";
import { Field } from "./Field";
import styles from "../BookingExperience.module.css";

interface LocationDetailsStepProps {
  form: UseFormReturn<BookingDetailsFormValues>;
}

export function LocationDetailsStep({ form }: LocationDetailsStepProps) {
  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const city = watch("city");

  const normalizedCity = city.trim().toLowerCase();
  const hasCityValue = normalizedCity.length > 1;
  const isCovered =
    hasCityValue &&
    BOOKING_ALLOWED_CITIES.some(
      (allowed) =>
        normalizedCity === allowed || normalizedCity.includes(allowed)
    );
  const isOutsideCoverage = hasCityValue && !isCovered;

  return (
    <section className={styles.stepSection} aria-labelledby="location-heading">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>3 of 7</p>
          <h3 id="location-heading">Where should we visit?</h3>
          <p>
            Add the home visit location before checking preferred dates and
            times.
          </p>
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formNotice}>
          <ShieldCheck aria-hidden="true" size={18} />
          <p>
            Location is checked before scheduling because therapist availability
            and travel coverage depend on the visit area.
          </p>
        </div>

        {isCovered ? (
          <div className={`${styles.fullWidth} ${styles.formNotice}`}>
            <MapPin aria-hidden="true" size={18} />
            <p>
              <strong>Covered area:</strong> We can check matched appointment
              times for this location.
            </p>
          </div>
        ) : null}

        {isOutsideCoverage ? (
          <div className={`${styles.fullWidth} ${styles.formNoticeError}`}>
            <MapPin aria-hidden="true" size={18} />
            <p>
              <strong>Outside current home visit area:</strong> We currently
              cover Luton, Dunstable, Houghton Regis, Harpenden and St Albans.
              Use a covered town before choosing a time.
            </p>
          </div>
        ) : null}

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

        <div className={styles.fullWidth}>
          <Field
            label="Area or access notes"
            icon={<DoorOpen size={16} />}
          >
            <textarea
              rows={3}
              placeholder="Flat number, entry instructions, lift/stairs, treatment space, or anything that helps arrival."
              {...register("accessNotes")}
            />
          </Field>
        </div>

        <div className={styles.fullWidth}>
          <Field
            label="Parking notes"
            icon={<Car size={16} />}
          >
            <textarea
              rows={3}
              placeholder="Parking space, visitor permit, paid parking, or nearby stopping details."
              {...register("parkingNotes")}
            />
          </Field>
        </div>

        <div className={styles.fullWidth}>
          <div className={styles.formNotice}>
            <ShieldCheck aria-hidden="true" size={18} />
            <p>
              Please prepare a clean, private space with enough room for the
              therapist to work safely. We will confirm any setup details if
              needed.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
