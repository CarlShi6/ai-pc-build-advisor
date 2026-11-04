import { describe, expect, it } from "vitest";
import { shortFileName } from "@/lib/v3/file-name";

describe("file name on the upload area", () => {
  it("keeps short names and shortens long ones in the middle, keeping the extension", () => {
    expect(shortFileName("real-photo-1.jpg")).toBe("real-photo-1.jpg");
    const long = "IMG_20261028_white_dual_chamber_build_final_v2.jpeg";
    const short = shortFileName(long);
    expect(short).toHaveLength(32);
    expect(short.startsWith("IMG_20261028_white_dual_")).toBe(true);
    expect(short.endsWith("….jpeg")).toBe(true);
    // No real extension: just the start and an ellipsis.
    expect(shortFileName("a".repeat(40))).toBe(`${"a".repeat(31)}…`);
  });
});
