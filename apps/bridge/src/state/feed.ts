import type { FeedItem } from "@bibo/protocol";

/** Pembangun item activity feed (PRD §7.3, dipakai state/reducer.ts). */

export function toolFeedItem(callID: string, tool: string, status: FeedItem["status"]): FeedItem {
  const shellish = tool === "shell" || tool === "execute";
  return {
    id: callID,
    kind: shellish ? "shell" : "tool",
    title: toolTitle(tool),
    status,
    ts: Date.now(),
  };
}

export function toolTitle(tool: string): string {
  switch (tool) {
    case "read":
      return "membaca file";
    case "edit":
      return "mengedit file";
    case "shell":
    case "execute":
      return "menjalankan perintah";
    case "question":
      return "bertanya";
    default:
      return `menjalankan ${tool}`;
  }
}

export function permissionTitle(action: string, resources: string[]): string {
  const target = resources[0] ?? action;
  const short = target.length > 60 ? `${target.slice(0, 57)}…` : target;
  return `Minta izin ${action}: ${short}`;
}
