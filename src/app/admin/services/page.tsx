import { redirect } from "next/navigation";
import { CheckSquare, Clock, PackageOpen, Users } from "lucide-react";
import {
  AdminAccessDenied,
  AdminEntityRow,
  AdminPageHeader,
  AdminPageScaffold,
  AdminStatusBadge,
} from "../components/admin-ui";
import { EmptyState } from "../components/EmptyState";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffProfile, PERMISSIONS } from "@/lib/auth/rbac";
import { ServiceFormDialog, type ServiceRecord } from "./ServiceFormDialog";
import { ServiceRowActions } from "./ServiceRowActions";

export const metadata = {
  title: "Services — Rahma Therapy Admin",
};

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});

const GENDER_LABEL: Record<ServiceRecord["gender_restrictions"], string> = {
  any: "Any",
  female_only: "Female only",
  male_only: "Male only",
};

const GENDER_TOOLTIP: Record<ServiceRecord["gender_restrictions"], string> = {
  any: "Open to any therapist",
  female_only: "Female therapists only",
  male_only: "Male therapists only",
};

function letterToken(name: string, fallback?: string | null) {
  const trimmed = name.trim();
  // Prefer the first alpha character; if the name starts with a digit or
  // punctuation, fall back to the category's first letter, then "·".
  const match = trimmed.match(/[a-z]/i);
  if (match) return match[0].toUpperCase();
  const cat = (fallback ?? "").trim();
  const catMatch = cat.match(/[a-z]/i);
  if (catMatch) return catMatch[0].toUpperCase();
  return trimmed.charAt(0).toUpperCase() || "·";
}

function groupKey(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Uncategorised";
}

function titleCase(value: string) {
  return value
    .split(/(\s+)/)
    .map((part) =>
      /^\s+$/.test(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("");
}

interface GroupedSection {
  title: string;
  minOrder: number;
  services: ServiceRecord[];
}

function groupServices(services: ServiceRecord[]): GroupedSection[] {
  const map = new Map<string, GroupedSection>();
  for (const service of services) {
    const key = groupKey(service.group_category);
    const existing = map.get(key);
    if (existing) {
      existing.services.push(service);
      existing.minOrder = Math.min(existing.minOrder, service.display_order);
    } else {
      map.set(key, {
        title: key,
        minOrder: service.display_order,
        services: [service],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.minOrder !== b.minOrder) return a.minOrder - b.minOrder;
    return a.title.localeCompare(b.title);
  });
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
        message="Service management is restricted to the practice owner. Ask the owner if you need a service updated."
      />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: rawServices } = await supabase
    .from("services")
    .select("*")
    .order("display_order")
    .order("name");
  const { data: serviceUsage } = await adminClient
    .from("booking_items")
    .select("service_id");

  const services = (rawServices ?? []) as ServiceRecord[];
  const usageCounts = new Map<string, number>();
  for (const item of serviceUsage ?? []) {
    usageCounts.set(
      item.service_id,
      (usageCounts.get(item.service_id) ?? 0) + 1
    );
  }

  const total = services.length;
  const active = services.filter((s) => s.is_active).length;
  const inactive = total - active;
  const groups = groupServices(services);
  const categoryCount = groups.length;
  const summary = total === 0
    ? "Catalog is empty"
    : `${active} active, ${inactive} inactive across ${categoryCount} ${categoryCount === 1 ? "category" : "categories"}`;

  return (
    <AdminPageScaffold className="pb-10 md:pb-0">
      <AdminPageHeader
        title="Services"
        description={summary}
        actions={total > 0 ? <ServiceFormDialog /> : null}
      />

      {total === 0 ? (
        <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] py-10">
          <EmptyState
            icon={PackageOpen}
            title="No services yet"
            message="Add your first treatment to start the catalog."
          />
          <div className="mt-4 flex justify-center">
            <ServiceFormDialog />
          </div>
        </div>
      ) : (
        <div className="grid gap-10">
          {groups.map((group) => (
            <section
              key={group.title}
              aria-labelledby={`group-${group.title}`}
              className="grid gap-4"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2
                  id={`group-${group.title}`}
                  className="font-display text-[1.333rem] font-semibold leading-tight tracking-[-0.015em] text-[var(--admin-heading)] sm:text-[1.5rem]"
                >
                  {titleCase(group.title)}
                </h2>
                <p className="text-xs font-medium text-[var(--admin-text-muted)]">
                  {group.services.length}{" "}
                  {group.services.length === 1 ? "service" : "services"}
                </p>
              </header>
              <div className="grid gap-3">
                {group.services.map((service) => {
                  const usageCount = usageCounts.get(service.id) ?? 0;
                  const genderLabel = GENDER_LABEL[service.gender_restrictions];
                  const genderTooltip =
                    GENDER_TOOLTIP[service.gender_restrictions];

                  return (
                    <AdminEntityRow
                      key={service.id}
                      leading={
                        <span
                          aria-hidden="true"
                          title={service.name}
                          className="inline-flex size-10 items-center justify-center rounded-full bg-[oklch(95.5%_0.012_155)] font-display text-base font-semibold text-[var(--admin-heading)]"
                        >
                          {letterToken(service.name, service.group_category)}
                        </span>
                      }
                      title={service.name}
                      description={
                        service.short_description ? (
                          <span className="line-clamp-1">
                            {service.short_description}
                          </span>
                        ) : null
                      }
                      meta={
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--admin-text-muted)]">
                          <span className="font-display text-base font-semibold tracking-[-0.01em] text-[var(--admin-heading)]">
                            {GBP.format(Number(service.price))}
                          </span>
                          <span
                            aria-hidden="true"
                            className="hidden h-3 w-px bg-[var(--admin-border)] sm:inline-block"
                          />
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[oklch(94%_0.008_280)] px-2 py-0.5 text-[0.6875rem] font-medium text-[oklch(30%_0.02_280)]"
                            title={`${service.duration_mins}-minute appointment slot`}
                          >
                            <Clock className="size-3 shrink-0" aria-hidden="true" />
                            {service.duration_mins} min
                          </span>
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[oklch(96%_0.038_75)] px-2 py-0.5 text-[0.6875rem] font-medium text-[oklch(28%_0.12_55)]"
                            title={genderTooltip}
                          >
                            <Users className="size-3 shrink-0" aria-hidden="true" />
                            {genderLabel}
                          </span>
                          <span
                            className="ml-auto font-mono text-[0.6875rem] text-[var(--admin-text-muted)]"
                            title={`Display order within ${group.title} — lower first`}
                          >
                            #{service.display_order}
                          </span>
                        </div>
                      }
                      badges={
                        <>
                          {!service.is_active ? (
                            <AdminStatusBadge
                              value="Inactive"
                              tone="danger"
                              compact
                            />
                          ) : null}
                          {!service.is_visible_on_frontend ? (
                            <AdminStatusBadge
                              value="Hidden"
                              tone="restricted"
                              compact
                            />
                          ) : null}
                          {usageCount > 0 ? (
                            <InUseBadge count={usageCount} />
                          ) : null}
                        </>
                      }
                      actions={
                        <ServiceRowActions
                          service={service}
                          usageCount={usageCount}
                        />
                      }
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminPageScaffold>
  );
}

function InUseBadge({ count }: { count: number }) {
  return (
    <span
      title={`${count} ${count === 1 ? "booking" : "bookings"} on file — can't be deleted`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[oklch(94%_0.030_200)] px-2 py-0.5 text-[0.6875rem] font-medium text-[oklch(28%_0.095_200)]"
    >
      <CheckSquare className="size-3 shrink-0" aria-hidden="true" />
      In use
    </span>
  );
}
