import { AdminStatusBadge } from "./admin-ui";

type AdminTone = "default" | "muted" | "warning" | "danger" | "success" | "info" | "restricted" | "gold";

export function BookingStatusChip({
  status,
  className,
}: {
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no-show";
  className?: string;
}) {
  const tones: Record<string, AdminTone> = {
    pending: "warning",
    confirmed: "info",
    completed: "success",
    cancelled: "muted",
    "no-show": "danger",
  };
  return <AdminStatusBadge value={status} tone={tones[status]} className={className} />;
}

export function AssignmentStatusChip({
  status,
  className,
}: {
  status: "unassigned" | "partially_assigned" | "fully_assigned" | "claimable" | "assigned_to_you";
  className?: string;
}) {
  const tones: Record<string, AdminTone> = {
    unassigned: "warning",
    partially_assigned: "info",
    fully_assigned: "success",
    claimable: "default",
    assigned_to_you: "gold",
  };
  return (
    <AdminStatusBadge 
      value={status === "assigned_to_you" ? "assigned to you" : status} 
      tone={tones[status]} 
      className={className} 
    />
  );
}

export function PaymentStatusChip({
  status,
  className,
}: {
  status: "paid" | "unpaid" | "outstanding" | "revenue_hidden";
  className?: string;
}) {
  const tones: Record<string, AdminTone> = {
    paid: "success",
    unpaid: "warning",
    outstanding: "danger",
    revenue_hidden: "restricted",
  };
  return (
    <AdminStatusBadge 
      value={status === "revenue_hidden" ? "hidden" : status} 
      tone={tones[status]} 
      className={className} 
    />
  );
}

export function EmailStatusChip({
  status,
  className,
}: {
  status: "queued" | "sent" | "failed" | "reminders_due";
  className?: string;
}) {
  const tones: Record<string, AdminTone> = {
    queued: "warning",
    sent: "success",
    failed: "danger",
    reminders_due: "info",
  };
  return <AdminStatusBadge value={status} tone={tones[status]} className={className} />;
}

export function SeverityChip({
  level,
  className,
}: {
  level: "info" | "warning" | "critical" | "resolved";
  className?: string;
}) {
  const tones: Record<string, AdminTone> = {
    info: "info",
    warning: "warning",
    critical: "danger",
    resolved: "success",
  };
  return <AdminStatusBadge value={level} tone={tones[level]} className={className} />;
}

export function VisibilityChip({
  status,
  className,
}: {
  status: "visible" | "hidden" | "active" | "inactive";
  className?: string;
}) {
  const tones: Record<string, AdminTone> = {
    visible: "success",
    hidden: "muted",
    active: "success",
    inactive: "muted",
  };
  return <AdminStatusBadge value={status} tone={tones[status]} className={className} />;
}

export function RolePermissionChip({
  status,
  className,
}: {
  status: "access_limited" | "assigned_only" | "sensitive_hidden" | "restricted_action";
  className?: string;
}) {
  const tones: Record<string, AdminTone> = {
    access_limited: "restricted",
    assigned_only: "info",
    sensitive_hidden: "restricted",
    restricted_action: "danger",
  };
  return <AdminStatusBadge value={status} tone={tones[status]} className={className} />;
}
