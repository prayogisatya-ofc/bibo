import { useRef, useState } from "react";
import type { FeedItem } from "@codepet/protocol";
import { useLocale } from "../i18n/index.js";
import { CheckIcon, XIcon } from "./icons.js";
import { truncate2k } from "./text-utils.js";

function formatDur(ms: number, locale: "id" | "en"): string {
  const s = (ms / 1000).toFixed(1);
  return `${locale === "id" ? s.replace(".", ",") : s} s`;
}

/**
 * Feed aktivitas tool (fase C): baris per tool dengan ikon status
 * (centang hijau = selesai, cincin berputar = berjalan, silang merah = gagal)
 * + durasi. Klik baris membuka detail.
 */
export function ActivityFeed({ items }: { items: FeedItem[] }): JSX.Element | null {
  const locale = useLocale();
  const [open, setOpen] = useState<string | undefined>(undefined);
  // Waktu pertama item terlihat ≈ awal tool berjalan (untuk durasi).
  const seenAt = useRef(new Map<string, number>());

  // Kosong: jangan render apa-apa (hindari pergeseran layout).
  if (items.length === 0) return null;

  const now = Date.now();
  return (
    <div className="tool-card" data-testid="feed" aria-live="polite">
      {items.map((f) => {
        let first = seenAt.current.get(f.id);
        if (first === undefined) {
          first = f.ts || now;
          seenAt.current.set(f.id, first);
        }
        // Durasi final: ts item selesai dari bridge dikurangi awal terlihat.
        // JANGAN pakai Date.now() saat render — komponen di-render ulang
        // tiap 500 ms (tick orchestrator) sehingga durasi akan "menghitung
        // terus" meski tool sudah selesai.
        const dur =
          f.status === "running" ? undefined : formatDur(Math.max(0, f.ts - first), locale);
        return (
          <div key={f.id}>
            <button type="button" className="tool-row" onClick={() => setOpen(open === f.id ? undefined : f.id)} aria-expanded={open === f.id}>
              <span className={`tool-status ${f.status}`} aria-hidden="true">
                {f.status === "ok" ? (
                  <CheckIcon size={11} />
                ) : f.status === "fail" ? (
                  <XIcon size={11} />
                ) : null}
              </span>
              <span className="tool-title">{f.title}</span>
              <span className="tool-dur">{dur ?? (locale === "id" ? "berjalan" : "running")}</span>
            </button>
            {open === f.id && f.detail && <pre className="tool-detail">{truncate2k(f.detail)}</pre>}
          </div>
        );
      })}
    </div>
  );
}
