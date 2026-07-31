// C-15 Phase B — Step 6 test: every registered template renders
// non-throwing with its sample input, via the shared SAMPLE_RENDERERS
// dispatch table (also consumed by preview/[id]/route.ts's GET and POST
// handlers, Step 7).

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  })),
}));

import { TEMPLATES } from "@/app/admin/emails/components/templates-data";
import { SAMPLE_RENDERERS } from "../sample-data";

describe("SAMPLE_RENDERERS dispatch table", () => {
  it("has exactly one renderer per registered template id — no missing, no stray entries", () => {
    const templateIds = TEMPLATES.map((t) => t.id).sort();
    const rendererIds = Object.keys(SAMPLE_RENDERERS).sort();
    expect(rendererIds).toEqual(templateIds);
  });

  it("every registered template renders non-throwing with its sample input", async () => {
    for (const template of TEMPLATES) {
      const renderer = SAMPLE_RENDERERS[template.id];
      const result = await renderer({});
      expect(result.content.length, template.id).toBeGreaterThan(0);
      expect(result.rendersAs, template.id).toBe(template.rendersAs);
    }
  });

  it("a per-field override is reflected in the sample-rendered output", async () => {
    const result = await SAMPLE_RENDERERS.booking_confirmation({
      greeting_intro: "Salaam {clientName}, testing the live preview.",
    });
    expect(result.content).toContain("Salaam Aisha Khan, testing the live preview.");
  });
});
