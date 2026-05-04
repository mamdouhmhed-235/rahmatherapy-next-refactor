import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, StickyNote } from "lucide-react";
import {
  AdminAccessDenied,
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
} from "../components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { formatDateTime } from "../clients/format";
import { PrivacyStatusForm } from "./PrivacyStatusForm";

export const metadata = {
  title: "Privacy Operations - Rahma Therapy Admin",
};

interface PrivacyRequestRecord {
  id: string;
  client_id: string;
  request_type: string;
  status: string;
  request_note: string | null;
  created_at: string;
  updated_at: string;
  created_by_staff_id: string | null;
}

interface ClientSummary {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface SensitiveNoteRecord {
  id: string;
  client_id: string;
  note: string;
  created_at: string;
  author_staff_id: string | null;
}

export default async function PrivacyPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!profile.permissions.has(PERMISSIONS.MANAGE_PRIVACY_OPERATIONS)) {
    return (
      <AdminAccessDenied
        title="Privacy operations restricted"
        message="Customer privacy requests and sensitive-note review require explicit privacy operations permission."
        permission={PERMISSIONS.MANAGE_PRIVACY_OPERATIONS}
      />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const [requestsResult, notesResult] = await Promise.all([
    adminClient
      .from("client_privacy_requests")
      .select("id, client_id, request_type, status, request_note, created_at, updated_at, created_by_staff_id")
      .order("created_at", { ascending: false })
      .returns<PrivacyRequestRecord[]>(),
    adminClient
      .from("client_notes")
      .select("id, client_id, note, created_at, author_staff_id")
      .eq("is_sensitive", true)
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<SensitiveNoteRecord[]>(),
  ]);

  const requests = requestsResult.data ?? [];
  const notes = notesResult.data ?? [];
  const clientIds = Array.from(
    new Set([...requests.map((request) => request.client_id), ...notes.map((note) => note.client_id)])
  );
  const { data: clients } =
    clientIds.length > 0
      ? await adminClient
          .from("clients")
          .select("id, full_name, email, phone")
          .in("id", clientIds)
          .returns<ClientSummary[]>()
      : { data: [] as ClientSummary[] };
  const clientById = new Map((clients ?? []).map((client) => [client.id, client]));

  return (
    <div>
      <AdminPageHeader
        eyebrow="Privacy"
        title="Privacy Operations"
        description="Track customer data export, correction, deletion/anonymization review, and sensitive-note review workflows. Every status change is audit logged."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <AdminPanel
          title="Customer privacy requests"
          description="Use this queue for GDPR-style customer data operations. Do not complete deletion/anonymization until booking and audit integrity requirements have been reviewed."
        >
          {requests.length === 0 ? (
            <AdminEmptyState
              icon={FileText}
              title="No privacy requests"
              message="Create a request from a client detail page when a customer asks for export, correction, deletion review, or sensitive-note review."
            />
          ) : (
            <div className="grid gap-3">
              {requests.map((request) => (
                <PrivacyRequestCard
                  key={request.id}
                  request={request}
                  client={clientById.get(request.client_id)}
                />
              ))}
            </div>
          )}
        </AdminPanel>

        <AdminPanel
          title="Sensitive note review"
          description="Recent sensitive client notes for owner/admin review. Keep note content out of exports and operational logs."
        >
          {notes.length === 0 ? (
            <p className="text-sm text-[var(--rahma-muted)]">No sensitive notes found.</p>
          ) : (
            <div className="grid gap-3">
              {notes.map((note) => (
                <SensitiveNoteCard
                  key={note.id}
                  note={note}
                  client={clientById.get(note.client_id)}
                />
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}

function PrivacyRequestCard({
  request,
  client,
}: {
  request: PrivacyRequestRecord;
  client?: ClientSummary;
}) {
  return (
    <article className="rounded-lg border border-[var(--rahma-border)] bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <AdminStatusBadge value={request.request_type} />
            <AdminStatusBadge value={request.status} tone={statusTone(request.status)} />
          </div>
          <h2 className="text-base font-semibold text-[var(--rahma-charcoal)]">
            {client ? (
              <Link
                href={`/admin/clients/${client.id}`}
                className="underline-offset-4 hover:underline"
              >
                {client.full_name}
              </Link>
            ) : (
              "Unknown client"
            )}
          </h2>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            {client?.email ?? "No email"} - {client?.phone ?? "No phone"}
          </p>
          {request.request_note ? (
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-[var(--rahma-ivory)]/70 p-3 text-sm text-[var(--rahma-charcoal)]">
              {request.request_note}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-[var(--rahma-muted)]">
            Created {formatDateTime(request.created_at)}. Updated{" "}
            {formatDateTime(request.updated_at)}.
          </p>
        </div>
        <PrivacyStatusForm requestId={request.id} status={request.status} />
      </div>
    </article>
  );
}

function SensitiveNoteCard({
  note,
  client,
}: {
  note: SensitiveNoteRecord;
  client?: ClientSummary;
}) {
  return (
    <article className="rounded-lg bg-[var(--rahma-ivory)]/70 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--rahma-muted)]">
        <StickyNote className="size-3.5" />
        Sensitive note
      </div>
      <p className="text-sm font-medium text-[var(--rahma-charcoal)]">
        {client ? (
          <Link href={`/admin/clients/${client.id}`} className="underline-offset-4 hover:underline">
            {client.full_name}
          </Link>
        ) : (
          "Unknown client"
        )}
      </p>
      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-[var(--rahma-muted)]">
        {note.note}
      </p>
      <p className="mt-2 text-xs text-[var(--rahma-muted)]">
        {formatDateTime(note.created_at)}
      </p>
    </article>
  );
}

function statusTone(status: string): "muted" | "warning" | "danger" | "success" {
  if (status === "completed") return "success";
  if (status === "declined") return "danger";
  if (status === "reviewing") return "warning";
  return "muted";
}
