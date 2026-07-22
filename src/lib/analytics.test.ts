import { describe, expect, it } from "vitest";
import { normalizeAnalyticsEvent } from "@/lib/analytics";

const defaults = {
  eventId: "generated-id",
  occurredAt: "2026-07-21T12:00:00.000Z",
  path: "/fallback",
};

describe("normalizeAnalyticsEvent", () => {
  it("accepts a known event and removes unsupported property values", () => {
    expect(
      normalizeAnalyticsEvent(
        {
          event: "compare_opened",
          eventId: "event-1",
          occurredAt: "2026-07-21T10:00:00.000Z",
          path: "/consult",
          properties: {
            category: "gpu",
            alternative_count: 4,
            valid: true,
            nested: { secret: "not collected" },
            invalid_key$: "ignored",
          },
        },
        defaults,
      ),
    ).toEqual({
      event: "compare_opened",
      eventId: "event-1",
      occurredAt: "2026-07-21T10:00:00.000Z",
      path: "/consult",
      properties: {
        category: "gpu",
        alternative_count: 4,
        valid: true,
      },
    });
  });

  it("rejects unknown event names", () => {
    expect(normalizeAnalyticsEvent({ event: "price_history_opened" }, defaults)).toBeNull();
  });
});
