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

test("a11y: mode ngobrol + popup izin (axe, focus trap, Esc)", async ({ page }) => {
  await page.goto("/?stt=fake");
  const input = page.getByTestId("dir-input");
  try {
    await input.waitFor({ timeout: 15000 });
  } catch {
    await page.getByTestId("dir-btn").click();
    await input.waitFor({ timeout: 10000 });
  }
  await input.fill("/tmp/e2e-a11y-talk");
  await page.getByTestId("dir-go").click();
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
  // Pindah ke Ngobrol, picu izin lewat mode chat, kembali ke Ngobrol.
  await page.getByTestId("mode-talk").click();
  await expect(page.locator(".talk-screen")).toBeVisible();
  await page.getByTestId("mode-chat").click();
  await page.getByTestId("chat-input").fill("jalankan perintah itu");
  await page.getByTestId("send-btn").click();
  await expect(page.getByTestId("approval")).toBeVisible({ timeout: 20000 });
  await page.getByTestId("mode-talk").click();
  const popup = page.getByTestId("approval");
  await expect(popup).toBeVisible();
  // Axe: tanpa pelanggaran serious/critical di mode Ngobrol + popup.
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  // Focus trap: Tab dari elemen terakhir membungkus ke pertama.
  const box = await popup.boundingBox();
  expect(box).not.toBeNull();
  await expect(popup.locator('[role="alertdialog"]')).toHaveCount(1);
  const focusables = popup.locator("button:not([disabled])");
  const n = await focusables.count();
  expect(n).toBeGreaterThan(1);
  await focusables.nth(n - 1).focus();
  await page.keyboard.press("Tab");
  await expect(focusables.first()).toBeFocused();
  // Shift+Tab dari pertama membungkus ke terakhir.
  await page.keyboard.press("Shift+Tab");
  await expect(focusables.nth(n - 1)).toBeFocused();
  // Esc: meminimalkan ke chip, bukan keputusan.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("awaiting-chip")).toBeVisible();
  await expect(popup).toHaveCount(0);
  // Chip bisa dibuka lagi via keyboard (Enter).
  await page.getByTestId("awaiting-chip").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("approval")).toBeVisible();
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
