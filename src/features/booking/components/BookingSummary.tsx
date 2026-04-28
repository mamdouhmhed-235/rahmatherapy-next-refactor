"use client";

import type { ReactNode } from "react";
import { PackageCheck } from "lucide-react";
import type { BookingPackage } from "../data/booking-packages";
import { formatDateLabel, formatPrice } from "../utils/format";
import styles from "../BookingExperience.module.css";

interface BookingSummaryProps {
  selectedPackages: BookingPackage[];
  packageTotal: number;
  preferredDate: string | null;
  preferredTime: string | null;
  actions: ReactNode;
}

export function BookingSummary({
  selectedPackages,
  packageTotal,
  preferredDate,
  preferredTime,
  actions,
}: BookingSummaryProps) {
  return (
    <aside
      className={styles.summary}
      aria-label="Booking request summary"
      aria-live="polite"
    >
      <div className={styles.summaryAccent} aria-hidden="true" />
      <div className={styles.summaryTopRow}>
        <div>
          <div className={styles.summaryHeader}>
            <PackageCheck aria-hidden="true" size={20} />
            <h3>Your booking request</h3>
          </div>
          <p className={styles.summaryIntro}>
            Check your selected package, estimated total and preferred home visit
            time.
          </p>
        </div>

        <div className={styles.summaryList}>
          {selectedPackages.length === 0 ? (
            <p className={styles.emptySummary}>
              Selected packages will appear here.
            </p>
          ) : (
            selectedPackages.map((item) => (
              <div key={item.id} className={styles.summaryItem}>
                <span>{item.name}</span>
                <strong>{formatPrice(item.price)}</strong>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.summaryActionRow}>
        <div className={styles.summaryTotal}>
          <span>Estimated total</span>
          <strong>{formatPrice(packageTotal)}</strong>
        </div>
        <div className={styles.summaryActions}>{actions}</div>
      </div>

      <dl className={styles.summaryMeta}>
        <div>
          <dt>Packages</dt>
          <dd>{selectedPackages.length}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDateLabel(preferredDate)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{preferredTime || "Time not chosen"}</dd>
        </div>
      </dl>
    </aside>
  );
}
