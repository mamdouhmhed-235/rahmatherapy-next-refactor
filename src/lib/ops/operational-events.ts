// SERVER ONLY - stores safe operational summaries, never raw payloads.
import type { SupabaseClient } from "@supabase/supabase-js";

type OperationalSeverity = "info" | "warning" | "error";

export async function recordOperationalEvent(
  supabase: SupabaseClient,
  input: {
    eventType: string;
    summary: string;
    severity?: OperationalSeverity;
    bookingId?: string | null;
    staffId?: string | null;
    safeContext?: Record<string, string | number | boolean | null>;
  }
) {
  await supabase.from("operational_events").insert({
    event_type: input.eventType,
    severity: input.severity ?? "warning",
    summary: input.summary.slice(0, 500),
    booking_id: input.bookingId ?? null,
    staff_id: input.staffId ?? null,
    safe_context: input.safeContext ?? {},
  });
}
