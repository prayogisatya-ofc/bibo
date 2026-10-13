import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { WebSocket } from "ws";

/**
 * Klien WS uji untuk DoD M1: hello → session.select → user.message,
 * lalu menunggu agent.text.final + agent.state idle.
 * Token dibaca dari <dataDir>/token (default .bibo).
 *
 *   bun run ./src/cli-test.ts --bridge ws://127.0.0.1:4317 --prompt "..." --dir /tmp/x
 */

function arg(name: string, dflt = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  const v: string | undefined = i >= 0 ? process.argv[i + 1] : undefined;
  return v ?? dflt;
}

async function main(): Promise<void> {
  const target = arg("target", "");
  const bridge = arg("bridge", target === "real" ? "ws://127.0.0.1:4318" : "ws://127.0.0.1:4317");
  const dataDir = arg("dataDir", target === "real" ? "/tmp/breal" : join(process.cwd(), ".bibo"));
  const token = arg("token", (await readFile(join(dataDir, "token"), "utf-8")).trim());
  const prompt = arg("prompt", "Reply with exactly: SMOKE-OK. No tools.");
  const dir = arg("dir", "/tmp/bibo-smoke");
  const timeoutMs = Number(arg("timeout", "90000"));

  const ws = new WebSocket(`${bridge}/ws?token=${token}`);
  const seen: string[] = [];
  let finalText = "";
  let lastPhase = "";
  const done = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout menunggu final (phase=${lastPhase})`)), timeoutMs);
    ws.on("open", () => {
      ws.send(JSON.stringify({ v: 1, type: "hello", clientVersion: "cli-test" }));
    });
    ws.on("message", (data) => {
      const m = JSON.parse(String(data)) as { type: string; [k: string]: unknown };
      seen.push(m.type);
      if (m.type === "bridge.ready") {
        ws.send(JSON.stringify({ v: 1, type: "session.select", directory: dir }));
      } else if (m.type === "agent.state") {
        const st = m["state"] as { phase?: string };
        lastPhase = st.phase ?? "";
        if (lastPhase === "idle" && finalText) {
          clearTimeout(timer);
          resolve();
        }
      } else if (m.type === "agent.text.final") {
        finalText = String(m["text"]);
        if (lastPhase === "idle") {
          clearTimeout(timer);
          resolve();
        }
      } else if (m.type === "error") {
        clearTimeout(timer);
        reject(new Error(`bridge error: ${JSON.stringify(m)}`));
      }
      // Kirim prompt sekali setelah state pertama tiba.
      if (m.type === "agent.state" && !(globalThis as { __sent?: boolean }).__sent) {
        (globalThis as { __sent?: boolean }).__sent = true;
        ws.send(JSON.stringify({ v: 1, type: "user.message", text: prompt, source: "chat", locale: "id-ID" }));
      }
    });
    ws.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });

  try {
    await done;
  } finally {
    ws.close();
  }
  console.log(`SMOKE OK state=${lastPhase} final=${JSON.stringify(finalText).slice(0, 120)} types=${[...new Set(seen)].join(",")}`);
}

main().catch((e) => {
  console.error("SMOKE FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
