"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createManualBooking, type ManualBookingState } from "../actions";

interface ServiceOption {
  slug: string;
  name: string;
  price: number | string;
  duration_mins: number;
  gender_restrictions: string;
}

interface ClientOption {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
}

interface EnquiryPrefill {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  service_interest: string | null;
  notes: string | null;
}

const initialState: ManualBookingState = {};
const inputClass =
  "h-10 rounded-md border border-[var(--rahma-border)] bg-white px-3 text-sm text-[var(--rahma-charcoal)] outline-none focus:ring-2 focus:ring-[var(--rahma-green)]/20";

export function ManualBookingForm({
  services,
  clients,
  initialClientId = "",
  enquiry,
}: {
  services: ServiceOption[];
  clients: ClientOption[];
  initialClientId?: string;
  enquiry?: EnquiryPrefill | null;
}) {
  const [state, action, pending] = useActionState(createManualBooking, initialState);
  const [participantCount, setParticipantCount] = useState(1);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId),
    [clients, selectedClientId]
  );
  const contactName = selectedClient?.full_name ?? enquiry?.full_name ?? "";
  const contactEmail = selectedClient?.email ?? enquiry?.email ?? "";
  const contactPhone = selectedClient?.phone ?? enquiry?.phone ?? "";
  const defaultSource =
    enquiry?.source && ["phone", "whatsapp", "instagram", "referral"].includes(enquiry.source)
      ? enquiry.source
      : "phone";

  return (
    <form action={action} className="grid gap-6">
      {enquiry ? <input type="hidden" name="enquiry_id" value={enquiry.id} /> : null}
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <section className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--rahma-border)" }}>
        <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
          Contact and source
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Existing client">
            <select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              className={inputClass}
            >
              <option value="">Create or enter manually</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name} - {client.email ?? client.phone ?? "no contact"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Booking source">
            <select name="booking_source" defaultValue={defaultSource} className={inputClass}>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="referral">Referral</option>
              <option value="admin">Repeat customer</option>
              <option value="manual">Walk-in/manual admin entry</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>
        <div
          key={selectedClientId || "manual-contact"}
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <Field label="Contact full name">
            <input
              name="full_name"
              defaultValue={contactName}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              defaultValue={contactEmail}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Phone">
            <input
              name="phone"
              defaultValue={contactPhone}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Booking for">
            <select name="booking_for" defaultValue="self" className={inputClass}>
              <option value="self">The contact</option>
              <option value="someone_else">Someone else</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--rahma-border)" }}>
        <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
          Services and participants
        </h2>
        <div
          key={`${selectedClientId || "manual"}-${participantCount}`}
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          {services.map((service) => (
            <label
              key={service.slug}
              className="flex items-start gap-3 rounded-xl border border-[var(--rahma-border)] bg-white/80 p-4"
            >
              <input
                type="checkbox"
                name="service_slugs"
                value={service.slug}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-[var(--rahma-charcoal)]">
                  {service.name}
                </span>
                <span className="block text-sm text-[var(--rahma-muted)]">
                  {service.duration_mins} mins - £{Number(service.price).toFixed(2)} -{" "}
                  {service.gender_restrictions.replace(/_/g, " ")}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-5 max-w-xs">
          <Field label="Participant count">
            <input
              name="number_of_people"
              type="number"
              min="1"
              max="10"
              value={participantCount}
              onChange={(event) => setParticipantCount(Number(event.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Array.from({ length: Math.max(1, Math.min(10, participantCount)) }, (_, index) => (
            <div key={index} className="rounded-xl border border-[var(--rahma-border)] bg-white/80 p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--rahma-charcoal)]">
                Participant {index + 1}
              </h3>
              <div className="grid gap-3">
                <Field label="Name or label">
                  <input
                    name={`participant_name_${index}`}
                    defaultValue={index === 0 ? contactName : ""}
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="Gender">
                  <select
                    name={`participant_gender_${index}`}
                    defaultValue=""
                    className={inputClass}
                    required
                  >
                    <option value="">Choose gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>
                <Field label="Participant notes">
                  <Textarea name={`participant_note_${index}`} rows={3} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--rahma-border)" }}>
        <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
          Location and time
        </h2>
        <div
          key={selectedClientId || "manual-location"}
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <Field label="Date">
            <input name="booking_date" type="date" className={inputClass} required />
          </Field>
          <Field label="Start time">
            <input name="start_time" type="time" className={inputClass} required />
          </Field>
          <Field label="Address">
            <input
              name="address"
              defaultValue={selectedClient?.address ?? ""}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Postcode">
            <input
              name="postcode"
              defaultValue={selectedClient?.postcode ?? ""}
              className={inputClass}
              required
            />
          </Field>
          <Field label="City">
            <input name="city" className={inputClass} required />
          </Field>
          <Field label="Area">
            <input name="area" className={inputClass} />
          </Field>
          <Field label="Access notes">
            <Textarea name="access_notes" rows={3} />
          </Field>
          <Field label="Parking notes">
            <Textarea name="parking_notes" rows={3} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--rahma-border)" }}>
        <h2 className="font-display text-lg font-semibold text-[var(--rahma-charcoal)]">
          Notes and confirmation
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Customer notes">
            <Textarea
              name="customer_notes"
              rows={4}
              defaultValue={
                enquiry
                  ? [enquiry.service_interest, enquiry.notes]
                      .filter(Boolean)
                      .join("\n\n")
                  : ""
              }
            />
          </Field>
          <Field label="Health notes">
            <Textarea name="health_notes" rows={4} />
          </Field>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="flex items-start gap-3 text-sm text-[var(--rahma-charcoal)]">
            <input name="consent_acknowledged" type="checkbox" className="mt-1" required />
            Consent/payment expectations have been discussed and recorded by admin.
          </label>
          <label className="flex items-start gap-3 text-sm text-[var(--rahma-charcoal)]">
            <input name="send_confirmation_email" type="checkbox" className="mt-1" />
            Send confirmation email after creating this booking.
          </label>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-[var(--rahma-border)] bg-[var(--rahma-ivory)]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Create booking
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
        {label}
      </span>
      {children}
    </label>
  );
}
