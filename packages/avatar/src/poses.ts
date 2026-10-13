/**
 * Koreografi pose — CHARACTER.md §§6–8.
 *
 * Setiap apply* menggerakkan lapisan A (ambient, parameter per pose) dan
 * lapisan B (khas pose). Lapisan C (reaksi) dikelola renderer. Semua angka
 * waktu/amplitudo dibaca dari T (timing.ts); tidak ada literal di sini
 * kecuali 0/1 dan nilai yang diturunkan langsung dari kontrak.
 */

import type { Animator, AnimLayer } from "./animator.js";
import { baseTranslate } from "./animator.js";
import { jittered } from "./prng.js";
import { T, type Timing } from "./timing.js";
import type { AvatarPose, WorkingVariant } from "./types.js";

export type HandWhich = "l" | "r";
export type LampColor = "stem" | "info" | "ok" | "ask" | "bad";

export interface FloatParams {
  ampY: number;
  periodMs: number;
  tiltDeg?: number;
  bowDeg?: number;
  swayDeg?: number;
  swayPeriodMs?: number;
  shakeX?: number;
}

/** Fasad operasi yang disediakan renderer untuk koreografi pose. */
export interface PoseOps {
  readonly anim: Animator;
  readonly T: Timing;
  readonly rand: () => number;
  readonly reduced: boolean;
  svg: SVGSVGElement;
  el(id: string): Element;
  /** Timer yang ikut dibatalkan saat pose berganti. */
  later(ms: number, fn: () => void): void;
  /** Timer lapisan C (reaksi): hanya dibatalkan bila reaksi dibatalkan. */
  clater(ms: number, fn: () => void): void;
  setEyes(v: string): void;
  setMouth(v: string): void;
  eye(): string;
  mouth(): string;
  moveHand(which: HandWhich, x: number, y: number, ms: number, ease?: string): void;
  handBase(which: HandWhich): { x: number; y: number };
  wrist(which: HandWhich): Element;
  placeHand(which: HandWhich, where: "back" | "front"): void;
  setLamp(color: LampColor): void;
  floatBody(p: FloatParams): void;
  stopBody(): void;
  shadowSync(periodMs: number, on: boolean): void;
  antennaFollow(periodMs: number, on: boolean): void;
  showProp(id: string, show: boolean, ms?: number): void;
  moodAmp(): number;
}

/* ------------------------------------------------------------------ */
/* Util lapisan                                                        */
/* ------------------------------------------------------------------ */

export function lampPattern(
  r: PoseOps,
  kind: "standby" | "pulse" | "double" | "fast" | "speak" | "breath" | "off",
  periodMs = 0,
  from = 1,
  to = 1,
): void {
  const bulb = r.el("bulb-core");
  r.anim.stop(bulb, "lamp");
  if (kind === "off") {
    bulb.setAttribute("opacity", "0.25");
    return;
  }
  if (r.reduced) {
    bulb.setAttribute("opacity", "1");
    return;
  }
  const loop = (kf: Keyframe[], ms: number): void => {
    r.anim.start(bulb, "lamp", "A", kf, {
      duration: ms,
      iterations: Infinity,
      easing: T.ease.soft,
    });
  };
  switch (kind) {
    case "standby":
      loop([{ opacity: 0.75 }, { opacity: 1 }], 4000);
      break;
    case "pulse":
      loop([{ opacity: from }, { opacity: to }], periodMs);
      break;
    case "double":
      r.anim.start(
        bulb,
        "lamp",
        "A",
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.075 },
          { opacity: 0.15, offset: 0.125 },
          { opacity: 0.15, offset: 0.175 },
          { opacity: 1, offset: 0.2 },
          { opacity: 1, offset: 0.275 },
          { opacity: 0.15, offset: 0.325 },
          { opacity: 0.15, offset: 1 },
        ],
        { duration: 1600, iterations: Infinity },
      );
      break;
    case "fast": {
      // 4 Hz selama 1 s (8 paruh-siklus 125 ms), jeda 0,8 s → siklus 1,8 s.
      const kf: Keyframe[] = [];
      for (let i = 0; i < 8; i++) {
        kf.push({ opacity: i % 2 === 0 ? 1 : 0.2, offset: i / 14.4 });
      }
      kf.push({ opacity: 0.2, offset: 1000 / 1800 });
      kf.push({ opacity: 0.2, offset: 1 });
      r.anim.start(bulb, "lamp", "A", kf, { duration: 1800, iterations: Infinity });
      break;
    }
    case "speak":
      loop([{ opacity: 1 }, { opacity: 0.35 }], 500);
      break;
    case "breath":
      loop([{ opacity: 0.35 }, { opacity: 0.6 }], 4500);
      break;
  }
}

/** Antisipasi pose-enter: badan turun 2 unit 80 ms (§10). */
export function anticipate(r: PoseOps): void {
  if (r.reduced) return;
  const nod = r.el("body-nod");
  r.anim.start(
    nod,
    "anticipate",
    "B",
    [{ translate: "0px 0px" }, { translate: "0px 2px" }, { translate: "0px 0px" }],
    { duration: 160, easing: T.ease.soft },
  );
}

/* ------------------------------------------------------------------ */
/* 6.1 Diam                                                             */
/* ------------------------------------------------------------------ */

export function applyIdle(r: PoseOps): void {
  r.setEyes("e-open");
  r.setMouth("m-smile");
  r.setLamp("stem");
  lampPattern(r, "standby");
  const period = jittered(r.rand, T.idle.float.periodMs, T.idle.float.jitter);
  r.floatBody({
    ampY: T.idle.float.ampY,
    periodMs: period,
    swayDeg: T.idle.sway.deg,
    swayPeriodMs: T.idle.sway.periodMs,
  });
  r.shadowSync(period, true);
  r.antennaFollow(period, true);
  // Tangan ambient: lag L 0,35 s / R 0,7 s terhadap badan.
  // composite:"add" agar bob MENAMBAH ke posisi dasar (dari moveHand),
  // bukan menimpanya (tangan tidak "kelempar").
  for (const [which, lag] of [["l", T.idle.hands.lagLms], ["r", T.idle.hands.lagRms]] as const) {
    const hand = r.el(which === "l" ? "hand-l" : "hand-r");
    r.anim.stop(hand, "bob");
    if (r.reduced) continue;
    r.anim.start(
      hand,
      "bob",
      "A",
      [
        { translate: "0px 0px" },
        { translate: `0px ${-T.idle.hands.amp}px`, offset: 0.5 },
        { translate: "0px 0px" },
      ],
      { duration: period, delay: lag, easing: T.ease.soft, iterations: Infinity, composite: "add" },
    );
  }
}

/* ------------------------------------------------------------------ */
/* Lambaian (§6.1, dipakai IdleDirector + react hello)                  */
/* ------------------------------------------------------------------ */

export function doWave(r: PoseOps, which: HandWhich): void {
  const w = T.idle.wave;
  const dx = which === "r" ? w.raiseR.dx : w.raiseL.dx;
  const dy = which === "r" ? w.raiseR.dy : w.raiseL.dy;
  const e0 = r.eye();
  const m0 = r.mouth();
  const base = r.handBase(which);
  const layer: AnimLayer = "C";
  // 0–120 ms: antisipasi.
  r.moveHand(which, base.x, base.y + 3, w.anticipateMs, T.ease.soft);
  const nod = r.el("body-nod");
  r.anim.start(
    nod,
    "wave-tilt",
    layer,
    [{ rotate: "0deg" }, { rotate: `${which === "r" ? w.tiltDeg : -w.tiltDeg}deg` }],
    { duration: w.anticipateMs, easing: T.ease.soft, fill: "forwards" },
  );
  r.clater(w.anticipateMs, () => {
    // 120–400 ms: angkat + ekspresi gembira.
    r.moveHand(which, base.x + dx, base.y + dy, w.raiseMs, T.ease.pop);
    r.setEyes("e-happy");
    r.setMouth("m-bigsmile");
    r.anim.start(nod, "wave-tilt", layer, [{ rotate: "0deg" }], {
      duration: 1,
      fill: "forwards",
    });
    (nod as HTMLElement).style.setProperty("rotate", "0deg");
    r.clater(w.raiseMs, () => {
      // 400–1280 ms: melambai di pivot pergelangan.
      const wrist = r.wrist(which);
      const kf: Keyframe[] = [];
      for (let i = 0; i <= w.waveHalfCycles; i++) {
        kf.push({ rotate: `${i % 2 === 0 ? -w.waveDeg : w.waveDeg}deg` });
      }
      r.anim.start(wrist, "wave-rot", layer, kf, {
        duration: w.waveMs,
        easing: T.ease.soft,
      });
      r.clater(w.waveMs, () => {
        // 1280–1600 ms: kembali ke posisi pose (bukan selalu 0,0).
        r.moveHand(which, base.x, base.y, w.returnMs, T.ease.inOut);
        if (r.eye() === "e-happy") r.setEyes(e0);
        if (r.mouth() === "m-bigsmile") r.setMouth(m0);
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/* 6.2 Berpikir                                                          */
/* ------------------------------------------------------------------ */

function dotsLoop(r: PoseOps): void {
  const d = T.thinking.dots;
  const ids = ["dot-1", "dot-2", "dot-3"];
  const appear = (i: number): void => {
    const dot = r.el(ids[i] as string);
    if (r.reduced) {
      (dot as HTMLElement).style.opacity = "1";
      return;
    }
    r.anim.start(
      dot,
      "appear",
      "B",
      [
        { opacity: 0, scale: "0.4" },
        { opacity: 1, scale: "1.12" },
        { opacity: 1, scale: "1" },
      ],
      { duration: d.appearMs, easing: T.ease.pop, fill: "forwards" },
    );
    (dot as HTMLElement).style.opacity = "1";
  };
  const pulse = (i: number): void => {
    if (r.reduced) return;
    const dot = r.el(ids[i] as string);
    r.anim.start(
      dot,
      "pulse",
      "B",
      [{ scale: "1" }, { scale: "1.12" }, { scale: "1" }],
      { duration: d.pulseMs, easing: T.ease.soft },
    );
  };
  const fadeAll = (): void => {
    if (r.reduced) return;
    for (const id of ids) {
      const dot = r.el(id);
      r.anim.start(
        dot,
        "fade",
        "B",
        [
          { opacity: 1, scale: "1" },
          { opacity: 0, scale: "0.8" },
        ],
        { duration: d.fadeMs, easing: T.ease.soft, fill: "forwards" },
      );
    }
    for (const id of ids) (r.el(id) as HTMLElement).style.opacity = "0";
  };
  const cycle = (): void => {
    appear(0);
    r.later(d.staggerMs, () => appear(1));
    r.later(d.staggerMs * 2, () => {
      appear(2);
      // Berdenyut bergiliran 150 ms selama tampil.
      r.later(0, () => pulse(0));
      r.later(d.pulseMs, () => pulse(1));
      r.later(d.pulseMs * 2, () => pulse(2));
    });
    r.later(d.cycleMs - d.fadeMs - 200, fadeAll);
    r.later(d.cycleMs, cycle);
  };
  cycle();
}

function chinRubLoop(r: PoseOps): void {
  const c = T.thinking.chin;
  if (r.reduced) return;
  const hand = r.el("hand-r");
  const rub = (n: number): void => {
    if (n >= c.rubs) {
      r.later(jittered(r.rand, (c.pauseMinMs + c.pauseMaxMs) / 2, 0.25), () => chinRubLoop(r));
      return;
    }
    // Hanya bake translate ATRIBUT; offset posisi tetap dari style.translate,
    // dan gerakan gosok sebagai delta. Rotate kini tepat di tangan.
    const attrBase = baseTranslate(hand);
    r.anim.start(
      hand,
      "rub",
      "B",
      [
        { transform: `${attrBase} translate(0px, 0px) rotate(0deg)` },
        {
          transform: `${attrBase} translate(${c.rubX}px, ${-c.rubY}px) rotate(${c.rubDeg}deg)`,
          offset: 0.5,
        },
        {
          transform: `${attrBase} translate(${-c.rubX}px, ${c.rubY}px) rotate(${-c.rubDeg}deg)`,
        },
      ],
      { duration: c.rubMs, easing: T.ease.soft },
    );
    r.later(c.rubMs, () => rub(n + 1));
  };
  rub(0);
}

export function applyThinking(r: PoseOps): void {
  r.setEyes("e-open");
  r.setMouth("m-flat");
  r.setLamp("info");
  lampPattern(r, "pulse", T.thinking.lampPulseMs, 0.85, 1);
  const period = jittered(r.rand, T.thinking.float.periodMs, T.thinking.float.jitter);
  r.floatBody({ ampY: T.thinking.float.ampY, periodMs: period, tiltDeg: T.thinking.float.tiltDeg });
  r.shadowSync(period, true);
  r.antennaFollow(period, true);
  // Tangan R ke dagu (114,148): offset (-44, 0) dari (158,148).
  r.placeHand("r", "front");
  r.moveHand("r", T.thinking.chin.dx, T.thinking.chin.dy, T.thinking.handToChinMs, T.ease.pop);
  r.later(T.thinking.handToChinMs, () => chinRubLoop(r));
  // Tangan L ambient (composite:add agar tidak menimpa posisi dasar).
  const handL = r.el("hand-l");
  r.anim.stop(handL, "bob");
  if (!r.reduced) {
    r.anim.start(
      handL,
      "bob",
      "A",
      [{ translate: "0px 0px" }, { translate: "0px -3px", offset: 0.5 }, { translate: "0px 0px" }],
      { duration: period, delay: 500, easing: T.ease.soft, iterations: Infinity, composite: "add" },
    );
  }
  // Mata melirik kanan-atas ↔ kiri-atas.
  if (!r.reduced) {
    const eyes = r.el("eyes");
    const glance = (): void => {
      const x = r.rand() < 0.5 ? T.thinking.eyesGlance.x : -T.thinking.eyesGlance.x;
      r.anim.start(
        eyes,
        "glance",
        "B",
        [{ translate: "0px 0px" }, { translate: `${x}px ${T.thinking.eyesGlance.y}px` }],
        { duration: T.thinking.eyesGlance.moveMs, easing: T.ease.out, fill: "forwards" },
      );
      (eyes as HTMLElement).style.setProperty("translate", `${x}px ${T.thinking.eyesGlance.y}px`);
      r.later(
        jittered(r.rand, (T.thinking.eyesGlance.minMs + T.thinking.eyesGlance.maxMs) / 2, 0.2),
        glance,
      );
    };
    glance();
  }
  dotsLoop(r);
}

/* ------------------------------------------------------------------ */
/* 6.3 Bekerja + varian §8                                              */
/* ------------------------------------------------------------------ */

const VARIANT_EYE: Record<WorkingVariant, string> = {
  typing: "e-focus",
  reading: "e-open",
  running: "e-focus",
  searching: "e-open",
  delegating: "e-open",
  generic: "e-focus",
};

function press(r: PoseOps, which: HandWhich, halfPeriodMs: number): void {
  const hand = r.el(which === "l" ? "hand-l" : "hand-r");
  const b = r.handBase(which);
  const t = T.working.typing;
  r.anim.start(
    hand,
    "press",
    "B",
    [
      { translate: `${b.x}px ${b.y}px`, scale: "1 1" },
      { translate: `${b.x}px ${b.y + t.pressY}px`, scale: `1 ${t.squashY}`, offset: 0.45 },
      { translate: `${b.x}px ${b.y}px`, scale: "1 1" },
    ],
    { duration: halfPeriodMs * 2, easing: T.ease.out },
  );
  // Highlight tombol di bawah tangan yang menekan.
  const keyRow = r.el("key-row");
  r.anim.start(
    keyRow,
    "hit",
    "B",
    [{ fill: "#C9D2F7" }, { fill: "#FFFFFF" }, { fill: "#C9D2F7" }],
    { duration: T.working.keyHighlightMs * 2, easing: T.ease.out },
  );
}

function typingLoop(r: PoseOps): void {
  const t = T.working.typing;
  let bursts = 0;
  const fastEveryOther = (): boolean => bursts % 2 === 0;
  const doBurst = (): void => {
    bursts++;
    const half = (fastEveryOther() ? t.burstPeriodMs : t.periodMs) / 2;
    const dur = jittered(r.rand, (t.burstMinMs + t.burstMaxMs) / 2, 0.25);
    // Enter serentak tiap 3–5 burst.
    const isEnter = bursts % Math.round(3 + r.rand() * 2) === 0;
    let n = 0;
    const step = (): void => {
      if (n * half >= dur) {
        if (isEnter) {
          press(r, "l", half);
          press(r, "r", half);
          const nod = r.el("body-nod");
          r.anim.start(
            nod,
            "enter-nod",
            "B",
            [{ translate: "0px 0px" }, { translate: `0px ${T.working.enter.nodY}px` }, { translate: "0px 0px" }],
            { duration: T.working.enter.nodMs * 2, easing: T.ease.out },
          );
        }
        r.later(jittered(r.rand, (t.pauseMinMs + t.pauseMaxMs) / 2, 0.3), doBurst);
        return;
      }
      press(r, n % 2 === 0 ? "l" : "r", half);
      n++;
      r.later(half, step);
    };
    step();
  };
  doBurst();
}

function eyesSweep(r: PoseOps, vertical: boolean): void {
  const e = T.working.eyes;
  const eyes = r.el("eyes");
  if (r.reduced) return;
  const period = jittered(r.rand, e.cycleMs, e.jitter);
  const kf: Keyframe[] = vertical
    ? [
        { translate: "0px -3px" },
        { translate: "0px 3px", offset: e.sweepMs / period },
        { translate: "0px 3px", offset: (e.sweepMs + e.returnMs) / period },
        { translate: "0px -3px" },
      ]
    : [
        { translate: "-4px 0px" },
        { translate: "4px 0px", offset: e.sweepMs / period },
        { translate: "4px 0px", offset: (e.sweepMs + e.returnMs) / period },
        { translate: "-4px 0px" },
      ];
  r.anim.start(eyes, "sweep", "B", kf, {
    duration: period,
    easing: T.ease.linear,
    iterations: Infinity,
  });
}

export function applyWorking(r: PoseOps, variant: WorkingVariant): void {
  r.setEyes(VARIANT_EYE[variant]);
  r.setMouth("m-flat");
  r.setLamp("info");
  const body = T.working.body;
  r.floatBody({ ampY: body.floatAmp, periodMs: body.floatPeriodMs, bowDeg: body.bowDeg });
  r.shadowSync(body.floatPeriodMs, true);
  // Keyboard naik dari bawah.
  const kb = r.el("keyboard");
  r.showProp("keyboard", true, 250);
  if (!r.reduced) {
    r.anim.start(
      kb,
      "kb-in",
      "B",
      [{ translate: "0px 14px" }, { translate: "0px 0px" }],
      { duration: 250, easing: T.ease.out, fill: "forwards" },
    );
    (kb as HTMLElement).style.setProperty("translate", "0px 0px");
  }
  r.placeHand("l", "front");
  r.placeHand("r", "front");
  // Posisi dasar mengetik: L (72,170), R (128,170).
  // Base tangan: L (42,152), R (158,148) → offset = target - base.
  const homeL = { x: 30, y: 18 };
  const homeR = { x: -30, y: 22 };
  const moveMs = 300;
  r.moveHand("l", homeL.x, homeL.y, moveMs, T.ease.out);
  r.moveHand("r", homeR.x, homeR.y, moveMs, T.ease.out);
  r.later(moveMs, () => {
    if (variant === "typing" || variant === "running" || variant === "generic") {
      if (!r.reduced) typingLoop(r);
    }
    switch (variant) {
      case "reading": {
        // Lembar dokumen di depan visor; tangan di tepinya.
        r.showProp("prop-doc", true);
        r.moveHand("l", -24, -36, 280, T.ease.out);
        r.moveHand("r", 24, -36, 280, T.ease.out);
        eyesSweep(r, true);
        break;
      }
      case "running": {
        r.showProp("prop-chip", true);
        eyesSweep(r, false);
        if (!r.reduced) {
          const lookChip = (): void => {
            const eyes = r.el("eyes");
            r.anim.stop(eyes, "sweep");
            r.anim.start(
              eyes,
              "chip-glance",
              "B",
              [{ translate: "3px -3px" }, { translate: "3px -3px" }],
              { duration: 600, fill: "forwards" },
            );
            r.later(600, () => eyesSweep(r, false));
            r.later(4000 + r.rand() * 3000, lookChip);
          };
          r.later(4000, lookChip);
        }
        break;
      }
      case "searching": {
        // Kaca pembesar di tangan R; gerak melingkar kecil.
        const mag = r.el("hand-r").querySelector(".mag");
        if (mag) (mag as Element).setAttribute("opacity", "1");
        if (!r.reduced) {
          const handR = r.el("hand-r");
          const b = r.handBase("r");
          const circ: Keyframe[] = [];
          for (let i = 0; i <= 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            circ.push({
              translate: `${b.x + Math.cos(a) * 6}px ${b.y + Math.sin(a) * 6}px`,
            });
          }
          r.anim.start(handR, "mag-circle", "B", circ, {
            duration: 2000,
            easing: T.ease.linear,
            iterations: Infinity,
          });
          const follow = (): void => {
            const eyes = r.el("eyes");
            const x = (r.rand() * 2 - 1) * 4;
            const y = (r.rand() * 2 - 1) * 3;
            r.anim.start(
              eyes,
              "mag-follow",
              "B",
              [{ translate: `${x}px ${y}px` }],
              { duration: 400, easing: T.ease.out, fill: "forwards" },
            );
            (eyes as HTMLElement).style.setProperty("translate", `${x}px ${y}px`);
            r.later(1500 + r.rand() * 1000, follow);
          };
          follow();
        }
        break;
      }
      case "delegating": {
        r.showProp("prop-mini", true);
        // Tangan R menunjuk ke robot mini.
        r.moveHand("r", 24, -8, 280, T.ease.out);
        if (!r.reduced) {
          const lookMini = (): void => {
            const eyes = r.el("eyes");
            r.anim.start(
              eyes,
              "mini-glance",
              "B",
              [{ translate: "0px 0px" }, { translate: "4px 0px" }],
              { duration: 400, easing: T.ease.out, fill: "forwards" },
            );
            (eyes as HTMLElement).style.setProperty("translate", "4px 0px");
            r.later(1200, () => {
              (eyes as HTMLElement).style.setProperty("translate", "0px 0px");
            });
            r.later(5000 + r.rand() * 3000, lookMini);
          };
          r.later(3000, lookMini);
        }
        break;
      }
      case "generic": {
        r.showProp("prop-gear", true);
        if (!r.reduced) {
          // Rotate di-bake dengan translate dasar agar gear berputar di tempat.
          const gear = r.el("prop-gear");
          const gearBase = baseTranslate(gear);
          r.anim.start(
            gear,
            "gear-spin",
            "B",
            [
              { transform: `${gearBase} rotate(0deg)` },
              { transform: `${gearBase} rotate(360deg)` },
            ],
            { duration: 3000, easing: T.ease.linear, iterations: Infinity },
          );
        }
        eyesSweep(r, false);
        break;
      }
      case "typing":
      default:
        eyesSweep(r, false);
        break;
    }
  });
  // Lampu aktivitas: terang saat mengetik, redup saat jeda (disederhanakan
  // jadi denyut tak beraturan mengikuti burst).
  if (!r.reduced) {
    const bulb = r.el("bulb-core");
    r.anim.start(
      bulb,
      "lamp",
      "A",
      [{ opacity: 0.7 }, { opacity: 1 }, { opacity: 0.75 }, { opacity: 1 }],
      { duration: 1700, easing: T.ease.soft, iterations: Infinity },
    );
  }
}

/* ------------------------------------------------------------------ */
/* 6.4 Bertanya                                                          */
/* ------------------------------------------------------------------ */

function qBubbleLoop(r: PoseOps, escalated: () => boolean): void {
  const q = T.asking.qBubble;
  const bubble = r.el("q-bubble");
  // Posisi dasar di-bake ke keyframes `transform` agar tidak "terbang".
  const base = baseTranslate(bubble);
  const cycleMs = (): number =>
    jittered(r.rand, escalated() ? T.asking.escalatedCycleMs : q.cycleMs, q.jitter);
  const cycle = (): void => {
    const c = cycleMs();
    if (r.reduced) {
      (bubble as HTMLElement).style.opacity = "1";
      return;
    }
    // Muncul pop.
    r.anim.start(
      bubble,
      "appear",
      "B",
      [
        { opacity: 0, transform: `${base} scale(0.4)` },
        { opacity: 1, transform: `${base} scale(1.15)`, offset: 0.6 },
        { opacity: 1, transform: `${base} scale(1)` },
      ],
      { duration: q.appearMs, easing: T.ease.pop, fill: "forwards" },
    );
    (bubble as HTMLElement).style.opacity = "1";
    // Goyang ±6°.
    r.anim.start(
      bubble,
      "wobble",
      "B",
      [
        { transform: `${base} rotate(-${q.wobbleDeg}deg)` },
        { transform: `${base} rotate(${q.wobbleDeg}deg)` },
      ],
      {
        duration: q.wobblePeriodMs,
        easing: T.ease.soft,
        iterations: Math.floor((c * 0.45) / q.wobblePeriodMs),
        direction: "alternate",
        delay: q.appearMs,
      },
    );
    // Lampu kedip ganda bersamaan dengan munculnya tanda tanya.
    lampPattern(r, "double");
    // Memudar.
    r.later(c - q.fadeMs - 400, () => {
      r.anim.start(
        bubble,
        "fade",
        "B",
        [{ opacity: 1, transform: `${base} scale(1)` }, { opacity: 0, transform: `${base} scale(0.9)` }],
        { duration: q.fadeMs, easing: T.ease.soft, fill: "forwards" },
      );
      (bubble as HTMLElement).style.opacity = "0";
    });
    r.later(c, cycle);
  };
  cycle();
}

export function applyAsking(r: PoseOps): void {
  r.setEyes("e-wide");
  r.setMouth("m-o");
  r.setLamp("ask");
  lampPattern(r, "double");
  const b = T.asking.body;
  r.floatBody({ ampY: b.floatAmp, periodMs: b.floatPeriodMs, tiltDeg: b.rotateDeg });
  r.shadowSync(b.floatPeriodMs, true);
  // Badan condong: scale 1,03.
  const nod = r.el("body-nod");
  if (!r.reduced) {
    r.anim.start(nod, "lean", "B", [{ scale: "1 1" }, { scale: "1.03 1.03" }], {
      duration: 280,
      easing: T.ease.out,
      fill: "forwards",
    });
    (nod as HTMLElement).style.setProperty("scale", "1.03 1.03");
  }
  // Raise hand R: antisipasi turun 2 unit, lalu naik ke (160,84).
  r.placeHand("r", "front");
  r.moveHand("r", 0, T.asking.anticipateY, 80, T.ease.soft);
  r.later(80, () => {
    r.moveHand("r", 2, -64, T.asking.raiseMs, T.ease.pop);
  });
  // Goyang tangan: 3×260 ms, jeda 0,9 s.
  let escalated = false;
  const shake = (): void => {
    if (r.reduced) return;
    const wrist = r.wrist("r");
    const deg = escalated ? T.asking.escalatedShakeDeg : T.asking.shakeDeg;
    const kf: Keyframe[] = [];
    for (let i = 0; i <= T.asking.shakes * 2; i++) {
      kf.push({ rotate: `${i % 2 === 0 ? -deg : deg}deg` });
    }
    r.anim.start(wrist, "shake", "B", kf, {
      duration: T.asking.shakeMs * T.asking.shakes,
      easing: T.ease.soft,
    });
    r.later(T.asking.shakeMs * T.asking.shakes + T.asking.shakePauseMs, shake);
  };
  r.later(T.asking.raiseMs + 100, shake);
  // Tangan L mengetuk: translateY ±2, 0,6 s.
  if (!r.reduced) {
    r.anim.start(
      r.el("hand-l"),
      "tap",
      "B",
      [{ translate: "0px -2px" }, { translate: "0px 2px" }],
      { duration: 600, easing: T.ease.soft, iterations: Infinity, direction: "alternate" },
    );
  }
  qBubbleLoop(r, () => escalated);
  // Eskalasi setelah 20 s.
  r.later(T.asking.escalateAtMs, () => {
    escalated = true;
    r.showProp("q-bubble-2", true);
  });
}

/* ------------------------------------------------------------------ */
/* 6.5 Senang                                                            */
/* ------------------------------------------------------------------ */

function confettiBurst(r: PoseOps): void {
  const c = T.celebrate.confetti;
  const pieces = [...r.svg.querySelectorAll("#confetti .cf")];
  pieces.forEach((piece, i) => {
    const p = piece as Element;
    const angleDeg = c.angleFrom + (i * (c.angleTo - c.angleFrom)) / (pieces.length - 1) +
      (r.rand() * 2 - 1) * c.angleJitter;
    const a = (angleDeg * Math.PI) / 180;
    const dist = c.distMin + r.rand() * (c.distMax - c.distMin);
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist;
    const rot = (r.rand() < 0.5 ? -1 : 1) * (360 + r.rand() * 360);
    const dur = c.durMinMs + r.rand() * (c.durMaxMs - c.durMinMs);
    r.anim.start(
      p,
      "burst",
      "B",
      [
        { transform: "translate(0px, 0px) rotate(0deg) scale(0.4)", opacity: 0, easing: "ease-out" },
        {
          transform: `translate(${(dx * 0.35).toFixed(1)}px, ${(dy * 0.35).toFixed(1)}px) rotate(${(rot * 0.35).toFixed(0)}deg) scale(1)`,
          opacity: 1,
          offset: 0.08,
          easing: "ease-out",
        },
        {
          transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${(rot * 0.6).toFixed(0)}deg)`,
          opacity: 1,
          offset: 0.35,
          easing: T.ease.fall,
        },
        {
          transform: `translate(${dx.toFixed(1)}px, ${(dy + c.fall).toFixed(1)}px) rotate(${rot.toFixed(0)}deg)`,
          opacity: 1,
          offset: 0.7,
          easing: T.ease.fall,
        },
        {
          transform: `translate(${dx.toFixed(1)}px, ${(dy + c.fall).toFixed(1)}px) rotate(${rot.toFixed(0)}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: dur,
        delay: (i * 17) % 120,
      },
    );
  });
}

export function applyCelebrate(r: PoseOps): void {
  r.setEyes("e-happy");
  r.setMouth("m-bigsmile");
  r.setLamp("ok");
  lampPattern(r, "pulse", T.celebrate.lampPulseMs, 0.8, 1);
  const f = T.celebrate.float;
  const period = jittered(r.rand, f.periodMs, f.jitter);
  r.floatBody({ ampY: f.ampY, periodMs: period });
  r.shadowSync(period, true);
  r.antennaFollow(period, true);
  if (r.reduced) {
    // Konfeti diganti 3 kilau statis.
    r.showProp("sparkles", true);
    r.placeHand("l", "front");
    r.placeHand("r", "front");
    r.moveHand("l", -6, -56, 80, T.ease.out);
    r.moveHand("r", 6, -52, 80, T.ease.out);
    return;
  }
  // Tangan di samping badan, berlawanan fase.
  r.placeHand("l", "front");
  r.placeHand("r", "front");
  r.moveHand("l", -6, -56, 280, T.ease.pop);
  r.moveHand("r", 6, -52, 280, T.ease.pop);
  const h = T.celebrate.hands;
  for (const [which, delay] of [["l", 0], ["r", h.periodMs / 2]] as const) {
    const hand = r.el(which === "l" ? "hand-l" : "hand-r");
    // Hanya bake translate ATRIBUT; offset posisi tetap dari style.translate
    // (moveHand), dan bob (±ampY) sebagai delta. Rotate kini tepat di tangan.
    const attrBase = baseTranslate(hand);
    r.anim.start(
      hand,
      "cheer",
      "B",
      [
        {
          transform: `${attrBase} translate(0px, ${-h.ampY}px) rotate(${-h.rotDeg}deg)`,
        },
        {
          transform: `${attrBase} translate(0px, ${h.ampY}px) rotate(${h.rotDeg}deg)`,
        },
      ],
      {
        duration: h.periodMs,
        delay: 280 + delay,
        easing: T.ease.soft,
        iterations: Infinity,
        direction: "alternate",
      },
    );
  }
  // Lompat tiap burst ke-2 (tengah pose).
  const j = T.celebrate.jump;
  r.later(1500, () => {
    const nod = r.el("body-nod");
    r.anim.start(
      nod,
      "jump",
      "B",
      [
        { translate: "0px 0px", scale: "1 1" },
        { translate: `0px ${j.anticipate}px`, scale: "1 1", offset: 0.16 },
        { translate: `0px ${j.height}px`, scale: "1 1", offset: 0.55 },
        { translate: "0px 0px", scale: `1 ${j.landSquashY}`, offset: 0.85 },
        { translate: "0px 0px", scale: "1 1" },
      ],
      { duration: j.ms, easing: T.ease.out },
    );
  });
  // Ledakan konfeti: langsung + tiap 1,5 s.
  confettiBurst(r);
  r.later(T.celebrate.confetti.burstIntervalMs, () => confettiBurst(r));
}

/* ------------------------------------------------------------------ */
/* 6.6 Bingung                                                           */
/* ------------------------------------------------------------------ */

function sweatLoop(r: PoseOps): void {
  const s = T.confused.sweat;
  const drop = (id: string, delayMs: number): void => {
    const el = r.el(id);
    if (r.reduced) {
      (el as HTMLElement).style.opacity = "1";
      return;
    }
    const cycle = (): void => {
      // Muncul.
      r.anim.start(
        el,
        "appear",
        "B",
        [{ opacity: 0, scale: "0.5" }, { opacity: 1, scale: "1" }],
        { duration: s.appearMs, easing: T.ease.pop, fill: "forwards" },
      );
      (el as HTMLElement).style.opacity = "1";
      // Naik sedikit.
      r.later(s.appearMs, () => {
        r.anim.start(
          el,
          "rise",
          "B",
          [{ translate: "0px 0px" }, { translate: `0px ${s.riseY}px` }],
          { duration: s.riseMs, easing: T.ease.out, fill: "forwards" },
        );
        (el as HTMLElement).style.setProperty("translate", `0px ${s.riseY}px`);
      });
      // Jatuh.
      r.later(s.appearMs + s.riseMs, () => {
        r.anim.start(
          el,
          "fall",
          "B",
          [
            { translate: `0px ${s.riseY}px`, scale: "1" },
            { translate: `0px ${s.fallY}px`, scale: "0.8" },
          ],
          { duration: s.fallMs, easing: T.ease.fall, fill: "forwards" },
        );
        (el as HTMLElement).style.setProperty("translate", `0px ${s.fallY}px`);
      });
      // Memudar.
      r.later(s.appearMs + s.riseMs + s.fallMs, () => {
        r.anim.start(el, "fade", "B", [{ opacity: 1 }, { opacity: 0 }], {
          duration: s.fadeMs,
          fill: "forwards",
        });
        (el as HTMLElement).style.opacity = "0";
        (el as HTMLElement).style.setProperty("translate", "0px 0px");
      });
      r.later(jittered(r.rand, s.cycleMs, s.jitter), cycle);
    };
    r.later(delayMs, cycle);
  };
  drop("sweat-1", 0);
  drop("sweat-2", s.delay2Ms);
}

function scratchLoop(r: PoseOps): void {
  const s = T.confused.scratch;
  if (r.reduced) return;
  const hand = r.el("hand-r");
  const cycle = (): void => {
    const b = r.handBase("r");
    // 5 gosokan × 140 ms.
    const kf: Keyframe[] = [];
    for (let i = 0; i <= s.scrubs * 2; i++) {
      kf.push({
        translate: `${b.x + (i % 2 === 0 ? -s.scrubX : s.scrubX)}px ${b.y + (i % 2 === 0 ? -s.scrubY : s.scrubY)}px`,
        rotate: `${i % 2 === 0 ? -s.scrubDeg : s.scrubDeg}deg`,
      });
    }
    r.anim.start(hand, "scratch", "B", kf, {
      duration: s.scrubMs * s.scrubs,
      easing: T.ease.soft,
    });
    r.later(s.scrubMs * s.scrubs + s.pauseMs, cycle);
  };
  cycle();
}

export function applyConfused(r: PoseOps): void {
  r.setEyes("e-worried");
  r.setMouth("m-wavy");
  r.setLamp("bad");
  lampPattern(r, "fast");
  const c = T.confused;
  r.floatBody({
    ampY: c.body.floatAmp,
    periodMs: 3200,
    swayDeg: c.body.shakeDeg,
    swayPeriodMs: c.body.shakePeriodMs,
    shakeX: r.reduced ? 0 : c.body.shakeX,
  });
  // Mulut bergelombang: geser kontinu tanpa putus.
  if (!r.reduced) {
    r.anim.start(
      r.el("wavy-path"),
      "wave",
      "B",
      [{ translate: "0px 0px" }, { translate: `-${c.mouthWave.travel}px 0px` }],
      { duration: c.mouthWave.periodMs, easing: T.ease.linear, iterations: Infinity },
    );
  }
  // Tangan R menggaruk kepala (136,76): offset (-22,-72).
  r.placeHand("r", "front");
  r.moveHand("r", -22, -72, c.scratch.enterMs, T.ease.pop);
  r.later(c.scratch.enterMs, () => scratchLoop(r));
  // Tangan L bergetar halus.
  if (!r.reduced) {
    r.anim.start(
      r.el("hand-l"),
      "tremble",
      "B",
      [{ translate: "0px -1px" }, { translate: "0px 1px" }],
      {
        duration: c.handTremble.periodMs,
        easing: T.ease.soft,
        iterations: Infinity,
        direction: "alternate",
      },
    );
  }
  // Mata mencari kiri-kanan.
  if (!r.reduced) {
    const eyes = r.el("eyes");
    r.anim.start(
      eyes,
      "search",
      "B",
      [{ translate: `-${c.eyesSearch.x}px 0px` }, { translate: `${c.eyesSearch.x}px 0px` }],
      {
        duration: c.eyesSearch.periodMs,
        easing: T.ease.soft,
        iterations: Infinity,
        direction: "alternate",
      },
    );
  }
  sweatLoop(r);
}

/* ------------------------------------------------------------------ */
/* 6.7 Berbicara — overlay (dikelola renderer; pola lampu & busur)      */
/* ------------------------------------------------------------------ */

export function startSpeakingVisuals(r: PoseOps, opts: { lamp?: boolean } = {}): void {
  const s = T.speaking;
  const withLamp = opts.lamp !== false;
  if (withLamp) r.setLamp("info");
  if (r.reduced) {
    r.setMouth("m-open");
    return;
  }
  if (withLamp) lampPattern(r, "speak");
  // Cincin riak tiap 0,5 s.
  const ring = r.el("bulb-ring");
  r.anim.start(
    ring,
    "ripple",
    "B",
    [
      { scale: "1", opacity: 0.45 },
      { scale: "1.9", opacity: 0 },
    ],
    { duration: s.rippleMs, easing: T.ease.out, iterations: Infinity },
  );
  // Busur suara: kecil→besar, selisih 0,2 s, siklus 1,2 s.
  const arcs: [string, number][] = [
    ["arc-r1", 0], ["arc-l1", 0],
    ["arc-r2", 1], ["arc-l2", 1],
    ["arc-r3", 2], ["arc-l3", 2],
  ];
  for (const [id, sizeIdx] of arcs) {
    const arc = r.el(id);
    r.anim.start(
      arc,
      "arc",
      "B",
      [
        { opacity: 0, scale: "0.7" },
        { opacity: s.arcs.peakOpacity, scale: "1", offset: 0.15 },
        { opacity: s.arcs.peakOpacity, offset: 0.75 },
        { opacity: 0, scale: "1" },
      ],
      {
        duration: jittered(r.rand, s.arcs.cycleMs, s.arcs.jitter),
        delay: sizeIdx * s.arcs.staggerMs,
        easing: T.ease.soft,
        iterations: Infinity,
      },
    );
  }
}

export function stopSpeakingVisuals(r: PoseOps): void {
  for (const id of ["arc-r1", "arc-r2", "arc-r3", "arc-l1", "arc-l2", "arc-l3"]) {
    const arc = r.el(id);
    r.anim.stop(arc, "arc");
    arc.setAttribute("opacity", "0");
  }
  r.anim.stop(r.el("bulb-ring"), "ripple");
  r.el("bulb-ring").setAttribute("opacity", "0");
}

/* ------------------------------------------------------------------ */
/* 6.8 Tidur                                                             */
/* ------------------------------------------------------------------ */

function zzzLoop(r: PoseOps): void {
  const z = T.sleeping.zzz;
  const ids = ["zzz-1", "zzz-2", "zzz-3"];
  const show = (i: number): void => {
    const el = r.el(ids[i] as string);
    if (r.reduced) {
      (el as HTMLElement).style.opacity = "0.9";
      return;
    }
    r.anim.start(
      el,
      "appear",
      "B",
      [
        { opacity: 0, scale: "0.7", translate: "0px 0px" },
        { opacity: 0.9, scale: "1", translate: "0px -1px", offset: 0.25 },
        { opacity: 0.9, scale: "1", translate: `0px ${z.driftY}px` },
      ],
      { duration: z.driftMs, easing: T.ease.out, fill: "forwards" },
    );
    (el as HTMLElement).style.opacity = "0.9";
  };
  const cycle = (): void => {
    show(0);
    r.later(z.staggerMs, () => show(1));
    r.later(z.staggerMs * 2, () => show(2));
    // Memudar bersama di 2,3–2,8 s.
    r.later(z.cycleMs - 700, () => {
      for (const id of ids) {
        const el = r.el(id);
        if (r.reduced) continue;
        r.anim.start(el, "fade", "B", [{ opacity: 0.9 }, { opacity: 0 }], {
          duration: z.fadeMs,
          fill: "forwards",
        });
        (el as HTMLElement).style.opacity = "0";
        (el as HTMLElement).style.setProperty("translate", "0px 0px");
      }
    });
    r.later(z.cycleMs, cycle);
  };
  cycle();
}

export function applySleeping(r: PoseOps): void {
  r.setEyes("e-sleep");
  r.setMouth("m-o");
  // Mulut elips mungil saat tidur (transform di-bake agar tidak bergeser).
  const mouth = r.el("mouth");
  (mouth as HTMLElement).style.setProperty("transform", `${baseTranslate(mouth)} scale(0.75)`);
  r.setLamp("stem");
  lampPattern(r, "breath");
  // Badan diam: tanpa float.
  r.stopBody();
  r.shadowSync(0, false);
  r.antennaFollow(0, false);
  // Antena menunduk.
  const ant = r.el("antenna");
  r.anim.start(ant, "droop", "B", [{ rotate: "0deg" }, { rotate: `${T.sleeping.antennaDroopDeg}deg` }], {
    duration: 600,
    easing: T.ease.soft,
    fill: "forwards",
  });
  (ant as HTMLElement).style.setProperty("rotate", `${T.sleeping.antennaDroopDeg}deg`);
  // Tangan menepi.
  r.placeHand("l", "front");
  r.placeHand("r", "front");
  const ms = r.reduced ? 80 : 600;
  r.moveHand("l", 22, 20, ms, T.ease.soft);
  r.moveHand("r", -22, 24, ms, T.ease.soft);
  zzzLoop(r);
  if (!r.reduced) {
    // Kedutan tangan sesekali.
    const twitch = (): void => {
      for (const which of ["l", "r"] as const) {
        const hand = r.el(which === "l" ? "hand-l" : "hand-r");
        const b = r.handBase(which);
        r.anim.start(
          hand,
          "twitch",
          "B",
          [{ translate: `${b.x}px ${b.y}px` }, { translate: `${b.x}px ${b.y - T.sleeping.twitch.amp}px` }],
          { duration: 200, easing: T.ease.soft, direction: "alternate", iterations: 2 },
        );
      }
      r.later(T.sleeping.twitch.minMs + r.rand() * (T.sleeping.twitch.maxMs - T.sleeping.twitch.minMs), twitch);
    };
    r.later(20000, twitch);
    // Gelembung ingus tiap 10–15 s.
    const snot = (): void => {
      const el = r.el("snot") as unknown as SVGCircleElement;
      r.anim.start(
        el,
        "grow",
        "B",
        [{ opacity: 0.8 }, { opacity: 0.8 }],
        { duration: T.sleeping.snot.growMs },
      );
      // r dianimasikan lewat atribut (geometri, diizinkan §5.4 untuk efek).
      el.setAttribute("r", String(T.sleeping.snot.r));
      el.setAttribute("opacity", "0.8");
      r.later(T.sleeping.snot.growMs, () => {
        r.anim.start(el, "pop", "B", [{ opacity: 0.8 }, { opacity: 0 }], {
          duration: T.sleeping.snot.popMs,
          fill: "forwards",
        });
        el.setAttribute("opacity", "0");
        el.setAttribute("r", "0");
      });
      r.later(T.sleeping.snot.minMs + r.rand() * (T.sleeping.snot.maxMs - T.sleeping.snot.minMs), snot);
    };
    r.later(10000, snot);
  }
}

/* ------------------------------------------------------------------ */
/* 7.1 Mendengar                                                         */
/* ------------------------------------------------------------------ */

function listeningArcs(r: PoseOps): void {
  const a = T.listening.arcs;
  if (r.reduced) return;
  const arcs: [string, number, number][] = [
    // [id, sizeIdx (0 kecil..2 besar), arah-x menuju wajah]
    ["arc-r1", 0, -a.travel], ["arc-l1", 0, a.travel],
    ["arc-r2", 1, -a.travel], ["arc-l2", 1, a.travel],
    ["arc-r3", 2, -a.travel], ["arc-l3", 2, a.travel],
  ];
  for (const [id, sizeIdx, dirX] of arcs) {
    const arc = r.el(id);
    // Muncul dari besar ke kecil: delay terbalik.
    r.anim.start(
      arc,
      "arc-in",
      "B",
      [
        { opacity: 0, scale: "1", translate: "0px 0px" },
        { opacity: 0.7, scale: "0.85", translate: `${dirX / 2}px 0px`, offset: 0.4 },
        { opacity: 0, scale: "0.7", translate: `${dirX}px 0px` },
      ],
      {
        duration: a.cycleMs,
        delay: (2 - sizeIdx) * a.staggerMs,
        easing: T.ease.soft,
        iterations: Infinity,
      },
    );
  }
}

export function applyListening(r: PoseOps): void {
  r.setEyes("e-wide");
  r.setMouth("m-flat");
  r.setLamp("info");
  // Lampu mengikuti level mic — didorong renderer.setSpeechLevel saat pose listening.
  const b = T.listening.body;
  r.floatBody({ ampY: b.floatAmp, periodMs: b.floatPeriodMs, tiltDeg: b.rotateDeg });
  r.shadowSync(b.floatPeriodMs, true);
  const nod = r.el("body-nod");
  if (!r.reduced) {
    r.anim.start(nod, "lean", "B", [{ scale: "1 1" }, { scale: `${b.scale} ${b.scale}` }], {
      duration: 280,
      easing: T.ease.out,
      fill: "forwards",
    });
    (nod as HTMLElement).style.setProperty("scale", `${b.scale} ${b.scale}`);
  }
  r.moveHand("l", -6, -10, 280, T.ease.out);
  r.moveHand("r", 6, -10, 280, T.ease.out);
  listeningArcs(r);
  if (!r.reduced) {
    const nodHead = (): void => {
      const eyes = r.el("eyes");
      r.anim.start(
        eyes,
        "nod",
        "B",
        [{ translate: "0px 0px" }, { translate: "0px 1px" }, { translate: "0px 0px" }],
        { duration: T.listening.nodMs * 2, easing: T.ease.soft },
      );
      r.later(2000 + r.rand() * 2000, nodHead);
    };
    r.later(2000, nodHead);
  }
}

/* ------------------------------------------------------------------ */
/* 7.2 Offline                                                           */
/* ------------------------------------------------------------------ */

export function applyOffline(r: PoseOps): void {
  r.setEyes("e-flat");
  r.setMouth("m-flat");
  r.setLamp("stem");
  lampPattern(r, "off");
  r.stopBody();
  r.shadowSync(0, false);
  r.antennaFollow(0, false);
  // Badan memudar.
  const nod = r.el("body-nod");
  r.anim.start(nod, "fade", "B", [{ opacity: 1 }, { opacity: 0.7 }], {
    duration: T.offline.fadeMs,
    easing: T.ease.soft,
    fill: "forwards",
  });
  (nod as HTMLElement).style.opacity = "0.7";
  // Antena terkulai.
  const ant = r.el("antenna");
  r.anim.start(ant, "droop", "B", [{ rotate: "0deg" }, { rotate: `${T.offline.antennaDroopDeg}deg` }], {
    duration: 400,
    easing: T.ease.soft,
    fill: "forwards",
  });
  (ant as HTMLElement).style.setProperty("rotate", `${T.offline.antennaDroopDeg}deg`);
  r.placeHand("l", "front");
  r.placeHand("r", "front");
  r.moveHand("l", 22, 16, r.reduced ? 80 : 300, T.ease.soft);
  r.moveHand("r", -22, 20, r.reduced ? 80 : 300, T.ease.soft);
  r.showProp("prop-disc", true);
  (r.el("prop-disc") as HTMLElement).style.opacity = "0.6";
  // Kedip merah 150 ms tiap 3 s.
  if (!r.reduced) {
    const blink = (): void => {
      const bulb = r.el("bulb-core");
      bulb.setAttribute("fill", "var(--bot-bad)");
      bulb.setAttribute("opacity", "0.8");
      r.later(T.offline.redBlinkMs, () => {
        bulb.setAttribute("fill", "var(--bot-stem)");
        bulb.setAttribute("opacity", "0.25");
      });
      r.later(T.offline.redIntervalMs, blink);
    };
    r.later(T.offline.redIntervalMs, blink);
  }
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                            */
/* ------------------------------------------------------------------ */

export function applyPoseLayers(r: PoseOps, pose: AvatarPose, variant: WorkingVariant): void {
  switch (pose) {
    case "idle":
      applyIdle(r);
      break;
    case "thinking":
      applyThinking(r);
      break;
    case "working":
      applyWorking(r, variant);
      break;
    case "asking":
      applyAsking(r);
      break;
    case "celebrate":
      applyCelebrate(r);
      break;
    case "confused":
      applyConfused(r);
      break;
    case "sleeping":
      applySleeping(r);
      break;
    case "listening":
      applyListening(r);
      break;
    case "offline":
      applyOffline(r);
      break;
  }
}
