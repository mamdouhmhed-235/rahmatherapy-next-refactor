"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInAdmin } from "./actions";

interface LoginFormProps {
  redirectTo: string;
}

type FieldErrors = { email?: string; password?: string };

const REQUIRED_STAR = (
  <span aria-hidden="true" className="ml-0.5 text-[var(--admin-danger)]">
    *
  </span>
);

function validate(email: string, password: string): FieldErrors | null {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = "Add your email address.";
  } else if (!email.includes("@")) {
    errors.email =
      "Email needs an @ symbol (for example, sara@example.com).";
  }
  if (!password) {
    errors.password = "Add your password.";
  }
  return Object.keys(errors).length ? errors : null;
}

function mapServerError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid credentials") || lower.includes("incorrect")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("deactivated") || lower.includes("inactive")) {
    return "Your account is deactivated. Contact the owner to regain access.";
  }
  if (lower.includes("too many") || lower.includes("rate")) {
    return "Too many sign-in attempts. Wait a few minutes and try again.";
  }
  return "Something went wrong. Try again.";
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(currentEmail: string, currentPassword: string) {
    const issues = validate(currentEmail, currentPassword);
    if (issues) {
      setFieldErrors(issues);
      setFormError(null);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setLoading(true);

    try {
      const result = await signInAdmin(currentEmail, currentPassword);
      if (result?.error) {
        setFormError(mapServerError(result.error));
        setPassword("");
        setLoading(false);
        return;
      }
      router.push(redirectTo || "/admin/dashboard");
      router.refresh();
    } catch {
      setFormError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(email, password);
  }

  const isServerNetworkError = formError === "Something went wrong. Try again.";

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          Email address{REQUIRED_STAR}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-required="true"
          aria-invalid={fieldErrors.email ? "true" : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          data-error={fieldErrors.email ? "true" : undefined}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          disabled={loading}
        />
        {fieldErrors.email ? (
          <div
            id="email-error"
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="text-xs text-[var(--admin-danger)]"
          >
            {fieldErrors.email}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-sm font-medium text-[var(--admin-heading)]"
        >
          Password{REQUIRED_STAR}
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-required="true"
          aria-invalid={fieldErrors.password ? "true" : undefined}
          aria-describedby={
            fieldErrors.password ? "password-error" : undefined
          }
          data-error={fieldErrors.password ? "true" : undefined}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={loading}
        />
        {fieldErrors.password ? (
          <div
            id="password-error"
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="text-xs text-[var(--admin-danger)]"
          >
            {fieldErrors.password}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Link
            href="/admin/password-reset"
            title="Reset your password"
            className="-mr-1 rounded-sm px-1 py-2 text-xs font-medium text-[var(--admin-text-muted)] underline-offset-2 hover:text-[var(--admin-heading)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      {formError ? (
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-start gap-2.5 rounded-[var(--admin-radius-sm)] border bg-[var(--admin-danger-bg)] px-3.5 py-3 text-sm text-[var(--admin-danger)]"
          style={{
            borderColor:
              "color-mix(in oklab, var(--admin-danger) 28%, transparent)",
          }}
        >
          <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-1 flex-col items-start gap-1.5">
            <span>{formError}</span>
            {isServerNetworkError ? (
              <button
                type="button"
                onClick={() => submit(email, password)}
                className="rounded-sm text-sm font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <Button
        type="submit"
        variant="admin-primary"
        size="lg"
        fullWidth
        loading={loading}
        className="mt-2"
      >
        Sign in
      </Button>
    </form>
  );
}
