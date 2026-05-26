import { AdminStatusBadge } from "@/app/admin/components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CURRENT_CIPHER_VERSION,
  hashResetToken,
} from "@/lib/auth/password-reset-token";
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
 * Resolution: hash the URL token + look up the matching row in
 * `account_password_requests` by `(encrypted_payload, payload_cipher_version)`.
 * Row status + expires_at then disambiguate which state renders.
 * The raw token is NEVER echoed into the rendered HTML.
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

async function resolveToken(rawToken: string): Promise<ResolvedTokenState> {
  if (!rawToken) return { kind: "hostile" };
  const hash = await hashResetToken(rawToken);
  const adminClient = createSupabaseAdminClient();
  const { data: row } = await adminClient
    .from("account_password_requests")
    .select("status, expires_at, reviewer_note")
    .eq("encrypted_payload", hash)
    .eq("payload_cipher_version", CURRENT_CIPHER_VERSION)
    .maybeSingle<{
      status: "pending" | "approved" | "rejected" | "expired" | "used";
      expires_at: string;
      reviewer_note: string | null;
    }>();

  if (!row) return { kind: "hostile" };

  const expiresAtMs = new Date(row.expires_at).getTime();
  const expired = Number.isFinite(expiresAtMs)
    ? expiresAtMs <= Date.now()
    : true;

  if (row.status === "approved" && !expired) {
    return { kind: "approved", token: rawToken };
  }
  if (row.status === "rejected") {
    return { kind: "rejected", reviewerNote: row.reviewer_note };
  }
  if (row.status === "expired" || (row.status === "approved" && expired)) {
    return { kind: "expired" };
  }
  if (row.status === "used") {
    return { kind: "expired" };
  }
  return { kind: "hostile" };
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

  const resolved = await resolveToken(token);

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
