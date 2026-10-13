import { expect, test } from "@playwright/test";

/**
 * FITUR C: pemilih model ujung-ke-ujung vs mock-opencode + bridge sungguhan.
 * Prasyarat sama seperti chat.spec (e2e-run: mock :4498, bridge :4317,
 * web :5173). Tidak didaftarkan di skrip `e2e` package.json agar tidak
 * merapuhkan suite; dijalankan manual:
 *   bun run ./scripts/e2e-run.ts --scenario simple-answer --grep "model-picker"
 */

async function onboard(page: import("@playwright/test").Page, dir: string): Promise<void> {
  await page.goto("/");
  const input = page.getByTestId("dir-input");
  try {
    await input.waitFor({ timeout: 15000 });
  } catch {
    await page.getByTestId("dir-btn").click();
    await input.waitFor({ timeout: 10000 });
  }
  await input.fill(dir);
  await page.getByTestId("dir-go").click();
}

async function selectedText(sel: import("@playwright/test").Locator): Promise<string | undefined> {
  return sel.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text);
}

test("model-picker: pilih model → model aktif berubah + bertahan setelah reload", async ({ page }) => {
  await onboard(page, "/tmp/e2e-model");
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
  const sel = page.getByTestId("model-select");
  await expect(sel).toBeVisible({ timeout: 15000 });
  // Daftar dari mock (/api/model).
  await expect(sel.locator("option", { hasText: "Mock B (pintar)" })).toHaveCount(1);
  // Awal: default server (belum memilih).
  expect(await selectedText(sel)).toBe("Model: bawaan server");
  // Pilih → label aktif berubah.
  await sel.selectOption({ label: "Mock B (pintar)" });
  await expect
    .poll(async () => selectedText(sel), { timeout: 10000 })
    .toBe("Mock B (pintar)");
  // Pilihan bertahan setelah reload (localStorage + store bridge).
  await page.reload();
  const sel2 = page.getByTestId("model-select");
  await expect(sel2).toBeVisible({ timeout: 15000 });
  await expect
    .poll(async () => selectedText(sel2), { timeout: 10000 })
    .toBe("Mock B (pintar)");
});
