import { z } from "zod";

/** Internal normalized signals. See PRD §6.4. Produced by bridge normalizer from
 *  OpenCode v2 events AND polling snapshots (deduped by caller). */

export const execOutcome = z.enum(["success", "failed", "interrupted"]);
export type ExecOutcome = z.infer<typeof execOutcome>;

export const agentSignal = z.discriminatedUnion("t", [
  z.object({ t: z.literal("exec.started"), sessionID: z.string() }),
  z.object({
    t: z.literal("exec.ended"),
    sessionID: z.string(),
    outcome: execOutcome,
    error: z.string().optional(),
  }),
  z.object({ t: z.literal("text.delta"), sessionID: z.string(), messageID: z.string(), text: z.string() }),
  z.object({ t: z.literal("text.done"), sessionID: z.string(), messageID: z.string(), text: z.string() }),
  z.object({
    t: z.literal("tool.started"),
    sessionID: z.string(),
    callID: z.string(),
    tool: z.string(),
    input: z.unknown().optional(),
  }),
  z.object({
    t: z.literal("tool.ended"),
    sessionID: z.string(),
    callID: z.string(),
    tool: z.string(),
    ok: z.boolean(),
    output: z.string().optional(),
  }),
  z.object({
    t: z.literal("permission.asked"),
    request: z.object({
      requestID: z.string(),
      sessionID: z.string(),
      action: z.string(),
      resources: z.array(z.string()),
      save: z.array(z.string()).optional(),
      risk: z.enum(["low", "medium", "high"]).default("medium"),
      voiceAllowed: z.boolean().default(true),
    }),
  }),
  z.object({ t: z.literal("permission.replied"), requestID: z.string(), decision: z.string() }),
  z.object({ t: z.literal("form.replied"), formID: z.string() }),
  z.object({
    t: z.literal("form.asked"),
    form: z.object({
      formID: z.string(),
      sessionID: z.string(),
      title: z.string(),
      fields: z.array(z.unknown()),
    }),
  }),
  z.object({ t: z.literal("session.updated"), sessionID: z.string(), title: z.string().optional() }),
  z.object({ t: z.literal("conn"), status: z.enum(["connected", "reconnecting", "down"]) }),
]);

export type AgentSignal = z.infer<typeof agentSignal>;
