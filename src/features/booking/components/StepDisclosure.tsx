"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import styles from "../BookingExperience.module.css";

interface StepDisclosureProps {
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function StepDisclosure({
  label,
  defaultOpen = false,
  children,
}: StepDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={styles.disclosure}>
      <button
        type="button"
        className={
          open
            ? `${styles.disclosureButton} ${styles.disclosureButtonOpen}`
            : styles.disclosureButton
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus aria-hidden="true" size={16} />
        {label}
      </button>
      {open ? (
        <div id={panelId} className={styles.disclosurePanel}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
