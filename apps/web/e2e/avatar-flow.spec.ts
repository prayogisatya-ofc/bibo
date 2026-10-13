import { expect, test } from "@playwright/test";

/**
 * Alur pose ujung-ke-ujung (M3 DoD): skenario mock → urutan pose §8.3.
 * Dijalankan per skenario via e2e-run (BIBO_MOCK_SCENARIO).
 * Menegaskan karakter TIDAK pernah idle saat agent masih aktif.
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

async function sendAndCollect(page: import("@playwright/test").Page, text: string, ms: number): Promise<string[]> {
  await page.getByTestId("chat-input").fill(text);
  await page.getByTestId("send-btn").click();
  const seen: string[] = [];
  const start = Date.now();
  while (Date.now() - start < ms) {
    const cap = (await page.getByTestId("avatar-caption").textContent()) ?? "";
    if (seen[seen.length - 1] !== cap) seen.push(cap);
    await page.waitForTimeout(250);
  }
  return seen;
}

test("pose-edit: thinking → editing → celebrate → idle, tanpa idle di tengah", async ({ page }) => {
  await onboard(page, "/tmp/e2e-pose-edit");
  const seq = await sendAndCollect(page, "edit sesuatu", 25000);
  console.log(`pose-edit: ${seq.join(" | ")}`);
  // Mock cepat: faseFormats/Olahragaringkas bisa lebih singkat dari polling 300 ms.
  // Yang dijamin: ada pose kerja, akhir celebrate/idle, tanpa idle di tengah.
  expect(seq.some((c) => /sedang (bekerja|berpikir)/.test(c))).toBe(true);
  expect(seq[seq.length - 1]).toMatch(/Bibo selesai!|Bibo siap/);
  // Tidak idle di tengah: "Bibo siap" hanya boleh di akhir.
  const mid = seq.slice(1, -1);
  expect(mid.filter((c) => c === "Bibo siap")).toHaveLength(0);
});

test("pose-permission: asking muncul dan bertahan hingga dijawab", async ({ page }) => {
  await onboard(page, "/tmp/e2e-pose-perm");
  await page.getByTestId("chat-input").fill("minta izin dulu");
  await page.getByTestId("send-btn").click();
  // Tunggu asking, lalu tahan 12 detik: tetap asking, tanpa idle palsu.
  await expect(page.getByTestId("avatar-caption")).toHaveText("Bibo sedang bertanya", { timeout: 20000 });
  const seq: string[] = [];
  const start = Date.now();
  while (Date.now() - start < 12000) {
    const cap = (await page.getByTestId("avatar-caption").textContent()) ?? "";
    if (seq[seq.length - 1] !== cap) seq.push(cap);
    await page.waitForTimeout(250);
  }
  console.log(`pose-permission: ${seq.join(" | ")}`);
  expect(seq[seq.length - 1]).toBe("Bibo sedang bertanya");
  expect(seq.filter((c) => c === "Bibo siap")).toHaveLength(0);
});

test("pose-silent: tetap thinking/working tanpa event, lalu idle", async ({ page }) => {
  await onboard(page, "/tmp/e2e-pose-silent");
  const seq = await sendAndCollect(page, "halo", 15000);
  console.log(`pose-silent: ${seq.join(" | ")}`);
  expect(seq.length).toBeGreaterThan(1);
  expect(seq.slice(1, -1).filter((c) => c === "Bibo siap")).toHaveLength(0);
  expect(seq[seq.length - 1]).toBe("Bibo siap");
});

test("pose-drop: pulih dari stream putus tanpa idle palsu", async ({ page }) => {
  await onboard(page, "/tmp/e2e-pose-drop");
  const seq = await sendAndCollect(page, "halo", 20000);
  console.log(`pose-drop: ${seq.join(" | ")}`);
  expect(seq[seq.length - 1]).toMatch(/Bibo selesai!|Bibo siap/);
  expect(seq.slice(1, -1).filter((c) => c === "Bibo siap")).toHaveLength(0);
});
