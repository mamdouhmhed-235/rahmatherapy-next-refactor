import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
 *   - cookie present + no query  → the request's REAL status (see below)
 *   - no cookie  → state 1
 *
 * ✅ 2026-09-09 — the "FAKE" note that stood here is now resolved. It said the real
 * implementation must query `account_password_requests` to confirm row status,
 * because "the cookie alone is not the source of truth", and that cookie-only routing
 * was a temporary UI testbed. It was never replaced, so the page told every returning
 * visitor "Still waiting on review" — including people who had been approved, and
 * people who had been rejected. It now reads the row and reports approved / rejected /
 * expired / pending honestly.
 *
 * ⛔ The lookup is by request id carried in the cookie, NOT by email or email-hash as
 * the original note suggested — and a decoy id is issued when no account matched, so
 * an unknown address still produces the identical "pending" screen. Matching on email
 * would have made the presence of a row observable and broken the uniform response
 * that stops this flow revealing who has an account.
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
  /** Null on cookies written before this field existed — treated as pending. */
  requestId: string | null;
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
        // ⚠️ Absent on cookies written before this field existed. Those fall back to
        // the old pending-only behaviour rather than erroring.
        requestId:
          typeof parsed.requestId === "string" ? parsed.requestId : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * What the request ACTUALLY says, rather than what the cookie assumes.
 *
 * ⛔ This page used to render "Still waiting on review" from the cookie alone, and
 * never looked at the row. So an approved requester was told to keep waiting, and so
 * was a rejected one — the screen stated something the system knew to be untrue.
 *
 * ⚠️ Returns "pending" for a row that cannot be found. That is deliberate: a decoy id
 * (no account matched) MUST be indistinguishable from a genuine pending request, or
 * the uniform response this flow is built on would leak. See setRequestCookie.
 */
async function lookupRequestStatus(
  requestId: string | null
): Promise<"pending" | "approved" | "rejected" | "expired"> {
  if (!requestId) return "pending";
  try {
    const adminClient = createSupabaseAdminClient();
    const { data } = await adminClient
      .from("account_password_requests")
      .select("status, expires_at")
      .eq("id", requestId)
      .maybeSingle<{ status: string; expires_at: string | null }>();

    if (!data) return "pending";
    if (data.status === "rejected") return "rejected";
    if (data.status === "approved") {
      // ⚠️ Nothing ever writes status = 'expired'; expiry is only ever a timestamp
      // comparison at read time. So it has to be computed here, or a lapsed approval
      // would keep telling someone to use a link that no longer works.
      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        return "expired";
      }
      return "approved";
    }
    return "pending";
  } catch (err) {
    // Never let a lookup failure take down the page — falling back to the previous
    // behaviour is worse than the truth but better than an error screen.
    console.error("password-reset status lookup failed:", err);
    return "pending";
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

  // ── State 3: returning visit — say what ACTUALLY happened ────────────
  if (cookie && !params.state) {
    const status = await lookupRequestStatus(cookie.requestId);

    if (status === "approved") {
      return (
        <PasswordResetCard
          heading="Approved"
          chip={<AdminStatusBadge value="Approved" tone="success" />}
        >
          <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
            Your request was approved. Check your email for the one-time link to set a
            new password.
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--admin-text-muted)]">
            {/* ⚠️ Said plainly because the email really can fail — the send is
                best-effort, and the reviewer is shown the same link on screen so they
                can pass it on. Without this line, someone whose email never arrived
                would sit and wait for something that is not coming. */}
            Nothing arrived? Ask whoever approved it to send you the link directly —
            they can see it on their screen.
          </p>
          {/* ⛔ This state used to END here, with no form and no way forward — unlike
              the rejected and expired states, which both offer one. So the one person
              who most needs another route (approved, but the email never came and the
              reviewer has lost the link) was the only one with no button to press.
              A fresh request costs nothing and supersedes the old one. */}
          <div className="mt-5">
            <ForgotForm />
          </div>
        </PasswordResetCard>
      );
    }

    if (status === "rejected") {
      return (
        <PasswordResetCard
          heading="Not approved"
          chip={<AdminStatusBadge value="Rejected" tone="danger" />}
        >
          <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
            Your request was reviewed and not approved. Speak to whoever manages the
            team, then submit a new request below if you still need one.
          </p>
          <div className="mt-5">
            <ForgotForm />
          </div>
        </PasswordResetCard>
      );
    }

    if (status === "expired") {
      return (
        <PasswordResetCard
          heading="That link has expired"
          chip={<AdminStatusBadge value="Expired" tone="warning" />}
        >
          <p className="text-sm leading-6 text-[var(--admin-text-muted)]">
            Your request was approved, but the link has since expired. Submit a new
            request below.
          </p>
          <div className="mt-5">
            <ForgotForm />
          </div>
        </PasswordResetCard>
      );
    }

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
