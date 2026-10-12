import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { AgentState, BridgeMessage, FeedItem } from "@codepet/protocol";
import { stripSpeak } from "../ui/text-utils.js";

export interface ChatMsg {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  streaming?: boolean;
}

export interface PendingPerm {
  requestID: string;
  tool: string;
  title: string;
  patterns: string[];
  risk: "low" | "medium" | "high";
  voiceAllowed: boolean;
}

export interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
}

interface AppCtx {
  agent: AgentState;
  chat: ChatMsg[];
  feed: FeedItem[];
  perms: PendingPerm[];
  diffs: DiffFile[];
  errors: string[];
  apply: (m: BridgeMessage) => void;
  pushUser: (text: string) => void;
  pushSystem: (text: string) => void;
  clearDiffs: () => void;
}

const Ctx = createContext<AppCtx | undefined>(undefined);

const IDLE: AgentState = { phase: "idle", runningTools: [], pendingPermissions: [], pendingForms: [] };

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [agent, setAgent] = useState<AgentState>(IDLE);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [perms, setPerms] = useState<PendingPerm[]>([]);
  const [diffs, setDiffs] = useState<DiffFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const buffers = useRef(new Map<string, string>());

  const apply = useCallback((m: BridgeMessage) => {
    switch (m.type) {
      case "agent.state":
        setAgent(m.state);
        break;
      case "agent.text.delta": {
        const buf = `${buffers.current.get(m.messageID) ?? ""}${m.text}`;
        buffers.current.set(m.messageID, buf);
        setChat((prev) => {
          const i = prev.findIndex((c) => c.id === m.messageID);
          const shown = stripSpeak(buf);
          if (i >= 0) {
            const next = [...prev];
            next[i] = { ...next[i]!, text: shown, streaming: true };
            return next;
          }
          return [...prev, { id: m.messageID, role: "agent", text: shown, streaming: true }];
        });
        break;
      }
      case "agent.text.final": {
        const full = stripSpeak(buffers.current.get(m.messageID) ?? m.text);
        buffers.current.delete(m.messageID);
        setChat((prev) => {
          const i = prev.findIndex((c) => c.id === m.messageID);
          if (i >= 0) {
            const next = [...prev];
            next[i] = { ...next[i]!, text: full, streaming: false };
            return next;
          }
          return [...prev, { id: m.messageID, role: "agent", text: full }];
        });
        break;
      }
      case "feed.item":
        setFeed((prev) => {
          const i = prev.findIndex((f) => f.id === m.item.id);
          if (i >= 0) {
            const next = [...prev];
            next[i] = m.item;
            return next;
          }
          return [...prev.slice(-99), m.item];
        });
        break;
      case "permission.requested":
        setPerms((prev) => (prev.some((p) => p.requestID === m.requestID) ? prev : [...prev, m]));
        break;
      case "form.requested":
        setChat((prev) => [...prev, { id: m.formID, role: "system", text: `Agent bertanya: ${m.title}` }]);
        break;
      case "diff.ready":
        setDiffs(m.files);
        break;
      case "agent.speak":
        // M4 menyuarakan; M2 mencatat sebagai sistem agar tak hilang.
        if (m.kind === "error" || m.kind === "ask") {
          setChat((prev) => [...prev, { id: m.id, role: "system", text: stripSpeak(m.text) }]);
        }
        break;
      case "error":
        setErrors((prev) => [...prev.slice(-4), `${m.code}: ${m.message}`]);
        break;
      case "bridge.ready":
      case "bridge.status":
        break;
    }
  }, []);

  const pushUser = useCallback((text: string) => {
    setChat((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text }]);
  }, []);

  const pushSystem = useCallback((text: string) => {
    setChat((prev) => [...prev, { id: `s-${Date.now()}`, role: "system", text }]);
  }, []);

  const clearDiffs = useCallback(() => setDiffs([]), []);

  const value = useMemo(
    () => ({ agent, chat, feed, perms, diffs, errors, apply, pushUser, pushSystem, clearDiffs }),
    [agent, chat, feed, perms, diffs, errors, apply, pushUser, pushSystem, clearDiffs],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp di luar AppProvider");
  return v;
}
