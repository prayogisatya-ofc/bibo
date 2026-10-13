import { z } from "zod";
import { agentState, feedItem } from "./state.js";

/** WebSocket protocol Web ↔ Bridge, v1. See PRD §6.6. */

const base = z.object({ v: z.literal(1), id: z.string().optional() });

// Web → Bridge
export const webMessage = z.discriminatedUnion("type", [
  base.extend({ type: z.literal("hello"), clientVersion: z.string() }),
  base.extend({
    type: z.literal("user.message"),
    text: z.string().min(1),
    source: z.enum(["chat", "voice"]),
    locale: z.string().default("id-ID"),
    // FR-014: antre ("queue", default) vs sela ("steer", default prompt v2).
    delivery: z.enum(["queue", "steer"]).optional(),
  }),
  base.extend({ type: z.literal("agent.interrupt") }),
  base.extend({
    type: z.literal("permission.reply"),
    requestID: z.string(),
    decision: z.enum(["once", "reject", "always"]),
    via: z.enum(["click", "voice"]),
  }),
  base.extend({ type: z.literal("form.reply"), formID: z.string(), answer: z.record(z.unknown()) }),
  base.extend({ type: z.literal("form.cancel"), formID: z.string() }),
  base.extend({ type: z.literal("session.select"), directory: z.string(), sessionID: z.string().optional() }),
  base.extend({ type: z.literal("session.list"), directory: z.string().optional() }),
  base.extend({ type: z.literal("settings.update"), settings: z.record(z.unknown()) }),
  base.extend({ type: z.literal("speech.request_summary"), messageID: z.string() }),
  // FITUR C: pilih model dari server OpenCode (GET /api/model + session.switchModel).
  base.extend({ type: z.literal("models.list") }),
  base.extend({
    type: z.literal("model.set"),
    id: z.string().min(1),
    providerID: z.string().min(1),
    variant: z.string().optional(),
  }),
]);
export type WebMessage = z.infer<typeof webMessage>;
/** Payload web→bridge tanpa envelope `v` (ditambahkan saat kirim). */
export type WebPayload = WithoutV<WebMessage>;

// Bridge → Web
export const bridgeMessage = z.discriminatedUnion("type", [
  base.extend({
    type: z.literal("bridge.ready"),
    bridgeVersion: z.string(),
    opencode: z.object({ status: z.enum(["up", "down"]), version: z.string().optional() }),
    directory: z.string(),
    sessionID: z.string().optional(),
    recentDirs: z.array(z.string()).default([]),
    agent: z.string().optional(),
    model: z.string().optional(),
  }),
  base.extend({ type: z.literal("bridge.status"), opencode: z.enum(["up", "reconnecting", "down"]) }),
  base.extend({
    type: z.literal("session.listed"),
    sessions: z.array(
      z.object({ sessionID: z.string(), title: z.string().optional(), directory: z.string().optional() }),
    ),
  }),
  base.extend({ type: z.literal("agent.state"), state: agentState }),
  base.extend({ type: z.literal("agent.text.delta"), messageID: z.string(), text: z.string() }),
  base.extend({ type: z.literal("agent.text.final"), messageID: z.string(), text: z.string() }),
  base.extend({
    type: z.literal("agent.speak"),
    id: z.string(),
    text: z.string(),
    priority: z.enum(["normal", "urgent"]),
    kind: z.enum(["ack", "summary", "ask", "error"]),
  }),
  base.extend({ type: z.literal("feed.item"), item: feedItem }),
  base.extend({
    type: z.literal("permission.requested"),
    requestID: z.string(),
    tool: z.string(),
    title: z.string(),
    patterns: z.array(z.string()),
    preview: z.string().optional(),
    risk: z.enum(["low", "medium", "high"]),
    voiceAllowed: z.boolean(),
  }),
  base.extend({ type: z.literal("form.requested"), formID: z.string(), title: z.string(), fields: z.array(z.unknown()) }),
  base.extend({
    type: z.literal("diff.ready"),
    sessionID: z.string(),
    files: z.array(z.object({ path: z.string(), additions: z.number(), deletions: z.number() })),
  }),
  base.extend({
    type: z.literal("models.listed"),
    models: z.array(
      z.object({ id: z.string(), name: z.string(), providerID: z.string() }),
    ),
    current: z.object({ id: z.string(), providerID: z.string() }).nullable(),
    error: z.string().optional(),
  }),
  base.extend({ type: z.literal("error"), code: z.string(), message: z.string(), recoverable: z.boolean() }),
]);
export type BridgeMessage = z.infer<typeof bridgeMessage>;
/** Payload bridge→web tanpa envelope `v` (ditambahkan saat kirim). */
type WithoutV<T> = T extends unknown ? Omit<T, "v"> : never;
export type BridgePayload = WithoutV<BridgeMessage>;
