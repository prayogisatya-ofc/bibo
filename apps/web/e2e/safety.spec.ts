import { expect, test } from "@playwright/test";
import { onboardDir } from "./helpers.js";

/**
 * Gherkin "Keselamatan izin" (M6): medium via suara, high tidak via suara, form.
 * Leg permission-medium / permission-high / form-question (lihat e2e script).
 */

async function onboardStt(page: import("@playwright/test").Page, dir: string): Promise<void> {
  await page.addInitScript({ path: "e2e/stub-speech.js" });
  await page.goto("/?stt=fake");
  await onboardDir(page, dir);
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
}

async function micSay(page: import("@playwright/test").Page, text: string): Promise<void> {
  await page.getByTestId("mic-btn").hover();
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.evaluate((t) => window.__stt?.final(t), text);
  await page.mouse.up();
}

test("safety-medium: izin medium via suara 'ya'", async ({ page }) => {
  await onboardStt(page, "/tmp/e2e-safe-med");
  await page.getByTestId("chat-input").fill("jalankan perintah itu");
  await page.getByTestId("send-btn").click();
  await expect(page.getByTestId("approval")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("risk-badge")).not.toContainText("tinggi");
  await micSay(page, "ya");
  await expect(page.getByTestId("voice-toast")).toContainText("Perintah suara: izinkan sekali", { timeout: 8000 });
  // Kartu hilang (dijawab) dan sesi lanjut.
  await expect(page.getByTestId("approval")).toHaveCount(0, { timeout: 20000 });
});

test("safety-high: 'ya' suara DITOLAK untuk risiko high", async ({ page }) => {
  await onboardStt(page, "/tmp/e2e-safe-high");
  await page.getByTestId("chat-input").fill("jalankan perintah itu");
  await page.getByTestId("send-btn").click();
  await expect(page.getByTestId("approval")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("risk-badge")).toContainText("tinggi");
  await expect(page.getByTestId("perm-always")).toHaveCount(0);
  await micSay(page, "ya");
  await page.waitForTimeout(1500);
  // TIDAK ada reply terkirim: kartu tetap ada, tidak idle.
  await expect(page.getByTestId("approval")).toBeVisible({ timeout: 5000 });
  // Setujui via klik + ketik OK.
  await page.getByTestId("perm-ok-input").fill("OK");
  await page.getByTestId("perm-once").click();
  await expect(page.getByTestId("approval")).toHaveCount(0, { timeout: 20000 });
});

test("safety-form: kartu form + jawab klik + jawab suara", async ({ page }) => {
  await onboardStt(page, "/tmp/e2e-safe-form");
  await page.getByTestId("chat-input").fill("tanya saya warna favorit");
  await page.getByTestId("send-btn").click();
  await expect(page.getByTestId("formcard")).toBeVisible({ timeout: 25000 });
  // Jawab via suara: "dua" = opsi kedua.
  await micSay(page, "dua");
  await expect(page.getByTestId("formcard")).toHaveCount(0, { timeout: 20000 });
});
