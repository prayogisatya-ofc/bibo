import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { chromium, type Page } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/**
 * Perbandingan visual fase E (AGENT-PROMPT-AVATAR-UI §E):
 * 3 adegan pada 1280x800 vs docs/reference/shots/, dibandingkan dengan
 * pixelmatch (angka selisih informatif, bukan syarat lolos).
 * Output: docs/reports/avatar-ui/{scene-*.png, side-by-side-*.png, COMPARISON.md}
 *
 *   bun run ./scripts/visual-compare.ts
 */

const BUN = process.env["BUN"] ?? "/home/trytoup/.bun/bin/bun";
const ROOT = new URL("../../..", import.meta.url).pathname;
const OUT = `${ROOT}/docs/reports/avatar-ui`;
const REF = `${ROOT}/docs/reference/shots`;

async function waitOk(url: string, ms: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // coba lagi
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timeout ${url}`);
}

async function freePorts(ports: number[]): Promise<void> {
  const { execSync } = await import("node:child_process");
  for (const p of ports) {
    try {
      const out = execSync(`ss -ltnp 2>/dev/null | grep ":${p} " | grep -oP 'pid=\\K[0-9]+' | head -3`, { encoding: "utf-8" });
      for (const pid of out.split("\n").filter(Boolean)) {
        try {
          execSync(`kill -9 ${pid}`);
        } catch {
          // abaikan
        }
      }
    } catch {
      // abaikan
    }
  }
}

async function onboard(page: Page, dir: string, query = ""): Promise<void> {
  await page.goto(`http://127.0.0.1:5173/${query}`);
  const input = page.getByTestId("dir-input");
  try {
    await input.waitFor({ timeout: 15000 });
  } catch {
    await page.getByTestId("dir-btn").click();
    await input.waitFor({ timeout: 10000 });
  }
  await input.fill(dir);
  await page.getByTestId("dir-go").click();
  await expect0(page.getByTestId("offline-banner"));
}

async function expect0(loc: { count(): Promise<number> }): Promise<void> {
  if ((await loc.count()) !== 0) throw new Error("offline-banner tampil");
}

async function sendChat(page: Page, text: string): Promise<void> {
  await page.getByTestId("chat-input").fill(text);
  await page.getByTestId("send-btn").click();
}

interface Scene {
  id: string;
  ref: string;
  scenario: string;
  dataDir: string;
  run: (page: Page) => Promise<void>;
}

const scenes: Scene[] = [
  {
    id: "a-chat-working",
    ref: "ui-mode-chat.png",
    scenario: "simple-answer",
    dataDir: "/tmp/vis-a",
    run: async (page) => {
      await onboard(page, "/tmp/vis-a");
      await sendChat(page, "jelaskan kode ini");
      // Tangkap saat Bibo bekerja (chip aktivitas tampil).
      await page.getByTestId("activity-chip").waitFor({ timeout: 25000 });
      await page.waitForTimeout(800);
    },
  },
  {
    id: "b-talk-speaking",
    ref: "ui-mode-ngobrol-bicara.png",
    scenario: "simple-answer",
    dataDir: "/tmp/vis-b",
    run: async (page) => {
      await page.addInitScript({ path: `${ROOT}/apps/web/e2e/stub-speech.js` });
      await onboard(page, "/tmp/vis-b", "?stt=fake");
      await page.getByTestId("mode-talk").click();
      await page.locator(".talk-screen").waitFor({ timeout: 10000 });
      // Perintah suara via STT palsu (mode Ngobrol tak punya kolom ketik).
      await page.getByTestId("mic-btn").hover();
      await page.mouse.down();
      await page.waitForTimeout(400);
      await page.evaluate(() => (window as unknown as { __stt?: { final(t: string): void } }).__stt?.final("ceritakan hasilnya"));
      await page.mouse.up();
      // Bubble ucapan muncul saat TTS (stub) berbicara; potret secepatnya.
      await page.getByTestId("speech-bubble").waitFor({ timeout: 30000 });
    },
  },
  {
    id: "c-talk-permission",
    ref: "ui-mode-ngobrol-izin.png",
    scenario: "permission-medium",
    dataDir: "/tmp/vis-c",
    run: async (page) => {
      await onboard(page, "/tmp/vis-c");
      await page.getByTestId("mode-talk").click();
      await page.locator(".talk-screen").waitFor({ timeout: 10000 });
      await page.getByTestId("mode-chat").click();
      await sendChat(page, "jalankan perintah itu");
      await page.getByTestId("approval").waitFor({ timeout: 25000 });
      await page.getByTestId("mode-talk").click();
      await page.getByTestId("approval").waitFor({ timeout: 10000 });
      await page.waitForTimeout(800); // animasi pindah mode selesai
    },
  },
];

async function main(): Promise<void> {
  const procs: ChildProcess[] = [];
  await freePorts([4498, 4317, 5173]);
  // Jangan hapus seluruh OUT: GHERKIN.md/PERF.md/A11Y.md juga tinggal di sini.
  await mkdir(OUT, { recursive: true });

  const runProc = (cmd: string, args: string[], cwd: string, env: Record<string, string>): ChildProcess => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "pipe" });
    p.stderr?.on("data", () => {});
    procs.push(p);
    return p;
  };

  try {
    runProc(BUN, ["run", "./src/server.ts"], `${ROOT}/tools/mock-opencode`, { MOCK_PORT: "4498", MOCK_LOG: "0" });
    await waitOk("http://127.0.0.1:4498/api/info", 15000);
    runProc(BUN, ["run", "preview", "--port", "5173"], `${ROOT}/apps/web`, {});
    await waitOk("http://127.0.0.1:5173/", 30000);

    const browser = await chromium.launch();
    const results: Array<{ id: string; ref: string; app: string; diffPx: number; pct: string }> = [];

    for (const scene of scenes) {
      // Bridge per adegan (skenario + data dir segar).
      await rm(scene.dataDir, { recursive: true, force: true });
      await mkdir(scene.dataDir, { recursive: true });
      const bridge = runProc(BUN, ["run", "./src/server.ts"], `${ROOT}/apps/bridge`, {
        BIBO_BRIDGE_PORT: "4317",
        BIBO_DATA_DIR: scene.dataDir,
        OPENCODE_URL: "http://127.0.0.1:4498",
        BIBO_MOCK_SCENARIO: scene.scenario,
        BIBO_POLL_MS: "500",
        BIBO_APPROVAL_POLL_MS: "500",
      });
      await waitOk("http://127.0.0.1:4317/health", 15000);

      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const appPath = `${OUT}/scene-${scene.id}.png`;
      try {
        await scene.run(page);
        await page.screenshot({ path: appPath });
        console.log(`OK ${scene.id}`);
      } catch (e) {
        console.log(`GAGAL ${scene.id}: ${e instanceof Error ? e.message : e}`);
        await page.screenshot({ path: appPath });
      }
      await page.close();
      bridge.kill();
      await new Promise((r) => setTimeout(r, 1500));

      // Bandingkan dengan referensi.
      const refPath = `${REF}/${scene.ref}`;
      const diffPath = `${OUT}/diff-${scene.id}.png`;
      const sidePath = `${OUT}/side-by-side-${scene.id}.png`;
      const refImg = PNG.sync.read(await readFile(refPath));
      const appImg = PNG.sync.read(await readFile(appPath));
      const w = Math.min(refImg.width, appImg.width);
      const h = Math.min(refImg.height, appImg.height);
      const diff = new PNG({ width: w, height: h });
      const diffPx = pixelmatch(refImg.data, appImg.data, diff.data, w, h, { threshold: 0.1 });
      await writeFile(diffPath, PNG.sync.write(diff));
      // Komposit berdampingan: referensi | aplikasi | diff.
      const side = new PNG({ width: w * 3, height: h });
      PNG.bitblt(refImg, side, 0, 0, w, h, 0, 0);
      PNG.bitblt(appImg, side, 0, 0, w, h, w, 0);
      PNG.bitblt(diff, side, 0, 0, w, h, w * 2, 0);
      await writeFile(sidePath, PNG.sync.write(side));
      const pct = ((diffPx / (w * h)) * 100).toFixed(2);
      console.log(`${scene.id}: diff ${diffPx}px (${pct}%)`);
      results.push({ id: scene.id, ref: scene.ref, app: `scene-${scene.id}.png`, diffPx, pct });
    }
    await browser.close();

    const lines = [
      "# Perbandingan Visual — Avatar + UI (fase E)",
      "",
      `Tanggal: ${new Date().toISOString().slice(0, 10)} · viewport 1280x800 · pixelmatch threshold 0.1`,
      "Angka selisih bersifat informatif (teks dinamis), bukan syarat lolos.",
      "",
      "| Adegan | Referensi | Aplikasi | Piksel beda | % | Side-by-side |",
      "|---|---|---|---|---|---|",
      ...results.map(
        (r) =>
          `| ${r.id} | ${r.ref} | ${r.app} | ${r.diffPx} | ${r.pct}% | side-by-side-${r.id}.png |`,
      ),
      "",
      "## Catatan",
      "- (a) working di Mode Chat: ditangkap saat chip aktivitas tampil.",
      "- (b) ringkasan diucapkan di Mode Ngobrol: bubble ucapan saat TTS (stub) berbicara.",
      "- (c) izin medium di Mode Ngobrol: popup di bawah Bibo + petunjuk suara.",
    ];
    await writeFile(`${OUT}/COMPARISON.md`, lines.join("\n") + "\n");
    console.log("COMPARISON.md ditulis");
  } finally {
    for (const p of procs) {
      try {
        p.kill();
      } catch {
        // abaikan
      }
    }
    await freePorts([4498, 4317, 5173]);
  }
}

main().catch((e) => {
  console.error("VISUAL FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
