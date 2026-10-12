/** Pose avatar (PRD §8.5). Renderer penuh (`AvatarRenderer`) hadir di M3;
 *  tipe pose didefinisikan di sini agar protokol sudah stabil sejak M1. */

export const AVATAR_POSES = [
  "offline",
  "sleeping",
  "idle",
  "listening",
  "thinking",
  "working.reading",
  "working.editing",
  "working.running",
  "working.searching",
  "working.delegating",
  "working.generic",
  "asking",
  "celebrate",
  "confused",
] as const;

export type AvatarPose = (typeof AVATAR_POSES)[number];

export function isAvatarPose(v: unknown): v is AvatarPose {
  return typeof v === "string" && (AVATAR_POSES as readonly string[]).includes(v);
}
