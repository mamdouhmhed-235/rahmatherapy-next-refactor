"use client";

import { Check } from "lucide-react";
import {
  BOOKING_PACKAGES,
  PACKAGE_GROUPS,
  type BookingPackageId,
} from "../data/booking-packages";
import { formatPrice } from "../utils/format";
import styles from "../BookingExperience.module.css";

interface PackageSelectionStepProps {
  selectedPackageIds: BookingPackageId[];
  error?: string;
  onToggle: (id: BookingPackageId) => void;
  onClear: () => void;
}

export function PackageSelectionStep({
  selectedPackageIds,
  error,
  onToggle,
  onClear,
}: PackageSelectionStepProps) {
  return (
    <section className={styles.stepSection} aria-labelledby="packages-heading">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>1 of 6</p>
          <h3 id="packages-heading">Choose your service</h3>
          <p>
            Choose one hijama or cupping package. You can also add one massage
            session if you want extra hands-on support.
          </p>
        </div>
        <button type="button" className={styles.textButton} onClick={onClear}>
          Clear selection
        </button>
      </div>

      <div className={styles.packageGrid}>
        {BOOKING_PACKAGES.map((item) => {
          const selected = selectedPackageIds.includes(item.id);
          return (
            <button
              type="button"
              key={item.id}
              className={selected ? styles.packageCardSelected : styles.packageCard}
              onClick={() => onToggle(item.id)}
              aria-pressed={selected}
            >
              <span className={selected ? styles.selectMarkActive : styles.selectMark}>
                {selected && <Check aria-hidden="true" size={14} />}
              </span>
              <span className={styles.packageTopline}>
                <span className={styles.packageGroup}>
                  {PACKAGE_GROUPS[item.group]}
                </span>
                {item.durationLabel && (
                  <span className={styles.packageDuration}>{item.durationLabel}</span>
                )}
                {item.badge && <span className={styles.badge}>{item.badge}</span>}
              </span>
              <span className={styles.packageTitle}>{item.name}</span>
              <span className={styles.packageSummary}>{item.summary}</span>
              <span className={styles.packageIncludes}>
                {item.includes.map((include) => (
                  <span key={include}>
                    <Check aria-hidden="true" size={14} />
                    {include}
                  </span>
                ))}
              </span>
              <span className={styles.packageFooter}>
                <strong>{formatPrice(item.price)}</strong>
                <span>{selected ? "Selected" : "Add package"}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  );
}
