"use client";

import { PackageCheck } from "lucide-react";
import type { BookingPackage } from "../data/booking-packages";
import { formatDateLabel, formatPrice } from "../utils/format";
import styles from "../BookingExperience.module.css";

interface BookingSummaryProps {
  selectedPackages: BookingPackage[];
  packageTotal: number;
  preferredDate: string | null;
  preferredTime: string | null;
}

export function BookingSummary({
  selectedPackages,
  packageTotal,
  preferredDate,
  preferredTime,
}: BookingSummaryProps) {
  return (
    <aside className={styles.summary} aria-label="Booking summary">
      <div className={styles.summaryAccent} aria-hidden="true" />
      <div className={styles.summaryHeader}>
        <PackageCheck aria-hidden="true" size={20} />
        <h3>Your selection</h3>
      </div>
      <p className={styles.summaryIntro}>
        Review the selected treatments and estimated total before continuing.
      </p>

      <div className={styles.summaryList}>
        {selectedPackages.length === 0 ? (
          <p className={styles.emptySummary}>Selected treatments will appear here.</p>
        ) : (
          selectedPackages.map((item) => (
            <div key={item.id} className={styles.summaryItem}>
              <span>{item.name}</span>
              <strong>{formatPrice(item.price)}</strong>
            </div>
          ))
        )}
      </div>

      <div className={styles.summaryTotal}>
        <span>Estimated total</span>
        <strong>{formatPrice(packageTotal)}</strong>
      </div>

      <dl className={styles.summaryMeta}>
        <div>
          <dt>Treatments</dt>
          <dd>{selectedPackages.length}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDateLabel(preferredDate)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{preferredTime || "Time not selected"}</dd>
        </div>
      </dl>
    </aside>
  );
}
