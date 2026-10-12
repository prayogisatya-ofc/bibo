import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Aksesibilitas M7: tanpa pelanggaran serius (axe) di halaman utama,
 * onboarding, settings, dan kartu izin.
 */

test("a11y: halaman utama + onboarding + settings", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("dir-input");
  try {
    await input.waitFor({ timeout: 15000 });
  } catch {
    await page.getByTestId("dir-btn").click();
    await input.waitFor({ timeout: 10000 });
  }
  const r1 = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r1.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await input.fill("/tmp/e2e-a11y");
  await page.getByTestId("dir-go").click();
  // Buka settings.
  await page.getByTestId("settings-btn").click();
  const r2 = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r2.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});

test("a11y: kartu izin", async ({ page }) => {
  await page.goto("/?stt=fake");
  const input = page.getByTestId("dir-input");
  try {
    await input.waitFor({ timeout: 15000 });
  } catch {
    await page.getByTestId("dir-btn").click();
    await input.waitFor({ timeout: 10000 });
  }
  await input.fill("/tmp/e2e-a11y-perm");
  await page.getByTestId("dir-go").click();
  await page.getByTestId("chat-input").fill("jalankan perintah itu");
  await page.getByTestId("send-btn").click();
  await expect(page.getByTestId("approval")).toBeVisible({ timeout: 20000 });
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});
