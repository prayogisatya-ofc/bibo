import { z } from "zod";

/** AgentState pushed to web as `agent.state`. See PRD §6.6. */

export const agentPhase = z.enum(["idle", "busy", "awaiting", "error"]);
export type AgentPhase = z.infer<typeof agentPhase>;

export const busyKind = z.enum(["reading", "editing", "running", "searching", "delegating", "thinking"]);
export type BusyKind = z.infer<typeof busyKind>;

export const permissionView = z.object({
  requestID: z.string(),
  tool: z.string(),
  title: z.string(),
  patterns: z.array(z.string()),
  preview: z.string().optional(),
  risk: z.enum(["low", "medium", "high"]),
  voiceAllowed: z.boolean(),
});
export type PermissionView = z.infer<typeof permissionView>;

export const formView = z.object({
  formID: z.string(),
  title: z.string(),
  fields: z.array(z.unknown()),
});
export type FormView = z.infer<typeof formView>;

export const agentState = z.object({
  phase: agentPhase,
  busyKind: busyKind.optional(),
  runningTools: z.array(z.string()).default([]),
  pendingPermissions: z.array(permissionView).default([]),
  pendingForms: z.array(formView).default([]),
  lastOutcome: z.enum(["success", "failed", "interrupted"]).optional(),
  lastError: z.string().optional(),
});
export type AgentState = z.infer<typeof agentState>;

export const initialAgentState: AgentState = {
  phase: "idle",
  runningTools: [],
  pendingPermissions: [],
  pendingForms: [],
};

export const feedItem = z.object({
  id: z.string(),
  kind: z.enum(["tool", "shell", "note"]),
  title: z.string(),
  detail: z.string().optional(),
  status: z.enum(["running", "ok", "fail"]),
  ts: z.number(),
});
export type FeedItem = z.infer<typeof feedItem>;
