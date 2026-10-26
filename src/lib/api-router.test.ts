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

  it("rejects oversized analytics requests before they can amplify structured logs", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await handleInternalApiRequest(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "advisor_request_succeeded",
          padding: "x".repeat(8 * 1024),
        }),
      }),
    );

    expect(response?.status).toBe(413);
    await expect(response?.json()).resolves.toEqual({
      message: "Request body must not exceed 8192 bytes.",
    });
    expect(console.info).not.toHaveBeenCalled();
  });
});

describe("v3 save revision check", () => {
  function save(body: Record<string, unknown>) {
    return handleInternalApiRequest(
      new Request("http://localhost/api/builds/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Router build", buildNeeds: {}, ...body }),
      }),
    );
  }

  it("returns 409 SAVE_CONFLICT when a stale tab saves over a newer version", async () => {
    const build = { id: "router-build", name: "Router build", parts: [], budget: 1500 };
    const created = await save({ build });
    expect(created?.status).toBe(200);
    const first = (await created!.json()).savedBuild;

    const newer = await save({ id: first.id, build, expectedUpdatedAt: first.updatedAt });
    expect(newer?.status).toBe(200);

    const stale = await save({ id: first.id, build, expectedUpdatedAt: first.updatedAt });
    expect(stale?.status).toBe(409);
    await expect(stale?.json()).resolves.toMatchObject({ error: { code: "SAVE_CONFLICT" } });
  });
});
