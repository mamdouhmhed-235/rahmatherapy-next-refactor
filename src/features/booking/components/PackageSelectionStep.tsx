"use client";

import { Check } from "lucide-react";
import {
  BOOKING_PACKAGES,
  PACKAGE_GROUPS,
  type BookingPackage,
  type BookingPackageId,
  type PackageGroup,
} from "../data/booking-packages";
import { formatPrice } from "../utils/format";
import styles from "../BookingExperience.module.css";

interface PackageSelectionStepProps {
  selectedPackageIds: BookingPackageId[];
  /**
   * D-033 — the slugs the database says may be booked right now.
   *
   * ⛔ `undefined`/`null` means the lookup FAILED and every package is shown,
   * which is the behaviour that existed before this prop. It does NOT mean
   * "nothing is bookable" — collapsing those two would take the booking form
   * down on a transient database error.
   */
  bookableSlugs?: string[] | null;
  error?: string;
  onToggle: (id: BookingPackageId) => void;
  onClear: () => void;
}

const GROUP_ORDER: PackageGroup[] = ["cupping", "massage"];

function PackageCard({
  item,
  selected,
  onToggle,
}: {
  item: BookingPackage;
  selected: boolean;
  onToggle: (id: BookingPackageId) => void;
}) {
  return (
    <button
      type="button"
      className={selected ? styles.packageCardSelected : styles.packageCard}
      onClick={() => onToggle(item.id)}
      aria-pressed={selected}
    >
      <span className={selected ? styles.selectMarkActive : styles.selectMark}>
        {selected && <Check aria-hidden="true" size={14} />}
      </span>
      <span className={styles.packageTopline}>
        <span className={styles.packageGroup}>{PACKAGE_GROUPS[item.group]}</span>
        {item.durationLabel && (
          <span className={styles.packageDuration}>{item.durationLabel}</span>
        )}
        {item.badge && <span className={styles.badge}>{item.badge}</span>}
      </span>
      <span className={styles.packageTitle}>{item.name}</span>
      <span className={styles.packageSummary}>{item.summary}</span>
      <span className={styles.packageSuitability}>{item.suitability}</span>
      {item.genderRestrictionLabel ? (
        <span className={styles.packageRestriction}>
          {item.genderRestrictionLabel}
        </span>
      ) : null}
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
        <span>{selected ? "Selected" : "Per person"}</span>
      </span>
    </button>
  );
}

export function PackageSelectionStep({
  selectedPackageIds,
  bookableSlugs,
  error,
  onToggle,
  onClear,
}: PackageSelectionStepProps) {
  // ⛔ `== null` on purpose — it catches BOTH undefined (prop not passed, e.g.
  // an older caller or a test) and null (the database lookup failed). Either
  // way the full list is shown, which is the pre-D-033 behaviour. Only a real
  // array filters anything, so this can never blank the form by accident.
  const bookablePackages =
    bookableSlugs == null
      ? BOOKING_PACKAGES
      : BOOKING_PACKAGES.filter((item) => bookableSlugs.includes(item.id));

  return (
    <section className={styles.stepSection} aria-labelledby="service-heading">
      <div className={styles.stepHeaderRow}>
        <div className={styles.stepHeader}>
          <p className={styles.stepKicker}>Step 1 of 4</p>
          <h2 id="service-heading" className={styles.stepTitle} tabIndex={-1}>
            Choose your service
          </h2>
          <p className={styles.stepSubtitle}>
            Choose one hijama or cupping package. You can also add one massage
            session if you want extra hands-on support.
          </p>
        </div>
        <button type="button" className={styles.textButton} onClick={onClear}>
          Clear selection
        </button>
      </div>

      {GROUP_ORDER.map((group) => {
        const groupPackages = bookablePackages.filter(
          (item) => item.group === group
        );
        // A group with nothing bookable left in it renders no empty heading.
        if (groupPackages.length === 0) return null;
        return (
          <div key={group} className={styles.stepBlock}>
            <p className={styles.groupHeading}>{PACKAGE_GROUPS[group]}</p>
            <div className={styles.packageGrid}>
              {groupPackages.map((item) => (
                <PackageCard
                  key={item.id}
                  item={item}
                  selected={selectedPackageIds.includes(item.id)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>
        );
      })}

      {error && (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  );
}
