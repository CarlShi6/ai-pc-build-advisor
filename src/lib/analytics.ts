export const ANALYTICS_EVENT_NAMES = [
  "landing_cta_clicked",
  "consultation_load_succeeded",
  "consultation_load_failed",
  "consultation_load_retried",
  "advisor_request_started",
  "advisor_request_succeeded",
  "advisor_request_failed",
  "advisor_request_retried",
  "compare_opened",
  "compare_load_succeeded",
  "compare_load_failed",
  "compare_load_retried",
  "replacement_started",
  "replacement_succeeded",
  "replacement_failed",
  "replacement_blocked",
  "shopping_list_opened",
  "affiliate_link_opened",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

export type AnalyticsEvent = {
  event: AnalyticsEventName;
  eventId: string;
  occurredAt: string;
  path: string;
  properties: Record<string, boolean | number | string | null>;
};

const EVENT_NAMES = new Set<string>(ANALYTICS_EVENT_NAMES);

function normalizeProperties(properties: unknown) {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return {};
  }

  const normalized: Record<string, boolean | number | string | null> = {};

  for (const [key, value] of Object.entries(properties as Record<string, unknown>).slice(0, 20)) {
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(key)) {
      continue;
    }

    if (typeof value === "string") {
      normalized[key] = value.slice(0, 160);
    } else if (
      typeof value === "boolean" ||
      value === null ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      normalized[key] = value;
    }
  }

  return normalized;
}

export function normalizeAnalyticsEvent(
  value: unknown,
  defaults: { eventId: string; occurredAt: string; path: string },
): AnalyticsEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  if (typeof input.event !== "string" || !EVENT_NAMES.has(input.event)) {
    return null;
  }

  const suppliedPath = typeof input.path === "string" ? input.path : defaults.path;
  const safePath = suppliedPath.startsWith("/") ? suppliedPath.slice(0, 200) : defaults.path;

  return {
    event: input.event as AnalyticsEventName,
    eventId:
      typeof input.eventId === "string" && input.eventId.length <= 100
        ? input.eventId
        : defaults.eventId,
    occurredAt:
      typeof input.occurredAt === "string" && !Number.isNaN(Date.parse(input.occurredAt))
        ? input.occurredAt
        : defaults.occurredAt,
    path: safePath,
    properties: normalizeProperties(input.properties),
  };
}

function createEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function trackAnalyticsEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: AnalyticsEvent = {
    event,
    eventId: createEventId(),
    occurredAt: new Date().toISOString(),
    path: window.location.pathname,
    properties: normalizeProperties(properties),
  };

  window.dispatchEvent(new CustomEvent("ai-pc-advisor:analytics", { detail: payload }));

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Analytics must never interrupt the product flow.
  });
}
