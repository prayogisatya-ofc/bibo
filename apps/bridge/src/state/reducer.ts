import { type AgentSignal, type AgentState, type FeedItem, type PermissionView, initialAgentState } from "@codepet/protocol";
import { toolKind } from "../opencode/normalize.js";
import { permissionTitle, toolFeedItem } from "./feed.js";

/**
 * Agent State Reducer (PRD §6.4, ADR-007).
 * Prioritas: awaiting (permission/form) > working (tool) > thinking (exec aktif) > hasil terakhir.
 * Murni: (state, signal) → { state, emit } tanpa efek samping.
 */

export interface ReduceEmit {
  feed?: FeedItem;
  textDelta?: { messageID: string; text: string };
  textFinal?: { messageID: string; text: string };
  speak?: { kind: "ack" | "summary" | "ask" | "error"; text: string };
}

interface Internal {
  state: AgentState;
  tools: Map<string, string>; // callID → tool
  texts: Map<string, string>; // messageID → buffer
  execRunning: boolean; // giliran eksekusi aktif (event exec.started/ended)
}

export function createReducer() {
  const inner: Internal = {
    state: { ...initialAgentState, runningTools: [], pendingPermissions: [], pendingForms: [] },
    tools: new Map(),
    texts: new Map(),
    execRunning: false,
  };

  function phase(s: AgentState): AgentState["phase"] {
    if (s.phase === "error") return "error"; // error bertahan sampai giliran berikut
    if (s.pendingPermissions.length > 0 || s.pendingForms.length > 0) return "awaiting";
    if (inner.execRunning || s.runningTools.length > 0) return "busy";
    return "idle";
  }

  function busyKindFor(s: AgentState): AgentState["busyKind"] {
    const first = s.runningTools[0];
    if (!first) return s.phase === "busy" ? "thinking" : undefined;
    return toolKind(first) === "asking" ? "thinking" : (toolKind(first) as AgentState["busyKind"]);
  }

  function refresh(s: AgentState): AgentState {
    const next: AgentState = { ...s, phase: phase(s) };
    next.busyKind = next.phase === "busy" ? busyKindFor(s) : undefined;
    return next;
  }

  function reduce(signal: AgentSignal): { state: AgentState; emit: ReduceEmit } {
    const s = inner.state;
    const emit: ReduceEmit = {};
    let next: AgentState = s;

    switch (signal.t) {
      case "exec.started":
        inner.execRunning = true;
        next = refresh({ ...s, phase: "busy" });
        break;
      case "exec.ended": {
        inner.execRunning = false;
        inner.tools.clear();
        const pending = s.pendingPermissions.length > 0 || s.pendingForms.length > 0;
        next = {
          ...s,
          phase: signal.outcome === "failed" ? "error" : "idle",
          runningTools: [],
          lastOutcome: signal.outcome,
          lastError: signal.error,
          busyKind: undefined,
        };
        if (pending) next = refresh(next);
        if (signal.outcome === "success") {
          // Ringkasan lisan penuh di M4; M1 tidak emit speak di sini.
        }
        break;
      }
      case "text.delta": {
        const buf = (inner.texts.get(signal.messageID) ?? "") + signal.text;
        inner.texts.set(signal.messageID, buf);
        emit.textDelta = { messageID: signal.messageID, text: signal.text };
        break;
      }
      case "text.done": {
        const full = inner.texts.get(signal.messageID) ?? "";
        inner.texts.delete(signal.messageID);
        emit.textFinal = { messageID: signal.messageID, text: full };
        break;
      }
      case "tool.started": {
        inner.tools.set(signal.callID, signal.tool);
        const runningTools = [...inner.tools.values()];
        next = refresh({ ...s, runningTools });
        emit.feed = toolFeedItem(signal.callID, signal.tool, "running");
        break;
      }
      case "tool.ended": {
        inner.tools.delete(signal.callID);
        const runningTools = [...inner.tools.values()];
        next = refresh({ ...s, runningTools });
        emit.feed = toolFeedItem(signal.callID, signal.tool, signal.ok ? "ok" : "fail");
        break;
      }
      case "permission.asked": {
        const p: PermissionView = {
          requestID: signal.request.requestID,
          tool: signal.request.action,
          title: permissionTitle(signal.request.action, signal.request.resources),
          patterns: signal.request.resources,
          risk: signal.request.risk,
          voiceAllowed: signal.request.voiceAllowed && signal.request.risk !== "high",
        };
        if (!s.pendingPermissions.some((x) => x.requestID === p.requestID)) {
          next = refresh({ ...s, pendingPermissions: [...s.pendingPermissions, p] });
        }
        emit.speak = { kind: "ask", text: p.title };
        break;
      }
      case "permission.replied":
        next = refresh({ ...s, pendingPermissions: s.pendingPermissions.filter((x) => x.requestID !== signal.requestID) });
        break;
      case "form.replied":
        next = refresh({ ...s, pendingForms: s.pendingForms.filter((x) => x.formID !== signal.formID) });
        break;
      case "form.asked": {
        if (!s.pendingForms.some((x) => x.formID === signal.form.formID)) {
          next = refresh({
            ...s,
            pendingForms: [...s.pendingForms, { formID: signal.form.formID, title: signal.form.title, fields: signal.form.fields }],
          });
        }
        emit.speak = { kind: "ask", text: signal.form.title };
        break;
      }
      case "session.updated":
        next = s;
        break;
      case "conn":
        next = signal.status === "down" ? { ...s, phase: "error", lastError: "opencode unreachable" } : s;
        break;
    }
    inner.state = next;
    return { state: next, emit };
  }

  return {
    reduce,
    reset(): void {
      inner.state = { ...initialAgentState, runningTools: [], pendingPermissions: [], pendingForms: [] };
      inner.tools.clear();
      inner.texts.clear();
      inner.execRunning = false;
    },
    get state() {
      return inner.state;
    },
  };
}
