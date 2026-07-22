import { afterEach, describe, expect, it, vi } from "vitest";
import { handleInternalApiRequest } from "@/lib/api-router";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Milestone 34 API validation", () => {
  it("rejects invalid recommendation inputs with a useful 400 response", async () => {
    const response = await handleInternalApiRequest(
      new Request("http://localhost/api/build/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ budget: -1 }),
      }),
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      message: "Budget must be between $300 and $20,000.",
    });
  });

  it("accepts supported analytics events without exposing a storage dependency", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await handleInternalApiRequest(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "advisor_request_succeeded",
          path: "/consult",
          properties: { provider: "mock", action_count: 2 },
        }),
      }),
    );

    expect(response?.status).toBe(202);
    await expect(response?.json()).resolves.toEqual({ accepted: true });
    expect(console.info).toHaveBeenCalledOnce();
  });
});
