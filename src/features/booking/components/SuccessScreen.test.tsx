import { StrictMode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuccessScreen } from "./SuccessScreen";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// SuccessScreen renders a <Dialog.Close>, which reads Base UI's dialog root
// context — it must be mounted inside <Dialog.Root> or that part throws.
function renderSuccessScreen(children: React.ReactNode) {
  return render(<Dialog.Root open>{children}</Dialog.Root>);
}

afterEach(() => {
  cleanup();
  delete window.gtag;
});

describe("SuccessScreen — booking_request_submitted", () => {
  it("calls window.gtag once with the event name and no other payload when gtag exists", () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    renderSuccessScreen(
      <SuccessScreen
        bookingId="abc123"
        manageUrl={null}
        onStartOver={vi.fn()}
      />
    );

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "booking_request_submitted");
  });

  it("does not throw when gtag is absent (ad-blocker / dev / GA env unset)", () => {
    expect(window.gtag).toBeUndefined();

    expect(() =>
      renderSuccessScreen(
        <SuccessScreen
          bookingId="abc123"
          manageUrl={null}
          onStartOver={vi.fn()}
        />
      )
    ).not.toThrow();
  });

  it("nets exactly one event under StrictMode's dev double-mount", () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    render(
      <StrictMode>
        <Dialog.Root open>
          <SuccessScreen
            bookingId="abc123"
            manageUrl={null}
            onStartOver={vi.fn()}
          />
        </Dialog.Root>
      </StrictMode>
    );

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "booking_request_submitted");
  });
});
