import { cookies } from "next/headers";
import { AdminStatusBadge } from "@/app/admin/components/admin-ui";
import { PasswordResetCard } from "./PasswordResetCard";
import { ForgotForm } from "./states/ForgotForm";
import { SubmittedConfirmation } from "./states/SubmittedConfirmation";
import { PendingStatus } from "./states/PendingStatus";

/**
 * /admin/password-reset (base route).
 *
 * Handles states 1, 2, 3 (and the cleared-cookie path back to 1) for the
 * pre-auth surface. The companion [token] route handles states 4, 5, 6.
 *
 * State routing (server-side, no client effects):
 *   - ?state=submitted  → state 2 (just submitted; cookie present)
 *   - cookie present + no query  → state 3 (returning visit, still pending)
 *   - no cookie  → state 1
 *
 * FAKE: real implementation also queries `account_password_requests` by the
 * cookie's email-hash to confirm row status (pending → state 3; rejected →
 * state 5; the cookie alone is not the source of truth). Until
 * BUILD-password-reset-request-actions.md lands, cookie-only routing is the
 * UI testbed.
 */

// noindex: the middleware exempts the whole /admin/password-reset subtree from
// the auth gate, so this is publicly reachable. Must stay crawlable for the
// directive to be read.
export const metadata = {
  title: "Password reset — Rahma Therapy Admin",
  robots: { index: false },
};

const COOKIE_NAME = "rahma_password_reset_request";

// State 2/3 chip — Pending family (clock icon) via the shared AdminStatusBadge
// primitive (DESIGN.md §5). Token + icon mapping lives in admin-ui.tsx so the
// password-reset surface stays drift-free from the canonical status palette.
const PENDING_CHIP = <AdminStatusBadge value="Pending review" tone="info" />;

interface PasswordResetPageProps {
  searchParams: Promise<{
    state?: string;
    error?: string;
    email?: string;
  }>;
}

interface ParsedCookie {
  maskedEmail: string;
  submittedAt: string;
}

function parseCookie(raw: string | undefined): ParsedCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ParsedCookie>;
    if (
      typeof parsed.maskedEmail === "string" &&
      typeof parsed.submittedAt === "string"
    ) {
      return {
        maskedEmail: parsed.maskedEmail,
        submittedAt: parsed.submittedAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export default async function PasswordResetPage({
  searchParams,
}: PasswordResetPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookie = parseCookie(cookieStore.get(COOKIE_NAME)?.value);

  // ── State 2: just submitted ──────────────────────────────────────────
  if (params.state === "submitted" && cookie) {
    return (
      <PasswordResetCard heading="Request received" chip={PENDING_CHIP}>
        <SubmittedConfirmation maskedEmail={cookie.maskedEmail} />
      </PasswordResetCard>
    );
  }

  // ── State 3: returning visit, still pending ──────────────────────────
  if (cookie && !params.state) {
    return (
      <PasswordResetCard heading="Still waiting on review" chip={PENDING_CHIP}>
        <PendingStatus
          maskedEmail={cookie.maskedEmail}
          submittedAt={cookie.submittedAt}
        />
      </PasswordResetCard>
    );
  }

  // ── State 1: default forgot-password form ─────────────────────────────
  return (
    <PasswordResetCard heading="Reset your password">
      <ForgotForm errorCode={params.error} email={params.email} />
    </PasswordResetCard>
  );
}
