import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const MOCK_PORT = 4499;
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`;

const BUN = process.env["BUN"] ?? "/home/trytoup/.bun/bin/bun";

let mock: ChildProcess | undefined;

async function waitFor(fn: () => Promise<boolean>, ms: number, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timeout: ${label}`);
}

async function httpGet(path: string): Promise<boolean> {
  try {
    const r = await fetch(`${MOCK_URL}${path}`);
    return r.ok;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  // Bersihkan sisa proses dari run sebelumnya.
  try {
    const { execSync } = await import("node:child_process");
    for (let p = 4321; p <= 4340; p++) {
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
    await new Promise((r) => setTimeout(r, 1000));
  } catch {
    // abaikan
  }
  mock = spawn(BUN, ["run", "./src/server.ts"], {
    cwd: join(ROOT, "..", "..", "tools", "mock-opencode"),
    env: { ...process.env, MOCK_PORT: String(MOCK_PORT) },
    stdio: "pipe",
  });
  // Direktori sesi uji harus ada (server nyata 500 bila tak ada).
  for (const d of ["/tmp/mock-simple", "/tmp/mock-perm", "/tmp/mock-drop", "/tmp/mock-silent", "/tmp/mock-int"]) {
    await mkdir(d, { recursive: true });
  }
  await waitFor(() => httpGet("/api/info"), 15000, "mock start");
}, 20000);

afterAll(() => {
  mock?.kill();
});

interface Ctx {
  proc: ChildProcess;
  ws: WebSocket;
  received: Array<{ type: string; [k: string]: unknown }>;
  dataDir: string;
  port: number;
}

let bridgeSeq = 0;

async function startBridge(scenario: string): Promise<Ctx> {
  const port = 4321 + bridgeSeq++;
  const dataDir = join(ROOT, "..", "..", "..", ".tmp-test", `bridge-${port}`);
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
      OPENCODE_URL: MOCK_URL,
      CODEPET_MOCK_SCENARIO: scenario,
    },
    stdio: "pipe",
  });
  proc.stderr?.on("data", () => {});
  await waitFor(async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      return r.ok;
    } catch {
      return false;
    }
  }, 15000, "bridge start");
  const token = (await readFile(join(dataDir, "token"), "utf-8")).trim();
  const received: Ctx["received"] = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", (e) => reject(e));
  });
  ws.on("message", (d) => {
    received.push(JSON.parse(String(d)) as Ctx["received"][number]);
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

async function waitType(c: Ctx, type: string, ms: number): Promise<{ type: string; [k: string]: unknown }> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const hit = c.received.find((m) => m.type === type);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timeout menunggu ${type}; diterima: ${[...new Set(c.received.map((m) => m.type))].join(",")}`);
}

async function waitPhase(c: Ctx, phase: string, ms: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const states = c.received.filter((m) => m.type === "agent.state").reverse();
    if (states[0] && (states[0]["state"] as { phase?: string }).phase === phase) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timeout menunggu phase=${phase}`);
}

describe("bridge ↔ mock-opencode", () => {
  it("simple-answer: prompt → text.final + idle", async () => {
    const c = await startBridge("simple-answer");
    try {
      send(c.ws, { type: "hello", clientVersion: "t" });
      await waitType(c, "bridge.ready", 5000);
      send(c.ws, { type: "session.select", directory: "/tmp/mock-simple" });
      await waitType(c, "agent.state", 5000);
      send(c.ws, { type: "user.message", text: "halo", source: "chat", locale: "id-ID" });
      const fin = await waitType(c, "agent.text.final", 20000);
      expect(String(fin["text"]).length).toBeGreaterThan(0);
      await waitPhase(c, "idle", 20000);
    } finally {
      stopBridge(c);
    }
  }, 60000);

  it("permission-medium: requested → reject → idle", async () => {
    const c = await startBridge("permission-medium");
    try {
      send(c.ws, { type: "hello", clientVersion: "t" });
      await waitType(c, "bridge.ready", 5000);
      send(c.ws, { type: "session.select", directory: "/tmp/mock-perm" });
      await waitType(c, "agent.state", 5000);
      send(c.ws, { type: "user.message", text: "run it", source: "chat", locale: "id-ID" });
      const req = await waitType(c, "permission.requested", 20000);
      expect(String(req["requestID"])).toMatch(/^per_/);
      send(c.ws, { type: "permission.reply", requestID: req["requestID"], decision: "reject", via: "click" });
      await waitPhase(c, "idle", 20000);
    } finally {
      stopBridge(c);
    }
  }, 60000);

  it("stream-drop: tetap final + idle setelah reconnect", async () => {
    const c = await startBridge("stream-drop");
    try {
      send(c.ws, { type: "hello", clientVersion: "t" });
      await waitType(c, "bridge.ready", 5000);
      send(c.ws, { type: "session.select", directory: "/tmp/mock-drop" });
      await waitType(c, "agent.state", 5000);
      send(c.ws, { type: "user.message", text: "halo", source: "chat", locale: "id-ID" });
      await waitType(c, "agent.text.final", 25000);
      await waitPhase(c, "idle", 25000);
    } finally {
      stopBridge(c);
    }
  }, 60000);

  it("silent-events: idle via polling walau tanpa event", async () => {
    const c = await startBridge("silent-events");
    try {
      send(c.ws, { type: "hello", clientVersion: "t" });
      await waitType(c, "bridge.ready", 5000);
      send(c.ws, { type: "session.select", directory: "/tmp/mock-silent" });
      await waitType(c, "agent.state", 5000);
      send(c.ws, { type: "user.message", text: "halo", source: "chat", locale: "id-ID" });
      await waitPhase(c, "busy", 8000);
      await waitPhase(c, "idle", 20000);
    } finally {
      stopBridge(c);
    }
  }, 60000);

  it("NFR-SEC-01: WS origin salah ditolak", async () => {
    const c = await startBridge("simple-answer");
    try {
      const bad = new WebSocket(`ws://127.0.0.1:${c.port}/ws?token=salah`);
      const closed = await new Promise<number>((resolve) => {
        bad.on("close", (code) => resolve(code));
        bad.on("error", () => resolve(-1));
        setTimeout(() => resolve(-2), 5000);
      });
      expect([4401, -1]).toContain(closed);
    } finally {
      stopBridge(c);
    }
  }, 30000);

  it("NFR-SEC-01: WS origin salah ditolak", async () => {
    const c = await startBridge("simple-answer");
    try {
      const token = (await readFile(join(c.dataDir, "token"), "utf-8")).trim();
      const bad = new WebSocket(`ws://127.0.0.1:${c.port}/ws?token=${token}`, { origin: "http://evil.example" });
      const closed = await new Promise<number>((resolve) => {
        bad.on("close", (code) => resolve(code));
        bad.on("error", () => resolve(-1));
        setTimeout(() => resolve(-2), 5000);
      });
      expect([4403, -1]).toContain(closed);
    } finally {
      stopBridge(c);
    }
  }, 30000);

  it("interrupt: agent.interrupt → idle", async () => {
    const c = await startBridge("interrupt");
    try {
      send(c.ws, { type: "hello", clientVersion: "t" });
      await waitType(c, "bridge.ready", 5000);
      send(c.ws, { type: "session.select", directory: "/tmp/mock-int" });
      await waitType(c, "agent.state", 5000);
      send(c.ws, { type: "user.message", text: "write a long story", source: "chat", locale: "id-ID" });
      await waitPhase(c, "busy", 8000);
      send(c.ws, { type: "agent.interrupt" });
      await waitPhase(c, "idle", 20000);
    } finally {
      stopBridge(c);
    }
  }, 60000);

  it("FR-005/server-down: bridge degraded lalu pulih tanpa restart", async () => {
    // Bridge menunjuk ke port mati; ia harus tetap melayani WS dengan status down,
    // lalu up sendiri setelah mock hadir — tanpa restart bridge.
    const deadPort = 4497;
    const port = 4330 + (bridgeSeq % 50);
    const dataDir = join(ROOT, "..", "..", ".tmp-test", `bridge-down-${port}`);
    await rm(dataDir, { recursive: true, force: true });
    await mkdir(dataDir, { recursive: true });
    const proc = spawn(BUN, ["run", "./src/server.ts"], {
      cwd: ROOT,
      env: {
        ...process.env,
        CODEPET_BRIDGE_PORT: String(port),
        CODEPET_DATA_DIR: dataDir,
        OPENCODE_URL: `http://127.0.0.1:${deadPort}`,
      },
      stdio: "pipe",
    });
    try {
      await waitFor(async () => {
        try {
          const r = await fetch(`http://127.0.0.1:${port}/health`);
          return r.ok;
        } catch {
          return false;
        }
      }, 15000, "bridge degraded start");
      const token = (await readFile(join(dataDir, "token"), "utf-8")).trim();
      const received: Array<{ type: string; [k: string]: unknown }> = [];
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", (e) => reject(e));
      });
      ws.on("message", (d) => {
        received.push(JSON.parse(String(d)) as { type: string });
      });
      send(ws, { type: "hello", clientVersion: "t" });
      const ready = await (async () => {
        const start = Date.now();
        while (Date.now() - start < 8000) {
          const hit = received.find((m) => m.type === "bridge.ready");
          if (hit) return hit as unknown as { opencode: { status: string } };
          await new Promise((r) => setTimeout(r, 150));
        }
        throw new Error("no bridge.ready");
      })();
      expect(ready.opencode.status).toBe("down");
      // Hadirkan mock di port mati → bridge harus pulih sendiri ≤15 s.
      const mock2 = spawn(BUN, ["run", "./src/server.ts"], {
        cwd: join(ROOT, "..", "..", "tools", "mock-opencode"),
        env: { ...process.env, MOCK_PORT: String(deadPort) },
        stdio: "pipe",
      });
      try {
        const start = Date.now();
        let up = false;
        while (Date.now() - start < 25000) {
          const hit = received.filter((m) => m.type === "bridge.status").reverse()[0] as
            | { opencode?: string }
            | undefined;
          if (hit?.opencode === "up") {
            up = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
        expect(up).toBe(true);
      } finally {
        mock2.kill();
      }
      ws.close();
    } finally {
      proc.kill();
    }
  }, 90000);

  it("DIR_NOT_FOUND: direktori tak ada ditolak jelas", async () => {
    const c = await startBridge("simple-answer");
    try {
      send(c.ws, { type: "hello", clientVersion: "t" });
      await waitType(c, "bridge.ready", 5000);
      send(c.ws, { type: "session.select", directory: "/tmp/pasti-tidak-ada-xyz-123" });
      const err = await waitType(c, "error", 8000);
      expect(err["code"]).toBe("DIR_NOT_FOUND");
    } finally {
      stopBridge(c);
    }
  }, 30000);
});
