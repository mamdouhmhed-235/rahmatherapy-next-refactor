import { AdminStatusBadge } from "@/app/admin/components/admin-ui";
import { PasswordResetCard } from "../PasswordResetCard";
import { SetNewPassword } from "../states/SetNewPassword";
import { Rejected } from "../states/Rejected";
import { Expired } from "../states/Expired";
import { ForgotForm } from "../states/ForgotForm";

/**
 * /admin/password-reset/[token].
 *
 * Handles states 4 (approved), 5 (rejected on token), 6 (expired).
 *
 * FAKE token verification: real implementation hashes the URL token + looks
 * up the row in `account_password_requests`. Until
 * BUILD-password-reset-request-actions.md lands, we route via a static map of
 * test tokens so the full surface (all six states) is reachable from the UI:
 *
 *   test-approved-token  → state 4 (set new password)
 *   test-rejected-token  → state 5 (rejected, reviewer note present)
 *   test-rejected-empty  → state 5 (rejected, no reviewer note)
 *   test-expired-token   → state 6 (expired, inline state-1 form)
 *
 * Any other token (including hostile / tampered values like
 * `<script>alert(1)</script>`) falls to state 5 with body "This link is no
 * longer valid. Submit a new request below." — the brief §6 hostile-token
 * rule. The token NEVER appears in the rendered HTML; React's default
 * escaping handles any attempted echo, and the rejected state never reads
 * the token into its output.
 */

export const metadata = {
  title: "Password reset — Rahma Therapy Admin",
};

// State chips routed through the shared AdminStatusBadge primitive (DESIGN.md
// §5). Tone → icon + token-pair mapping is centralised in admin-ui.tsx, which
// removes four future drift points if the status palette is ever retuned.
const APPROVED_CHIP = <AdminStatusBadge value="Approved" tone="success" />;
const NOT_APPROVED_CHIP = <AdminStatusBadge value="Not approved" tone="danger" />;
const EXPIRED_CHIP = <AdminStatusBadge value="Expired" tone="restricted" />;

type ResolvedTokenState =
  | { kind: "approved"; token: string }
  | { kind: "rejected"; reviewerNote: string | null }
  | { kind: "expired" }
  | { kind: "hostile" };

function resolveToken(rawToken: string): ResolvedTokenState {
  // FAKE: deterministic test-token map. Real action will read
  // account_password_requests by hashed-token equality.
  switch (rawToken) {
    case "test-approved-token":
      return { kind: "approved", token: rawToken };
    case "test-rejected-token":
      return {
        kind: "rejected",
        reviewerNote:
          "Thanks for getting in touch. The owner needs a brief chat before approving this one. Drop us a message on WhatsApp and we'll sort it together.",
      };
    case "test-rejected-empty":
      return { kind: "rejected", reviewerNote: null };
    case "test-expired-token":
      return { kind: "expired" };
    default:
      // Hostile / tampered / unknown token → state 5 chrome (heading + chip)
      // but the body switches to "This link is no longer valid" and an inline
      // state-1 form replaces the "Submit a new request" button per brief §6.
      // The rawToken is NEVER threaded into the render path.
      return { kind: "hostile" };
  }
}

interface TokenPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function PasswordResetTokenPage({
  params,
  searchParams,
}: TokenPageProps) {
  const { token } = await params;
  const { error } = await searchParams;

  const resolved = resolveToken(token);

  if (resolved.kind === "approved") {
    return (
      <PasswordResetCard
        heading="Set a new password"
        chip={APPROVED_CHIP}
        showBackLink={false}
      >
        <SetNewPassword token={resolved.token} serverErrorCode={error} />
      </PasswordResetCard>
    );
  }

  if (resolved.kind === "expired") {
    return (
      <PasswordResetCard
        heading="This link has expired"
        chip={EXPIRED_CHIP}
      >
        <Expired />
      </PasswordResetCard>
    );
  }

  if (resolved.kind === "hostile") {
    return (
      <PasswordResetCard
        heading="Request not approved"
        chip={NOT_APPROVED_CHIP}
      >
        <p className="text-center text-base leading-[1.55] text-[var(--admin-body)] [text-wrap:pretty]">
          This link is no longer valid. Submit a new request below.
        </p>
        <ForgotForm variant="expired-inline" />
      </PasswordResetCard>
    );
  }

  // rejected — named token with optional reviewer note (state 5)
  return (
    <PasswordResetCard
      heading="Request not approved"
      chip={NOT_APPROVED_CHIP}
    >
      <Rejected reviewerNote={resolved.reviewerNote} />
    </PasswordResetCard>
  );
}
