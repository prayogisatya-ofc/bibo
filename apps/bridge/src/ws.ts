import type { Server } from "node:http";
import type { IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { type BridgePayload, type WebMessage, webMessage } from "@codepet/protocol";

/**
 * Gateway WebSocket Web ↔ Bridge (PRD §6.6, NFR-SEC-01).
 * - Hanya token acak per start (`?token=`), cek Origin (localhost/127.0.0.1
 *   atau tanpa Origin untuk klien non-browser).
 * - Penanganan pesan diserialkan per koneksi (hindari race select vs message).
 * - Semua pesan divalidasi zod dua arah (masuk di sini, keluar di pengirim).
 */

export interface GatewayOptions {
  token: string;
  onMessage: (msg: WebMessage, send: (m: BridgePayload) => void) => Promise<void>;
}

export interface Gateway {
  sockets: Set<WebSocket>;
  broadcast: (m: BridgePayload) => void;
  close: () => void;
}

export function createGateway(server: Server, opts: GatewayOptions): Gateway {
  const sockets = new Set<WebSocket>();

  function broadcast(m: BridgePayload): void {
    const raw = JSON.stringify({ v: 1, ...m });
    for (const s of sockets) {
      if (s.readyState === WebSocket.OPEN) s.send(raw);
    }
  }

  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/ws", "http://127.0.0.1");
    if (url.searchParams.get("token") !== opts.token) {
      socket.close(4401, "bad token");
      return;
    }
    const origin = req.headers.origin;
    if (origin) {
      try {
        const host = new URL(origin).hostname;
        if (host !== "127.0.0.1" && host !== "localhost") {
          socket.close(4403, "bad origin");
          return;
        }
      } catch {
        socket.close(4403, "bad origin");
        return;
      }
    }
    sockets.add(socket);
    const send = (m: BridgePayload): void => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ v: 1, ...m }));
    };
    let tail: Promise<void> = Promise.resolve();
    socket.on("message", (data) => {
      tail = tail
        .then(async () => {
          const parsed = webMessage.safeParse(JSON.parse(String(data)));
          if (!parsed.success) {
            send({ type: "error", code: "BAD_MESSAGE", message: "Pesan WS tidak valid.", recoverable: true });
            return;
          }
          await opts.onMessage(parsed.data, send);
        })
        .catch(() => {
          send({ type: "error", code: "HANDLER_ERROR", message: "Gagal memproses pesan.", recoverable: true });
        });
    });
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  return {
    sockets,
    broadcast,
    close: () => wss.close(),
  };
}
