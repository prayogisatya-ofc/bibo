import type { AvatarPose, WorkingVariant } from "@bibo/avatar";
import { fill, type Strings } from "../i18n/index.js";
import { character } from "../character.js";

/** Ukuran avatar per mode (px) — untuk animasi pindah mode ~350ms. */
export const CHAT_AVATAR_PX: Record<"s" | "m" | "l", number> = { s: 170, m: 250, l: 310 };
export const TALK_AVATAR_PX = 400;
export const TALK_AVATAR_ASKING_PX = 290;

/** Judul status panggung ("Bibo sedang bekerja") — nama dari character.name + i18n. */
export function stageTitle(pose: AvatarPose, t: Strings): string {
  const key = (
    {
      idle: "stIdle",
      thinking: "stThinking",
      working: "stWorking",
      asking: "stAsking",
      listening: "stListening",
      celebrate: "stCelebrate",
      confused: "stConfused",
      sleeping: "stSleeping",
      offline: "stOffline",
    } as const
  )[pose];
  return fill(t[key], { name: character.name });
}

/** Sub-judul status (petunjuk lampu, dsb.). */
export function stageSub(pose: AvatarPose, t: Strings): string {
  const key = (
    {
      idle: "shIdle",
      thinking: "shThinking",
      working: "shWorking",
      asking: "shAsking",
      listening: "shListening",
      celebrate: "shCelebrate",
      confused: "shConfused",
      sleeping: "shSleeping",
      offline: "shOffline",
    } as const
  )[pose];
  return t[key];
}

/**
 * Chip aktivitas di atas panggung ("Mengetik…"); undefined saat idle
 * (tidak ada aktivitas).
 */
export function activityChip(pose: AvatarPose, variant: WorkingVariant | undefined, t: Strings): string | undefined {
  if (pose === "idle") return undefined;
  if (pose === "working") {
    const key = (
      {
        typing: "chipWorkingTyping",
        reading: "chipWorkingReading",
        running: "chipWorkingRunning",
        searching: "chipWorkingSearching",
        delegating: "chipWorkingDelegating",
        generic: "chipWorkingGeneric",
      } as const
    )[variant ?? "generic"];
    return t[key];
  }
  const key = (
    {
      thinking: "chipThinking",
      listening: "chipListening",
      asking: "chipAsking",
      celebrate: "chipCelebrate",
      confused: "chipConfused",
      sleeping: "chipSleeping",
      offline: "chipOffline",
    } as const
  )[pose];
  return t[key];
}
