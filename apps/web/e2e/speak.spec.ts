import { expect, test } from "@playwright/test";

/**
 * E2E suara M4 dengan TTS dipalsukan (e2e/stub-speech.js).
 * Butuh stack mock simple-answer + bridge + web (lihat e2e-run).
 */

async function onboard(page: import("@playwright/test").Page, dir: string): Promise<void> {
  await page.addInitScript({ path: "e2e/stub-speech.js" });
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

test("speak: ack dulu lalu ringkasan, tanpa kode/speak-tag", async ({ page }) => {
  await onboard(page, "/tmp/e2e-speak");
  await page.getByTestId("chat-input").fill("halo bibo");
  await page.getByTestId("send-btn").click();
  // Tunggu final + ringkasan terucap.
  await expect(page.getByTestId("chat-count")).not.toHaveText("1", { timeout: 20000 });
  await page.waitForFunction(() => (window.__spoken ?? []).length >= 2, null, { timeout: 20000 });
  const spoken = (await page.evaluate(() => window.__spoken ?? [])) as Array<{ text: string }>;
  expect(spoken.length).toBeGreaterThanOrEqual(2);
  const all = spoken.map((s) => s.text).join("\n");
  expect(all).not.toContain("<speak>");
  expect(all).not.toContain("```");
  const summary = spoken[spoken.length - 1]?.text ?? "";
  expect(summary.split(/(?<=[.!?])\s+/).filter(Boolean).length).toBeLessThanOrEqual(2);
});

test("speak: cancel menghentikan ucapan + animasi bicara", async ({ page }) => {
  await onboard(page, "/tmp/e2e-speak2");
  await page.getByTestId("chat-input").fill("ceritakan yang panjang");
  await page.getByTestId("send-btn").click();
  await page.waitForFunction(() => (window.__spoken ?? []).length >= 1, null, { timeout: 20000 });
  const before = (await page.evaluate(() => (window.__spoken ?? []).length)) as number;
  await page.getByTestId("stop-btn").click();
  await page.waitForTimeout(1200);
  const after = (await page.evaluate(() => (window.__spoken ?? []).length)) as number;
  // Maksimal 1 utterance susulan yang sudah terlanjur jalan; antrean dibuang.
  expect(after - before).toBeLessThanOrEqual(1);
  // Overlay bicara berhenti: data-speaking kembali false (bukan voice-pulse lama).
  const speaking = await page.evaluate(() => document.querySelector('[data-testid="bibo-svg"] svg')?.getAttribute("data-speaking"));
  expect(speaking).toBe("false");
});
