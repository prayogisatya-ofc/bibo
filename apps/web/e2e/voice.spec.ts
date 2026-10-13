import { expect, test } from "@playwright/test";
import { onboardDir } from "./helpers.js";

/**
 * M5 Gherkin §13.3: STT dipalsukan (?stt=fake + __stt inject), TTS dipalsukan.
 * Leg simple-answer: success, barge-in, no-mic. Leg interrupt: stop, negatif.
 */

async function onboardStt(page: import("@playwright/test").Page, dir: string, stt = "fake"): Promise<void> {
  await page.addInitScript({ path: "e2e/stub-speech.js" });
  await page.goto(`/?stt=${stt}`);
  await onboardDir(page, dir);
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
}

async function micHold(page: import("@playwright/test").Page, ms: number): Promise<void> {
  await page.getByTestId("mic-btn").hover();
  await page.mouse.down();
  await page.waitForTimeout(ms);
}

async function micRelease(page: import("@playwright/test").Page): Promise<void> {
  await page.mouse.up();
}

test("voice-success: perintah suara sukses", async ({ page }) => {
  await onboardStt(page, "/tmp/e2e-voice-ok");
  await micHold(page, 400);
  await page.evaluate(() => window.__stt?.interim("tambahkan validasi"));
  await expect(page.getByTestId("mic-caption")).toContainText("tambahkan validasi");
  await page.evaluate(() => window.__stt?.final("tambahkan validasi email"));
  await micRelease(page);
  // Auto-submit: bubble pengguna + jawaban agent.
  await expect(page.locator(".bubble-user", { hasText: "tambahkan validasi email" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("chat-count")).not.toHaveText("1", { timeout: 20000 });
});

test("voice-bargein: mic aktif menghentikan TTS seketika", async ({ page }) => {
  await onboardStt(page, "/tmp/e2e-voice-barge");
  await page.getByTestId("chat-input").fill("halo");
  await page.getByTestId("send-btn").click();
  // Tanpa ack: ucapan pertama = ringkasan akhir giliran.
  await page.waitForFunction(() => (window.__spoken ?? []).length >= 1, null, { timeout: 20000 });
  const cancelledBefore = (await page.evaluate(() => window.__ttsCancelled ?? 0)) as number;
  await micHold(page, 400);
  await page.waitForTimeout(300);
  const cancelledAfter = (await page.evaluate(() => window.__ttsCancelled ?? 0)) as number;
  expect(cancelledAfter).toBeGreaterThan(cancelledBefore);
  await micRelease(page);
  await expect(page.getByTestId("avatar-caption")).toHaveText("Bibo siap", { timeout: 25000 });
  await page.waitForTimeout(1500);
  // Overlay bicara berhenti: data-speaking kembali false (bukan voice-pulse lama).
  const speaking = await page.evaluate(() => document.querySelector('[data-testid="bibo-svg"] svg')?.getAttribute("data-speaking"));
  expect(speaking).toBe("false");
});

test("voice-nomic: STT tidak tersedia", async ({ page }) => {
  await page.addInitScript({ path: "e2e/stub-speech.js" });
  await page.goto("/?stt=none");
  await onboardDir(page, "/tmp/e2e-voice-nomic");
  await expect(page.getByTestId("mic-unavailable")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("mic-unavailable")).toContainText("Mic tidak tersedia");
  // Chat teks tetap jalan.
  await page.getByTestId("chat-input").fill("tes teks");
  await page.getByTestId("send-btn").click();
  await expect(page.locator(".bubble-user", { hasText: "tes teks" })).toBeVisible({ timeout: 10000 });
});

test("voice-stop: berkata berhenti menghentikan agent", async ({ page }) => {
  await onboardStt(page, "/tmp/e2e-voice-stop");
  await page.getByTestId("chat-input").fill("tulis cerita sangat panjang tanpa henti");
  await page.getByTestId("send-btn").click();
  await page.waitForTimeout(1500); // pastikan sibuk (streaming cerita)
  await micHold(page, 400);
  await page.evaluate(() => window.__stt?.final("berhenti"));
  await micRelease(page);
  await expect(page.getByTestId("voice-toast")).toContainText("Perintah suara: berhenti", { timeout: 5000 });
  // Avatar kembali idle tanpa celebrate berkepanjangan; tidak ada bubble "berhenti".
  await expect(page.getByTestId("avatar-caption")).toHaveText("Bibo siap", { timeout: 15000 });
  await expect(page.locator(".bubble-user", { hasText: "berhenti" })).toHaveCount(0);
});

test("voice-neg-yes: 'ya' tanpa permission = teks biasa", async ({ page }) => {
  await onboardStt(page, "/tmp/e2e-voice-negyes");
  await micHold(page, 400);
  await page.evaluate(() => window.__stt?.final("ya"));
  await micRelease(page);
  await expect(page.locator(".bubble-user", { hasText: "ya" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("voice-toast")).toHaveCount(0);
});

test("voice-neg-substring: 'jangan berhenti di baris 3' bukan interrupt", async ({ page }) => {
  await onboardStt(page, "/tmp/e2e-voice-negsub");
  await page.getByTestId("chat-input").fill("tulis cerita sangat panjang tanpa henti");
  await page.getByTestId("send-btn").click();
  await page.waitForTimeout(1500);
  await micHold(page, 400);
  await page.evaluate(() => window.__stt?.final("jangan berhenti di baris 3"));
  await micRelease(page);
  // Diteruskan sebagai teks: bubble muncul, TIDAK ada toast interrupt.
  await expect(page.locator(".bubble-user", { hasText: "jangan berhenti di baris 3" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("voice-toast")).toHaveCount(0);
});
