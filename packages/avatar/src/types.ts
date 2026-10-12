export type { AvatarPose } from "@codepet/protocol";
export { AVATAR_POSES, isAvatarPose } from "@codepet/protocol";

/**
 * Renderer avatar (PRD §8.5). Logika bisnis hanya memanggil interface ini.
 * Bicara = voice-pulse via setSpeechLevel (TANPA mulut — setMouth tidak ada).
 */
export interface AvatarRenderer {
  mount(el: HTMLElement, opts: { theme: "light" | "dark"; reducedMotion: boolean }): void;
  /** Mata + badge + tangan + badan + props untuk satu pose. */
  setPose(pose: import("@codepet/protocol").AvatarPose): void;
  /** 0..1 voice-pulse; dipanggil ≤ 30 Hz saat bicara (M4/TTS atau slider galeri). */
  setSpeechLevel(level: number): void;
  /** Arah pandang -1..1 (opsional; dipakai idle micro-behavior). */
  setLook(x: number, y: number): void;
  setTheme(theme: "light" | "dark"): void;
  destroy(): void;
}
