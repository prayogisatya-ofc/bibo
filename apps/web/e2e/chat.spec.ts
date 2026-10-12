import { expect, test } from "@playwright/test";

/**
 * E2E M2 vs mock-opencode + bridge sungguhan.
 * Prasyarat (lihat package.json e2e:*): mock :4498, bridge :4317 (OPENCODE_URL=mock),
 * web dev/preview :5173. Skenario mock dipilih via CODEPET_MOCK_SCENARIO bridge.
 */

async function onboard(page: import("@playwright/test").Page, dir: string): Promise<void> {
  await page.goto("/");
  // Modal bisa muncul belakangan (menunggu bridge.ready) atau sudah ada.
  const input = page.getByTestId("dir-input");
  try {
    await input.waitFor({ timeout: 15000 });
  } catch {
    // Bridge sudah punya direktori → buka onboarding manual.
    await page.getByTestId("dir-btn").click();
    await input.waitFor({ timeout: 10000 });
  }
  await input.fill(dir);
  await page.getByTestId("dir-go").click();
}

test("simple-answer: kirim pesan, streaming, selesai", async ({ page }) => {
  await onboard(page, "/tmp/e2e-simple");
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
  await page.getByTestId("chat-input").fill("halo bibo");
  await page.getByTestId("send-btn").click();
  // bubble pengguna
  await expect(page.locator(".bubble-user", { hasText: "halo bibo" })).toBeVisible();
  // jawaban agent mengalir lalu final; chat-count ≥ 2
  await expect(page.getByTestId("chat-count")).not.toHaveText("1", { timeout: 20000 });
  // tidak ada tag speak yang bocor
  const body = await page.locator(".chat-log").innerHTML();
  expect(body).not.toContain("<speak>");
  await page.screenshot({ path: "e2e/shot-simple.png" });
});

test("edit-files: feed tool + kartu perubahan", async ({ page }) => {
  await onboard(page, "/tmp/e2e-edit");
  await page.getByTestId("chat-input").fill("tambah catatan");
  await page.getByTestId("send-btn").click();
  // feed tool muncul
  await expect(page.getByTestId("feed").locator("li").first()).toBeVisible({ timeout: 30000 });
  // kartu perubahan muncul dengan +/- baris
  const changes = page.getByTestId("changes");
  await expect(changes).toBeVisible({ timeout: 30000 });
  await expect(changes).toContainText("+");
  await page.screenshot({ path: "e2e/shot-edit.png" });
});

test("offline: banner + input mati saat bridge down", async ({ page }) => {
  // Arahkan web ke bridge yang mati via localStorage sebelum load.
  await page.addInitScript(() => {
    localStorage.setItem("codepet.bridge-url", "http://127.0.0.1:4399");
  });
  await page.goto("/");
  await expect(page.getByTestId("offline-banner")).toBeVisible({ timeout: 25000 });
  await expect(page.getByTestId("chat-input")).toBeDisabled();
  await page.screenshot({ path: "e2e/shot-offline.png" });
});
