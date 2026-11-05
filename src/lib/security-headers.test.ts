import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS, withSecurityHeaders } from "@/lib/security-headers";

describe("security headers", () => {
  it("adds every header in production, keeps the body and any header already set", async () => {
    const response = withSecurityHeaders(
      new Response("hello", { headers: { "x-frame-options": "SAMEORIGIN" } }),
      true,
    );
    for (const name of Object.keys(SECURITY_HEADERS))
      expect(response.headers.has(name), name).toBe(true);
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(await response.text()).toBe("hello");
  });

  it("leaves the content policy and HSTS out in dev", () => {
    const response = withSecurityHeaders(new Response(""), false);
    expect(response.headers.has("content-security-policy")).toBe(false);
    expect(response.headers.has("strict-transport-security")).toBe(false);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("copies a response whose headers cannot change", () => {
    const fetched = Response.redirect("https://example.com/", 302);
    const response = withSecurityHeaders(fetched, true);
    expect(response.status).toBe(302);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("gives static files the same headers (public/_headers)", () => {
    const file = readFileSync("public/_headers", "utf8");
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      expect(file.toLowerCase()).toContain(`${name}: ${value}`.toLowerCase());
  });

  it("allows only the outside origins the app loads", () => {
    const policy = SECURITY_HEADERS["content-security-policy"];
    const origins = new Set(policy.match(/https:\/\/[a-z0-9.-]+/g));
    expect([...origins].sort()).toEqual([
      "https://challenges.cloudflare.com",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ]);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });
});
