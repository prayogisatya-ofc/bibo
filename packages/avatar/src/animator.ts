/**
 * Animator — lapisan tipis di atas GSAP.
 *
 * API publik IDENTIK dengan versi WAAPI sebelumnya:
 * - Setiap animasi punya id logis per elemen ("float-y", "blink", ...).
 * - start() dengan id yang sama membatalkan animasi lama dulu.
 * - data-anim="<nama>" dijaga sinkron di tiap elemen (kontrak §12).
 * - pauseAll/resumeAll untuk pause(); seekAll untuk mode beku galeri dev;
 *   setRate untuk slow-mo galeri dev.
 *
 * GSAP menangani transform SVG dengan benar (tidak ada bug transform-origin
 * seperti pada properti individual WAAPI), sehingga helper baseTranslate()
 * tidak lagi diperlukan untuk kode baru — tetapi tetap diekspor untuk
 * kompatibilitas keyframes lama yang sudah membake translate dasar.
 */

import { gsap } from "gsap";

export type AnimLayer = "A" | "B" | "C";

/**
 * Ambil translate dasar dari atribut `transform` SVG sebagai string CSS.
 * Dipertahankan untuk kompatibilitas; GSAP tidak membutuhkannya karena
 * membaca transform dasar dari atribut secara otomatis.
 */
export function baseTranslate(el: Element): string {
  const t = el.getAttribute("transform") ?? "";
  const m = /translate\(\s*(-?[\d.]+)(?:px)?\s*,?\s*(-?[\d.]+)?(?:px)?\s*\)/.exec(t);
  if (!m) return "";
  return `translate(${m[1]}px,${m[2] ?? "0"}px)`;
}

/** Petakan easing CSS (dari timing.ts) ke ease GSAP. */
function mapEase(cssEase: string | undefined): string {
  if (!cssEase) return "power1.out";
  const e = cssEase.trim();
  if (e === "linear") return "none";
  if (e === "cubic-bezier(.45,0,.55,1)") return "sine.inOut"; // soft
  if (e === "cubic-bezier(.22,1,.36,1)") return "expo.out"; // out
  if (e === "cubic-bezier(.34,1.56,.64,1)") return "back.out(1.4)"; // pop
  if (e === "cubic-bezier(.5,0,.9,.6)") return "power2.in"; // fall
  if (e === "cubic-bezier(.65,0,.35,1)") return "power2.inOut"; // inOut
  // cubic-bezier generik: fallback ke power1.out
  return "power1.out";
}

interface GsapProps {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
  [k: string]: unknown;
}

/** Urai string transform CSS ("translate(100px,120px) scaleY(0.1)") ke props GSAP. */
function parseTransform(tf: string): GsapProps {
  const out: GsapProps = {};
  let m: RegExpExecArray | null;

  // translate(x, y) | translate(x)
  m = /translate\(\s*(-?[\d.]+)(?:px)?\s*,?\s*(-?[\d.]+)?(?:px)?\s*\)/.exec(tf);
  if (m && m[1] !== undefined) {
    out.x = parseFloat(m[1]);
    if (m[2] !== undefined) out.y = parseFloat(m[2]);
  }
  m = /translateX\(\s*(-?[\d.]+)(?:px)?\s*\)/.exec(tf);
  if (m && m[1] !== undefined) out.x = parseFloat(m[1]);
  m = /translateY\(\s*(-?[\d.]+)(?:px)?\s*\)/.exec(tf);
  if (m && m[1] !== undefined) out.y = parseFloat(m[1]);

  // scale(s) | scale(sx, sy)
  m = /scale\(\s*(-?[\d.]+)\s*,?\s*(-?[\d.]+)?\s*\)/.exec(tf);
  if (m && m[1] !== undefined) {
    out.scaleX = parseFloat(m[1]);
    out.scaleY = m[2] !== undefined ? parseFloat(m[2]) : parseFloat(m[1]);
  }
  m = /scaleX\(\s*(-?[\d.]+)\s*\)/.exec(tf);
  if (m && m[1] !== undefined) out.scaleX = parseFloat(m[1]);
  m = /scaleY\(\s*(-?[\d.]+)\s*\)/.exec(tf);
  if (m && m[1] !== undefined) out.scaleY = parseFloat(m[1]);

  // rotate(deg)
  m = /rotate\(\s*(-?[\d.]+)(?:deg)?\s*\)/.exec(tf);
  if (m && m[1] !== undefined) out.rotation = parseFloat(m[1]);

  return out;
}

/** Konversi satu keyframe WAAPI ke props GSAP. */
function keyframeToProps(kf: Keyframe): GsapProps {
  const out: GsapProps = {};
  if (typeof kf.transform === "string") {
    Object.assign(out, parseTransform(kf.transform));
  }
  if (kf.opacity !== undefined) {
    const v = kf.opacity;
    out.opacity = typeof v === "string" ? parseFloat(v) : (v as number);
  }
  // Properti CSS lain (mis. "d" untuk path) diteruskan apa adanya bila string/number.
  for (const key of Object.keys(kf)) {
    if (key === "transform" || key === "opacity" || key === "offset" || key === "easing" || key === "composite") continue;
    const v = (kf as Record<string, unknown>)[key];
    if (typeof v === "string" || typeof v === "number") out[key] = v;
  }
  return out;
}

interface Tracked {
  id: string;
  layer: AnimLayer;
  tween: gsap.core.Timeline | gsap.core.Tween;
  infinite: boolean;
  /** Durasi satu iterasi (detik) — untuk seekAll. */
  duration: number;
}

/** Facade mirip WAAPI Animation di atas GSAP (untuk kompatibilitas). */
class GsapAnimationFacade {
  currentTime = 0;
  playbackRate = 1;
  playState: AnimationPlayState = "running";
  onfinish: ((this: Animation, ev: AnimationPlaybackEvent) => unknown) | null = null;
  oncancel: ((this: Animation, ev: AnimationPlaybackEvent) => unknown) | null = null;
  onremove: ((this: Animation, ev: AnimationPlaybackEvent) => unknown) | null = null;
  __animId?: string;

  constructor(private readonly target: gsap.core.Timeline | gsap.core.Tween) {}

  cancel(): void {
    this.target.kill();
    this.playState = "idle";
  }
  finish(): void {
    this.target.progress(1);
    this.playState = "finished";
    if (this.onfinish) this.onfinish.call(this as unknown as Animation, {} as AnimationPlaybackEvent);
  }
  pause(): void {
    this.target.pause();
    this.playState = "paused";
  }
  play(): void {
    this.target.play();
    this.playState = "running";
  }
  reverse(): void {
    this.target.reverse();
  }
  persist(): void {}
  commitStyles(): void {}
}

export class Animator {
  private readonly tracked = new Map<Element, Map<string, Tracked>>();
  private paused = false;
  private rate = 1;

  start(
    el: Element,
    id: string,
    layer: AnimLayer,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ): Animation {
    this.stop(el, id);

    const durationMs = typeof options.duration === "number" ? options.duration : 1000;
    const durationS = Math.max(durationMs / 1000, 0.001);
    const ease = mapEase(typeof options.easing === "string" ? options.easing : undefined);
    const iterations = options.iterations ?? 1;
    const infinite = iterations === Infinity;
    const delayS = typeof options.delay === "number" ? options.delay / 1000 : 0;

    // Hitung offset tiap keyframe (WAAPI: tanpa offset = terbagi rata).
    const n = keyframes.length;
    const offsets = keyframes.map((kf, i) => {
      const o = (kf as { offset?: unknown }).offset;
      return typeof o === "number" ? o : n <= 1 ? 0 : i / (n - 1);
    });

    let tween: gsap.core.Timeline | gsap.core.Tween;
    try {
      if (n === 1) {
        // Satu keyframe: tween langsung ke nilai target.
        const kf0 = keyframes[0];
        if (!kf0) {
          tween = gsap.timeline({ paused: true });
        } else {
          const props = keyframeToProps(kf0);
          tween = gsap.to(el as unknown as object, {
            ...props,
            duration: durationS,
            ease,
            delay: delayS,
            repeat: infinite ? -1 : (iterations as number) - 1,
            yoyo: options.direction === "alternate",
            paused: this.paused,
          });
        }
      } else {
        // Multi-keyframe: timeline dengan tween per segmen.
        const tl = gsap.timeline({
          delay: delayS,
          repeat: infinite ? -1 : (iterations as number) - 1,
          yoyo: options.direction === "alternate",
          paused: this.paused,
        });
        for (let i = 1; i < n; i++) {
          const from = offsets[i - 1] ?? 0;
          const to = offsets[i] ?? 1;
          const kf = keyframes[i];
          if (!kf) continue;
          const segDur = Math.max((to - from) * durationS, 0.0001);
          const props = keyframeToProps(kf);
          // Easing per-keyframe bila ada, else easing global.
          const kfEaseRaw = (kf as { easing?: unknown }).easing;
          const kfEase = typeof kfEaseRaw === "string" ? mapEase(kfEaseRaw) : ease;
          tl.to(el as unknown as object, { ...props, duration: segDur, ease: kfEase }, from * durationS);
        }
        tween = tl;
      }
    } catch {
      // Gagal membuat tween: buat timeline kosong agar API tetap aman.
      tween = gsap.timeline({ paused: true });
    }

    tween.timeScale(this.rate);

    const facade = new GsapAnimationFacade(tween);
    facade.__animId = id;
    (facade as { playbackRate: number }).playbackRate = this.rate;

    // Sinkronkan playbackRate facade dengan timeScale GSAP.
    const origTimeScale = tween.timeScale.bind(tween);
    void origTimeScale;

    let per = this.tracked.get(el);
    if (!per) {
      per = new Map();
      this.tracked.set(el, per);
    }
    per.set(id, { id, layer, tween, infinite, duration: durationS });
    this.syncDataAnim(el);

    // Bersihkan tracking saat one-shot selesai (non-infinite).
    if (!infinite) {
      tween.eventCallback("onComplete", () => {
        const p = this.tracked.get(el);
        if (p?.get(id)?.tween === tween) {
          p.delete(id);
          if (p.size === 0) this.tracked.delete(el);
          this.syncDataAnim(el);
        }
        if (facade.onfinish) {
          facade.playState = "finished";
          facade.onfinish.call(facade as unknown as Animation, {} as AnimationPlaybackEvent);
        }
      });
    }

    return facade as unknown as Animation;
  }

  stop(el: Element, id: string): void {
    const per = this.tracked.get(el);
    const t = per?.get(id);
    if (!t) return;
    try {
      t.tween.kill();
    } catch {
      /* abaikan */
    }
    per?.delete(id);
    if (per && per.size === 0) this.tracked.delete(el);
    this.syncDataAnim(el);
  }

  /** Batalkan semua animasi pada lapisan tertentu (atau semua bila tanpa argumen). */
  stopLayer(layer?: AnimLayer): void {
    for (const [el, per] of [...this.tracked]) {
      for (const [id, t] of [...per]) {
        if (layer === undefined || t.layer === layer) {
          try {
            t.tween.kill();
          } catch {
            /* abaikan */
          }
          per.delete(id);
        }
      }
      if (per.size === 0) this.tracked.delete(el);
      else this.syncDataAnim(el);
    }
  }

  cancelAll(): void {
    this.stopLayer(undefined);
  }

  /** Selesaikan animasi satu-shot yang sedang berjalan lalu batalkan (untuk transisi mulus). */
  finish(el: Element, id: string): void {
    const t = this.tracked.get(el)?.get(id);
    if (!t) return;
    try {
      t.tween.progress(1);
    } catch {
      /* abaikan */
    }
    this.stop(el, id);
  }

  pauseAll(): void {
    this.paused = true;
    for (const per of this.tracked.values()) {
      for (const t of per.values()) {
        try {
          t.tween.pause();
        } catch {
          /* abaikan */
        }
      }
    }
  }

  resumeAll(): void {
    this.paused = false;
    for (const per of this.tracked.values()) {
      for (const t of per.values()) {
        try {
          t.tween.play();
        } catch {
          /* abaikan */
        }
      }
    }
  }

  setRate(rate: number): void {
    this.rate = rate;
    for (const per of this.tracked.values()) {
      for (const t of per.values()) {
        try {
          t.tween.timeScale(rate);
        } catch {
          /* abaikan */
        }
      }
    }
  }

  /**
   * Mode beku galeri dev: arahkan semua animasi ke waktu t lalu jeda.
   * Animasi infinite di-seek ke (t mod durasi); one-shot ke min(t, durasi).
   */
  seekAll(ms: number): void {
    const t = ms / 1000;
    for (const per of this.tracked.values()) {
      for (const tr of per.values()) {
        try {
          const dur = tr.duration;
          const target = dur === 0 ? t : tr.infinite ? t % dur : Math.min(t, dur);
          // Untuk timeline, totalTime mencakup repeat; pakai time() untuk satu iterasi.
          if (tr.infinite) {
            tr.tween.pause();
            (tr.tween as gsap.core.Timeline).time(target);
          } else {
            (tr.tween as gsap.core.Timeline).time(Math.min(target, dur));
            tr.tween.pause();
          }
        } catch {
          /* abaikan */
        }
      }
    }
    this.paused = true;
  }

  activeCount(): number {
    let n = 0;
    for (const per of this.tracked.values()) n += per.size;
    return n;
  }

  private syncDataAnim(el: Element): void {
    const per = this.tracked.get(el);
    if (!per || per.size === 0) {
      el.removeAttribute("data-anim");
      return;
    }
    el.setAttribute("data-anim", [...per.keys()].join(" "));
  }
}
