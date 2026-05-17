"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import { AdminActionMenu, AdminMenuItem } from "../components/admin-ui-interactions";
import { updateService } from "./actions";
import { DeleteServiceButton } from "./DeleteServiceButton";
import { ServiceFormDialog, type ServiceRecord } from "./ServiceFormDialog";

interface ServiceRowActionsProps {
  service: ServiceRecord;
  usageCount: number;
}

function priceField(value: number | string) {
  return typeof value === "string" ? value : String(value);
}

function buildFormData(service: ServiceRecord, overrides: Partial<ServiceRecord>) {
  const next: ServiceRecord = { ...service, ...overrides };
  const fd = new FormData();
  fd.set("name", next.name);
  fd.set("slug", next.slug);
  fd.set("group_category", next.group_category ?? "");
  fd.set("gender_restrictions", next.gender_restrictions);
  fd.set("price", priceField(next.price));
  fd.set("duration_mins", String(next.duration_mins));
  fd.set("display_order", String(next.display_order));
  if (next.is_active) fd.set("is_active", "on");
  if (next.is_visible_on_frontend) fd.set("is_visible_on_frontend", "on");
  fd.set("short_description", next.short_description ?? "");
  fd.set("full_description", next.full_description ?? "");
  fd.set("suitable_for_notes", next.suitable_for_notes ?? "");
  return fd;
}

export function ServiceRowActions({ service, usageCount }: ServiceRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const liveOnPublic = service.is_active && service.is_visible_on_frontend;

  function runToggle(overrides: Partial<ServiceRecord>, successCopy: string) {
    const fd = buildFormData(service, overrides);
    startTransition(async () => {
      const result = await updateService(service.id, {}, fd);
      if (result.error) {
        toast.error(result.error, { duration: Infinity });
        return;
      }
      toast.success(successCopy);
      router.refresh();
    });
  }

  // Per-item pending icon: spinner replaces the action's leading icon while
  // a toggle is in-flight. Non-pending items keep their normal icons but
  // disable to prevent double-fires.
  const PendingOrIcon = ({
    Icon,
  }: {
    Icon: React.ElementType;
  }) =>
    isPending ? (
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
    ) : (
      <Icon className="size-4 shrink-0" aria-hidden="true" />
    );

  return (
    <div
      className="flex shrink-0 items-center gap-1 transition-opacity"
      aria-busy={isPending || undefined}
      style={{ opacity: isPending ? 0.6 : 1 }}
    >
      <ServiceFormDialog service={service} usageCount={usageCount} />
      <AdminActionMenu label={`More actions for ${service.name}`}>
        {service.is_active ? (
          <AdminMenuItem
            type="button"
            disabled={isPending}
            onClick={() =>
              runToggle({ is_active: false }, "Service deactivated.")
            }
          >
            <PendingOrIcon Icon={PowerOff} />
            Deactivate
          </AdminMenuItem>
        ) : (
          <AdminMenuItem
            type="button"
            disabled={isPending}
            onClick={() => runToggle({ is_active: true }, "Service activated.")}
          >
            <PendingOrIcon Icon={Power} />
            Activate
          </AdminMenuItem>
        )}
        {service.is_visible_on_frontend ? (
          <AdminMenuItem
            type="button"
            disabled={isPending}
            onClick={() =>
              runToggle(
                { is_visible_on_frontend: false },
                "Hidden from the website."
              )
            }
          >
            <PendingOrIcon Icon={EyeOff} />
            Hide from website
          </AdminMenuItem>
        ) : (
          <AdminMenuItem
            type="button"
            disabled={isPending}
            onClick={() =>
              runToggle(
                { is_visible_on_frontend: true },
                "Visible on the website."
              )
            }
          >
            <PendingOrIcon Icon={Eye} />
            Show on website
          </AdminMenuItem>
        )}
        {liveOnPublic ? (
          <a
            href={`/services/${service.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-9 w-full items-center gap-2 rounded-[var(--admin-radius-control)] px-3 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            aria-label={`View ${service.name} on the public website (opens in a new tab)`}
          >
            <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
            View on website
          </a>
        ) : null}
        <div
          aria-hidden="true"
          className="my-1 h-px bg-[var(--admin-border)]"
        />
        <DeleteServiceButton
          serviceId={service.id}
          serviceName={service.name}
          hasHistoricalBookings={usageCount > 0}
          asMenuItem
        />
      </AdminActionMenu>
    </div>
  );
}
