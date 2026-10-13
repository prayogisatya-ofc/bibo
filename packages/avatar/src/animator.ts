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

/** Urai string transform CSS ke props GSAP.
 * PENTING: beberapa translate() diakumulasi (bukan ditimpa) — pola
 * "translate(42px,152px) translate(0px,-12px)" = base + delta. */
function parseTransform(tf: string): GsapProps {
  const out: GsapProps = {};
  let m: RegExpExecArray | null;

  // Kumpulkan SEMUA translate() lalu jumlahkan.
  let tx = 0, ty = 0, hasT = false;
  const reT = /translate\(\s*(-?[\d.]+)(?:px)?\s*,?\s*(-?[\d.]+)?(?:px)?\s*\)/g;
  while ((m = reT.exec(tf)) !== null) {
    if (m[1] !== undefined) { tx += parseFloat(m[1]); hasT = true; }
    if (m[2] !== undefined) ty += parseFloat(m[2]);
  }
  const reTX = /translateX\(\s*(-?[\d.]+)(?:px)?\s*\)/g;
  while ((m = reTX.exec(tf)) !== null) {
    if (m[1] !== undefined) { tx += parseFloat(m[1]); hasT = true; }
  }
  const reTY = /translateY\(\s*(-?[\d.]+)(?:px)?\s*\)/g;
  while ((m = reTY.exec(tf)) !== null) {
    if (m[1] !== undefined) { ty += parseFloat(m[1]); hasT = true; }
  }
  if (hasT) { out.x = tx; out.y = ty; }

  // scale(s) | scale(sx, sy) — ambil yang terakhir (tidak diakumulasi).
  const reS = /scale\(\s*(-?[\d.]+)\s*,?\s*(-?[\d.]+)?\s*\)/g;
  let lastS: RegExpExecArray | null = null;
  while ((m = reS.exec(tf)) !== null) lastS = m;
  if (lastS && lastS[1] !== undefined) {
    out.scaleX = parseFloat(lastS[1]);
    out.scaleY = lastS[2] !== undefined ? parseFloat(lastS[2]) : parseFloat(lastS[1]);
  }
  const reSX = /scaleX\(\s*(-?[\d.]+)\s*\)/g;
  let lastSX: RegExpExecArray | null = null;
  while ((m = reSX.exec(tf)) !== null) lastSX = m;
  if (lastSX && lastSX[1] !== undefined) out.scaleX = parseFloat(lastSX[1]);
  const reSY = /scaleY\(\s*(-?[\d.]+)\s*\)/g;
  let lastSY: RegExpExecArray | null = null;
  while ((m = reSY.exec(tf)) !== null) lastSY = m;
  if (lastSY && lastSY[1] !== undefined) out.scaleY = parseFloat(lastSY[1]);

  // rotate(deg) — ambil yang terakhir, akumulasi bila beberapa.
  let rot = 0, hasR = false;
  const reR = /rotate\(\s*(-?[\d.]+)(?:deg)?\s*\)/g;
  while ((m = reR.exec(tf)) !== null) {
    if (m[1] !== undefined) { rot += parseFloat(m[1]); hasR = true; }
  }
  if (hasR) out.rotation = rot;

  return out;
}

/** Origin SVG (koordinat viewBox) untuk elemen dengan transform-box: view-box.
 * GSAP menimpa transform-origin CSS saat inisialisasi, jadi nilai diambil
 * dari sini (sesuai svg.ts) bukan dari getComputedStyle. */
const SVG_VIEWBOX_ORIGINS: Record<string, string> = {
  antenna: "100 62",
  "body-float": "100 166",
};

/** Ambil svgOrigin dari CSS transform-origin bila transform-box: view-box (untuk SVG). */
function getSvgOrigin(el: Element): string | undefined {
  // Cek peta hardcoded dulu (paling andal — GSAP menimpa computed style).
  const id = el.getAttribute("id");
  if (id && SVG_VIEWBOX_ORIGINS[id] !== undefined) {
    return SVG_VIEWBOX_ORIGINS[id];
  }
  try {
    const cs = getComputedStyle(el as unknown as globalThis.Element);
    // getComputedStyle tersedia di browser; di jsdom transformBox mungkin kosong.
    const box = (cs as unknown as { transformBox?: string }).transformBox ?? "";
    if (box !== "view-box") return undefined;
    const origin = cs.transformOrigin ?? "";
    const m = /(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(origin);
    if (!m || m[1] === undefined || m[2] === undefined) return undefined;
    // Abaikan "0px 0px" — itu tanda GSAP sudah menimpa (bukan nilai asli).
    if (m[1] === "0" && m[2] === "0") return undefined;
    return `${m[1]} ${m[2]}`;
  } catch {
    return undefined;
  }
}

/** Konversi satu keyframe WAAPI ke props GSAP.
 * Hanya untuk keyframes 'transform' string & opacity (jalur GSAP).
 * Properti individual (rotate/translate/scale) ditangani via WAAPI. */
function keyframeToProps(kf: Keyframe): GsapProps {
  const out: GsapProps = {};
  if (typeof kf.transform === "string") {
    Object.assign(out, parseTransform(kf.transform));
  }
  if (kf.opacity !== undefined) {
    const v = kf.opacity;
    out.opacity = typeof v === "string" ? parseFloat(v) : (v as number);
  }
  // Properti CSS lain diteruskan apa adanya bila string/number.
  for (const key of Object.keys(kf)) {
    if (key === "transform" || key === "opacity" || key === "offset" || key === "easing" || key === "composite" ||
        key === "rotate" || key === "translate" || key === "scale") continue;
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

/** Animasi no-op untuk lingkungan tanpa WAAPI (tidak terjadi di browser target). */
function noopAnimation(): Animation {
  return {
    cancel() {},
    finish() {},
    pause() {},
    play() {},
    reverse() {},
    persist() {},
    commitStyles() {},
    currentTime: 0,
    playbackRate: 1,
    playState: "finished",
    onfinish: null,
    oncancel: null,
    onremove: null,
  } as unknown as Animation;
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

    // HYBRID: properti individual (rotate/translate/scale) pakai WAAPI —
    // browser menangani transform-box/transform-origin SVG dengan benar.
    // GSAP hanya untuk keyframes 'transform' string & opacity (lebih halus).
    // PENGECUALIAN: transform string yang mengandung rotate() atau scale()
    // juga via WAAPI, karena GSAP menimpa transform-origin CSS (gear jadi
    // orbit, scale dari pojok bukan dari tengah).
    const usesIndividual = keyframes.some((kf) => {
      const r = kf as Record<string, unknown>;
      if (typeof r["rotate"] === "string" || typeof r["translate"] === "string" || typeof r["scale"] === "string") {
        return true;
      }
      // Transform string dengan rotate/scale: WAAPI agar origin CSS dihormati.
      if (typeof r["transform"] === "string") {
        const tf = r["transform"] as string;
        if (/rotate\(/.test(tf) || /scale\(/.test(tf) || /scaleX\(/.test(tf) || /scaleY\(/.test(tf)) {
          return true;
        }
      }
      return false;
    });
    if (usesIndividual) {
      return this.startWaapi(el, id, layer, keyframes, options);
    }

    const durationMs = typeof options.duration === "number" ? options.duration : 1000;
    const durationS = Math.max(durationMs / 1000, 0.001);
    const ease = mapEase(typeof options.easing === "string" ? options.easing : undefined);
    const iterations = options.iterations ?? 1;
    const infinite = iterations === Infinity;
    const delayS = typeof options.delay === "number" ? options.delay / 1000 : 0;
    // Hormati transform-box: view-box pada SVG (mis. antena) agar origin benar.
    // Set via gsap.set EKSPLISIT sebelum timeline (bukan via vars) agar GSAP
    // tidak mengabaikannya.
    const svgOrigin = getSvgOrigin(el);
    if (svgOrigin !== undefined) {
      try {
        gsap.set(el as unknown as object, { svgOrigin });
      } catch {
        /* abaikan */
      }
    }
    const originVars = svgOrigin !== undefined ? { svgOrigin } : {};

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
            ...originVars,
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
        // PENTING: set nilai keyframe pertama di t=0 (seperti WAAPI),
        // lalu tween ke keyframe berikutnya.
        const tl = gsap.timeline({
          delay: delayS,
          repeat: infinite ? -1 : (iterations as number) - 1,
          yoyo: options.direction === "alternate",
          paused: this.paused,
        });
        // Set state awal ke keyframe[0] (mendukung fill:"backwards").
        const kf0 = keyframes[0];
        if (kf0) {
          const props0 = keyframeToProps(kf0);
          if (Object.keys(props0).length > 0) {
            tl.set(el as unknown as object, { ...originVars, ...props0 }, 0);
          }
        }
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
          tl.to(el as unknown as object, { ...originVars, ...props, duration: segDur, ease: kfEase }, from * durationS);
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

  /** Jalur WAAPI untuk properti individual (rotate/translate/scale).
   * Browser menangani transform-box/transform-origin SVG dengan benar,
   * tidak seperti GSAP yang menimpa origin. */
  private startWaapi(
    el: Element,
    id: string,
    layer: AnimLayer,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ): Animation {
    const anyEl = el as Element & { animate?: Element["animate"] };
    let anim: Animation;
    try {
      anim =
        typeof anyEl.animate === "function" ? anyEl.animate(keyframes, options) : noopAnimation();
    } catch {
      anim = noopAnimation();
    }
    anim.playbackRate = this.rate;
    (anim as unknown as { __animId?: string }).__animId = id;
    if (this.paused) anim.pause();
    // Simpan sebagai Tracked dengan tween facade agar stop/pause konsisten.
    // Untuk WAAPI, bungkus dalam objek yang meniru antarmuka GSAP minimal.
    const wrapper = {
      kill: () => { try { anim.cancel(); } catch { /* abaikan */ } },
      pause: () => { try { anim.pause(); } catch { /* abaikan */ } },
      play: () => { try { anim.play(); } catch { /* abaikan */ } },
      timeScale: (r: number) => { try { anim.playbackRate = r; } catch { /* abaikan */ } },
      progress: (p: number) => {
        try {
          const dur = typeof options.duration === "number" ? options.duration : 1000;
          anim.currentTime = p * dur;
        } catch { /* abaikan */ }
      },
      time: (_t: number) => { /* tidak dipakai untuk WAAPI */ },
      eventCallback: (_e: string, _cb: () => void) => { /* tidak dipakai */ },
    };
    const durationMs = typeof options.duration === "number" ? options.duration : 1000;
    let per = this.tracked.get(el);
    if (!per) {
      per = new Map();
      this.tracked.set(el, per);
    }
    per.set(id, {
      id,
      layer,
      tween: wrapper as unknown as gsap.core.Timeline,
      infinite: options.iterations === Infinity,
      duration: Math.max(durationMs / 1000, 0.001),
    });
    this.syncDataAnim(el);
    return anim;
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
