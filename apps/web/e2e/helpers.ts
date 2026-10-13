import type { Page } from "@playwright/test";

/**
 * Buka dialog folder (bila belum terbuka) dan pilih `dir` lewat Jelajahi:
 * ketik di input manual → Enter (memuat), lalu klik "Pilih folder ini".
 * Selanjutnya klik "Sesi baru" agar session.select terkirim.
 *
 * Dipakai semua E2E agar perubahan dialog tak merembet ke tiap test.
 */
export async function onboardDir(page: Page, dir: string): Promise<void> {
  // Dialog awal muncul otomatis saat bridge.ready tanpa directory.
  // Bila sudah onboarded sebelumnya, buka manual via chip folder.
  const browse = page.getByTestId("dir-browse");
  try {
    await browse.waitFor({ timeout: 15000 });
  } catch {
    await page.getByTestId("dir-btn").click();
    await browse.waitFor({ timeout: 10000 });
  }
  await browse.click();
  const input = page.getByTestId("dir-picker-input");
  await input.waitFor({ timeout: 10000 });
  await input.fill(dir);
  await input.press("Enter");
  // Tunggu daftar isi/breadcrumb siap sebelum menekan "Pilih".
  await page.getByTestId("dir-picker-select").waitFor({ timeout: 10000 });
  // Beri waktu /api/dirs merespons agar `cur` ter-set.
  await page.waitForTimeout(300);
  await page.getByTestId("dir-picker-select").click();
  await page.getByTestId("sess-new").click();
}
