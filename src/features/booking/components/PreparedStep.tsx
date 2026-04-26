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
      <h3 id="prepared-heading">Request details ready</h3>
      <p>
        Your preferred treatment, visit time, and contact details have been reviewed.
        Zam Therapy will still need to confirm availability before the appointment is final.
      </p>
      <button type="button" className={styles.secondaryButton} onClick={onStartOver}>
        Start over
      </button>
    </section>
  );
}
