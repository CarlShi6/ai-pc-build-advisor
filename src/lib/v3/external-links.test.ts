import { describe, expect, it } from "vitest";
import { allowedExternalUrl } from "@/lib/v3/external-links";
import { v3Catalog } from "@/lib/v3/catalog";
import { manufacturerSearch } from "@/lib/v3/model-guess";

describe("outbound links", () => {
  it("allows https links to the listed sites and their subdomains only", () => {
    expect(allowedExternalUrl("https://www.corsair.com/us/en/p/x")).toBe(
      "https://www.corsair.com/us/en/p/x",
    );
    expect(allowedExternalUrl("https://rog.asus.com/x")).not.toBeNull();
    for (const bad of [
      "http://www.corsair.com/",
      "https://corsair.com.evil.example/",
      "https://evilcorsair.com/",
      "https://user:pw@www.corsair.com/",
      "https://www.corsair.com:8443/",
      "javascript:alert(1)",
      "data:text/html,hi",
      "//www.corsair.com/",
      "https://example.com/",
      "not a url",
      "",
      null,
    ])
      expect(allowedExternalUrl(bad)).toBeNull();
  });

  it("covers every link the catalog and the guess search make", () => {
    const urls = v3Catalog.flatMap((part) =>
      [part.productUrl, part.searchUrl].filter((url) => url && !url.includes("example.com")),
    );
    expect(urls.length).toBeGreaterThan(20);
    for (const url of urls) expect(allowedExternalUrl(url), url).not.toBeNull();
    expect(
      allowedExternalUrl(
        manufacturerSearch({ category: "case", brand: "Phanteks", model: "NV5" } as never).url,
      ),
    ).not.toBeNull();
  });
});
