/**
 * Kontrak AvatarRenderer — CHARACTER.md §12.
 *
 * Decoupled dari @bibo/protocol: tipe avatar didefinisikan di sini dan
 * package ini TIDAK mengimpor tipe avatar dari package protocol.
 * Logika bisnis hanya memanggil interface ini; tidak boleh menyentuh DOM SVG.
 */

export type AvatarPose =
  | "idle"
  | "thinking"
  | "working"
  | "asking"
  | "celebrate"
  | "confused"
  | "sleeping"
  | "listening"
  | "offline";

export type WorkingVariant =
  | "typing"
  | "reading"
  | "running"
  | "searching"
  | "delegating"
  | "generic";

export type AvatarMood = "neutral" | "happy" | "wary";

export type ReactionKind =
  | "hello"
  | "nod"
  | "perk"
  | "startle"
  | "shrug"
  | "thanks"
  | "poke";

export interface AvatarMountOptions {
  theme: "light" | "dark";
  reducedMotion: boolean;
  /** PRNG seed; tetap saat tes agar jadwal acak deterministik. */
  seed?: number;
  /** Nama karakter untuk aria-label (tidak di-hardcode di renderer). */
  characterName: string;
  /** Label aksesibilitas kustom; bila tidak ada dipakai `${characterName}: ${pose}`. */
  getAriaLabel?: (pose: AvatarPose, variant?: WorkingVariant) => string;
}

export interface AvatarPoseOptions {
  variant?: WorkingVariant;
  /** Durasi pose transient (ms); celebrate default 3000, confused default 4000. */
  durationMs?: number;
}

export interface AvatarRenderer {
  mount(el: HTMLElement, opts: AvatarMountOptions): void;
  setPose(pose: AvatarPose, opts?: AvatarPoseOptions): void;
  /** 0..1; >0 mengaktifkan overlay speaking (mulut parametris), 0 menonaktifkan. */
  setSpeechLevel(level: number): void;
  /**
   * 0..1; lampu antena berdenyut mengikuti level saat pose Mendengar
   * (CHARACTER.md §4.3). Revisi kontrak yang disetujui 2026-10-13
   * (ADR-009): menggantikan deviasi lama di mana setSpeechLevel merangkap
   * sebagai driver mic-level saat pose listening.
   */
  setMicLevel(level: number): void;
  /** Arah pandang -1..1 (null-safe: nilai di-clamp). */
  setLook(x: number, y: number): void;
  setMood(mood: AvatarMood): void;
  react(kind: ReactionKind): void;
  setTheme(theme: "light" | "dark"): void;
  setReducedMotion(on: boolean): void;
  /** Dipanggil saat tab disembunyikan / di luar viewport. */
  pause(): void;
  resume(): void;
  destroy(): void;
}

/** Daftar 9 pose dasar untuk galeri dev & E2E. */
export const AVATAR_POSES: readonly AvatarPose[] = [
  "idle",
  "thinking",
  "working",
  "asking",
  "celebrate",
  "confused",
  "sleeping",
  "listening",
  "offline",
] as const;

/** Daftar 7 reaksi untuk galeri dev. */
export const AVATAR_REACTIONS: readonly ReactionKind[] = [
  "hello",
  "nod",
  "perk",
  "startle",
  "shrug",
  "thanks",
  "poke",
] as const;

/** Daftar 6 varian working untuk galeri dev. */
export const WORKING_VARIANTS: readonly WorkingVariant[] = [
  "typing",
  "reading",
  "running",
  "searching",
  "delegating",
  "generic",
] as const;

export function isAvatarPose(v: string): v is AvatarPose {
  return (AVATAR_POSES as readonly string[]).includes(v);
}
