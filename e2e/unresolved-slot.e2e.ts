import { expect, test, type Page } from "@playwright/test";
import { clickUntil, openReady, selectedCount } from "./helpers";

// Stage 1: a part the photo shows but nobody confirmed. The Studio shows the photo evidence, the
// closest-looking catalog parts (never "this part"), a search by name and "keep unknown", and it
// keeps the review's decisions. Local sample, no AI call; the 2D view so it needs no WebGL.
async function photoDraft(page: Page) {
  await openReady(page, "/");
  await page.locator("input[type=file]").setInputFiles("e2e/fixtures/white-build-glass-front.png");
  await clickUntil(
    page.getByRole("button", { name: "Load local fixture (no AI call)" }),
    async () => {
      await expect(page.getByRole("region", { name: "Catalog candidate review" })).toBeVisible();
    },
  );
  // Exclude the cooler's top match in the review; the rest of the coolers tie, so it stays open.
  const coolers = page.locator('.v3-candidate-set[data-category="cooler"]');
  await coolers.getByLabel(/More options for/).click();
  const exclude = coolers.getByRole("button", { name: /^Exclude / });
  const excludedName = (await exclude.innerText()).replace(/^Exclude /, "");
  await exclude.click();
  await page.getByRole("button", { name: "Build it in 3D" }).click();
  const changes = page.getByRole("region", { name: "Suggested parts preview" });
  await changes.getByRole("button", { name: "Confirm and open Build Studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await page.getByRole("button", { name: "2D view" }).click();
  return excludedName;
}

const slotButton = (page: Page, label: string) =>
  page
    .locator(".v3-slot-list > button")
    .filter({ has: page.locator(".v3-slot-main", { hasText: new RegExp(`^${label}`) }) });

test("an unconfirmed photo slot offers similar looks, search and keep-unknown", async ({
  page,
}) => {
  const excludedName = await photoDraft(page);
  const detail = page.locator("aside.v3-detail-panel");

  // Cooler: the part excluded in the review stays out in the Studio.
  await slotButton(page, "Cooler").click();
  const cooler = detail.getByRole("region", { name: "Find this part" });
  await expect(cooler).toContainText(/Photo: /);
  await expect(cooler).not.toContainText(excludedName);
  await expect(cooler).toContainText("1 excluded in the review is hidden.");

  // GPU: photo evidence and similar looks, labelled as such.
  await slotButton(page, "GPU").click();
  const find = detail.getByRole("region", { name: "Find this part" });
  await expect(find).toContainText(/Photo: .*white/i);
  const looks = find.locator(".v3-identity-list").first().locator("li");
  await expect(looks.first()).toContainText("Similar look, not this exact part");
  await expect(find).toContainText("can't tell them apart");
  // No bare full-catalog dropdown for an unconfirmed photo slot.
  await expect(detail.getByLabel("Choose a catalog part")).toHaveCount(0);
  // "Use this" previews; the Build changes only on Confirm.
  await looks.first().getByRole("button", { name: "Use this" }).click();
  await expect(detail.getByText("PREVIEW · NOT APPLIED")).toBeVisible();
  await expect(selectedCount(page)).toHaveText("1 / 8");
  await detail
    .getByRole("button", { name: /^Confirm/ })
    .first()
    .click();
  await expect(selectedCount(page)).toHaveText("2 / 8");

  // Motherboard: nothing in the catalog looks alike; search by name, then keep it unknown.
  await slotButton(page, "Motherboard").click();
  const board = detail.getByRole("region", { name: "Find this part" });
  await expect(board).toContainText("No catalog part looks like this yet.");
  await board.getByLabel("Search by model name").fill("z790");
  await expect(board.getByRole("list", { name: "Search results" }).locator("li")).not.toHaveCount(
    0,
  );
  await board.getByLabel("Search by model name").fill("no such board");
  await expect(board).toContainText("No catalog part matches");
  await board.getByRole("button", { name: "Not in catalog · keep unknown" }).click();
  await expect(board.getByRole("status")).toContainText("Kept unknown");
  await expect(selectedCount(page)).toHaveText("2 / 8");
});
