"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Submit button that reflects the parent `<form action={…}>`'s pending state
 * via `useFormStatus`. The Button primitive renders a 16px Field White spinner
 * in the leading-icon slot, sets `aria-busy="true"`, and stays disabled while
 * the server action is in flight. Button text is unchanged.
 *
 * Used for the state-1 forgot-password submit and the state-6 inline re-submit.
 * State 4's `SetNewPassword` is already a client component and wires its own
 * submit through this primitive in the same way.
 *
 * Brief §6 "Loading (form submission)" cross-state requirement.
 */

export function PasswordResetSubmitButton({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="admin-primary"
      size="lg"
      fullWidth
      loading={pending}
    >
      {children}
    </Button>
  );
}
