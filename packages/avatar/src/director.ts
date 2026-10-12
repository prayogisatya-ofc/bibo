/**
 * IdleDirector — jadwal perilaku mikro anti-monoton (CHARACTER.md §9.1).
 *
 * Aktif pada pose idle (penuh) dan listening (terbatas: hanya lookAround).
 * Memakai PRNG ber-seed agar deterministik saat tes.
 */

import { jittered, weightedPick } from "./prng.js";
import { T } from "./timing.js";

export type DirectorBehavior =
  | "lookAround"
  | "antennaWiggle"
  | "waveR"
  | "waveL"
  | "stretch"
  | "hum"
  | "miniJump"
  | "antennaSpin"
  | "yawn";

const ORDER: DirectorBehavior[] = [
  "lookAround",
  "antennaWiggle",
  "waveR",
  "waveL",
  "stretch",
  "hum",
  "miniJump",
  "antennaSpin",
  "yawn",
];

export interface DirectorHooks {
  rand: () => number;
  /** true bila pose saat ini idle; "limited" bila listening. */
  mode(): "idle" | "limited" | "off";
  reducedMotion(): boolean;
  mood(): "neutral" | "happy" | "wary";
  onBehavior(b: DirectorBehavior): void;
  /** Dipicu setelah 120 s idle: yawn → mengantuk → tidur. */
  onSleepy(): void;
}

export class IdleDirector {
  private readonly hooks: DirectorHooks;
  private timers = new Set<number>();
  private lastFired = new Map<DirectorBehavior, number>();
  private lastBehavior: DirectorBehavior | null = null;
  private idleSince = 0;
  private running = false;
  private slept = false;

  constructor(hooks: DirectorHooks) {
    this.hooks = hooks;
  }

  /** Dipanggil renderer setiap pose menjadi idle. */
  notifyIdle(): void {
    this.idleSince = Date.now();
    this.slept = false;
    this.lastBehavior = null;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleGap();
  }

  stop(): void {
    this.running = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private scheduleGap(): void {
    if (!this.running) return;
    const gap = jittered(
      this.hooks.rand,
      (T.director.gapMinMs + T.director.gapMaxMs) / 2,
      0.45,
    );
    this.later(gap, () => this.fire());
  }

  private fire(): void {
    if (!this.running) return;
    const mode = this.hooks.mode();
    const now = Date.now();
    // Urutan mengantuk: 120 s idle → tidur.
    if (mode === "idle" && !this.slept && now - this.idleSince >= T.director.sleepAfterMs) {
      this.slept = true;
      this.hooks.onSleepy();
      this.scheduleGap();
      return;
    }
    if (mode === "off") {
      this.scheduleGap();
      return;
    }
    const pick = this.pick(now, mode);
    if (pick) {
      this.lastFired.set(pick, now);
      this.lastBehavior = pick;
      this.hooks.onBehavior(pick);
    }
    this.scheduleGap();
  }

  /** Pilih perilaku + catat seperti fire() (untuk tes). */
  pickForTest(now: number, mode: "idle" | "limited"): DirectorBehavior | null {
    const pick = this.pick(now, mode);
    if (pick) {
      this.lastFired.set(pick, now);
      this.lastBehavior = pick;
    }
    return pick;
  }

  private pick(now: number, mode: "idle" | "limited"): DirectorBehavior | null {
    const reduced = this.hooks.reducedMotion();
    const mood = this.hooks.mood();
    const idleFor = now - this.idleSince;
    const candidates: { b: DirectorBehavior; w: number }[] = [];
    for (const b of ORDER) {
      const spec = T.director.behaviors[b];
      if (!spec) continue;
      if (reduced && b !== "lookAround") continue;
      if (mode === "limited" && b !== "lookAround") continue;
      if (b === this.lastBehavior) continue;
      const last = this.lastFired.get(b) ?? -Infinity;
      if (now - last < spec.cooldownMs) continue;
      if (b === "yawn" && idleFor < 60000) continue;
      if ((b === "hum" || b === "miniJump") && mood === "wary") continue;
      let w = spec.weight;
      if ((b === "waveR" || b === "waveL") && mood === "happy") w *= 2;
      if (b === "lookAround" && mood === "wary") w *= 1.5;
      candidates.push({ b, w });
    }
    if (candidates.length === 0) return null;
    const idx = weightedPick(
      this.hooks.rand,
      candidates.map((c) => c.w),
    );
    return (candidates[idx] as { b: DirectorBehavior }).b;
  }
}
