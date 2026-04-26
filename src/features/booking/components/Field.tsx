"use client";

import type { ReactElement, ReactNode } from "react";
import styles from "../BookingExperience.module.css";

interface FieldProps {
  label: string;
  error?: string;
  icon?: ReactNode;
  children: ReactElement;
}

export function Field({ label, error, icon, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span>
        {icon}
        {label}
      </span>
      {children}
      {error && (
        <p className={styles.fieldError} role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </label>
  );
}
