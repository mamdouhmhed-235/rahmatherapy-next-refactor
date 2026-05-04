import { afterEach, describe, expect, it } from "vitest";
import {
  createManageUrl,
  getManageTokenExpiry,
  getManageTokenHash,
} from "./manage-token";

describe("booking manage tokens", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("stores only a stable sha256 token hash", () => {
    expect(getManageTokenHash("customer-token")).toBe(
      "e771018d44b6443eef1443347f7cbbf6f90906871a5d8421027c090b051141c4"
    );
    expect(getManageTokenHash("customer-token")).not.toContain("customer-token");
  });

  it("expires manage links at the end of the booking date", () => {
    expect(getManageTokenExpiry("2026-06-01")).toBe("2026-06-01T23:59:59.000Z");
  });

  it("creates a site-relative manage URL without leaking the hash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://rahmatherapy.example/";

    expect(createManageUrl("token with spaces")).toBe(
      "https://rahmatherapy.example/booking/manage?token=token%20with%20spaces"
    );
  });
});
