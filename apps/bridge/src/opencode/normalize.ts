import type { AgentSignal, ExecOutcome } from "@bibo/protocol";

/**
 * Normalisasi event OpenCode v2 → AgentSignal (PRD §6.4, ADR-007).
 * Berdasarkan fixture M0 (`docs/fixtures/opencode-events/`, v2.0.16):
 * payload bisnis selalu di `data`; nama tool hanya ada di `tool.input.started`.
 * Event tak dikenal → null (pemanggil menghitung untuk debug, tidak throw).
 */

export interface RawEvent {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Nama tool → busyKind (PRD §8.3a, diverifikasi M0). */
const TOOL_KIND: Record<string, string> = {
  read: "reading",
  edit: "editing",
  shell: "running",
  execute: "running",
  question: "asking",
  webfetch: "searching",
  websearch: "searching",
  task: "delegating",
};

export function toolKind(tool: string): string {
  return TOOL_KIND[tool] ?? "thinking";
}

const EXEC_END: Record<string, ExecOutcome> = {
  "session.execution.succeeded": "success",
  "session.execution.failed": "failed",
  "session.execution.interrupted": "interrupted",
};

export class EventNormalizer {
  /** callID → nama tool (dari tool.input.started). */
  private names = new Map<string, string>();
  unknownCount = 0;
  /** Ring buffer 500 event tak dikenal (PRD §6.4; untuk debug & fixture). */
  readonly unknownRing: RawEvent[] = [];

  normalize(raw: RawEvent): AgentSignal | null {
    const type = str(raw.type);
    const d = (raw.data ?? {}) as Record<string, unknown>;
    const sessionID = str(d["sessionID"]);
    if (!type) {
      this.noteUnknown(raw);
      return null;
    }
    switch (type) {
      case "session.execution.started":
        return sessionID ? { t: "exec.started", sessionID } : null;
      case "session.execution.succeeded":
      case "session.execution.failed":
      case "session.execution.interrupted": {
        if (!sessionID) return null;
        const err = d["error"] as { message?: string } | undefined;
        return {
          t: "exec.ended",
          sessionID,
          outcome: EXEC_END[type] ?? "failed",
          error: typeof err?.message === "string" ? err.message : undefined,
        };
      }
      case "session.text.delta": {
        const mid = str(d["assistantMessageID"]);
        const delta = str(d["delta"]);
        return sessionID && mid ? { t: "text.delta", sessionID, messageID: mid, text: delta } : null;
      }
      case "session.text.ended": {
        // Teks final lengkap tidak selalu ada di event; final dirakit dari delta
        // oleh reducer (lihat state/reducer.ts). Di sini teruskan penanda selesai.
        const mid = str(d["assistantMessageID"]);
        return sessionID && mid ? { t: "text.done", sessionID, messageID: mid, text: "" } : null;
      }
      case "session.tool.input.started": {
        const callID = str(d["id"]);
        const name = str(d["name"]);
        if (!sessionID || !callID) return null;
        if (name) this.names.set(callID, name);
        return { t: "tool.started", sessionID, callID, tool: name || "unknown" };
      }
      case "session.tool.called":
        // Nama tidak ada di payload; diisi dari input.started bila sudah terlihat.
        return null;
      case "session.tool.success":
      case "session.tool.failed": {
        const callID = str(d["id"]);
        if (!sessionID || !callID) return null;
        const tool = this.names.get(callID) ?? "unknown";
        this.names.delete(callID);
        return { t: "tool.ended", sessionID, callID, tool, ok: type === "session.tool.success" };
      }
      case "permission.asked": {
        const requestID = str(d["id"]);
        const action = str(d["action"]);
        const resources = Array.isArray(d["resources"]) ? d["resources"].filter((x): x is string => typeof x === "string") : [];
        if (!requestID || !sessionID) return null;
        return { t: "permission.asked", request: { requestID, sessionID, action, resources, risk: "medium" as const, voiceAllowed: true } };
      }
      case "permission.replied": {
        const requestID = str(d["requestID"]);
        const decision = str(d["reply"]);
        return requestID ? { t: "permission.replied", requestID, decision } : null;
      }
      case "form.created": {
        const form = d["form"] as { id?: string; sessionID?: string; title?: string; fields?: unknown[] } | undefined;
        if (!form || typeof form.id !== "string") return null;
        return {
          t: "form.asked",
          form: {
            formID: form.id,
            sessionID: typeof form.sessionID === "string" ? form.sessionID : "",
            title: typeof form.title === "string" ? form.title : "",
            fields: Array.isArray(form.fields) ? form.fields : [],
          },
        };
      }
      case "form.replied":
      case "form.cancelled": {
        const formID = str(d["formID"]) || str((d["form"] as { id?: unknown } | undefined)?.id);
        return formID ? { t: "form.replied", formID } : null;
      }
      case "session.created":
      case "session.updated":
      case "session.renamed":
        return sessionID || str(d["id"]) || str(raw.id)
          ? { t: "session.updated", sessionID: sessionID || str(d["id"]), title: str(d["title"]) || undefined }
          : null;
      default:
        this.noteUnknown(raw);
        return null;
    }
  }

  private noteUnknown(raw: RawEvent): void {
    this.unknownCount++;
    this.unknownRing.push(raw);
    if (this.unknownRing.length > 500) this.unknownRing.shift();
  }
}
