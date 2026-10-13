import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";

/**
 * FITUR C (bridge ↔ mock-opencode): models.list, model.set, penerapan
 * preferredModel ke sesi baru, dan perilaku oc-down yang ramah.
 */

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const MOCK_PORT = 4469;
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;
const DEAD_PORT = 4467;
const BUN = process.env["BUN"] ?? "/home/trytoup/.bun/bin/bun";

let mock: ChildProcess | undefined;
let seq = 0;

async function waitFor(fn: () => Promise<boolean>, ms: number, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timeout: ${label}`);
}

async function httpGet(url: string): Promise<boolean> {
  try {
    const r = await fetch(url);
    return r.ok;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  mock = spawn(BUN, ["run", "./src/server.ts"], {
    cwd: join(ROOT, "..", "..", "tools", "mock-opencode"),
    env: { ...process.env, MOCK_PORT: String(MOCK_PORT) },
    stdio: "pipe",
  });
  for (const d of ["/tmp/mock-model", "/tmp/mock-model-2"]) {
    await mkdir(d, { recursive: true });
  }
  await waitFor(() => httpGet(`${MOCK_URL}/api/info`), 15000, "mock start");
}, 20000);

afterAll(() => {
  mock?.kill();
});

interface Msg {
  type: string;
  [k: string]: unknown;
}
interface Ctx {
  proc: ChildProcess;
  ws: WebSocket;
  received: Msg[];
  dataDir: string;
  port: number;
}

async function startBridge(openCodeUrl: string): Promise<Ctx> {
  const port = 4451 + seq++;
  const dataDir = join(ROOT, "..", "..", ".tmp-test", `bridge-model-${port}`);
  await rm(dataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });
  const proc = spawn(BUN, ["run", "./src/server.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      CODEPET_BRIDGE_PORT: String(port),
      CODEPET_DATA_DIR: dataDir,
      CODEPET_POLL_MS: "500",
      CODEPET_APPROVAL_POLL_MS: "500",
      OPENCODE_URL: openCodeUrl,
      CODEPET_MOCK_SCENARIO: "simple-answer",
    },
    stdio: "pipe",
  });
  proc.stderr?.on("data", () => {});
  await waitFor(() => httpGet(`http://127.0.0.1:${port}/health`), 15000, "bridge start");
  const token = (await readFile(join(dataDir, "token"), "utf-8")).trim();
  const received: Msg[] = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", (e) => reject(e));
  });
  ws.on("message", (d) => {
    received.push(JSON.parse(String(d)) as Msg);
  });
  return { proc, ws, received, dataDir, port };
}

function stopBridge(c: Ctx): void {
  try {
    c.ws.close();
  } catch {
    // abaikan
  }
  c.proc.kill();
}

function send(ws: WebSocket, o: object): void {
  ws.send(JSON.stringify({ v: 1, ...o }));
}

/** Tunggu pesan `type` yang tiba SETELAH indeks `since`; kembalikan yang terakhir. */
async function waitTypeSince(c: Ctx, type: string, since: number, ms: number): Promise<Msg> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const hits = c.received.slice(since).filter((m) => m.type === type);
    if (hits.length > 0) return hits[hits.length - 1]!;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timeout menunggu ${type}`);
}

async function mockSession(sid: string): Promise<{ model?: { id?: string } | null }> {
  const r = await fetch(`${MOCK_URL}/api/session/${sid}`);
  if (!r.ok) throw new Error(`mock session.get ${r.status}`);
  return ((await r.json()) as { data: { model?: { id?: string } | null } }).data;
}

describe("FITUR C: model via WS", () => {
  it("models.list → daftar mock; model.set → switch tercatat + tersimpan", async () => {
    const c = await startBridge(MOCK_URL);
    try {
      send(c.ws, { type: "hello", clientVersion: "t" });
      await waitTypeSince(c, "bridge.ready", 0, 5000);
      let mark = c.received.length;
      send(c.ws, { type: "session.select", directory: "/tmp/mock-model" });
      const ready = await waitTypeSince(c, "bridge.ready", mark, 8000);
      const sid = ready["sessionID"] as string;
      expect(typeof sid).toBe("string");

      mark = c.received.length;
      send(c.ws, { type: "models.list" });
      const listed = await waitTypeSince(c, "models.listed", mark, 8000);
      const models = listed["models"] as Array<{ id: string; name: string; providerID: string }>;
      expect(models.map((m) => m.id)).toEqual(["mock-a", "mock-b", "mock-c"]);
      expect(models[0]).toMatchObject({ name: "Mock A (cepat)", providerID: "mock" });
      expect(listed["current"]).toBeNull();
      expect(listed["error"]).toBeUndefined();

      mark = c.received.length;
      send(c.ws, { type: "model.set", id: "mock-b", providerID: "mock" });
      const after = await waitTypeSince(c, "models.listed", mark, 8000);
      expect(after["current"]).toEqual({ id: "mock-b", providerID: "mock" });
      expect(after["error"]).toBeUndefined();

      // Mock mencatat switch pada sesi aktif.
      const st = await mockSession(sid);
      expect(st.model?.id).toBe("mock-b");

      // Pilihan tersimpan di store bridge.
      const store = JSON.parse(await readFile(join(c.dataDir, "store.json"), "utf-8")) as {
        settings: { preferredModel?: unknown };
      };
      expect(store.settings.preferredModel).toEqual({ id: "mock-b", providerID: "mock" });
    } finally {
      stopBridge(c);
    }
  }, 60000);

  it("sesi baru otomatis memakai preferredModel tersimpan (sekali, diam-diam)", async () => {
    const c = await startBridge(MOCK_URL);
    try {
      send(c.ws, { type: "hello", clientVersion: "t" });
      await waitTypeSince(c, "bridge.ready", 0, 5000);
      let mark = c.received.length;
      send(c.ws, { type: "session.select", directory: "/tmp/mock-model" });
      await waitTypeSince(c, "bridge.ready", mark, 8000);
      mark = c.received.length;
      send(c.ws, { type: "model.set", id: "mock-c", providerID: "mock" });
      await waitTypeSince(c, "models.listed", mark, 8000);

      // Direktori baru → sesi baru dibuat → preferredModel diterapkan otomatis.
      mark = c.received.length;
      send(c.ws, { type: "session.select", directory: "/tmp/mock-model-2" });
      const ready = await waitTypeSince(c, "bridge.ready", mark, 8000);
      const newSid = ready["sessionID"] as string;
      expect(typeof newSid).toBe("string");
      const st = await mockSession(newSid);
      expect(st.model?.id).toBe("mock-c");
    } finally {
      stopBridge(c);
    }
  }, 60000);

  it("oc down → models.listed ramah (models kosong, error OC_DOWN)", async () => {
    const c = await startBridge(`http://127.0.0.1:${DEAD_PORT}`);
    try {
      send(c.ws, { type: "hello", clientVersion: "t" });
      await waitTypeSince(c, "bridge.ready", 0, 8000);
      const mark = c.received.length;
      send(c.ws, { type: "models.list" });
      const listed = await waitTypeSince(c, "models.listed", mark, 8000);
      expect(listed["models"]).toEqual([]);
      expect(listed["current"]).toBeNull();
      expect(listed["error"]).toBe("OC_DOWN");
    } finally {
      stopBridge(c);
    }
  }, 60000);
});
