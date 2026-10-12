import type { AvatarPose, AvatarRenderer } from "./types.js";
import { BiboSVG, POSES, type BadgeIcon, type EyeVariant, type PoseSpec, type PropName } from "./bibo.js";

function specOf(pose: AvatarPose): PoseSpec {
  const s = POSES[pose];
  if (!s) throw new Error(`pose tak dikenal: ${pose}`);
  return s;
}
import { BIBO_CSS } from "./bibo-css.js";

/**
 * BiboSvgRenderer: SVG + CSS keyframes, tanpa library animasi (PRD §8.4/§8.5).
 * Bicara = voice-pulse (denyut badan + badge gelombang), bukan mulut.
 */

const EYES: EyeVariant[] = ["open", "wide", "focus", "happy", "sleep", "worried", "flat"];
const ICONS: Exclude<BadgeIcon, null>[] = [
  "dots", "wave", "mic", "code", "terminal", "eye", "globe",
  "gear", "question", "exclaim", "check", "zzz", "offline",
];
const PROPS: PropName[] = ["magnifier", "keyboard", "terminal", "globe", "minibot", "sparkles", "sweat", "signal"];

export class BiboSvgRenderer implements AvatarRenderer {
  private root: SVGSVGElement | undefined;
  private styleEl: HTMLStyleElement | undefined;
  private pose: AvatarPose = "idle";
  private look: [number, number] = [0, 0];
  private speech = 0;
  private savedBadge: BadgeIcon | undefined = undefined;
  private timers: Array<ReturnType<typeof setTimeout | typeof setInterval>> = [];
  private reduced = false;
  private sleepMs = 120_000;
  private lookRange: [number, number] = [5000, 9000];
  private idleSince = Date.now();

  mount(el: HTMLElement, opts: { theme: "light" | "dark"; reducedMotion: boolean; sleepMs?: number }): void {
    this.destroy();
    this.reduced = opts.reducedMotion;
    if (opts.sleepMs !== undefined) this.sleepMs = opts.sleepMs;
    this.styleEl = document.createElement("style");
    this.styleEl.textContent = BIBO_CSS;
    el.appendChild(this.styleEl);
    const wrap = document.createElement("div");
    wrap.innerHTML = BiboSVG;
    const svg = wrap.querySelector("svg");
    if (!svg) throw new Error("SVG Bibo gagal dibuat");
    el.appendChild(svg);
    this.root = svg as unknown as SVGSVGElement;
    this.setTheme(opts.theme);
    this.root.dataset["rm"] = this.reduced ? "1" : "0";
    this.applyPose("idle");
    this.scheduleLook();
    this.scheduleSleep();
  }

  setPose(pose: AvatarPose): void {
    this.pose = pose;
    this.idleSince = Date.now();
    this.applyPose(pose);
  }

  setSpeechLevel(level: number): void {
    const l = Math.max(0, Math.min(1, level));
    this.speech = l;
    const svg = this.root;
    if (!svg) return;
    const pulse = svg.querySelector("#speech-pulse") as SVGGElement | null;
    if (l <= 0) {
      svg.dataset["speaking"] = "0";
      pulse?.removeAttribute("transform");
      this.restoreBadge();
      return;
    }
    svg.dataset["speaking"] = "1";
    // voice-pulse: scaleY = 1 + 0.045·level, scaleX = 1 − 0.02·level (§9.3).
    // Atribut transform (bukan style) agar konsisten di semua DOM/SVG.
    if (pulse) {
      pulse.setAttribute("transform", `scale(${(1 - 0.02 * l).toFixed(3)} ${(1 + 0.045 * l).toFixed(3)})`);
      pulse.style.setProperty("transform-box", "fill-box");
      pulse.style.setProperty("transform-origin", "50% 100%");
    }
    // Badge gelombang selama bicara; pulihkan setelahnya.
    const current = specOf(this.pose).badge;
    if (current !== "wave") {
      this.savedBadge = current;
      this.showBadge("wave", specOf(this.pose).tone);
    }
  }

  setLook(x: number, y: number): void {
    this.look = [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
    this.applyFace();
  }

  setTheme(theme: "light" | "dark"): void {
    this.root?.setAttribute("data-theme", theme);
  }

  destroy(): void {
    for (const t of this.timers) {
      clearTimeout(t as ReturnType<typeof setTimeout>);
      clearInterval(t as ReturnType<typeof setInterval>);
    }
    this.timers = [];
    this.root?.remove();
    this.styleEl?.remove();
    this.root = undefined;
    this.styleEl = undefined;
  }

  /** Untuk tes: pose aktif + ukuran SVG. */
  get currentPose(): AvatarPose {
    return this.pose;
  }

  private applyPose(pose: AvatarPose): void {
    const svg = this.root;
    if (!svg) return;
    const spec = specOf(pose);
    if (this.speech <= 0) this.showBadge(spec.badge, spec.tone);
    else this.showBadge("wave", spec.tone);
    this.showEyes(spec.eye);
    this.moveHands(spec.handL, spec.handR);
    const [tilt, sx, sy] = spec.body;
    const body = svg.querySelector("#body-wrap") as SVGGElement | null;
    // style.transform (bukan atribut) agar transisi CSS 200–300 ms bekerja.
    if (body) {
      body.style.transformBox = "view-box";
      body.style.transformOrigin = "240px 236px";
      body.style.transform = `rotate(${tilt}deg) scale(${sx}, ${sy})`;
    }
    this.applyFace();
    this.showProps(spec.props);
    svg.dataset["loop"] = spec.loop;
    svg.dataset["tone"] = spec.tone;
    svg.dataset["dim"] = pose === "sleeping" ? "1" : "0";
  }

  private applyFace(): void {
    const svg = this.root;
    if (!svg) return;
    const [gx, gy] = specOf(this.pose).gaze;
    const face = svg.querySelector("#face") as SVGGElement | null;
    if (face) {
      face.style.transformBox = "view-box";
      face.style.transform = `translate(${(gx + this.look[0] * 6).toFixed(1)}px, ${(gy + this.look[1] * 6).toFixed(1)}px)`;
    }
  }

  private showEyes(v: EyeVariant): void {
    const svg = this.root;
    if (!svg) return;
    for (const e of EYES) {
      const g = svg.querySelector(`.e-${e}`) as SVGGElement | null;
      if (g) g.style.display = e === v ? "" : "none";
    }
  }

  private showBadge(icon: BadgeIcon, tone: string): void {
    const svg = this.root;
    if (!svg) return;
    const badge = svg.querySelector("#badge") as SVGGElement | null;
    badge?.setAttribute("data-hidden", icon === null ? "1" : "0");
    svg.dataset["tone"] = tone;
    for (const name of ICONS) {
      const g = svg.querySelector(`.bi-${name}`) as SVGGElement | null;
      if (g) g.style.display = name === icon ? "" : "none";
    }
  }

  private restoreBadge(): void {
    if (this.savedBadge === undefined) return;
    const spec = specOf(this.pose);
    this.showBadge(this.savedBadge, spec.tone);
    this.savedBadge = undefined;
  }

  private moveHands(l: [number, number], r: [number, number, number]): void {
    const svg = this.root;
    if (!svg) return;
    const hl = svg.querySelector("#hand-left") as SVGGElement | null;
    if (hl) {
      hl.style.transformBox = "fill-box";
      hl.style.transformOrigin = "center";
      hl.style.transform = `translate(${l[0]}px, ${l[1]}px)`;
    }
    const hr = svg.querySelector("#hand-right") as SVGGElement | null;
    if (hr) {
      hr.style.transformBox = "fill-box";
      hr.style.transformOrigin = "center";
      hr.style.transform = `translate(${r[0]}px, ${r[1]}px) rotate(${r[2]}deg)`;
    }
  }

  private showProps(props: Array<{ name: PropName; at: [number, number]; scale?: number }>): void {
    const svg = this.root;
    if (!svg) return;
    const on = new Map(props.map((p) => [p.name, p]));
    for (const name of PROPS) {
      const g = svg.querySelector(`.prop-${name}`) as SVGGElement | null;
      if (!g) continue;
      const p = on.get(name);
      if (!p) {
        g.style.display = "none";
        continue;
      }
      g.style.display = "";
      const s = p.scale ?? 1;
      // Atribut (bukan style): props hanya muncul/hilang, tanpa transisi.
      g.setAttribute("transform", `translate(${p.at[0]},${p.at[1]}) scale(${s})`);
    }
  }

  private scheduleLook(): void {
    if (this.reduced) return;
    const tick = (): void => {
      if (this.pose === "idle" || this.pose === "listening") {
        this.setLook((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.8);
      }
      const [a, b] = this.lookRange;
      this.timers.push(setTimeout(tick, a + Math.random() * (b - a)));
    };
    const [a, b] = this.lookRange;
    this.timers.push(setTimeout(tick, a + Math.random() * (b - a)));
  }

  private scheduleSleep(): void {
    const tick = (): void => {
      if (this.pose === "idle" && Date.now() - this.idleSince >= this.sleepMs) {
        this.applyPose("sleeping");
        // pose logis tetap idle; visual tidur sampai setPose berikutnya.
      }
      this.timers.push(setTimeout(tick, Math.min(5000, this.sleepMs)));
    };
    this.timers.push(setTimeout(tick, Math.min(5000, this.sleepMs)));
  }
}
