import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Risk } from "./risk.js";

/**
 * Penjaga persetujuan (PRD §10.2):
 * - via suara + risk high → VOICE_NOT_ALLOWED.
 * - decision "always" via suara ATAU untuk risk high → ditolak.
 * - Tidak ada auto-approve; tidak ada timeout. Setiap keputusan dicatat lokal
 *   (waktu, requestID, risiko, via) TANPA data rahasia (tanpa perintah/resource).
 */

export type ReplyVia = "click" | "voice";
export type ReplyDecision = "once" | "reject" | "always";

export const VOICE_NOT_ALLOWED = "VOICE_NOT_ALLOWED";
export const ALWAYS_NOT_ALLOWED = "ALWAYS_NOT_ALLOWED";

export function guardReply(input: {
  risk: Risk;
  via: ReplyVia;
  decision: ReplyDecision;
}): { ok: true } | { ok: false; code: string; message: string } {
  // Menolak selalu aman: boleh lewat jalur dan risiko apa pun.
  if (input.decision === "reject") return { ok: true };
  if (input.decision === "always" && (input.via === "voice" || input.risk === "high")) {
    return {
      ok: false,
      code: ALWAYS_NOT_ALLOWED,
      message: "Selalu izinkan hanya via klik untuk risiko rendah/medium.",
    };
  }
  if (input.via === "voice" && input.risk === "high") {
    return {
      ok: false,
      code: VOICE_NOT_ALLOWED,
      message: "Risiko tinggi harus dikonfirmasi lewat layar.",
    };
  }
  return { ok: true };
}

export interface DecisionRecord {
  at: string;
  requestID: string;
  risk: Risk;
  via: ReplyVia;
  decision: ReplyDecision;
}

/** Tulis log keputusan (append JSONL). Tanpa perintah/resource (NFR-SEC-03). */
export async function logDecision(dataDir: string, rec: Omit<DecisionRecord, "at">): Promise<DecisionRecord> {
  const full: DecisionRecord = { ...rec, at: new Date().toISOString() };
  await mkdir(dataDir, { recursive: true });
  await appendFile(join(dataDir, "decisions.jsonl"), `${JSON.stringify(full)}\n`);
  return full;
}
