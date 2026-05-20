import Link from "next/link";
import { ExternalLink, Mail, MapPin, Phone, User } from "lucide-react";
import {
  AdminPanel,
  AdminStatusBadge,
  type AdminTone,
} from "@/app/admin/components/admin-ui";
import {
  formatDate,
  formatMoney,
  formatTime,
} from "../format";
import type { BookingRecord, BookingStatus } from "../types";

const STATUS_TONES: Record<BookingStatus, AdminTone> = {
  pending: "info",
  confirmed: "success",
  completed: "default",
  cancelled: "danger",
  no_show: "warning",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

interface SidebarProps {
  booking: BookingRecord;
  clientId?: string | null;
  showFinancials: boolean;
  showClientLink: boolean;
}

export function BookingDetailSidebar({
  booking,
  clientId,
  showFinancials,
  showClientLink,
}: SidebarProps) {
  return (
    <aside className="grid content-start gap-4 md:sticky md:top-4">
      <SummaryCard booking={booking} showFinancials={showFinancials} />
      <ClientCard
        booking={booking}
        clientId={clientId ?? null}
        showClientLink={showClientLink}
      />
      <AddressCard booking={booking} />
    </aside>
  );
}

function SummaryCard({
  booking,
  showFinancials,
}: {
  booking: BookingRecord;
  showFinancials: boolean;
}) {
  return (
    <AdminPanel>
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <code
            className="font-[var(--font-admin-mono),IBM_Plex_Mono,Menlo,monospace] text-sm font-medium text-[var(--admin-heading)] break-all"
            title={booking.id}
            style={{ fontFamily: "var(--font-admin-mono), IBM Plex Mono, Menlo, monospace" }}
          >
            {shortRef(booking.id)}
          </code>
          <AdminStatusBadge
            tone={STATUS_TONES[booking.status]}
            value={STATUS_LABELS[booking.status]}
          />
        </div>
        <div className="grid gap-1.5 text-sm">
          <p className="font-semibold text-[var(--admin-heading)]">
            {formatDate(booking.booking_date)}
          </p>
          <p className="text-[var(--admin-text-muted)]">
            {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
            {booking.total_duration_mins
              ? ` · ${booking.total_duration_mins} mins`
              : ""}
          </p>
        </div>
        {showFinancials ? (
          <div className="mt-1 border-t border-[var(--admin-border)] pt-3">
            <p className="text-xs font-medium text-[var(--admin-text-muted)]">
              Total
            </p>
            <p
              className="mt-1 min-w-0 break-words leading-none tracking-[-0.02em] [font-variant-numeric:tabular-nums]"
              style={{
                fontFamily: "var(--font-admin-serif), Cormorant Garamond, Georgia, serif",
                fontSize: "2.369rem",
                fontWeight: 700,
                /* Rahma Gold — DESIGN.md §2 sanctioned use: Cormorant numeral on light canvas */
                color: "oklch(58% 0.135 72)",
              }}
            >
              {formatMoney(booking.total_price)}
            </p>
          </div>
        ) : null}
      </div>
    </AdminPanel>
  );
}

function ClientCard({
  booking,
  clientId,
  showClientLink,
}: {
  booking: BookingRecord;
  clientId: string | null;
  showClientLink: boolean;
}) {
  const displayName =
    booking.clients?.full_name || booking.contact_full_name || "Unknown client";
  const phone = booking.clients?.phone || booking.contact_phone || null;
  const email = booking.clients?.email || booking.contact_email || null;

  return (
    <AdminPanel>
      <div className="flex items-start gap-3">
        <ClientAvatar name={displayName} />
        <div className="min-w-0 flex-1">
          <p
            className="font-display text-[1.0625rem] font-semibold tracking-[-0.01em] text-[var(--admin-heading)] break-words"
          >
            {displayName}
          </p>
          <div className="mt-2 grid gap-1 text-sm">
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="-mx-2 inline-flex min-h-11 sm:min-h-0 items-center gap-2 rounded-[var(--admin-radius-control)] px-2 py-1 text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <Phone className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
                <span>{phone}</span>
              </a>
            ) : null}
            {email ? (
              <a
                href={`mailto:${email}`}
                className="-mx-2 inline-flex min-h-11 sm:min-h-0 items-center gap-2 break-all rounded-[var(--admin-radius-control)] px-2 py-1 text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
              >
                <Mail className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
                <span>{email}</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>
      {showClientLink && clientId ? (
        <div className="mt-3 border-t border-[var(--admin-border)] pt-3">
          <Link
            href={`/admin/clients/${clientId}`}
            className="inline-flex h-11 sm:h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-sm font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            <User className="size-4" aria-hidden="true" />
            View client profile
          </Link>
        </div>
      ) : null}
    </AdminPanel>
  );
}

function parseAccessNotes(raw: string | null): { area: string | null; access: string | null } {
  if (!raw) return { area: null, access: null };
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let area: string | null = null;
  const accessParts: string[] = [];

  for (const line of lines) {
    const areaMatch = /^area\s*:\s*(.+)$/i.exec(line);
    const accessMatch = /^access\s*:\s*(.+)$/i.exec(line);
    if (areaMatch && !area) {
      area = areaMatch[1].trim();
    } else if (accessMatch) {
      accessParts.push(accessMatch[1].trim());
    } else {
      accessParts.push(line);
    }
  }

  return {
    area,
    access: accessParts.length > 0 ? accessParts.join(" ") : null,
  };
}

interface AddressRowProps {
  label: string;
  children: React.ReactNode;
  emphasis?: boolean;
}

function AddressRow({ label, children, emphasis = false }: AddressRowProps) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-baseline gap-3 py-1.5 [&+&]:border-t [&+&]:border-[var(--admin-border)]">
      <span className="text-xs font-medium text-[var(--admin-text-muted)]">
        {label}
      </span>
      <span
        className={`min-w-0 break-words text-sm leading-6 ${
          emphasis
            ? "font-semibold tracking-[0.02em] text-[var(--admin-heading)] [font-feature-settings:'tnum']"
            : "text-[var(--admin-body)]"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

function AddressCard({ booking }: { booking: BookingRecord }) {
  const lines = [
    booking.service_address_line1,
    booking.service_address_line2,
    booking.service_city,
    booking.service_postcode,
  ].filter(Boolean) as string[];

  const hasAddress = lines.length > 0;
  const mapsQuery = encodeURIComponent(lines.join(", "));
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const { area, access } = parseAccessNotes(booking.access_notes ?? null);
  const postcode = booking.service_postcode ?? null;
  const streetLines = lines.filter((line) => line !== postcode);

  return (
    <AdminPanel>
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] pb-2.5">
        <span
          aria-hidden="true"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-panel-muted)] text-[var(--admin-primary)]"
        >
          <MapPin className="size-3.5" />
        </span>
        <p className="text-xs font-semibold text-[var(--admin-text-muted)]">
          Visit location
        </p>
      </div>

      {hasAddress ? (
        <div className="mt-1">
          {streetLines.length > 0 ? (
            <AddressRow label="Street">{streetLines.join(", ")}</AddressRow>
          ) : null}
          {postcode ? (
            <AddressRow label="Postcode" emphasis>
              {postcode}
            </AddressRow>
          ) : null}
          {area ? <AddressRow label="Area">{area}</AddressRow> : null}
          {access ? <AddressRow label="Access">{access}</AddressRow> : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--admin-text-muted)]">
          No address recorded for this booking.
        </p>
      )}

      {hasAddress ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open this address in Google Maps"
          className="mt-4 inline-flex h-11 sm:h-10 w-full items-center justify-center gap-1.5 rounded-[var(--admin-radius-control)] bg-[var(--admin-primary)] px-4 text-sm font-bold tracking-[0.01em] text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          View on Maps
        </a>
      ) : null}
    </AdminPanel>
  );
}

function ClientAvatar({ name }: { name: string }) {
  const tint = avatarTint(name);
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{ backgroundColor: tint.bg, color: tint.text }}
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  }
  const first = Array.from(parts[0])[0] ?? "";
  const last = Array.from(parts[parts.length - 1])[0] ?? "";
  return (first + last).toUpperCase();
}

function shortRef(id: string) {
  if (!id) return "—";
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/**
 * Deterministic avatar tint — DESIGN.md §00-shared-components commit:
 * hue = hash(seed) % 360, chroma 0.025, lightness 88% for background;
 * matching darker hue at 26% / chroma 0.04 for readable initials.
 */
function avatarTint(seed: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `oklch(88% 0.025 ${hue})`,
    text: `oklch(26% 0.04 ${hue})`,
  };
}
