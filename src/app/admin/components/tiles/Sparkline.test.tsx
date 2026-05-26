import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "./Sparkline";

describe("Sparkline (tile-tail wrapper)", () => {
  it("renders nothing when no values are provided", () => {
    const { container } = render(<Sparkline />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when values is empty (sparkline policy: no copy)", () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a wrapper when values are present", () => {
    const { container } = render(
      <Sparkline values={[1, 2, 3, 4]} className="sparkline-test" />
    );
    expect(container.querySelector(".sparkline-test")).not.toBeNull();
  });
});
