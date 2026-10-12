import { expect, test } from "@playwright/test";
import { AVATAR_POSES } from "@codepet/avatar";

/**
 * Galeri visual M3: tiap pose × tema. Hanya butuh web (tanpa bridge/mock).
 * Screenshot diamati pemilik produk (laporan M3). Hash membuat tiap
 * screenshot deterministik.
 */

test("galeri 14 pose × 2 tema", async ({ page }) => {
  for (const theme of ["dark", "light"] as const) {
    for (const pose of AVATAR_POSES) {
      await page.goto(`/?dev=avatar#pose=${pose}&theme=${theme}&speech=0`);
      await expect(page.getByTestId("dev-caption")).toContainText(pose, { timeout: 10000 });
      await page.waitForTimeout(400); // transisi 400 ms selesai
      await page.getByTestId("dev-stage").screenshot({ path: `gallery/${theme}-${pose.replace(".", "-")}.png` });
    }
  }
  // Overlay bicara: idle + speech 0.8.
  await page.goto("/?dev=avatar#pose=idle&theme=dark&speech=0.8");
  await page.waitForTimeout(400);
  await page.getByTestId("dev-stage").screenshot({ path: "gallery/dark-speaking.png" });
});

test("animasi berjalan ≥30fps (NFR-PERF-04, headless)", async ({ page }) => {
  await page.goto("/?dev=avatar#pose=thinking&theme=dark&speech=0");
  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = (): void => {
          frames++;
          if (performance.now() - start < 2000) requestAnimationFrame(tick);
          else resolve((frames / (performance.now() - start)) * 1000);
        };
        requestAnimationFrame(tick);
      }),
  );
  console.log(`fps=${fps.toFixed(1)}`);
  // FPS gate NFR-PERF-04 (headless Chromium, terukur ~60).
  expect(fps).toBeGreaterThan(55);
});
