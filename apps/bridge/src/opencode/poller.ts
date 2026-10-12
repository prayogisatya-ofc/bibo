import type { AgentSignal } from "@codepet/protocol";
import type { OpenCodeClient } from "./client.js";

/**
 * Poller: jaring pengaman polling (ADR-007).
 * - session.active → sesi yang sedang running (termasuk yang menunggu izin/form).
 * - permission.list + session.form.list → sinyal permission.asked / form.asked
 *   untuk id yang belum terlihat dari event (dedupe oleh pemanggil).
 * - message.list → deteksi pesan assistant baru (keperluan rekonsiliasi).
 */

export interface PollerCallbacks {
  getSessionID: () => string | undefined;
  getDirectory: () => string | undefined;
  onSignal: (s: AgentSignal) => void;
  seenPermission: (id: string) => boolean;
  seenForm: (id: string) => boolean;
}

interface MsgRow {
  id?: string;
  type?: string;
  time?: { created?: number };
  outcome?: string;
}

export function createPoller(client: OpenCodeClient, cb: PollerCallbacks) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let activeTimer: ReturnType<typeof setInterval> | undefined;

  async function pollActive(): Promise<Record<string, { type: string }>> {
    try {
      return (await client.session.active()) as Record<string, { type: string }>;
    } catch {
      return {};
    }
  }

  async function pollApprovals(): Promise<void> {
    const sessionID = cb.getSessionID();
    if (!sessionID) return;
    try {
      const perms = (await client.permission.list({ sessionID })) as Array<{
        id: string;
        sessionID: string;
        action: string;
        resources: string[];
      }>;
      for (const p of perms ?? []) {
        if (!cb.seenPermission(p.id)) {
          cb.onSignal({
            t: "permission.asked",
            request: { requestID: p.id, sessionID: p.sessionID, action: p.action, resources: p.resources ?? [], risk: "medium" as const, voiceAllowed: true },
          });
        }
      }
    } catch {
      // Jaring pengaman tidak boleh melempar.
    }
    try {
      const forms = (await client.session.form.list({ sessionID })) as Array<{
        id: string;
        sessionID: string;
        title: string;
        fields: unknown[];
      }>;
      for (const f of forms ?? []) {
        if (!cb.seenForm(f.id)) {
          cb.onSignal({
            t: "form.asked",
            form: { formID: f.id, sessionID: f.sessionID, title: f.title, fields: (f.fields ?? []) as never[] },
          });
        }
      }
    } catch {
      // abaikan
    }
  }

  async function latestMessages(sessionID: string, limit = 10): Promise<MsgRow[]> {
    try {
      const res = (await client.message.list({ sessionID })) as { data?: MsgRow[] } | MsgRow[];
      const data = Array.isArray(res) ? res : (res.data ?? []);
      return data.slice(-limit);
    } catch {
      return [];
    }
  }

  return {
    pollActive,
    pollApprovals,
    latestMessages,
    start(activeMs: number, approvalMs: number): void {
      activeTimer = setInterval(() => void pollActive(), activeMs);
      timer = setInterval(() => void pollApprovals(), approvalMs);
    },
    stop(): void {
      if (timer) clearInterval(timer);
      if (activeTimer) clearInterval(activeTimer);
    },
  };
}
