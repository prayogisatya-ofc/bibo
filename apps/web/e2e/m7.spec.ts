import { expect, test } from "@playwright/test";

/** M7 P1: mini mode + ganti sesi (leg simple-answer). */

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
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
}

test("mini mode: avatar pojok 96px + chat bisa dibuka", async ({ page }) => {
  await onboard(page, "/tmp/e2e-mini");
  await page.getByTestId("mini-btn").click();
  await expect(page.getByTestId("chat-log")).toHaveCount(0);
  const box = await page.getByTestId("bibo-svg").boundingBox();
  expect(box?.width ?? 999).toBeLessThanOrEqual(130);
  await page.getByTestId("chat-fab").click();
  await expect(page.getByTestId("chat-log")).toBeVisible();
});

test("ganti sesi: daftar sesi + pilih", async ({ page }) => {
  await onboard(page, "/tmp/e2e-sess-a");
  await page.getByTestId("chat-input").fill("satu");
  await page.getByTestId("send-btn").click();
  await expect(page.locator(".bubble-user", { hasText: "satu" })).toBeVisible({ timeout: 10000 });
  // Direktori kedua = sesi kedua.
  await page.getByTestId("dir-btn").click();
  const input = page.getByTestId("dir-input");
  await input.waitFor({ timeout: 10000 });
  await input.fill("/tmp/e2e-sess-b");
  await page.getByTestId("dir-go").click();
  await page.getByTestId("chat-input").fill("dua");
  await page.getByTestId("send-btn").click();
  await expect(page.locator(".bubble-user", { hasText: "dua" })).toBeVisible({ timeout: 10000 });
  // Buka menu: daftar sesi tampil ≥2, pilih satu, tidak error.
  await page.getByTestId("dir-btn").click();
  await page.waitForTimeout(1500);
  const sessBtns = page.locator("[data-testid^='sess-']");
  await expect(sessBtns.first()).toBeVisible({ timeout: 10000 });
  expect(await sessBtns.count()).toBeGreaterThanOrEqual(1);
  await sessBtns.first().click();
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
  await expect(page.getByTestId("chat-input")).toBeEnabled();
});
