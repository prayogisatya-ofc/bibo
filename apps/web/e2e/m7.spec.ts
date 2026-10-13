import { expect, test } from "@playwright/test";

/**
 * E2E pemilih mode Chat | Ngobrol (pengganti mini mode, keputusan ADR d).
 * Leg simple-answer / permission-medium / permission-high (lihat e2e script).
 */

async function onboard(page: import("@playwright/test").Page, dir: string, query = ""): Promise<void> {
  await page.goto(`/${query}`);
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

test("mode-switch: chat ↔ ngobrol, uiMode tersimpan di localStorage", async ({ page }) => {
  await onboard(page, "/tmp/e2e-mode");
  // Default: mode chat.
  await expect(page.getByTestId("chat-log")).toBeVisible();
  await expect(page.getByTestId("mode-chat")).toHaveAttribute("aria-pressed", "true");
  // Pindah ke Ngobrol.
  await page.getByTestId("mode-talk").click();
  await expect(page.locator(".talk-screen")).toBeVisible();
  await expect(page.getByTestId("mode-talk")).toHaveAttribute("aria-pressed", "true");
  // Mode Ngobrol HANYA: Bibo besar + mic, tanpa daftar chat/feed tool.
  await expect(page.getByTestId("chat-log")).toHaveCount(0);
  await expect(page.getByTestId("feed")).toHaveCount(0);
  await expect(page.getByTestId("mic-btn")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("bibo.ui-mode"))).toBe("talk");
  // Persist: reload tetap di Ngobrol.
  await page.reload();
  await expect(page.locator(".talk-screen")).toBeVisible({ timeout: 15000 });
  // Kembali ke Chat: riwayat (input) tetap ada.
  await page.getByTestId("mode-chat").click();
  await expect(page.getByTestId("chat-log")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("bibo.ui-mode"))).toBe("chat");
});

test("talk-permission: popup izin medium di bawah Bibo + petunjuk suara", async ({ page }) => {
  await onboard(page, "/tmp/e2e-talk-med");
  await page.getByTestId("mode-talk").click();
  await expect(page.locator(".talk-screen")).toBeVisible();
  // Picu permission: kirim pesan via chat? Di mode Ngobrol tak ada kolom ketik —
  // kembali ke chat untuk mengirim, lalu kembali ke Ngobrol saat izin pending.
  await page.getByTestId("mode-chat").click();
  await page.getByTestId("chat-input").fill("jalankan perintah itu");
  await page.getByTestId("send-btn").click();
  await expect(page.getByTestId("approval")).toBeVisible({ timeout: 20000 });
  await page.getByTestId("mode-talk").click();
  // Popup izin tampil di bawah Bibo (bukan dock).
  const popup = page.getByTestId("approval");
  await expect(popup).toBeVisible();
  await expect(popup.locator(".pop-arrow")).toBeVisible();
  await expect(page.getByTestId("risk-badge")).not.toContainText("tinggi");
  // Petunjuk suara di bawah kartu (medium + voiceAllowed).
  await expect(page.getByTestId("perm-voice-hint")).toBeVisible();
  await expect(page.getByTestId("perm-voice-hint")).toContainText(/ucapkan.*ya/i);
  // Bibo mengecil saat bertanya (290 px; tunggu animasi pindah ~350 ms).
  await expect(page.locator(".talk-stage.asking")).toBeVisible();
  await page.waitForTimeout(600);
  const box = await page.getByTestId("bibo-svg").boundingBox();
  expect(box?.width ?? 999).toBeLessThan(340);
  // Izinkan sekali → kartu hilang, sesi lanjut.
  await page.getByTestId("perm-once").click();
  await expect(page.getByTestId("approval")).toHaveCount(0, { timeout: 20000 });
});

test("talk-high: izin high di mode ngobrol (ketik OK, tanpa selalu-izinkan)", async ({ page }) => {
  await onboard(page, "/tmp/e2e-talk-high");
  await page.getByTestId("mode-chat").click();
  await page.getByTestId("chat-input").fill("jalankan perintah itu");
  await page.getByTestId("send-btn").click();
  await expect(page.getByTestId("approval")).toBeVisible({ timeout: 20000 });
  await page.getByTestId("mode-talk").click();
  await expect(page.getByTestId("approval")).toBeVisible();
  await expect(page.getByTestId("risk-badge")).toContainText("tinggi");
  // High: tanpa "Selalu izinkan", tanpa petunjuk suara, ada langkah ketik OK.
  await expect(page.getByTestId("perm-always")).toHaveCount(0);
  await expect(page.getByTestId("perm-voice-hint")).toHaveCount(0);
  const once = page.getByTestId("perm-once");
  await expect(once).toBeDisabled();
  await page.getByTestId("perm-ok-input").fill("OK");
  await expect(once).toBeEnabled();
  await once.click();
  await expect(page.getByTestId("approval")).toHaveCount(0, { timeout: 20000 });
});

test("esc-minimize: Esc meminimalkan kartu → chip menunggu izin, kartu tetap pending", async ({ page }) => {
  await onboard(page, "/tmp/e2e-esc");
  await page.getByTestId("mode-talk").click();
  await page.getByTestId("mode-chat").click();
  await page.getByTestId("chat-input").fill("jalankan perintah itu");
  await page.getByTestId("send-btn").click();
  await expect(page.getByTestId("approval")).toBeVisible({ timeout: 20000 });
  await page.getByTestId("mode-talk").click();
  await expect(page.getByTestId("approval")).toBeVisible();
  // Esc: bukan keputusan — kartu diminimalkan, chip "Menunggu izin" tampil.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("approval")).toHaveCount(0);
  const chip = page.getByTestId("awaiting-chip");
  await expect(chip).toBeVisible();
  // Kartu tetap pending: buka lagi via chip, izin masih bisa dijawab.
  await chip.click();
  await expect(page.getByTestId("approval")).toBeVisible();
  await page.getByTestId("perm-reject").click();
  await expect(page.getByTestId("approval")).toHaveCount(0, { timeout: 20000 });
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
