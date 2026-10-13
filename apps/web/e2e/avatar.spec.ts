import { expect, test } from "@playwright/test";
import { AVATAR_POSES } from "@bibo/avatar";

/**
 * Galeri visual (fase E, CHARACTER.md §14): tiap pose × tema, dibekukan
 * (?freeze) agar deterministik. Hanya butuh web (tanpa bridge/mock).
 * Dijalankan via `bun run e2e-gallery` (lihat package.json).
 */

const WORKING_VARIANTS = ["typing", "reading", "running", "searching", "delegating", "generic"] as const;

test("galeri 9 pose × 2 tema (beku, deterministik)", async ({ page }) => {
  for (const theme of ["dark", "light"] as const) {
    for (const pose of AVATAR_POSES) {
      const variants = pose === "working" ? WORKING_VARIANTS : ([undefined] as const);
      for (const variant of variants) {
        const q = new URLSearchParams({
          dev: "avatar",
          pose,
          theme,
          speech: "0",
          seed: "1234",
          freeze: "1200",
        });
        if (variant) q.set("variant", variant);
        await page.goto(`/?${q.toString()}`);
        await expect(page.getByTestId("dev-caption")).toContainText(pose, { timeout: 10000 });
        await page.waitForTimeout(1400); // freeze diterapkan setelah 1200 ms
        const name = variant ? `${pose}-${variant}` : pose;
        await page.getByTestId("dev-stage").screenshot({ path: `gallery/${theme}-${name}.png` });
      }
    }
  }
  // Overlay bicara: idle + speech 0.8 (mulut parametris + busur suara).
  await page.goto("/?dev=avatar&pose=idle&theme=dark&speech=0.8&seed=1234&freeze=1200");
  await page.waitForTimeout(1400);
  await page.getByTestId("dev-stage").screenshot({ path: "gallery/dark-speaking.png" });
});

test("animasi berjalan ≥30fps (NFR-PERF-04, headless)", async ({ page }) => {
  await page.goto("/?dev=avatar&pose=thinking&theme=dark&speech=0&seed=1234");
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
