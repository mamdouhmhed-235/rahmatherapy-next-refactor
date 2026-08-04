// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://localhost:3000/" }
//
// C-18 Phase C — proof that the Functional control actually gates
// `rahma-booking-contact-v1`, rather than merely being described as gating it.
//
// The registry's gating-obligation comment (src/lib/consent/cookie-registry.ts)
// requires exactly this: a test that reads the gate, not one that re-reads the
// copy. So these call the very functions BookingExperience's submit handler and
// pre-fill effect call, with the underlying storage helpers mocked, and assert
// on whether they were reached at all.
//
// The https origin is load-bearing — writeConsent sets the cookie `Secure` and
// jsdom will not return a Secure cookie to an insecure origin.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/returning-customer", () => ({
  saveReturningCustomer: vi.fn(),
  loadReturningCustomer: vi.fn(() => ({ fullName: "Prefilled Person" })),
  clearReturningCustomer: vi.fn(),
}));

import { writeConsent, type ConsentChoices } from "@/lib/consent/consent-state";
import { resetConsentStoreForTests } from "@/components/consent/consent-store";
import { loadReturningCustomer, saveReturningCustomer } from "../utils/returning-customer";
import {
  loadReturningCustomerIfConsented,
  saveReturningCustomerIfConsented,
} from "../BookingExperience";
import type { BookingDetailsFormValues } from "../schemas/booking-schema";

const DETAILS = { fullName: "Test Person", phone: "07000 000000" } as BookingDetailsFormValues;

function clearAllCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

/** Store the given choice and make the consent store re-read it. */
function storeChoice(choices: ConsentChoices) {
  writeConsent(choices);
  resetConsentStoreForTests();
}

beforeEach(() => {
  clearAllCookies();
  resetConsentStoreForTests();
  vi.mocked(saveReturningCustomer).mockClear();
  vi.mocked(loadReturningCustomer).mockClear();
});

afterEach(() => {
  clearAllCookies();
});

describe("the write gate (booking submit)", () => {
  it("does not save the contact details when no choice has been made at all", () => {
    saveReturningCustomerIfConsented(DETAILS);
    expect(saveReturningCustomer).not.toHaveBeenCalled();
  });

  it("does not save the contact details when functional consent is refused", () => {
    storeChoice({ analytics: true, functional: false });

    saveReturningCustomerIfConsented(DETAILS);

    expect(saveReturningCustomer).not.toHaveBeenCalled();
  });

  it("does save them when functional consent is given", () => {
    // The non-vacuous half: without this, the two assertions above would pass
    // just as well against a gate that never let anything through.
    storeChoice({ analytics: false, functional: true });

    saveReturningCustomerIfConsented(DETAILS);

    expect(saveReturningCustomer).toHaveBeenCalledTimes(1);
    expect(saveReturningCustomer).toHaveBeenCalledWith(DETAILS);
  });
});

describe("the read gate (booking pre-fill)", () => {
  it("does not even look at the store when no choice has been made", () => {
    expect(loadReturningCustomerIfConsented()).toBeNull();
    // PECR covers access to information on the device, not just storage of it,
    // so the gate has to stop the read happening — returning null after reading
    // would not be enough.
    expect(loadReturningCustomer).not.toHaveBeenCalled();
  });

  it("does not look at the store when functional consent is refused", () => {
    storeChoice({ analytics: true, functional: false });

    expect(loadReturningCustomerIfConsented()).toBeNull();
    expect(loadReturningCustomer).not.toHaveBeenCalled();
  });

  it("reads and returns the stored details when functional consent is given", () => {
    storeChoice({ analytics: false, functional: true });

    expect(loadReturningCustomerIfConsented()).toEqual({ fullName: "Prefilled Person" });
    expect(loadReturningCustomer).toHaveBeenCalledTimes(1);
  });
});

describe("a stale record is not consent", () => {
  it("refuses on a consent record from an older banner version", () => {
    document.cookie = `rahma_consent=${encodeURIComponent(
      JSON.stringify({
        v: "2020-01-01.1",
        id: "3f1d5f6e-1c2b-4a3d-9e8f-0a1b2c3d4e5f",
        choices: { analytics: true, functional: true },
        ts: "2026-08-04T00:00:00.000Z",
      })
    )}; Path=/`;
    resetConsentStoreForTests();

    saveReturningCustomerIfConsented(DETAILS);
    expect(loadReturningCustomerIfConsented()).toBeNull();

    expect(saveReturningCustomer).not.toHaveBeenCalled();
    expect(loadReturningCustomer).not.toHaveBeenCalled();
  });
});
