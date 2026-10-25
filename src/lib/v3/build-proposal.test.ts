import { describe, expect, it } from "vitest";
import { seedParts } from "@/data/seedParts";
import { createDraft, selectPart } from "@/lib/v3/build-document";
import {
  confirmPartRemoval,
  confirmPartSelection,
  proposePartRemoval,
  proposePartSelection,
} from "@/lib/v3/build-proposal";

describe("v3 part proposal", () => {
  it("previews without mutation, then confirms exactly one revision", () => {
    const current = createDraft("blank");
    const cpu = seedParts.find((part) => part.category === "cpu")!;
    const proposal = proposePartSelection(current, "cpu", cpu);
    expect(current.build.parts).toHaveLength(0);
    expect(proposal.candidate.build.parts).toHaveLength(1);
    const confirmed = confirmPartSelection(current, proposal);
    expect(confirmed.revision).toBe(1);
    expect(confirmed.build.parts.map((part) => part.id)).toEqual([cpu.id]);
  });

  it("rejects a stale preview", () => {
    const current = createDraft("blank");
    const cpu = seedParts.find((part) => part.category === "cpu")!;
    const gpu = seedParts.find((part) => part.category === "gpu")!;
    const stale = proposePartSelection(current, "cpu", cpu);
    const newer = selectPart(current, "gpu", gpu);
    expect(() => confirmPartSelection(newer, stale)).toThrow(/build changed/);
  });

  it("previews removal and rejects it after a newer selection", () => {
    const cpu = seedParts.find((part) => part.category === "cpu")!;
    const gpu = seedParts.find((part) => part.category === "gpu")!;
    const current = selectPart(createDraft("blank"), "cpu", cpu);
    const proposal = proposePartRemoval(current, "cpu");
    expect(current.build.parts).toHaveLength(1);
    expect(proposal.candidate.build.parts).toHaveLength(0);
    expect(confirmPartRemoval(current, proposal).build.parts).toHaveLength(0);
    expect(() => confirmPartRemoval(selectPart(current, "gpu", gpu), proposal)).toThrow(
      /build changed/,
    );
  });
});
