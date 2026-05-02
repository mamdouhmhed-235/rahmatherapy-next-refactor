"use client";

import type { UseFormReturn } from "react-hook-form";
import { MapPin, ShieldCheck } from "lucide-react";
import type { BookingDetailsFormValues } from "../schemas/booking-schema";
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

  // Temporary coverage check. Phase 8 will replace this with backend rules.
  const isOutsideCoverage =
    city &&
    city.length > 2 &&
    !["luton", "dunstable", "houghton regis"].some((allowed) =>
      city.toLowerCase().includes(allowed)
    );

  return (
    <section className={styles.stepSection} aria-labelledby="location-heading">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>3 of 6</p>
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

        {isOutsideCoverage ? (
          <div className={`${styles.fullWidth} ${styles.formNotice}`}>
            <MapPin aria-hidden="true" size={18} />
            <p>
              <strong>Note:</strong> It looks like you are outside our standard
              coverage area. You may still submit a request, but we cannot
              guarantee availability and a travel fee may apply.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
