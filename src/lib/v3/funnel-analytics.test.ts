import { afterEach, describe, expect, it, vi } from "vitest";
import { seedParts } from "@/data/seedParts";
import { normalizeAnalyticsEvent, type AnalyticsEvent } from "@/lib/analytics";
import { createDraft } from "@/lib/v3/build-document";
import { createOgImageFixture } from "@/lib/v3/dev-image-fixture";
import {
  analysisProperties,
  draftProperties,
  funnel,
  reviewProperties,
} from "@/lib/v3/funnel-analytics";

const cpu = seedParts.find((part) => part.category === "cpu")!;
const secretText = "my private parts list with Some mystery 1000W PSU";

function importedDraft() {
  return createDraft("import", {
    name: "Imported parts draft",
    sourceInput: secretText,
    parts: [cpu],
    unresolved: { psu: "Some mystery 1000W PSU" },
  });
}

/** Captures what `trackAnalyticsEvent` would send, using a minimal browser stand-in. */
function captureEvents() {
  const sent: AnalyticsEvent[] = [];
  const storage = new Map<string, string>();
  vi.stubGlobal("window", {
    location: { pathname: "/studio", search: "?utm_source=test" },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    dispatchEvent: () => true,
  });
  vi.stubGlobal("CustomEvent", class {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 202 });
    }),
  );
  return sent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("v3 funnel analytics", () => {
  it("reports occupancy counts without treating unresolved slots as done", () => {
    expect(draftProperties(importedDraft())).toEqual({
      source: "import",
      selected_count: 1,
      unresolved_count: 1,
      empty_count: 6,
      complete: false,
    });
  });

  it("summarizes an analysis by counts only and flags fixture runs", () => {
    const fixture = createOgImageFixture();
    const properties = analysisProperties(fixture);
    expect(properties).toMatchObject({ fixture: true, quality: fixture.quality });
    expect(properties.observation_count).toBe(fixture.observations.length);
    expect(JSON.stringify(properties)).not.toContain(fixture.summary);
  });

  it("records the review decision but not manual notes", () => {
    expect(
      reviewProperties("case", {
        status: "manual",
        excludedPartIds: ["a", "b"],
        manualText: secretText,
      }),
    ).toEqual({ category: "case", review_status: "manual", excluded_count: 2 });
  });

  it("sends each funnel step through the existing analytics endpoint", () => {
    const sent = captureEvents();
    const draft = importedDraft();
    funnel.imageSubmitted({ fixture: false });
    funnel.imageAnalysisFailed({ fixture: false }, "IMAGE_AI_NOT_CONFIGURED");
    funnel.draftCreated(draft);
    funnel.buildSaved(draft, true);
    funnel.buildSaveConflict(draft);
    funnel.reportExported(draft, "json_file");
    funnel.shoppingLinkOpened(draft, "cpu", "official");

    expect(sent.map((event) => event.event)).toEqual([
      "v3_image_submitted",
      "v3_image_analysis_failed",
      "v3_draft_created",
      "v3_build_saved",
      "v3_build_save_conflict",
      "v3_report_exported",
      "v3_shopping_link_opened",
    ]);
    const sessionIds = new Set(sent.map((event) => event.properties.session_id));
    expect(sessionIds.size).toBe(1);
    expect(sent[3].properties).toMatchObject({ first_save: true, unresolved_count: 1 });
    expect(sent[5].properties).toMatchObject({ format: "json_file" });
    expect(JSON.stringify(sent)).not.toContain("mystery");

    // The server accepts every v3 event name it receives.
    for (const event of sent)
      expect(
        normalizeAnalyticsEvent(event, { eventId: "x", occurredAt: event.occurredAt, path: "/" }),
      ).not.toBeNull();
  });
});
