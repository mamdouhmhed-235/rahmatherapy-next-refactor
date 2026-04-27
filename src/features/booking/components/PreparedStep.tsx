"use client";

import { CheckCircle2 } from "lucide-react";
import styles from "../BookingExperience.module.css";

export function PreparedStep({ onStartOver }: { onStartOver: () => void }) {
  return (
    <section className={styles.preparedStep} aria-labelledby="prepared-heading">
      <div className={styles.successIcon}>
        <CheckCircle2 aria-hidden="true" size={44} />
      </div>
      <p className={styles.sectionKicker}>4 of 4</p>
      <h3 id="prepared-heading">Booking request ready</h3>
      <p>
        Your package, preferred home visit time and contact details have been
        reviewed. Rahma Therapy will confirm availability before any appointment
        is final.
      </p>
      <button type="button" className={styles.secondaryButton} onClick={onStartOver}>
        Start a new request
      </button>
    </section>
  );
}
