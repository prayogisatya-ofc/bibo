import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import { createGateway } from "./ws.js";
import {
  type AgentSignal,
  type BridgePayload,
  type WebMessage,
  agentState,
  webMessage,
} from "@codepet/protocol";
import { loadConfig } from "./config.js";
import { connect, type OpenCodeClient } from "./opencode/client.js";
import { EventNormalizer, type RawEvent } from "./opencode/normalize.js";
import { createPump } from "./opencode/pump.js";
import { createPoller } from "./opencode/poller.js";
import { createReducer } from "./state/reducer.js";
import { SpeakTracker } from "./speech/parse-speak.js";
import {
  VOICE_INSTRUCTION_KEY,
  VOICE_INSTRUCTION_VALUE,
  generateWithTimeout,
  phrase,
  summarize,
  summaryModeFromEnv,
} from "./speech/summarize.js";
import { toolTitle } from "./state/feed.js";
import { classifyRisk } from "./safety/risk.js";
import { ALWAYS_NOT_ALLOWED, VOICE_NOT_ALLOWED, guardReply, logDecision } from "./safety/guard.js";
import { ReminderTracker } from "./safety/remind.js";
import { loadStore, saveStore, rememberDir, type BridgeStoreData } from "./store.js";
import { DirHttpError, listDir, resolveDirPath } from "./fs/dirs.js";

const VERSION = "0.1.0-m1";

/** Nilai default: pakai model default server OpenCode (tidak di-pin bridge). */

async function main(): Promise<void> {
  const config = loadConfig();
  const token = randomBytes(24).toString("hex");
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(join(config.dataDir, "token"), token);
  const store: BridgeStoreData = await loadStore(config.dataDir);

  // Koneksi OpenCode malas + retry (FR-005): bridge tetap melayani WS/HTTP
  // dengan status down bila server belum ada, pulih otomatis saat muncul.
  let oc: { client: OpenCodeClient; version: string } | undefined;
  const ocStatus = (): "up" | "down" => (oc ? "up" : "down");
  const ocVersion = (): string | undefined => oc?.version;

  const normalizer = new EventNormalizer();
  const reducer = createReducer();
  let directory = "";
  let sessionID: string | undefined;
  const seenPermissions = new Set<string>();
  const seenForms = new Set<string>();
  let seenActive = false;
  let activeMisses = 0;
  let turnStartedAt = 0;
  const tracker = new SpeakTracker();
  const speakByMessage = new Map<string, string[]>();
  let lastAssistantText = "";
  let lastDiffFiles: Array<{ path: string }> = [];
  let lastProgressAt = 0;
  const summaryMode = summaryModeFromEnv(process.env["CODEPET_SUMMARY_MODE"]);

  function speechLocale(): "id" | "en" {
    return store.settings["locale"] === "en" ? "en" : "id";
  }

  function verbosity(): "silent" | "normal" | "cerewet" {
    const v = store.settings["verbosity"];
    return v === "silent" || v === "cerewet" ? v : "normal";
  }

  function broadcast(msg: BridgePayload): void {
    gateway.broadcast(msg);
  }
  function pushState(): void {
    broadcast({ type: "agent.state", state: agentState.parse(reducer.state) });
  }

/** Form sudah settled (dijawab/dibatalkan/kedaluwarsa): kenali dari error server. */
function isSettledError(e: unknown): boolean {
  const s = JSON.stringify(e ?? "").slice(0, 500);
  return /FormAlreadySettled|FormNotFound|FormInvalidAnswer|no form|not found|settled/i.test(s);
}
  function needClient(send: (m: BridgePayload) => void): OpenCodeClient | undefined {
    if (!oc) {
      send({ type: "error", code: "OPENCODE_DOWN", message: "OpenCode tidak terhubung. Menunggu server…", recoverable: true });
      return undefined;
    }
    return oc.client;
  }

  function ingest(signal: AgentSignal): void {
    // Saring event sesi lain (stream global — ADR-007).
    // permission.replied / form.replied tak membawa sessionID: selalu proses
    // (id-nya unik per request; filter tak dikenal diabaikan reducer).
    const sid =
      signal.t === "permission.replied" || signal.t === "form.replied" || signal.t === "conn"
        ? undefined
        : signal.t === "permission.asked"
          ? signal.request.sessionID
          : signal.t === "form.asked"
            ? signal.form.sessionID
            : signal.sessionID;
    if (sid !== undefined && sessionID !== undefined && sid !== sessionID) return;
    if (signal.t === "permission.asked") {
      // Dedupe per sesi: ID bisa dipakai ulang (terutama replay fixture mock).
      const pkey = `${signal.request.sessionID}:${signal.request.requestID}`;
      if (seenPermissions.has(pkey)) return;
      seenPermissions.add(pkey);
      const risk = classifyRisk({
        action: signal.request.action,
        resources: signal.request.resources,
        directory: directory || undefined,
      });
      signal.request.risk = risk;
      signal.request.voiceAllowed = risk !== "high";
    }
    if (signal.t === "form.asked") {
      const fkey = `${signal.form.sessionID}:${signal.form.formID}`;
      if (seenForms.has(fkey)) return;
      seenForms.add(fkey);
    }
    const { state, emit } = reducer.reduce(signal);
    void state;
    pushState();
    if (signal.t === "tool.started" && verbosity() === "cerewet" && Date.now() - lastProgressAt > 8000) {
      lastProgressAt = Date.now();
      broadcast({
        type: "agent.speak",
        id: `spk-${Date.now()}`,
        text: `Aku lagi ${toolTitle(signal.tool).toLowerCase()}…`,
        priority: "normal",
        kind: "summary",
      });
    }
    if (signal.t === "exec.ended" && signal.outcome === "success" && sessionID) {
      const sid = sessionID;
      void (async () => {
        try {
          const diff = oc?.client ? await oc.client.session.diff({ sessionID: sid }) : [];
          const files = (Array.isArray(diff) ? diff : []).map((f) => ({
            path: String((f as { path?: unknown }).path ?? "?"),
            additions: Number((f as { additions?: unknown }).additions ?? 0),
            deletions: Number((f as { deletions?: unknown }).deletions ?? 0),
          }));
          if (files.length > 0) broadcast({ type: "diff.ready", sessionID: sid, files });
          lastDiffFiles = files;
        } catch {
          // diff opsional; diam bila gagal.
        }
        // Ringkasan lisan (FR-022): tag → generate → heuristik.
        if (verbosity() === "silent") return;
        try {
          const tagSpeak = [...speakByMessage.values()].flat().at(-1);
          const result = await summarize(
            {
              text: tagSpeak ?? lastAssistantText,
              files: lastDiffFiles,
              locale: speechLocale(),
              generate: (prompt) =>
                oc?.client
                  ? generateWithTimeout(oc.client, sid, prompt, 8000)
                  : Promise.reject(new Error("offline")),
            },
            tagSpeak ? "tag" : summaryMode,
          );
          broadcast({
            type: "agent.speak",
            id: `spk-${Date.now()}`,
            text: result.text,
            priority: "normal",
            kind: "summary",
          });
        } catch {
          // ringkasan opsional; diam bila gagal.
        }
      })();
    }
    if (emit.textDelta) {
      broadcast({ type: "agent.text.delta", messageID: emit.textDelta.messageID, text: emit.textDelta.text });
    }
    if (emit.textFinal) {
      broadcast({ type: "agent.text.final", messageID: emit.textFinal.messageID, text: emit.textFinal.text });
    }
    if (emit.feed) {
      broadcast({
        type: "feed.item",
        item: { ...emit.feed, detail: emit.feed.detail ?? undefined },
      });
    }
    if (emit.speak) {
      const last = reducer.state.pendingPermissions.at(-1);
      if (signal.t === "permission.asked" && last) {
        broadcast({
          type: "permission.requested",
          requestID: last.requestID,
          tool: last.tool,
          title: last.title,
          patterns: last.patterns,
          preview: last.preview,
          risk: last.risk,
          voiceAllowed: last.voiceAllowed,
        });
        // Ucapan permintaan izin (urgent, FR-040): ringkas apa+di mana;
        // risiko high: arahkan konfirmasi ke layar.
        const ask =
          last.risk === "high"
            ? `Ini perintah berbahaya: ${(last.patterns[0] ?? last.tool).slice(0, 80)}. Tolong konfirmasi lewat layar ya.`
            : last.title;
        broadcast({ type: "agent.speak", id: `spk-${Date.now()}`, text: ask, priority: "urgent", kind: "ask" });
      }
      const lastForm = reducer.state.pendingForms.at(-1);
      if (signal.t === "form.asked" && lastForm) {
        broadcast({ type: "form.requested", formID: lastForm.formID, title: lastForm.title, fields: lastForm.fields });
      }
      if (signal.t !== "permission.asked" && signal.t !== "form.asked") {
        const urgent = emit.speak.kind === "ask" || emit.speak.kind === "error";
        broadcast({
          type: "agent.speak",
          id: `spk-${Date.now()}`,
          text: emit.speak.text,
          priority: urgent ? "urgent" : "normal",
          kind: emit.speak.kind,
        });
      }
    }
  }

  function onRawEvent(e: RawEvent): void {
    let signal = normalizer.normalize(e);
    if (!signal) return;
    if (signal.t === "exec.started") {
      seenActive = false; // turn baru: tunggu bukti aktif
      turnStartedAt = Date.now();
    }
    if (signal.t === "text.delta") {
      const add = tracker.push(signal.messageID, signal.text);
      if (!add) return; // belum aman tampil (di dalam <speak>)
      signal = { ...signal, text: add };
    } else if (signal.t === "text.done") {
      const { display, speak } = tracker.done(signal.messageID);
      if (speak.length > 0) speakByMessage.set(signal.messageID, speak);
      lastAssistantText = display || lastAssistantText;
      signal = { ...signal, text: display };
    }
    ingest(signal);
  }

  async function reconcile(): Promise<void> {
    // Setelah (re)connect: kirim ulang state penuh; polling approvals menangkap
    // izin/form yang eventnya hilang.
    await poller?.pollApprovals();
    pushState();
    broadcast({ type: "bridge.status", opencode: "up" });
  }

  let pump: ReturnType<typeof createPump> | undefined;
  let poller: ReturnType<typeof createPoller> | undefined;
  let activeWatch: ReturnType<typeof setInterval> | undefined;
  let remindTimer: ReturnType<typeof setInterval> | undefined;
  const reminder = new ReminderTracker();

  function wireOpencode(client: OpenCodeClient): void {
    pump = createPump(client, {
      onEvent: onRawEvent,
      onConn: (status) => {
        ingest({ t: "conn", status });
        broadcast({ type: "bridge.status", opencode: status === "connected" ? "up" : status === "down" ? "down" : "reconnecting" });
      },
      onReconnect: reconcile,
    });
    void pump.start(ctl.signal);
    poller = createPoller(client, {
    getSessionID: () => sessionID,
    getDirectory: () => directory || undefined,
    onSignal: ingest,
    // Dedupe otoritatif ada di ingest (per sesi); poller selalu teruskan.
    seenPermission: () => false,
    seenForm: () => false,
  });
    poller.start(config.pollMs, config.approvalPollMs);

    // Pengingat izin/form menunggu >60 s, SEKALI (FR-045). Bukan auto-approve.
    remindTimer = setInterval(() => {
      const ids = [
        ...reducer.state.pendingPermissions.map((p) => p.requestID),
        ...reducer.state.pendingForms.map((f) => f.formID),
      ];
      for (const id of reminder.check(Date.now(), ids)) {
        const perm = reducer.state.pendingPermissions.find((p) => p.requestID === id);
        const text = perm ? `Masih menunggu jawaban untuk: ${perm.title}` : "Masih ada pertanyaan yang menunggu jawaban.";
        broadcast({ type: "agent.speak", id: `spk-${Date.now()}`, text, priority: "urgent", kind: "ask" });
      }
    }, 10_000);

    // Heuristik idle via polling (jaring pengaman silent-events, ADR-007):
    // bila sesi tak lagi di active selama 2 poll berturut-turut padahal reducer
    // masih busy (tanpa pending izin/form), anggap giliran selesai.
    // Anti-balap: hanya setelah sesi TERLIHAT aktif di turn ini, ATAU bila
    // riwayat pesan sudah memuat idle turn ini (burst event terlewat).
    activeMisses = 0;
    activeWatch = setInterval(() => {
      void (async () => {
        if (!sessionID || !poller) return;
        const sid = sessionID;
        const active = await poller.pollActive();
        if (active[sid]) {
          activeMisses = 0;
          seenActive = true;
          return;
        }
        activeMisses++;
        if (reducer.state.phase !== "busy" || activeMisses < 2) return;
        if (seenActive) {
          activeMisses = 0;
          seenActive = false;
          ingest({ t: "exec.ended", sessionID: sid, outcome: "success" });
          return;
        }
        // Burst terlewat? idle di riwayat pesan yang lebih baru dari awal turn.
        try {
          const msgs = await poller.latestMessages(sid, 5);
          const idle = msgs.find(
            (m) => m.type === "idle" && typeof m.time?.created === "number" && (m.time?.created ?? 0) >= turnStartedAt,
          ) as { outcome?: string } | undefined;
          if (idle) {
            const outcome = idle.outcome === "failed" || idle.outcome === "interrupted" ? idle.outcome : "success";
            activeMisses = 0;
            ingest({ t: "exec.ended", sessionID: sid, outcome });
          }
        } catch {
          // abaikan; coba lagi poll berikutnya
        }
      })();
    }, config.pollMs);
  }

  async function sessionMeta(sid: string): Promise<{ agent?: string; model?: string }> {
    try {
      const info = await oc!.client.session.get({ sessionID: sid });
      const meta: { agent?: string; model?: string } = {};
      if (typeof info.agent === "string") meta.agent = info.agent;
      const mid = (info.model as { id?: unknown } | undefined)?.id;
      if (typeof mid === "string") meta.model = mid;
      return meta;
    } catch {
      return {};
    }
  }

  async function ensureSession(dir: string, sid?: string): Promise<string> {
    // Ganti sesi = state baru: reset reducer + dedupe + lacak agar residu
    // sesi lama tak bocor ke sesi baru.
    tracker.reset();
    speakByMessage.clear();
    seenPermissions.clear();
    seenForms.clear();
    lastAssistantText = "";
    lastDiffFiles = [];
    seenActive = false;
    activeMisses = 0;
    reducer.reset();
    pushState();
    if (sid) {
      sessionID = sid;
      directory = dir;
      return sid;
    }
    const prev = store.lastSessionByDir[dir];
    if (prev) {
      try {
        await oc!.client.session.get({ sessionID: prev });
        sessionID = prev;
        directory = dir;
        return prev;
      } catch {
        // sesi lama hilang; buat baru di bawah.
      }
    }
    const created = await oc!.client.session.create({
      title: "CodePet",
      location: { directory: dir },
      // Test hook: pilih skenario mock. Tidak dipakai di produksi.
      ...(process.env["CODEPET_MOCK_SCENARIO"] ? { metadata: { mockScenario: process.env["CODEPET_MOCK_SCENARIO"] } } : {}),
    });
    // Injeksi instruksi suara via instruction entry (cara terverifikasi M0).
    try {
      await oc!.client.session.instructions.entry.put({
        sessionID: created.id,
        key: VOICE_INSTRUCTION_KEY,
        value: VOICE_INSTRUCTION_VALUE,
      });
    } catch {
      // Opsional; lanjut tanpa <speak> bila gagal (fallback generate/heuristik).
    }
    sessionID = created.id;
    directory = dir;
    store.lastSessionByDir[dir] = created.id;
    rememberDir(store, dir);
    await saveStore(config.dataDir, store);
    return created.id;
  }

  async function handleMessage(msg: WebMessage, send: (m: BridgePayload) => void): Promise<void> {
    switch (msg.type) {
      case "hello": {
        const meta = sessionID ? await sessionMeta(sessionID) : {};
        send({
          type: "bridge.ready",
          bridgeVersion: VERSION,
          opencode: { status: ocStatus(), version: ocVersion() },
          directory,
          sessionID,
          recentDirs: store.recentDirs,
          ...meta,
        });
        break;
      }
        send({ type: "agent.state", state: agentState.parse(reducer.state) });
        break;
      case "session.select": {
        if (!oc) {
          send({ type: "error", code: "OPENCODE_DOWN", message: "OpenCode tidak terhubung. Menunggu server…", recoverable: true });
          break;
        }
        try {
          await stat(msg.directory);
        } catch {
          // Server mengembalikan 500 kosong untuk direktori tak ada (M4);
          // cegah dengan pesan yang jelas.
          send({ type: "error", code: "DIR_NOT_FOUND", message: "Folder itu tidak ada. Coba periksa lagi ya.", recoverable: true });
          break;
        }
        const sid = await ensureSession(msg.directory, msg.sessionID);
        // Rekonsiliasi segera sesi baru (izin/form/active terbaru).
        await poller?.pollApprovals();
        send({
          type: "bridge.ready",
          bridgeVersion: VERSION,
          opencode: { status: ocStatus(), version: ocVersion() },
          directory,
          sessionID: sid,
          recentDirs: store.recentDirs,
          ...(await sessionMeta(sid)),
        });
        pushState();
        break;
      }
      case "session.list": {
        const c0 = needClient(send);
        if (!c0) break;
        const list = await c0.session.list({ directory: msg.directory ?? directory ?? undefined });
        const items = Array.isArray(list) ? list : ((list as { data?: unknown[] }).data ?? []);
        send({
          type: "session.listed",
          sessions: (items as Array<{ id?: unknown; title?: unknown; location?: { directory?: unknown } }>)
            .map((x) => ({
              sessionID: typeof x.id === "string" ? x.id : "",
              title: typeof x.title === "string" ? x.title : undefined,
              directory: typeof x.location?.directory === "string" ? (x.location?.directory as string) : undefined,
            }))
            .filter((x) => x.sessionID !== ""),
        });
        break;
      }
      case "user.message": {
        if (!sessionID || !directory) {
          send({ type: "error", code: "NO_SESSION", message: "Pilih direktori dulu (session.select).", recoverable: true });
          break;
        }
        const c1 = needClient(send);
        if (!c1) break;
        await c1.session.prompt({
          sessionID,
          text: msg.text,
          ...(msg.delivery ? { delivery: msg.delivery } : { delivery: "queue" as const }),
        });
        tracker.reset();
        speakByMessage.clear();
        lastAssistantText = "";
        lastDiffFiles = [];
        seenActive = false;
        turnStartedAt = Date.now();
        if (verbosity() !== "silent") {
          broadcast({ type: "agent.speak", id: `spk-${Date.now()}`, text: phrase("ack", speechLocale()), priority: "normal", kind: "ack" });
        }
        ingest({ t: "exec.started", sessionID });
        break;
      }
      case "agent.interrupt": {
        if (!sessionID) break;
        const c2 = needClient(send);
        if (!c2) break;
        await c2.session.interrupt({ sessionID });
        break;
      }
      case "permission.reply": {
        const target = reducer.state.pendingPermissions.find((p) => p.requestID === msg.requestID);
        if (!target || !sessionID) {
          send({ type: "error", code: "UNKNOWN_REQUEST", message: "Permission request tidak dikenal.", recoverable: true });
          break;
        }
        // Penjaga keselamatan (PRD §10.2): tanpa pengecualian.
        const g = guardReply({ risk: target.risk, via: msg.via, decision: msg.decision });
        if (!g.ok) {
          send({ type: "error", code: g.code, message: g.message, recoverable: true });
          break;
        }
        const c3 = needClient(send);
        if (!c3) break;
        await c3.permission.reply({ sessionID, requestID: msg.requestID, decision: msg.decision });
        await logDecision(config.dataDir, {
          requestID: msg.requestID,
          risk: target.risk,
          via: msg.via,
          decision: msg.decision,
        });
        ingest({ t: "permission.replied", requestID: msg.requestID, decision: msg.decision });
        break;
      }
      case "form.reply": {
        if (!sessionID) break;
        const c4 = needClient(send);
        if (!c4) break;
        try {
          await c4.session.form.reply({ sessionID, formID: msg.formID, answer: msg.answer as Record<string, string | number | boolean | string[]> });
        } catch (e) {
          if (isSettledError(e)) {
            ingest({ t: "form.replied", formID: msg.formID });
            send({ type: "error", code: "FORM_SETTLED", message: "Formulir sudah dijawab atau dibatalkan.", recoverable: true });
            break;
          }
          throw e;
        }
        ingest({ t: "form.replied", formID: msg.formID });
        break;
      }
      case "form.cancel": {
        if (!sessionID) break;
        const c5 = needClient(send);
        if (!c5) break;
        await c5.session.form.cancel({ sessionID, formID: msg.formID });
        ingest({ t: "form.replied", formID: msg.formID });
        break;
      }
      case "settings.update": {
        store.settings = { ...store.settings, ...msg.settings };
        await saveStore(config.dataDir, store);
        break;
      }
      case "speech.request_summary":
        send({ type: "error", code: "NOT_IMPLEMENTED", message: "Ringkasan lisan hadir di M4.", recoverable: true });
        break;
    }
  }

  // HTTP (Hono) + WS (ws) di satu server 127.0.0.1.
  const app = new Hono();
  app.get("/health", (c) =>
    c.json({ ok: true, bridge: VERSION, opencode: ocVersion() ?? null, status: ocStatus(), rssMB: Math.round(process.memoryUsage().rss / 1048576) }),
  );
  app.get("/bootstrap", (c) => c.json({ token, port: config.port }));
  // Jelajah folder lokal untuk pemilih folder web (FITUR B).
  // Hanya baca direktori; tidak ada tulis/hapus. CORS tetap pola lokal saja.
  app.get("/api/dirs", async (c) => {
    try {
      const abs = resolveDirPath(c.req.query("path"));
      const entries = await listDir(abs);
      return c.json({ path: abs, entries });
    } catch (e) {
      if (e instanceof DirHttpError) return c.json({ error: e.message }, e.status);
      return c.json({ error: "Gagal membaca folder." }, 500);
    }
  });

  const server = createServer((req, res) => {
    void (async () => {
      // CORS minimal: hanya origin lokal (127.0.0.1/localhost). NFR-SEC-01.
      let localOrigin: string | undefined;
      const reqOrigin = req.headers.origin;
      if (reqOrigin) {
        try {
          const host = new URL(reqOrigin).hostname;
          if (host === "127.0.0.1" || host === "localhost") localOrigin = reqOrigin;
        } catch {
          // abaikan
        }
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          ...(localOrigin ? { "access-control-allow-origin": localOrigin } : {}),
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
        });
        res.end();
        return;
      }
      try {
        const request = new Request(`http://127.0.0.1${req.url ?? "/"}`, {
          method: req.method ?? "GET",
          headers: req.headers as unknown as HeadersInit,
        });
        const out = await app.fetch(request);
        const headers = Object.fromEntries(out.headers.entries());
        if (localOrigin) headers["access-control-allow-origin"] = localOrigin;
        res.writeHead(out.status, headers);
        res.end(await out.text());
      } catch {
        res.writeHead(500);
        res.end("bridge error");
      }
    })();
  });

  const gateway = createGateway(server, {
    token,
    onMessage: (msg, send) => handleMessage(msg, send),
  });

  const ctl = new AbortController();
  server.listen(config.port, "127.0.0.1", () => {
    console.log(`[bridge] ws://127.0.0.1:${config.port}/ws?token=<token> (token di ${config.dataDir}/token)`);
  });

  // Loop koneksi dengan retry (FR-005): gagal → status down, coba lagi 5 dtk.
  void (async () => {
    while (!ctl.signal.aborted) {
      if (!oc) {
        try {
          const conn = await connect(config.opencodeUrl);
          oc = { client: conn.client, version: conn.version };
          console.log(`[bridge] opencode ${conn.version} connected`);
          wireOpencode(conn.client);
          broadcast({ type: "bridge.status", opencode: "up" });
          pushState();
        } catch {
          broadcast({ type: "bridge.status", opencode: "down" });
          await new Promise((r) => setTimeout(r, 5000));
        }
      } else {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();

  const shutdown = (): void => {
    ctl.abort();
    poller?.stop();
    if (activeWatch) clearInterval(activeWatch);
    if (remindTimer) clearInterval(remindTimer);
    gateway.close();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error("[bridge] fatal", e);
  process.exit(1);
});
