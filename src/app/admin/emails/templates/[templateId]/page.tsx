// C-15 Phase C, Step 11 — editor page (server).
//
// Reachable by URL but not yet linked from anywhere (the gallery that links
// here is Phase E) — that is correct for this phase. Because it's directly
// reachable, it carries its own auth gate rather than inheriting
// /admin/emails's (brief §3 — "per existing Templates-tab visibility"; the
// same canSeeDelivery || canResend check that page uses to decide the
// Templates tab is visible at all). `canEdit` is computed here, server-side,
// from MANAGE_EMAIL_TEMPLATES and handed down as a prop — the real
// enforcement for saves lives in saveTemplateOverride's own
// requirePermission call, unchanged since Phase A; this gate plus the
// client's read-only rendering are defence-in-depth, not the sole guard.
//
// Different tree from the preview route: this page lives under
// admin/emails/templates/[templateId]/ — the preview route stays at
// admin/email-templates/preview/[id]/. No sibling [id] vs [templateId]
// clash at the same route level (verified — see the C-C dispatch's explicit
// warning on this).

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageEmailTemplates,
  canResendBookingEmails,
  canViewEmailLogs,
  getStaffProfile,
} from "@/lib/auth/rbac";
import { resolveTemplateOverrides } from "@/lib/email/templates";
import { findTemplate } from "@/app/admin/emails/components/templates-data";
import { AdminAccessDenied } from "@/app/admin/components/admin-ui";
import { TemplateEditor } from "../components/TemplateEditor";

interface TemplateEditorPageProps {
  params: Promise<{ templateId: string }>;
}

export async function generateMetadata({
  params,
}: TemplateEditorPageProps): Promise<Metadata> {
  const { templateId } = await params;
  const template = findTemplate(templateId);
  return {
    title: template ? `${template.cardName} · Rahma admin` : "Email template · Rahma admin",
  };
}

export default async function TemplateEditorPage({ params }: TemplateEditorPageProps) {
  const { templateId } = await params;

  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile || !profile.active) redirect("/admin/login");

  const canSeeDelivery = canViewEmailLogs(profile);
  const canResend = canResendBookingEmails(profile);
  if (!canSeeDelivery && !canResend) {
    return (
      <AdminAccessDenied
        title="Email access limited"
        message="You need email or booking-management access to see email templates. Ask the practice owner."
      />
    );
  }

  const template = findTemplate(templateId);
  if (!template) notFound();

  const canEdit = canManageEmailTemplates(profile);
  const initialValues = await resolveTemplateOverrides(templateId);

  return <TemplateEditor template={template} canEdit={canEdit} initialValues={initialValues} />;
}
