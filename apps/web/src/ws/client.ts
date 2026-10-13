import { useEffect, useRef, useState } from "react";
import { bridgeMessage, type BridgeMessage, type WebPayload } from "@bibo/protocol";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "down";

export interface BridgeApi {
  status: ConnStatus;
  send: (m: WebPayload) => void;
}

/**
 * Koneksi WS ke bridge via /bootstrap (token), reconnect backoff,
 * dan validasi zod untuk semua pesan masuk.
 */
export function useBridge(bridgeHttp: string, onMessage: (m: BridgeMessage) => void): BridgeApi {
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const wsRef = useRef<WebSocket | undefined>(undefined);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;
  const urlRef = useRef(bridgeHttp);
  urlRef.current = bridgeHttp;

  useEffect(() => {
    let dead = false;
    let delay = 500;

    function openSocket(token: string): Promise<WebSocket> {
      return new Promise((resolve, reject) => {
        const sock = new WebSocket(`${urlRef.current.replace(/^http/, "ws")}/ws?token=${token}`);
        sock.onopen = () => resolve(sock);
        sock.onerror = () => reject(new Error("ws error"));
        sock.onclose = () => reject(new Error("ws closed before open"));
      });
    }

    void (async () => {
      while (!dead) {
        try {
          const boot = await fetch(`${urlRef.current}/bootstrap`);
          if (!boot.ok) throw new Error(`bootstrap ${boot.status}`);
          const { token } = (await boot.json()) as { token: string };
          const sock = await openSocket(token);
          wsRef.current = sock;
          delay = 500;
          setStatus("open");
          sock.onmessage = (ev) => {
            try {
              const parsed = bridgeMessage.safeParse(JSON.parse(String(ev.data)));
              if (parsed.success) handlerRef.current(parsed.data);
            } catch {
              // abaikan frame rusak
            }
          };
          // Tunggu soket ini tutup sebelum mencoba lagi (satu koneksi aktif).
          await new Promise<void>((resolve) => {
            sock.onclose = () => {
              if (wsRef.current === sock) wsRef.current = undefined;
              resolve();
            };
          });
          if (dead) return;
          setStatus("reconnecting");
        } catch {
          if (dead) return;
          setStatus("reconnecting");
          await new Promise((r) => setTimeout(r, delay));
          delay = Math.min(delay * 2, 10000);
        }
      }
    })();
    return () => {
      dead = true;
      try {
        wsRef.current?.close();
      } catch {
        // abaikan
      }
    };
  }, []);

  return {
    status,
    send: (m) => {
      const sock = wsRef.current;
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({ v: 1, ...m }));
      }
    },
  };
}
