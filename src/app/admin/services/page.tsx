import { redirect } from "next/navigation";
import { Clock, History, PackageOpen, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AdminAccessDenied } from "../components/admin-ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { DeleteServiceButton } from "./DeleteServiceButton";
import {
  ServiceFormDialog,
  type ServiceRecord,
} from "./ServiceFormDialog";

export const metadata = {
  title: "Services & Packages - Rahma Therapy Admin",
};

function formatPrice(value: number | string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatRestriction(value: string) {
  return value.replace(/_/g, " ");
}

export default async function ServicesPage() {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);

  if (!profile || !profile.active) {
    redirect("/admin/login");
  }

  if (!profile.permissions.has(PERMISSIONS.MANAGE_SERVICES)) {
    return (
      <AdminAccessDenied
        title="Services access limited"
        message="You need service management permission to access this page."
        permission="manage_services"
      />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .order("display_order")
    .order("name");
  const { data: serviceUsage } = await adminClient
    .from("booking_items")
    .select("service_id");
  const usageCounts = new Map<string, number>();
  for (const item of serviceUsage ?? []) {
    usageCounts.set(item.service_id, (usageCounts.get(item.service_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--rahma-charcoal)]">
            Services &amp; Packages
          </h1>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            Manage the treatment catalog used for booking snapshots and future
            availability calculations.
          </p>
        </div>
        <ServiceFormDialog />
      </div>

      {(services ?? []).length === 0 ? (
        <div
          className="rounded-2xl border-2 border-dashed bg-white/50 px-6 py-20 text-center"
          style={{ borderColor: "var(--rahma-border)" }}
        >
          <PackageOpen className="mx-auto mb-4 size-12 text-[var(--rahma-muted)]/30" />
          <h2 className="text-lg font-semibold text-[var(--rahma-charcoal)]">
            No services found
          </h2>
          <p className="mt-1 text-sm text-[var(--rahma-muted)]">
            Add the first treatment or package to start managing the catalog.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {(services ?? []).map((service) => (
            <article
              key={service.id}
              className="rounded-2xl border bg-white p-6"
              style={{
                borderColor: "var(--rahma-border)",
                boxShadow: "var(--shadow-soft-token)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[var(--rahma-charcoal)]">
                      {service.name}
                    </h2>
                    {!service.is_active ? (
                      <Badge
                        variant="secondary"
                        className="border-none bg-gray-100 text-gray-500"
                      >
                        Inactive
                      </Badge>
                    ) : null}
                    {!service.is_visible_on_frontend ? (
                      <Badge
                        variant="secondary"
                        className="border-none bg-orange-50 text-orange-600"
                      >
                        Hidden
                      </Badge>
                    ) : null}
                    {(usageCounts.get(service.id) ?? 0) > 0 ? (
                      <Badge
                        variant="secondary"
                        className="border-none bg-[var(--rahma-green)]/10 text-[var(--rahma-green)]"
                      >
                        Historical snapshots
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-[var(--rahma-muted)]">
                    {service.short_description ?? "No short description set."}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold text-[var(--rahma-charcoal)]">
                    {formatPrice(service.price)}
                  </p>
                  <p className="text-xs text-[var(--rahma-muted)]">
                    Order {service.display_order}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 border-t border-[var(--rahma-border)] pt-4 sm:grid-cols-4">
                <span className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                  <PackageOpen className="size-4" />
                  {service.group_category ?? "Un grouped"}
                </span>
                <span className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                  <Clock className="size-4" />
                  {service.duration_mins} mins
                </span>
                <span className="flex items-center gap-2 text-sm capitalize text-[var(--rahma-muted)]">
                  <Tag className="size-4" />
                  {formatRestriction(service.gender_restrictions)}
                </span>
                <span className="flex items-center gap-2 text-sm text-[var(--rahma-muted)]">
                  <History className="size-4" />
                  {usageCounts.get(service.id) ?? 0} snapshot{(usageCounts.get(service.id) ?? 0) === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <ServiceFormDialog service={service as ServiceRecord} />
                <DeleteServiceButton
                  serviceId={service.id}
                  serviceName={service.name}
                  hasHistoricalBookings={(usageCounts.get(service.id) ?? 0) > 0}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
