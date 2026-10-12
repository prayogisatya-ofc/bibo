import type { AvatarPose } from "@codepet/avatar";

/**
 * Konteks murni untuk derivePose (PRD §8.1–8.2). Bebas framework agar mudah diuji.
 */
export interface PoseContext {
  link: "online" | "offline";
  /** Status agent dari bridge (agent.state). */
  agent: "idle" | "thinking" | "working" | "awaiting" | "error";
  busyKind: "reading" | "editing" | "running" | "searching" | "delegating" | "thinking" | undefined;
  mic: "off" | "listening";
  speaking: boolean;
  /** True pada jendela transient (celebrate 2 s / confused 4 s). */
  celebrate: boolean;
  confused: boolean;
  /** Ms sejak aktivitas terakhir (untuk sleeping > 120 s). */
  idleMs: number;
}

/** Pemetaan nama tool nyata (M0) → busyKind. TABEL DATA, fallback "thinking". */
export const TOOL_BUSY_KIND: Record<string, PoseContext["busyKind"]> = {
  read: "reading",
  edit: "editing",
  shell: "running",
  execute: "running",
  question: "thinking", // question → asking via awaiting, bukan working
  webfetch: "searching",
  websearch: "searching",
  task: "delegating",
};

export function busyKindOf(tool: string): Exclude<PoseContext["busyKind"], undefined> {
  return TOOL_BUSY_KIND[tool] ?? "thinking";
}

/**
 * Prioritas pose (PRD §8.2): offline > confused > asking > listening >
 * working.* > thinking > celebrate > idle > sleeping.
 * `speaking` adalah overlay (voice-pulse), BUKAN pose — ditangani terpisah.
 */
export function derivePose(ctx: PoseContext): AvatarPose {
  if (ctx.link === "offline") return "offline";
  if (ctx.confused) return "confused";
  if (ctx.agent === "awaiting") return "asking";
  if (ctx.mic === "listening") return "listening";
  if (ctx.agent === "working") {
    switch (ctx.busyKind) {
      case "reading":
        return "working.reading";
      case "editing":
        return "working.editing";
      case "running":
        return "working.running";
      case "searching":
        return "working.searching";
      case "delegating":
        return "working.delegating";
      default:
        return "working.generic";
    }
  }
  if (ctx.agent === "thinking") return "thinking";
  if (ctx.agent === "error") return "confused";
  if (ctx.celebrate) return "celebrate";
  if (ctx.idleMs > 120_000) return "sleeping";
  return "idle";
}

/** Label status manusiawi untuk caption/avatar aria (id/en). */
const POSE_LABEL: Record<"id" | "en", Record<AvatarPose, string>> = {
  id: {
    offline: "Luring",
    sleeping: "Tidur",
    idle: "Bibo siap.",
    listening: "Mendengarkan…",
    thinking: "Hmm, aku pikir dulu…",
    "working.reading": "Aku lagi baca file…",
    "working.editing": "Aku lagi mengedit file…",
    "working.running": "Aku lagi menjalankan perintah…",
    "working.searching": "Aku lagi mencari…",
    "working.delegating": "Aku minta tolong robot mini…",
    "working.generic": "Aku lagi bekerja…",
    asking: "Boleh…?",
    celebrate: "Beres!",
    confused: "Aduh, bingung…",
  },
  en: {
    offline: "Offline",
    sleeping: "Sleeping",
    idle: "Bibo is ready.",
    listening: "Listening…",
    thinking: "Hmm, let me think…",
    "working.reading": "Reading files…",
    "working.editing": "Editing files…",
    "working.running": "Running commands…",
    "working.searching": "Searching…",
    "working.delegating": "Asking the mini robot…",
    "working.generic": "Working…",
    asking: "May I…?",
    celebrate: "Done!",
    confused: "Oops, confused…",
  },
};

export function poseLabel(pose: AvatarPose, locale: "id" | "en" = "id"): string {
  return POSE_LABEL[locale][pose];
}
