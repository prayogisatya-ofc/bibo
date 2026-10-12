/**
 * BotRenderer — implementasi AvatarRenderer (CHARACTER.md §12).
 *
 * Orkestrasi tiga lapisan animasi WAAPI (A ambient, B pose, C reaksi),
 * overlay speaking, IdleDirector, eye tracking, poke, mood, dan transisi.
 * Satu-satunya angka waktu berasal dari T (timing.ts).
 */

import { Animator, type AnimLayer } from "./animator.js";
import { IdleDirector, type DirectorBehavior } from "./director.js";
import { mouthParams, smoothLevel } from "./mouth.js";
import {
  applyPoseLayers,
  doWave,
  lampPattern,
  startSpeakingVisuals,
  stopSpeakingVisuals,
  type HandWhich,
  type LampColor,
  type PoseOps,
} from "./poses.js";
import { jittered, mulberry32 } from "./prng.js";
import { T } from "./timing.js";
import {
  type AvatarMood,
  type AvatarMountOptions,
  type AvatarPose,
  type AvatarPoseOptions,
  type AvatarRenderer,
  type ReactionKind,
  type WorkingVariant,
} from "./types.js";
import { BOT_SVG, buildConfettiPool } from "./svg.js";

const PROP_IDS = [
  "q-bubble", "q-bubble-2", "prop-note", "prop-disc", "keyboard",
  "sparkles", "prop-doc", "prop-chip", "prop-mini", "prop-gear",
];
const DOT_IDS = ["dot-1", "dot-2", "dot-3"];
const ZZZ_IDS = ["zzz-1", "zzz-2", "zzz-3"];
const SWEAT_IDS = ["sweat-1", "sweat-2"];
const ARC_IDS = ["arc-r1", "arc-r2", "arc-r3", "arc-l1", "arc-l2", "arc-l3"];

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(max, Math.max(min, v));
}

export class BotRenderer implements AvatarRenderer, PoseOps {
  readonly anim = new Animator();
  readonly T = T;
  rand: () => number = mulberry32(Date.now() % 4294967296);
  get reduced(): boolean {
    return this.reducedMotion;
  }

  svg!: SVGSVGElement;

  private host: HTMLElement | null = null;
  private pose: AvatarPose = "idle";
  private variant: WorkingVariant = "typing";
  private moodState: AvatarMood = "neutral";
  private reducedMotion = false;
  private theme: "light" | "dark" = "dark";
  private characterName = "";
  private getAriaLabel?: AvatarMountOptions["getAriaLabel"];
  private destroyed = false;
  private paused = false;

  private poseTimers = new Set<number>();
  private reactionTimers = new Set<number>();
  private moodTimer: number | null = null;
  private blinkTimer: number | null = null;
  private speakStopTimer: number | null = null;

  private eyeVariant = "";
  private mouthVariant = "";
  private handPos: Record<HandWhich, { x: number; y: number }> = {
    l: { x: 0, y: 0 },
    r: { x: 0, y: 0 },
  };
  private handLayer: Record<HandWhich, "back" | "front"> = { l: "back", r: "back" };
  private propShown = new Map<string, boolean>();

  // Speaking overlay.
  private speaking = false;
  private speakLevel = 0;
  private speakA = 0;

  // Mic level (pose Mendengar; CHARACTER.md §4.3).
  private micLevel = 0;

  // Eye tracking.
  private lookTarget = { x: 0, y: 0 };
  private lookCur = { x: 0, y: 0 };
  private lookUser = false;
  private clockId: number | null = null;

  // Poke.
  private pokeTimes: number[] = [];
  private lastDizzy = 0;

  private director: IdleDirector | null = null;
  private autoSleep = false;
  private hoverAt = 0;
  private lastHoverWave = 0;
  private io: IntersectionObserver | null = null;

  private onClick = (): void => this.poke();
  private onMouseMove = (e: MouseEvent): void => this.hover(e);
  private onVisibility = (): void => {
    if (document.hidden) this.pause();
    else this.resume();
  };

  constructor() {}

  /* ------------------------------ PoseOps ------------------------------ */

  el(id: string): Element {
    const e = this.svg.querySelector(`#${CSS.escape(id)}`);
    if (!e) throw new Error(`avatar: elemen #${id} tidak ditemukan`);
    return e;
  }

  later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.poseTimers.delete(id);
      if (!this.destroyed) fn();
    }, ms);
    this.poseTimers.add(id);
  }

  /** Timer lapisan C: bertahan saat pose berganti, kecuali reaksi dibatalkan. */
  clater(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.reactionTimers.delete(id);
      if (!this.destroyed) fn();
    }, ms);
    this.reactionTimers.add(id);
  }

  private clearReactionTimers(): void {
    for (const t of this.reactionTimers) window.clearTimeout(t);
    this.reactionTimers.clear();
  }

  eye(): string {
    return this.eyeVariant;
  }

  mouth(): string {
    return this.mouthVariant;
  }

  setEyes(v: string): void {
    if (v === this.eyeVariant) return;
    const prev = this.eyeVariant;
    this.eyeVariant = v;
    for (const eyeId of ["eye-l", "eye-r"]) {
      const eye = this.el(eyeId);
      const prevEl = prev ? eye.querySelector(`.${prev}`) : null;
      const nextEl = eye.querySelector(`.${v}`);
      if (prevEl) {
        if (!this.reducedMotion) {
          this.anim.start(prevEl, "xfade", "A", [{ opacity: 1 }, { opacity: 0 }], {
            duration: T.transition.eyeMouthMs,
            fill: "forwards",
          });
        }
        (prevEl as HTMLElement).style.opacity = "0";
      }
      if (nextEl) {
        if (!this.reducedMotion) {
          this.anim.start(nextEl, "xfade", "A", [{ opacity: 0 }, { opacity: 1 }], {
            duration: T.transition.eyeMouthMs,
            fill: "forwards",
          });
        }
        (nextEl as HTMLElement).style.opacity = "1";
      }
    }
  }

  setMouth(v: string): void {
    if (v === this.mouthVariant) return;
    const prev = this.mouthVariant;
    this.mouthVariant = v;
    const mouth = this.el("mouth");
    const prevEl = prev ? mouth.querySelector(`.${prev}`) : null;
    const nextEl = mouth.querySelector(`.${v}`);
    if (prevEl) {
      if (!this.reducedMotion) {
        this.anim.start(prevEl, "xfade", "A", [{ opacity: 1 }, { opacity: 0 }], {
          duration: T.transition.eyeMouthMs,
          fill: "forwards",
        });
      }
      (prevEl as HTMLElement).style.opacity = "0";
    }
    if (nextEl) {
      if (!this.reducedMotion) {
        this.anim.start(nextEl, "xfade", "A", [{ opacity: 0 }, { opacity: 1 }], {
          duration: T.transition.eyeMouthMs,
          fill: "forwards",
        });
      }
      (nextEl as HTMLElement).style.opacity = "1";
    }
  }

  moveHand(which: HandWhich, x: number, y: number, ms: number, ease: string = T.ease.out): void {
    const cur = this.handPos[which];
    const hand = this.el(which === "l" ? "hand-l" : "hand-r");
    this.anim.stop(hand, "hand-move");
    (hand as HTMLElement).style.setProperty("translate", `${x}px ${y}px`);
    if (!this.reducedMotion && ms > 0) {
      this.anim.start(
        hand,
        "hand-move",
        "B",
        [{ translate: `${cur.x}px ${cur.y}px` }, { translate: `${x}px ${y}px` }],
        { duration: ms, easing: ease, fill: "backwards" },
      );
    } else if (this.reducedMotion) {
      // Reduced motion: pindah posisi tanpa gerak, crossfade 80 ms.
      this.anim.start(hand, "hand-move", "B", [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }], {
        duration: T.transition.handLayerMs,
      });
    }
    this.handPos[which] = { x, y };
  }

  handBase(which: HandWhich): { x: number; y: number } {
    return { ...this.handPos[which] };
  }

  wrist(which: HandWhich): Element {
    const w = this.el(which === "l" ? "hand-l" : "hand-r").querySelector(".hand-wave");
    if (!w) throw new Error("avatar: .hand-wave tidak ditemukan");
    return w;
  }

  placeHand(which: HandWhich, where: "back" | "front"): void {
    if (this.handLayer[which] === where) return;
    this.handLayer[which] = where;
    const hand = this.el(which === "l" ? "hand-l" : "hand-r");
    const target = this.el(where === "front" ? "hands-front" : "hands-back");
    (hand as HTMLElement).style.opacity = "";
    target.appendChild(hand);
    if (this.reducedMotion) return;
    // Crossfade 80 ms agar tidak melompat (§3.2).
    this.anim.start(hand, "layer", "B", [{ opacity: 0 }, { opacity: 1 }], {
      duration: T.transition.handLayerMs,
      easing: T.ease.out,
    });
  }

  setLamp(color: LampColor): void {
    this.el("bulb-core").setAttribute("fill", `var(--bot-${color})`);
  }

  floatBody(p: { ampY: number; periodMs: number; tiltDeg?: number; bowDeg?: number; swayDeg?: number; swayPeriodMs?: number; shakeX?: number }): void {
    const body = this.el("body-float");
    this.anim.stop(body, "float-y");
    this.anim.stop(body, "sway");
    if (this.reducedMotion) return;
    const period = jittered(this.rand, p.periodMs, 0.15);
    const rot = (p.tiltDeg ?? 0) + (p.bowDeg ?? 0);
    const amp = p.ampY * this.moodAmp();
    const shakeX = p.shakeX ?? 0;
    this.anim.start(
      body,
      "float-y",
      "A",
      [
        { translate: "0px 0px" },
        { translate: `${shakeX}px ${-amp}px`, offset: 0.5 },
        { translate: "0px 0px" },
      ],
      { duration: period, easing: T.ease.soft, iterations: Infinity },
    );
    const swayDeg = p.swayDeg ?? 0;
    if (swayDeg > 0 || rot !== 0) {
      this.anim.start(
        body,
        "sway",
        "A",
        [{ rotate: `${rot - swayDeg}deg` }, { rotate: `${rot + swayDeg}deg` }],
        {
          duration: p.swayPeriodMs ?? period * 2,
          easing: T.ease.soft,
          iterations: Infinity,
          direction: "alternate",
        },
      );
    }
  }

  stopBody(): void {
    const body = this.el("body-float");
    this.anim.stop(body, "float-y");
    this.anim.stop(body, "sway");
  }

  shadowSync(periodMs: number, on: boolean): void {
    const sh = this.el("shadow");
    this.anim.stop(sh, "sh-scale");
    if (!on || this.reducedMotion) return;
    const s = T.idle.shadow;
    this.anim.start(
      sh,
      "sh-scale",
      "A",
      [
        { scale: "1 1", opacity: s.opacityFrom },
        { scale: `${s.scaleX} 1`, opacity: s.opacityTo, offset: 0.5 },
        { scale: "1 1", opacity: s.opacityFrom },
      ],
      { duration: periodMs, easing: T.ease.soft, iterations: Infinity },
    );
  }

  antennaFollow(periodMs: number, on: boolean): void {
    const ant = this.el("antenna");
    this.anim.stop(ant, "follow");
    if (!on || this.reducedMotion) return;
    this.anim.start(
      ant,
      "follow",
      "A",
      [{ rotate: "3deg" }, { rotate: "-3deg" }],
      {
        duration: periodMs,
        delay: 120,
        easing: T.ease.soft,
        iterations: Infinity,
        direction: "alternate",
      },
    );
  }

  showProp(id: string, show: boolean, ms = T.transition.eyeMouthMs): void {
    if (this.propShown.get(id) === show) return;
    this.propShown.set(id, show);
    const p = this.el(id);
    (p as HTMLElement).style.opacity = show ? "1" : "0";
    if (this.reducedMotion) return;
    this.anim.start(p, "show", "B", [{ opacity: show ? 0 : 1 }, { opacity: show ? 1 : 0 }], {
      duration: ms,
      easing: T.ease.out,
      fill: "backwards",
    });
  }

  moodAmp(): number {
    return this.moodState === "happy" ? 1.3 : this.moodState === "wary" ? 0.7 : 1;
  }

  /* --------------------------- AvatarRenderer --------------------------- */

  mount(host: HTMLElement, opts: AvatarMountOptions): void {
    if (this.destroyed) return;
    this.host = host;
    this.theme = opts.theme;
    this.reducedMotion = opts.reducedMotion;
    this.characterName = opts.characterName;
    this.getAriaLabel = opts.getAriaLabel;
    // PRNG ber-seed dari mount opts (deterministik saat tes).
    this.rand = mulberry32(opts.seed ?? Date.now() % 4294967296);

    const tpl = document.createElement("template");
    tpl.innerHTML = BOT_SVG.trim();
    const svg = tpl.content.querySelector("svg");
    if (!svg) throw new Error("avatar: template svg rusak");
    this.svg = svg as unknown as SVGSVGElement;
    buildConfettiPool(this.svg, T.celebrate.confetti.pool);
    this.svg.dataset.theme = this.theme;
    host.appendChild(this.svg);

    this.svg.addEventListener("click", this.onClick);
    window.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("visibilitychange", this.onVisibility);
    if (typeof IntersectionObserver === "function") {
      this.io = new IntersectionObserver((entries) => {
        const vis = entries.some((e) => e.isIntersecting);
        if (vis) this.resume();
        else this.pause();
      });
      this.io.observe(this.svg);
    }

    this.director = new IdleDirector({
      rand: this.rand,
      mode: () => (this.pose === "idle" ? "idle" : this.pose === "listening" ? "limited" : "off"),
      reducedMotion: () => this.reducedMotion,
      mood: () => this.moodState,
      onBehavior: (b) => this.runBehavior(b),
      onSleepy: () => this.autoSleepNow(),
    });

    this.applyPose("idle", "typing", false);
    this.director.notifyIdle();
    this.director.start();
    this.updateAria();
  }

  setPose(pose: AvatarPose, opts: AvatarPoseOptions = {}): void {
    if (this.destroyed) return;
    this.autoSleep = false;
    const variant = pose === "working" ? (opts.variant ?? this.variant) : "typing";
    // Reaksi critical:false dibatalkan bila pose → asking/confused/working (§5.1).
    const cancelReactions = pose === "asking" || pose === "confused" || pose === "working";
    this.applyPose(pose, variant, cancelReactions);
    // Transient: celebrate 3 s → idle + happy; confused 4 s → idle + wary.
    if (pose === "celebrate") {
      const ms = opts.durationMs ?? T.celebrate.durationMs;
      this.later(ms, () => {
        this.setMood("happy");
        this.setPose("idle");
      });
    } else if (pose === "confused") {
      const ms = opts.durationMs ?? T.confused.durationMs;
      this.later(ms, () => {
        this.setMood("wary");
        this.setPose("idle");
      });
    }
  }

  setSpeechLevel(level: number): void {
    if (this.destroyed) return;
    const lv = clamp(level, 0, 1);
    this.speakLevel = lv;
    if (lv > 0) {
      if (this.speakStopTimer !== null) {
        window.clearTimeout(this.speakStopTimer);
        this.speakStopTimer = null;
      }
      if (!this.speaking) this.startSpeaking();
    } else if (this.speaking && this.speakStopTimer === null) {
      // Berhenti bila level tetap 0 selama 100 ms; mulut tertutup ≤100 ms (§6.7).
      this.speakStopTimer = window.setTimeout(() => {
        this.speakStopTimer = null;
        if (this.speakLevel === 0) this.stopSpeaking();
      }, T.speaking.mouth.stopCloseMs);
    }
  }

  setMicLevel(level: number): void {
    if (this.destroyed) return;
    const lv = clamp(level, 0, 1);
    this.micLevel = lv;
    // CHARACTER.md §4.3: pola lampu Mendengar = denyut mengikuti level mic.
    // (ADR-009: dipindah dari setSpeechLevel agar kontrak bersih.)
    if (this.pose !== "listening") return;
    const bulb = this.el("bulb") as HTMLElement;
    bulb.style.setProperty("scale", `${1 + 0.25 * lv}`);
    bulb.style.opacity = String(0.7 + 0.3 * lv);
  }

  setLook(x: number, y: number): void {
    if (this.destroyed) return;
    this.lookTarget = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
    this.lookUser = true;
    if (this.lookAllowed()) this.ensureClock();
  }

  setMood(mood: AvatarMood): void {
    if (this.destroyed) return;
    this.moodState = mood;
    this.svg.dataset.mood = mood;
    if (this.moodTimer !== null) window.clearTimeout(this.moodTimer);
    if (mood !== "neutral") {
      this.moodTimer = window.setTimeout(() => {
        this.moodTimer = null;
        this.moodState = "neutral";
        this.svg.dataset.mood = "neutral";
      }, T.mood.ttlMs);
    }
    this.updateAria();
  }

  react(kind: ReactionKind): void {
    if (this.destroyed || this.paused) return;
    const layer: AnimLayer = "C";
    switch (kind) {
      case "hello": {
        const nod = this.el("body-nod");
        this.anim.start(
          nod,
          "hello",
          layer,
          [
            { scale: "0.6 0.6", opacity: 0 },
            { scale: "1.08 1.08", opacity: 1, offset: 0.7 },
            { scale: "1 1", opacity: 1 },
          ],
          { duration: T.react.hello.appearMs, easing: T.ease.pop },
        );
        doWave(this, "r");
        this.doBlinkNow();
        break;
      }
      case "nod": {
        const nod = this.el("body-nod");
        const e0 = this.eyeVariant;
        this.anim.start(
          nod,
          "nod",
          layer,
          [
            { translate: "0px 0px" },
            { translate: `0px ${T.react.nod.y}px`, offset: 0.4 },
            { translate: "0px 0px" },
          ],
          { duration: T.react.nod.ms, easing: T.ease.soft },
        );
        this.setEyes("e-happy");
        this.clater(T.react.nod.ms, () => {
          if (this.eye() === "e-happy") this.setEyes(e0);
        });
        break;
      }
      case "perk": {
        const ant = this.el("antenna");
        this.anim.start(
          ant,
          "perk",
          layer,
          [{ rotate: "0deg" }, { rotate: "-6deg", offset: 0.5 }, { rotate: "0deg" }],
          { duration: 300, easing: T.ease.soft },
        );
        const e0 = this.eyeVariant;
        this.setEyes("e-wide");
        this.clater(200, () => {
          if (this.eye() === "e-wide") this.setEyes(e0);
        });
        const bulb = this.el("bulb-core");
        this.anim.start(bulb, "perk-flash", layer, [{ opacity: 0.4 }, { opacity: 1 }], {
          duration: 150,
          direction: "alternate",
          iterations: 2,
        });
        break;
      }
      case "startle": {
        const nod = this.el("body-nod");
        this.anim.start(
          nod,
          "startle",
          layer,
          [
            { translate: "0px 0px" },
            { translate: `0px ${T.react.startle.jumpY}px`, offset: 0.5 },
            { translate: "0px 0px" },
          ],
          { duration: T.react.startle.ms, easing: T.ease.out },
        );
        for (const id of ["eye-l", "eye-r"]) {
          this.anim.start(
            this.el(id),
            "startle-eyes",
            layer,
            [{ scale: "1 0.05" }, { scale: "1 1.2" }, { scale: "1 1" }],
            { duration: 220, easing: T.ease.out },
          );
        }
        this.antennaWiggle(layer);
        break;
      }
      case "shrug": {
        const m0 = this.mouthVariant;
        this.setMouth("m-flat");
        for (const which of ["l", "r"] as const) {
          const b = this.handBase(which);
          const hand = this.el(which === "l" ? "hand-l" : "hand-r");
          this.anim.start(
            hand,
            "shrug",
            layer,
            [
              { translate: `${b.x}px ${b.y}px` },
              { translate: `${b.x}px ${b.y - T.react.shrug.y}px`, offset: 0.4 },
              { translate: `${b.x}px ${b.y}px` },
            ],
            { duration: T.react.shrug.ms, easing: T.ease.soft },
          );
        }
        this.clater(T.react.shrug.ms, () => {
          if (this.mouth() === "m-flat") this.setMouth(m0);
        });
        break;
      }
      case "thanks": {
        const nod = this.el("body-nod");
        const e0 = this.eyeVariant;
        this.anim.start(
          nod,
          "thanks",
          layer,
          [{ translate: "0px 0px" }, { translate: "0px 2px", offset: 0.5 }, { translate: "0px 0px" }],
          { duration: T.react.thanks.ms, easing: T.ease.soft },
        );
        this.setEyes("e-happy");
        this.clater(T.react.thanks.ms, () => {
          if (this.eye() === "e-happy") this.setEyes(e0);
        });
        break;
      }
      case "poke":
        this.poke();
        break;
    }
  }

  setTheme(theme: "light" | "dark"): void {
    this.theme = theme;
    if (this.svg) this.svg.dataset.theme = theme;
  }

  setReducedMotion(on: boolean): void {
    if (this.reducedMotion === on) return;
    this.reducedMotion = on;
    // Terapkan ulang pose agar loop berhenti / props statis (§13).
    this.applyPose(this.pose, this.variant, false);
  }

  pause(): void {
    if (this.paused || this.destroyed) return;
    this.paused = true;
    this.anim.pauseAll();
    this.director?.stop();
    this.clearBlink();
    this.stopClock();
  }

  resume(): void {
    if (!this.paused || this.destroyed) return;
    this.paused = false;
    this.anim.resumeAll();
    this.director?.start();
    this.scheduleBlink();
    if (this.clockNeeded()) this.ensureClock();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const t of this.poseTimers) window.clearTimeout(t);
    this.poseTimers.clear();
    this.clearReactionTimers();
    if (this.moodTimer !== null) window.clearTimeout(this.moodTimer);
    if (this.speakStopTimer !== null) window.clearTimeout(this.speakStopTimer);
    this.clearBlink();
    this.stopClock();
    this.director?.stop();
    this.anim.cancelAll();
    this.svg?.removeEventListener("click", this.onClick);
    window.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.io?.disconnect();
    this.svg?.remove();
    this.host = null;
  }

  /* ------------------------- Dev-only (galeri) ------------------------- */

  /** Slow-mo galeri: skala playback semua animasi. Di luar kontrak §12. */
  setPlaybackRate(rate: number): void {
    this.anim.setRate(rate);
  }

  /** Mode beku galeri: ?freeze=<ms> — seek semua animasi ke t lalu jeda. */
  freeze(ms: number): void {
    for (const t of this.poseTimers) window.clearTimeout(t);
    this.poseTimers.clear();
    this.clearReactionTimers();
    this.director?.stop();
    this.clearBlink();
    this.stopClock();
    this.anim.seekAll(ms);
  }

  /* ------------------------------ internal ------------------------------ */

  private applyPose(pose: AvatarPose, variant: WorkingVariant, cancelReactions: boolean): void {
    this.pose = pose;
    this.variant = variant;
    // Bersihkan timer & lapisan pose lama; reaksi hanya bila diminta (§5.1).
    for (const t of this.poseTimers) window.clearTimeout(t);
    this.poseTimers.clear();
    this.anim.stopLayer("A");
    this.anim.stopLayer("B");
    if (cancelReactions) {
      this.anim.stopLayer("C");
      this.clearReactionTimers();
    }
    this.resetTransientStyles();
    this.resetProps();
    // Tangan kembali ke lapisan belakang; pose menempatkan ulang bila perlu.
    this.placeHand("l", "back");
    this.placeHand("r", "back");
    // Koreografi enter: antisipasi (§10), kecuali tidur/offline.
    if (pose !== "sleeping" && pose !== "offline" && !this.reducedMotion) {
      const nod = this.el("body-nod");
      this.anim.start(
        nod,
        "anticipate",
        "B",
        [{ translate: "0px 0px" }, { translate: "0px 2px" }, { translate: "0px 0px" }],
        { duration: 160, easing: T.ease.soft },
      );
    }
    applyPoseLayers(this, pose, variant);
    // Overlay speaking bertahan di atas pose baru (mulut/busur/lampu).
    if (this.speaking && pose !== "offline") {
      this.setMouth("m-open");
      startSpeakingVisuals(this, { lamp: pose !== "asking" && pose !== "sleeping" });
    }
    this.svg.dataset.pose = pose;
    this.svg.dataset.variant = pose === "working" ? variant : "";
    this.svg.dataset.speaking = String(this.speaking);
    if (pose === "idle") this.director?.notifyIdle();
    this.scheduleBlink();
    this.updateAria();
  }

  /** Kembalikan gaya sementara yang ditulis pose/reaksi ke netral. */
  private resetTransientStyles(): void {
    const set = (id: string, props: Record<string, string>): void => {
      const e = this.el(id) as HTMLElement;
      for (const [k, v] of Object.entries(props)) {
        if (v === "") e.style.removeProperty(k);
        else e.style.setProperty(k, v);
      }
    };
    set("body-nod", { translate: "", scale: "", opacity: "", rotate: "" });
    set("antenna", { rotate: "" });
    set("eyes", { translate: "" });
    set("mouth", { scale: "" });
    set("sound-arcs", { opacity: "" });
    const bulb = this.el("bulb-core");
    bulb.setAttribute("opacity", "1");
    const bulbG = this.el("bulb");
    (bulbG as HTMLElement).style.setProperty("scale", "");
    (bulbG as HTMLElement).style.opacity = "";
    for (const g of this.svg.querySelectorAll(".e-glint")) {
      (g as HTMLElement).style.setProperty("translate", "");
    }
    for (const id of ["hand-l", "hand-r"]) {
      (this.el(id) as HTMLElement).style.opacity = "";
    }
    const tongue = this.el("mopen-tongue");
    tongue.setAttribute("opacity", "0");
  }

  /** Sembunyikan semua props; pose menghidupkan yang dibutuhkannya. */
  private resetProps(): void {
    this.propShown.clear();
    const hide = (id: string): void => {
      (this.el(id) as HTMLElement).style.opacity = "0";
    };
    for (const id of PROP_IDS) hide(id);
    for (const id of DOT_IDS) hide(id);
    for (const id of ZZZ_IDS) hide(id);
    for (const id of SWEAT_IDS) hide(id);
    for (const id of ARC_IDS) hide(id);
    const snot = this.el("snot") as unknown as SVGCircleElement;
    snot.setAttribute("r", "0");
    snot.setAttribute("opacity", "0");
    const mag = this.el("hand-r").querySelector(".mag");
    if (mag) (mag as Element).setAttribute("opacity", "0");
    this.el("key-row").setAttribute("fill", "#C9D2F7");
    const disc = this.el("prop-disc");
    (disc as HTMLElement).style.opacity = "0";
  }

  private updateAria(): void {
    if (!this.svg) return;
    const label = this.getAriaLabel
      ? this.getAriaLabel(this.pose, this.pose === "working" ? this.variant : undefined)
      : `${this.characterName}: ${this.pose}`;
    this.svg.setAttribute("aria-label", label);
  }

  /* ------------------------------- blink ------------------------------- */

  private clearBlink(): void {
    if (this.blinkTimer !== null) {
      window.clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }
  }

  private scheduleBlink(): void {
    this.clearBlink();
    if (this.destroyed || this.paused) return;
    if (this.pose === "sleeping" || this.pose === "offline") return;
    const b = T.idle.blink;
    let interval = jittered(this.rand, (b.minIntervalMs + b.maxIntervalMs) / 2, 0.3);
    if (this.reducedMotion) interval *= 2;
    if (this.moodState === "happy") interval /= 1.5;
    this.blinkTimer = window.setTimeout(() => {
      this.blinkTimer = null;
      this.doBlink();
    }, interval);
  }

  private doBlinkNow(): void {
    const b = T.idle.blink;
    for (const id of ["eye-l", "eye-r"]) {
      this.anim.start(
        this.el(id),
        "blink",
        "A",
        [{ scale: "1 1" }, { scale: "1 0.08", offset: 0.5 }, { scale: "1 1" }],
        { duration: b.closeMs + b.openMs, easing: T.ease.soft },
      );
    }
  }

  private doBlink(): void {
    if (this.destroyed || this.paused) return;
    const b = T.idle.blink;
    const roll = this.rand();
    const slow = !this.reducedMotion && roll < b.slowChance;
    const closeMs = this.reducedMotion ? b.closeMs / 2 : slow ? b.slowCloseMs : b.closeMs;
    const openMs = this.reducedMotion ? b.openMs / 2 : b.openMs;
    const one = (cMs: number, oMs: number): void => {
      for (const id of ["eye-l", "eye-r"]) {
        this.anim.start(
          this.el(id),
          "blink",
          "A",
          [{ scale: "1 1" }, { scale: "1 0.08", offset: cMs / (cMs + oMs) }, { scale: "1 1" }],
          { duration: cMs + oMs, easing: T.ease.soft },
        );
      }
    };
    one(closeMs, openMs);
    // 15% kedip ganda (jeda 180 ms).
    if (!this.reducedMotion && !slow && roll < b.slowChance + b.doubleChance) {
      window.setTimeout(() => {
        if (!this.destroyed) one(b.closeMs, b.openMs);
      }, closeMs + openMs + b.doubleGapMs);
    }
    this.scheduleBlink();
  }

  /* ------------------------------ speaking ------------------------------ */

  private startSpeaking(): void {
    this.speaking = true;
    this.speakA = 0;
    this.svg.dataset.speaking = "true";
    this.setMouth("m-open");
    // Prioritas pola lampu: asking > speaking > pose dasar (§11).
    const keepLamp = this.pose === "asking" || this.pose === "sleeping" || this.pose === "offline";
    startSpeakingVisuals(this, { lamp: !keepLamp });
    this.ensureClock();
    this.updateAria();
  }

  private stopSpeaking(): void {
    this.speaking = false;
    this.svg.dataset.speaking = "false";
    stopSpeakingVisuals(this);
    // Kembalikan mulut & lampu pose dasar (prioritas asking > speaking > pose).
    if (this.pose === "asking") {
      lampPattern(this, "double");
    } else if (this.pose !== "offline" && this.pose !== "sleeping" && this.pose !== "listening") {
      this.restorePoseLamp();
    }
    this.setMouth(this.poseMouth());
    (this.el("body-nod") as HTMLElement).style.setProperty("translate", "");
    if (!this.clockNeeded()) this.stopClock();
    this.updateAria();
  }

  private poseMouth(): string {
    switch (this.pose) {
      case "thinking":
      case "working":
      case "listening":
      case "offline":
        return "m-flat";
      case "asking":
      case "sleeping":
        return "m-o";
      case "celebrate":
        return "m-bigsmile";
      case "confused":
        return "m-wavy";
      case "idle":
      default:
        return "m-smile";
    }
  }

  /** Pola lampu pose dasar (dipakai saat overlay speaking berhenti). */
  private restorePoseLamp(): void {
    switch (this.pose) {
      case "idle":
        this.setLamp("stem");
        lampPattern(this, "standby");
        break;
      case "thinking":
        this.setLamp("info");
        lampPattern(this, "pulse", T.thinking.lampPulseMs, 0.85, 1);
        break;
      case "working":
        this.setLamp("info");
        lampPattern(this, "pulse", 1700, 0.7, 1);
        break;
      case "celebrate":
        this.setLamp("ok");
        lampPattern(this, "pulse", T.celebrate.lampPulseMs, 0.8, 1);
        break;
      case "confused":
        this.setLamp("bad");
        lampPattern(this, "fast");
        break;
      default:
        break;
    }
  }

  /* ------------------------------ rAF clock ------------------------------ */

  private lookAllowed(): boolean {
    return this.pose === "idle" || this.pose === "listening" || this.pose === "asking";
  }

  private clockNeeded(): boolean {
    if (this.speaking) return true;
    if (!this.lookAllowed()) return false;
    const dx = this.lookTarget.x - this.lookCur.x;
    const dy = this.lookTarget.y - this.lookCur.y;
    return Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005;
  }

  private ensureClock(): void {
    if (this.clockId !== null || this.destroyed || this.paused) return;
    if (typeof requestAnimationFrame !== "function") return;
    const tick = (t: number): void => {
      this.clockId = null;
      if (this.destroyed || this.paused) return;
      this.frame(t);
      if (this.clockNeeded()) this.clockId = requestAnimationFrame(tick);
    };
    this.clockId = requestAnimationFrame(tick);
  }

  private stopClock(): void {
    if (this.clockId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.clockId);
    }
    this.clockId = null;
  }

  private frame(_t: number): void {
    // Mulut parametris (§6.7): a = lerp(a, level, .35) per frame.
    if (this.speaking && this.pose !== "offline") {
      this.speakA = smoothLevel(this.speakA, this.speakLevel, T.speaking.mouth.lerp);
      const mp = mouthParams(this.speakA);
      const shape = this.el("mopen-shape") as unknown as SVGEllipseElement;
      const tongue = this.el("mopen-tongue") as unknown as SVGEllipseElement;
      if (mp.closed && this.speakA < 0.06) {
        if (this.mouthVariant !== "m-smile") this.setMouth("m-smile");
      } else if (!mp.closed && this.speakA > 0.12) {
        if (this.mouthVariant !== "m-open") this.setMouth("m-open");
        shape.setAttribute("rx", mp.rx.toFixed(2));
        shape.setAttribute("ry", mp.ry.toFixed(2));
        shape.setAttribute("cy", mp.cy.toFixed(2));
        if (mp.tongue) {
          tongue.setAttribute("cx", String(mp.tongue.cx));
          tongue.setAttribute("cy", mp.tongue.cy.toFixed(2));
          tongue.setAttribute("rx", mp.tongue.rx.toFixed(2));
          tongue.setAttribute("ry", mp.tongue.ry.toFixed(2));
          tongue.setAttribute("opacity", "1");
        } else {
          tongue.setAttribute("opacity", "0");
        }
      }
      // Angguk badan mengikuti level.
      (this.el("body-nod") as HTMLElement).style.setProperty(
        "translate",
        `0px ${(-T.speaking.bodyNod * this.speakA).toFixed(2)}px`,
      );
      (this.el("sound-arcs") as HTMLElement).style.opacity =
        String(0.6 + 0.4 * this.speakLevel);
    }
    // Eye tracking: lerp 0,18 per frame; kilap +20% (§4.1).
    if (this.lookAllowed()) {
      const lerp = 0.18;
      this.lookCur.x += (this.lookTarget.x - this.lookCur.x) * lerp;
      this.lookCur.y += (this.lookTarget.y - this.lookCur.y) * lerp;
      if (Math.abs(this.lookTarget.x - this.lookCur.x) < 0.005) this.lookCur.x = this.lookTarget.x;
      if (Math.abs(this.lookTarget.y - this.lookCur.y) < 0.005) this.lookCur.y = this.lookTarget.y;
      const ex = (this.lookCur.x * 4).toFixed(2);
      const ey = (this.lookCur.y * 3).toFixed(2);
      (this.el("eyes") as HTMLElement).style.setProperty("translate", `${ex}px ${ey}px`);
      for (const g of this.svg.querySelectorAll(".e-glint")) {
        (g as HTMLElement).style.setProperty(
          "translate",
          `${(this.lookCur.x * 4.8).toFixed(2)}px ${(this.lookCur.y * 3.6).toFixed(2)}px`,
        );
      }
    }
  }

  /* --------------------------- director & idle --------------------------- */

  private runBehavior(b: DirectorBehavior): void {
    if (this.destroyed || this.paused || this.pose !== "idle") return;
    switch (b) {
      case "lookAround":
        this.lookAround();
        break;
      case "antennaWiggle":
        this.antennaWiggle("C");
        break;
      case "waveR":
        doWave(this, "r");
        break;
      case "waveL":
        doWave(this, "l");
        break;
      case "stretch":
        this.stretch();
        break;
      case "hum":
        this.hum();
        break;
      case "miniJump":
        this.miniJump();
        break;
      case "antennaSpin":
        this.antennaSpin();
        break;
      case "yawn":
        this.yawn();
        break;
    }
  }

  private lookAround(): void {
    if (this.reducedMotion) {
      // Hanya perubahan arah mata, tanpa gerak badan (§13).
      this.lookTarget = { x: this.rand() < 0.5 ? -0.75 : 0.75, y: 0 };
      this.lookUser = false;
      this.ensureClock();
      return;
    }
    const eyes = this.el("eyes");
    const x = (this.rand() < 0.5 ? -1 : 1) * T.idle.glance.x;
    const y = (this.rand() < 0.5 ? -1 : 1) * T.idle.glance.y;
    const hold = T.idle.glance.holdMinMs + this.rand() * (T.idle.glance.holdMaxMs - T.idle.glance.holdMinMs);
    this.anim.start(
      eyes,
      "glance",
      "C",
      [
        { translate: "0px 0px" },
        { translate: `${x}px ${y}px`, offset: 0.3 },
        { translate: `${x}px ${y}px`, offset: 0.7 },
        { translate: "0px 0px" },
      ],
      { duration: hold + 400, easing: T.ease.soft },
    );
  }

  private antennaWiggle(layer: AnimLayer): void {
    const ant = this.el("antenna");
    this.anim.start(
      ant,
      "wiggle",
      layer,
      [{ rotate: "0deg" }, { rotate: "8deg" }, { rotate: "-8deg" }, { rotate: "4deg" }, { rotate: "0deg" }],
      { duration: 800, easing: T.ease.soft },
    );
  }

  private antennaSpin(): void {
    const ant = this.el("antenna");
    this.anim.start(
      ant,
      "spin",
      "C",
      [{ rotate: "0deg" }, { rotate: "14deg" }, { rotate: "-10deg" }, { rotate: "0deg" }],
      { duration: 1000, easing: T.ease.soft },
    );
    const bulb = this.el("bulb-core");
    this.anim.start(bulb, "spin-flash", "C", [{ opacity: 0.5 }, { opacity: 1 }], {
      duration: 200,
      direction: "alternate",
      iterations: 5,
    });
  }

  private stretch(): void {
    if (this.reducedMotion) return;
    this.moveHand("l", -10, -40, 500, T.ease.out);
    this.moveHand("r", 10, -40, 500, T.ease.out);
    const nod = this.el("body-nod");
    this.anim.start(
      nod,
      "stretch",
      "C",
      [{ scale: "1 1" }, { scale: "1 1.04", offset: 0.45 }, { scale: "1 1" }],
      { duration: 1400, easing: T.ease.soft },
    );
    this.clater(800, () => {
      if (this.pose !== "idle") return;
      this.moveHand("l", 0, 0, 600, T.ease.soft);
      this.moveHand("r", 0, 0, 600, T.ease.soft);
    });
  }

  private hum(): void {
    if (this.reducedMotion) return;
    const e0 = this.eyeVariant;
    this.setEyes("e-happy");
    this.showProp("prop-note", true);
    const note = this.el("prop-note");
    this.anim.start(
      note,
      "hum",
      "C",
      [
        { translate: "0px 0px", opacity: 1 },
        { translate: "6px -14px", opacity: 1, offset: 0.7 },
        { translate: "10px -20px", opacity: 0 },
      ],
      { duration: 2000, easing: T.ease.out },
    );
    this.clater(2000, () => {
      if (this.eye() === "e-happy") this.setEyes(e0);
      this.showProp("prop-note", false);
    });
  }

  private miniJump(): void {
    if (this.reducedMotion) return;
    const nod = this.el("body-nod");
    this.anim.start(
      nod,
      "minijump",
      "C",
      [
        { translate: "0px 0px", scale: "1 1" },
        { translate: "0px -6px", scale: "1 1", offset: 0.5 },
        { translate: "0px 0px", scale: "1 0.94", offset: 0.8 },
        { translate: "0px 0px", scale: "1 1" },
      ],
      { duration: 500, easing: T.ease.out },
    );
  }

  private yawn(): void {
    const m0 = this.mouthVariant;
    this.setMouth("m-yawn");
    for (const id of ["eye-l", "eye-r"]) {
      this.anim.start(this.el(id), "yawn-eyes", "C", [{ scale: "1 1" }, { scale: "1 0.1" }], {
        duration: 400,
        easing: T.ease.soft,
        fill: "forwards",
      });
    }
    this.moveHand("l", -14, -30, 600, T.ease.soft);
    this.moveHand("r", 14, -30, 600, T.ease.soft);
    this.clater(1600, () => {
      if (this.pose !== "idle") return;
      this.setMouth(m0);
      for (const id of ["eye-l", "eye-r"]) {
        this.anim.start(this.el(id), "yawn-eyes", "C", [{ scale: "1 1" }], { duration: 200 });
      }
      this.moveHand("l", 0, 0, 600, T.ease.soft);
      this.moveHand("r", 0, 0, 600, T.ease.soft);
    });
  }

  private autoSleepNow(): void {
    // yawn → mata mengantuk (ry menurun 2 detik) → sleeping (§9.1).
    this.yawn();
    this.later(1600, () => {
      for (const id of ["eye-l", "eye-r"]) {
        this.anim.start(this.el(id), "drowsy", "C", [{ scale: "1 1" }, { scale: "1 0.3" }], {
          duration: 2000,
          easing: T.ease.soft,
          fill: "forwards",
        });
      }
    });
    this.later(3600, () => {
      this.autoSleep = true;
      this.applyPose("sleeping", "typing", false);
      this.updateAria();
    });
  }

  /* -------------------------------- poke -------------------------------- */

  private poke(): void {
    if (this.destroyed || this.paused) return;
    if (this.pose === "sleeping") {
      this.wakeAnnoyed();
      return;
    }
    if (this.pose === "working" || this.pose === "asking") {
      // Tidak ada efek besar agar tidak mengganggu fokus (§9.3).
      const bulb = this.el("bulb-core");
      this.anim.start(bulb, "poke-flash", "C", [{ opacity: 0.5 }, { opacity: 1 }], {
        duration: 200,
      });
      return;
    }
    const now = Date.now();
    this.pokeTimes = this.pokeTimes.filter((t) => now - t < T.react.poke.window3Ms);
    this.pokeTimes.push(now);
    const in2 = this.pokeTimes.filter((t) => now - t < T.react.poke.window1Ms).length;
    if (this.pokeTimes.length >= 5 && now - this.lastDizzy > T.react.poke.dizzyCooldownMs) {
      this.lastDizzy = now;
      this.dizzy();
      return;
    }
    if (in2 >= 3) {
      this.annoyed();
      return;
    }
    this.squashPoke();
  }

  private squashPoke(): void {
    const p = T.react.poke;
    const e0 = this.eyeVariant;
    const m0 = this.mouthVariant;
    if (!this.reducedMotion) {
      const nod = this.el("body-nod");
      this.anim.start(
        nod,
        "poke",
        "C",
        [
          { scale: "1 1" },
          { scale: "1.08 0.88", offset: p.squashMs / p.totalMs },
          { scale: "0.97 1.04", offset: 0.7 },
          { scale: "1 1" },
        ],
        { duration: p.totalMs, easing: T.ease.pop },
      );
    }
    this.setEyes("e-happy");
    this.setMouth("m-bigsmile");
    const bulb = this.el("bulb-core");
    this.anim.start(bulb, "poke-flash", "C", [{ opacity: 0.5 }, { opacity: 1 }], {
      duration: 200,
    });
    this.clater(400, () => {
      if (this.eye() === "e-happy") this.setEyes(e0);
      if (this.mouth() === "m-bigsmile") this.setMouth(m0);
    });
  }

  private annoyed(): void {
    const e0 = this.eyeVariant;
    const m0 = this.mouthVariant;
    this.setEyes("e-worried");
    this.setMouth("m-flat");
    if (!this.reducedMotion) {
      const nod = this.el("body-nod");
      this.anim.start(
        nod,
        "annoyed",
        "C",
        [{ rotate: "-3deg" }, { rotate: "3deg" }, { rotate: "-3deg" }, { rotate: "0deg" }],
        { duration: T.react.poke.annoyedMs, easing: T.ease.soft },
      );
    }
    this.clater(T.react.poke.annoyedMs, () => {
      if (this.eye() === "e-worried") this.setEyes(e0);
      if (this.mouth() === "m-flat") this.setMouth(m0);
    });
  }

  private dizzy(): void {
    for (const id of ["eye-l", "eye-r"]) {
      this.anim.start(this.el(id), "dizzy", "C", [{ rotate: "0deg" }, { rotate: "360deg" }], {
        duration: T.react.poke.dizzyMs,
        easing: T.ease.soft,
      });
    }
  }

  private wakeAnnoyed(): void {
    // Terbangun kesal: startle → mata setengah terbuka 1 s → kembali tidur.
    this.react("startle");
    for (const id of ["eye-l", "eye-r"]) {
      this.anim.start(this.el(id), "wake", "C", [{ scale: "1 0.1" }, { scale: "1 0.5" }], {
        duration: 300,
        fill: "forwards",
      });
    }
    this.clater(1000, () => {
      for (const id of ["eye-l", "eye-r"]) {
        this.anim.start(this.el(id), "wake", "C", [{ scale: "1 0.1" }], { duration: 300 });
      }
    });
  }

  /* -------------------------------- hover -------------------------------- */

  private hover(e: MouseEvent): void {
    if (this.destroyed || this.paused || this.pose !== "idle") return;
    const rect = this.svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    const now = Date.now();
    if (dist <= 120) {
      if (this.hoverAt === 0) {
        this.hoverAt = now;
        // Lampu bersinar: cincin riak sekali.
        const ring = this.el("bulb-ring");
        this.anim.start(
          ring,
          "hover-ring",
          "C",
          [{ scale: "1", opacity: 0.45 }, { scale: "1.9", opacity: 0 }],
          { duration: 500, easing: T.ease.out },
        );
        // Tangan terdekat naik -4.
        const which: HandWhich = e.clientX < cx ? "l" : "r";
        const b = this.handBase(which);
        const hand = this.el(which === "l" ? "hand-l" : "hand-r");
        this.anim.start(
          hand,
          "hover-lift",
          "C",
          [{ translate: `${b.x}px ${b.y}px` }, { translate: `${b.x}px ${b.y - 4}px` }],
          { duration: 200, easing: T.ease.out, fill: "forwards" },
        );
      }
      // Eye tracking mengikuti kursor.
      const nx = (e.clientX - cx) / (rect.width / 2 || 1);
      const ny = (e.clientY - cy) / (rect.height / 2 || 1);
      this.lookTarget = { x: clamp(nx, -1, 1), y: clamp(ny, -1, 1) };
      this.lookUser = true;
      this.ensureClock();
      // Hover ≥ 1,2 s: lambaian singkat (cooldown 20 s).
      if (now - this.hoverAt >= 1200 && now - this.lastHoverWave > 20000) {
        this.lastHoverWave = now;
        doWave(this, e.clientX < cx ? "l" : "r");
      }
    } else {
      this.hoverAt = 0;
      if (this.lookUser) {
        this.lookTarget = { x: 0, y: 0 };
        this.ensureClock();
      }
    }
  }
}
