import { describe, expect, it } from "vitest";
import { seedParts } from "@/data/seedParts";
import {
  createDraft,
  fromLegacyBuild,
  previewPartsList,
  selectPart,
  slotOccupancy,
  completeness,
} from "@/lib/v3/build-document";

describe("v3 Build draft bridge", () => {
  it("keeps a blank draft incomplete and changes only after part confirmation", () => {
    const blank = createDraft("blank");
    const preview = selectPart(blank, "cpu", seedParts.find((part) => part.category === "cpu")!);
    expect(completeness(blank)).toMatchObject({ selected: 0, missing: 8, complete: false });
    expect(slotOccupancy(preview, "cpu")).toBe("selected");
    expect(preview.revision).toBe(1);
    expect(blank.revision).toBe(0);
    expect(blank.build.parts).toHaveLength(0);
  });

  it("reads an old saved Build without changing part identities", () => {
    const original = createDraft("blank", { parts: seedParts.slice(0, 2) }).build;
    const adapted = fromLegacyBuild(original, "saved-1");
    expect(adapted?.savedBuildId).toBe("saved-1");
    expect(adapted?.build.parts.map((part) => part.id)).toEqual(
      original.parts.map((part) => part.id),
    );
    expect(adapted?.schemaVersion).toBe(3);
  });

  it("imports exact catalog names while leaving unknown claims unresolved", () => {
    const known = seedParts.find((part) => part.category === "cpu")!;
    const result = previewPartsList(`${known.displayName}\nUnknown graphics card`);
    expect(result[0]).toMatchObject({ status: "matched", part: { id: known.id } });
    expect(result[1]).toMatchObject({ status: "unknown", line: "Unknown graphics card" });
  });

  it("does not silently choose between two parts for one slot", () => {
    const cpus = seedParts.filter((part) => part.category === "cpu").slice(0, 2);
    const result = previewPartsList(cpus.map((part) => part.displayName).join("\n"));
    expect(result).toHaveLength(2);
    expect(result.every((row) => row.status === "ambiguous" && !row.part)).toBe(true);
  });
});
