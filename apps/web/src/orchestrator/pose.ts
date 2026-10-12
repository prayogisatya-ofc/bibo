import type { AvatarPose, WorkingVariant } from "@codepet/avatar";

/**
 * Konteks murni untuk derivePose (PRD §8.1–8.2, pemetaan tampilan CHARACTER.md §11).
 * Bebas framework agar mudah diuji.
 */
export interface PoseContext {
  link: "online" | "offline";
  /** Status agent dari bridge (agent.state); "working" = phase busy + busyKind. */
  agent: "idle" | "thinking" | "working" | "awaiting" | "error";
  busyKind: "reading" | "editing" | "running" | "searching" | "delegating" | "thinking" | undefined;
  mic: "off" | "listening";
  /** True bila TTS aktif — OVERLAY Berbicara, BUKAN pose (CHARACTER.md §11). */
  speaking: boolean;
  /** True pada jendela transient (celebrate 3 s / confused 4 s). */
  celebrate: boolean;
  confused: boolean;
  /** Ms sejak aktivitas terakhir (untuk sleeping > 120 s). */
  idleMs: number;
}

/** Pemetaan nama tool nyata (M0, PRD §8.3a) → busyKind. TABEL DATA, fallback "thinking". */
export const TOOL_BUSY_KIND: Record<string, PoseContext["busyKind"]> = {
  read: "reading",
  edit: "editing",
  shell: "running",
  execute: "running",
  question: "thinking", // question → asking via awaiting, bukan working
  webfetch: "searching",
  websearch: "searching",
  task: "delegating",
  subagent: "delegating", // audit ADR: dulu hilang, padahal ada di PRD §8.3a
};

export function busyKindOf(tool: string): Exclude<PoseContext["busyKind"], undefined> {
  return TOOL_BUSY_KIND[tool] ?? "thinking";
}

/** busyKind bridge → varian pose Bekerja (kontrak @codepet/avatar). editing → mengetik. */
const WORKING_VARIANT: Record<"reading" | "editing" | "running" | "searching" | "delegating", WorkingVariant> = {
  reading: "reading",
  editing: "typing",
  running: "running",
  searching: "searching",
  delegating: "delegating",
};

export interface DerivedPose {
  pose: AvatarPose;
  variant?: WorkingVariant;
}

/**
 * Prioritas pose (PRD §8.2, tidak berubah):
 * offline > confused > asking > [speaking: overlay] > listening >
 * working > thinking > celebrate > idle > sleeping.
 *
 * `speaking` TIDAK mengubah pose — overlay Berbicara ditangani renderer
 * (mulut parametris + busur suara; prioritas pola lampu asking > speaking >
 * pola pose dasar, CHARACTER.md §11). Fungsi ini mengembalikan pose dasar + varian.
 */
export function derivePose(ctx: PoseContext): DerivedPose {
  if (ctx.link === "offline") return { pose: "offline" };
  if (ctx.confused || ctx.agent === "error") return { pose: "confused" };
  if (ctx.agent === "awaiting") return { pose: "asking" };
  if (ctx.mic === "listening") return { pose: "listening" };
  if (ctx.agent === "working") {
    const v = ctx.busyKind && ctx.busyKind !== "thinking" ? WORKING_VARIANT[ctx.busyKind] : "generic";
    return { pose: "working", variant: v };
  }
  if (ctx.agent === "thinking") return { pose: "thinking" };
  if (ctx.celebrate) return { pose: "celebrate" };
  if (ctx.idleMs > 120_000) return { pose: "sleeping" };
  return { pose: "idle" };
}

/**
 * Label status manusiawi untuk caption/avatar aria (id/en).
 *
 * CATATAN fase C: string mengandung nama sementara "Bibo" (aturan PROMPT:
 * nama hanya boleh dari character.name + i18n). Fase C akan mengganti seluruh
 * label ini dengan i18n; jangan menambah hard-code nama baru di sini.
 */
const POSE_LABEL: Record<"id" | "en", Record<Exclude<AvatarPose, "working">, string>> = {
  id: {
    offline: "Luring",
    sleeping: "Tidur",
    idle: "Bibo siap.",
    listening: "Mendengarkan…",
    thinking: "Hmm, aku pikir dulu…",
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
    asking: "May I…?",
    celebrate: "Done!",
    confused: "Oops, confused…",
  },
};

const WORKING_LABEL: Record<"id" | "en", Record<WorkingVariant, string>> = {
  id: {
    reading: "Aku lagi baca file…",
    typing: "Aku lagi mengedit file…",
    running: "Aku lagi menjalankan perintah…",
    searching: "Aku lagi mencari…",
    delegating: "Aku minta tolong robot mini…",
    generic: "Aku lagi bekerja…",
  },
  en: {
    reading: "Reading files…",
    typing: "Editing files…",
    running: "Running commands…",
    searching: "Searching…",
    delegating: "Asking the mini robot…",
    generic: "Working…",
  },
};

export function poseLabel(pose: AvatarPose, variant: WorkingVariant | undefined, locale: "id" | "en" = "id"): string {
  if (pose === "working") return WORKING_LABEL[locale][variant ?? "generic"];
  return POSE_LABEL[locale][pose];
}
