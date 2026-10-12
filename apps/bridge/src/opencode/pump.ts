import type { OpenCodeClient } from "./client.js";
import type { RawEvent } from "./normalize.js";

/**
 * Event Pump: subscribe + reconnect + buffer terbatas (PRD §6.5).
 * - Backoff 500ms → 1s → 2s → 5s → 10s; reset setelah stabil 30s.
 * - Queue maks 1000; bila penuh, buang text.delta terlama, tandai gap=true.
 * - Setelah (re)connect, panggil onReconnect untuk rekonsiliasi.
 */

export interface PumpStats {
  connected: boolean;
  streamEnds: number;
  dropped: number;
  gap: boolean;
}

export interface PumpCallbacks {
  onEvent: (e: RawEvent) => void;
  onConn: (status: "connected" | "reconnecting" | "down") => void;
  onReconnect: () => Promise<void>;
}

export function createPump(client: OpenCodeClient, cb: PumpCallbacks) {
  const queue: RawEvent[] = [];
  const stats: PumpStats = { connected: false, streamEnds: 0, dropped: 0, gap: false };
  let running = false;
  let delay = 500;
  let stableSince = Date.now();

  function enqueue(e: RawEvent): void {
    if (queue.length >= 1000) {
      const idx = queue.findIndex((x) => x.type === "session.text.delta");
      if (idx >= 0) {
        queue.splice(idx, 1);
        stats.dropped++;
        stats.gap = true;
        return;
      }
      queue.shift();
      stats.dropped++;
      stats.gap = true;
      return;
    }
    queue.push(e);
  }

  async function loop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        for await (const event of client.event.subscribe()) {
          if (signal.aborted) break;
          if (Date.now() - stableSince > 30_000) delay = 500;
          if (!stats.connected) cb.onConn("connected");
          stats.connected = true;
          enqueue(event as unknown as RawEvent);
          drain();
        }
        // Stream berakhir tanpa error (kontrak live-only) → reconnect.
        stats.connected = false;
        stats.streamEnds++;
        cb.onConn("reconnecting");
      } catch {
        stats.connected = false;
        stats.streamEnds++;
        cb.onConn("reconnecting");
      }
      if (signal.aborted) break;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 10_000);
      stableSince = Date.now();
      try {
        await cb.onReconnect();
      } catch {
        // Rekonsiliasi gagal; loop akan mencoba lagi.
      }
    }
  }

  function drain(): void {
    while (queue.length > 0) {
      const e = queue.shift();
      if (e) cb.onEvent(e);
    }
  }

  return {
    stats,
    start(signal: AbortSignal): Promise<void> {
      running = true;
      return loop(signal);
    },
    get isRunning(): boolean {
      return running;
    },
  };
}
