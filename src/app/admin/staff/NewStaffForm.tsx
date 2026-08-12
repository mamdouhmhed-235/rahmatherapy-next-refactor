"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createStaffProfile } from "./actions";

interface Role {
  id: string;
  name: string;
  display_label: string | null;
}

interface NewStaffFormProps {
  roles: Role[];
  fullWidth?: boolean;
}

const EMAIL_REGEX = /.+@.+\..+/;

type FieldErrors = Partial<Record<"name" | "email" | "role_id" | "gender", string>>;

export function NewStaffForm({ roles, fullWidth = false }: NewStaffFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function resetForm() {
    setName("");
    setEmail("");
    setRoleId(roles[0]?.id ?? "");
    setGender("");
    setFormError(null);
    setFieldErrors({});
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!name.trim()) {
      errors.name = "Add their full name so the team knows who joined.";
    }
    if (!email.trim()) {
      errors.email = "Add an email so they can sign in.";
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = "Email needs an @ symbol. For example: name@example.com.";
    }
    if (!roleId) {
      errors.role_id = "Pick a role so they have the right permissions on day one.";
    }
    if (!gender) {
      errors.gender = "Pick their gender; it's used for same-gender booking matching.";
    }
    return errors;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Check the highlighted fields and try again.");
      return;
    }

    startTransition(async () => {
      const result = await createStaffProfile({
        name,
        email,
        role_id: roleId,
        gender: gender as "male" | "female",
      });

      if (result.error) {
        // Map the common server-side errors to the brief copy.
        const serverError = result.error;
        const isDuplicate = /already/i.test(serverError);
        const message = isDuplicate
          ? "Someone with that email is already on the team. Open their profile if you need to update it."
          : serverError;
        setFormError(message);
        setFieldErrors((prev) =>
          isDuplicate ? { ...prev, email: message } : prev
        );
        toast.error("Couldn't add this team member. Try again.");
        return;
      }

      toast.success(`${name.trim()} added to the team. Invitation email sent.`);
      resetForm();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={roles.length === 0}
        className={`${fullWidth ? "flex w-full" : "inline-flex"} h-10 items-center justify-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:pointer-events-none disabled:opacity-50`}
      >
        <UserPlus className="size-4" aria-hidden="true" />
        Add staff member
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>
              Create their profile now. They&apos;ll receive a sign-in invitation by
              email.
            </DialogDescription>
          </DialogHeader>

          {formError ? (
            <div
              role="alert"
              aria-live="polite"
              aria-atomic="true"
              className="flex items-start gap-2.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-status-cancelled-bg)] px-3 py-3 text-sm text-[var(--admin-status-cancelled-text)]"
            >
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          ) : null}

          <div className="grid gap-4">
            <FieldLabel htmlFor="staff-name" required>
              Full name
            </FieldLabel>
            <FieldInput
              id="staff-name"
              name="name"
              value={name}
              required
              onChange={(event) => setName(event.target.value)}
              placeholder="As they'd like it on their record"
              disabled={isPending}
              error={fieldErrors.name}
            />

            <FieldLabel htmlFor="staff-email" required>
              Email
            </FieldLabel>
            <FieldInput
              id="staff-email"
              name="email"
              type="email"
              value={email}
              required
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              hint="They'll receive a sign-in invitation at this address."
              disabled={isPending}
              error={fieldErrors.email}
            />

            <FieldLabel htmlFor="staff-role" required>
              Role
            </FieldLabel>
            <FieldSelect
              id="staff-role"
              name="role_id"
              value={roleId}
              required
              onChange={(event) => setRoleId(event.target.value)}
              disabled={isPending}
              error={fieldErrors.role_id}
            >
              <option value="">Pick a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.display_label ?? role.name}
                </option>
              ))}
            </FieldSelect>

            <FieldLabel htmlFor="staff-gender" required>
              Gender
            </FieldLabel>
            <FieldSelect
              id="staff-gender"
              name="gender"
              value={gender}
              required
              onChange={(event) => setGender(event.target.value as "male" | "female" | "")}
              disabled={isPending}
              hint="Used for same-gender booking matching."
              error={fieldErrors.gender}
            >
              <option value="">Pick a gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </FieldSelect>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="inline-flex h-10 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-4 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || roles.length === 0}
              aria-busy={isPending || undefined}
              className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : null}
              Add staff member
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="-mb-3 text-sm font-medium text-[var(--admin-heading)]"
    >
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-[var(--admin-status-cancelled-text)]">
          *
        </span>
      ) : null}
    </label>
  );
}

function FieldHint({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-xs text-[var(--admin-text-muted)]">
      {children}
    </p>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center gap-1.5 text-xs text-[var(--admin-status-cancelled-text)]"
    >
      <XCircle className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </div>
  );
}

function FieldInput({
  id,
  hint,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  hint?: string;
  error?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="grid gap-1.5">
      <input
        id={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
          undefined
        }
        className={`h-10 rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors placeholder:text-[var(--admin-text-muted)] focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-[oklch(26%_0.14_25)]" : "border-[var(--admin-border-form)]"
        } ${className ?? ""}`}
        {...props}
      />
      {hint && !error ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

function FieldSelect({
  id,
  hint,
  error,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  hint?: string;
  error?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="grid gap-1.5">
      <select
        id={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
          undefined
        }
        className={`h-10 rounded-[var(--admin-radius-control)] border bg-[var(--admin-surface-input)] px-3 text-sm text-[var(--admin-body)] outline-none transition-colors focus-visible:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-[oklch(26%_0.14_25)]" : "border-[var(--admin-border-form)]"
        } ${className ?? ""}`}
        {...props}
      >
        {children}
      </select>
      {hint && !error ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
