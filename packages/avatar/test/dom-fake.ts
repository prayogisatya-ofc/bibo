/**
 * Test-helper: Animator palsu yang mencatat semua start()/stop() + rAF terkontrol.
 *
 * Animator kini memakai GSAP (bukan WAAPI), jadi mock dipasang di level
 * Animator.prototype — bukan Element.animate. Bentuk AnimRecord dipertahankan
 * agar tes perilaku tidak berubah: kapan animasi dimulai, keyframes/opsinya,
 * dan apakah dibatalkan (deteksi kebocoran).
 */

import { Animator, type AnimLayer } from "../src/animator.js";

export interface AnimRecord {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  /** Date.now() (jam palsu) saat start() dipanggil. */
  startStamp: number;
  cancelled: boolean;
  finished: boolean;
  paused: boolean;
  playbackRate: number;
  /** Lapisan animasi ("A"|"B"|"C") — untuk stopLayer berlapis. */
  layer: AnimLayer;
  /** Live dari animasi (getter), bukan salinan. */
  readonly currentTime: number | null;
  /** Id logis dari Animator (via __animId), bila ada. */
  readonly animId: string | undefined;
}

/** Animasi palsu: tidak benar-benar menganimasikan, hanya mencatat status. */
class FakeAnimation {
  currentTime: number | null = 0;
  playbackRate = 1;
  playState: AnimationPlayState = "running";
  onfinish: ((this: Animation, ev: AnimationPlaybackEvent) => unknown) | null = null;
  oncancel: ((this: Animation, ev: AnimationPlaybackEvent) => unknown) | null = null;
  onremove: ((this: Animation, ev: AnimationPlaybackEvent) => unknown) | null = null;
  __animId?: string;
  #record: AnimRecord;
  constructor(record: AnimRecord) {
    this.#record = record;
  }
  cancel(): void {
    this.#record.cancelled = true;
    this.playState = "idle";
    this.currentTime = null;
  }
  finish(): void {
    this.#record.finished = true;
    this.playState = "finished";
    if (this.onfinish) this.onfinish.call(this as unknown as Animation, {} as AnimationPlaybackEvent);
  }
  pause(): void {
    this.#record.paused = true;
    this.playState = "paused";
  }
  play(): void {
    this.#record.paused = false;
    this.playState = "running";
  }
  reverse(): void {}
  persist(): void {}
  commitStyles(): void {}
}

export const animRecords: AnimRecord[] = [];

let installed = false;
let rafTime = 0;
let rafNextId = 1;
const rafPendingMap = new Map<number, FrameRequestCallback>();

/**
 * Pasang ulang rAF terkontrol. WAJIB dipanggil setelah vi.useFakeTimers()
 * karena fake timers menimpa requestAnimationFrame dengan versi sinon.
 */
export function reinstallRaf(): void {
  rafTime = 0;
  rafNextId = 1;
  rafPendingMap.clear();
  const g = globalThis as unknown as {
    requestAnimationFrame: (cb: FrameRequestCallback) => number;
    cancelAnimationFrame: (id: number) => void;
    __rafStep: (ms: number) => void;
    __rafPending: () => number;
  };
  g.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const id = rafNextId++;
    rafPendingMap.set(id, cb);
    return id;
  };
  g.cancelAnimationFrame = (id: number): void => {
    rafPendingMap.delete(id);
  };
  g.__rafStep = (ms: number): void => {
    rafTime += ms;
    const cbs = [...rafPendingMap.values()];
    rafPendingMap.clear();
    for (const cb of cbs) cb(rafTime);
  };
  g.__rafPending = (): number => rafPendingMap.size;
}

export function installDomFakes(): void {
  if (installed) return;
  installed = true;

  // Patch Animator.prototype.start: catat, kembalikan FakeAnimation (tanpa GSAP sungguhan).
  const proto = Animator.prototype as unknown as {
    start(el: Element, id: string, layer: AnimLayer, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation;
    stop(el: Element, id: string): void;
    stopLayer(layer?: AnimLayer): void;
    pauseAll(): void;
    resumeAll(): void;
    setRate(rate: number): void;
    seekAll(ms: number): void;
    finish(el: Element, id: string): void;
  };

  const origStart = proto.start;
  const origStop = proto.stop;
  const origStopLayer = proto.stopLayer;
  void origStart;
  void origStop;
  void origStopLayer;

  // Simpan referensi record per (el, id) untuk penandaan cancelled.
  const live = new Map<Element, Map<string, AnimRecord>>();

  function syncDataAnim(el: Element): void {
    const per = live.get(el);
    if (!per || per.size === 0) el.removeAttribute("data-anim");
    else el.setAttribute("data-anim", [...per.keys()].join(" "));
  }

  proto.start = function (
    this: Animator,
    el: Element,
    id: string,
    layer: AnimLayer,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ): Animation {
    // Batalkan yang lama dulu (seperti Animator asli): tandai cancelled.
    const perEl = live.get(el);
    const prev = perEl?.get(id);
    if (prev) {
      prev.cancelled = true;
      perEl?.delete(id);
    }

    let anim!: FakeAnimation;
    const record: AnimRecord = {
      el,
      keyframes,
      options,
      startStamp: Date.now(),
      cancelled: false,
      finished: false,
      paused: false,
      playbackRate: 1,
      layer,
      get currentTime(): number | null {
        const seek = (record as unknown as { __seekTime?: number }).__seekTime;
        if (seek !== undefined) return seek;
        return anim?.currentTime ?? null;
      },
      get animId(): string | undefined {
        return anim?.__animId;
      },
    };
    anim = new FakeAnimation(record);
    anim.__animId = id;
    animRecords.push(record);

    let per = live.get(el);
    if (!per) {
      per = new Map();
      live.set(el, per);
    }
    per.set(id, record);
    syncDataAnim(el);

    return anim as unknown as Animation;
  };

  proto.stop = function (this: Animator, el: Element, id: string): void {
    const rec = live.get(el)?.get(id);
    if (rec) {
      rec.cancelled = true;
      live.get(el)?.delete(id);
      syncDataAnim(el);
    }
  };

  proto.stopLayer = function (this: Animator, layer?: AnimLayer): void {
    for (const [el, per] of [...live]) {
      for (const [id, rec] of [...per]) {
        if (layer === undefined || rec.layer === layer) {
          rec.cancelled = true;
          per.delete(id);
        }
      }
      if (per.size === 0) live.delete(el);
      syncDataAnim(el);
    }
  };

  proto.pauseAll = function (this: Animator): void {
    for (const per of live.values()) {
      for (const rec of per.values()) {
        if (!rec.cancelled) rec.paused = true;
      }
    }
  };

  proto.resumeAll = function (this: Animator): void {
    for (const per of live.values()) {
      for (const rec of per.values()) {
        if (!rec.cancelled) rec.paused = false;
      }
    }
  };

  proto.setRate = function (this: Animator, rate: number): void {
    for (const per of live.values()) {
      for (const rec of per.values()) {
        if (!rec.cancelled) rec.playbackRate = rate;
      }
    }
  };

  proto.seekAll = function (this: Animator, ms: number): void {
    // Model sederhana: tandai paused; currentTime dihitung dari durasi.
    for (const per of live.values()) {
      for (const rec of per.values()) {
        if (rec.cancelled) continue;
        const dur = typeof rec.options.duration === "number" ? rec.options.duration : 0;
        const infinite = rec.options.iterations === Infinity;
        const target = dur === 0 ? ms : infinite ? ms % dur : Math.min(ms, dur);
        // Simpan sebagai currentTime via closure — gunakan properti ekspansi.
        (rec as unknown as { __seekTime: number }).__seekTime = target;
        rec.paused = true;
      }
    }
  };

  proto.finish = function (this: Animator, el: Element, id: string): void {
    const rec = live.get(el)?.get(id);
    if (rec) {
      rec.finished = true;
      rec.cancelled = true;
      live.get(el)?.delete(id);
      syncDataAnim(el);
    }
  };

  reinstallRaf();
}

/** Majukan jam rAF terkontrol (satu frame per panggilan berantai). */
export function stepRaf(frames: number, msPerFrame = 16): void {
  const g = globalThis as unknown as { __rafStep: (ms: number) => void };
  for (let i = 0; i < frames; i++) g.__rafStep(msPerFrame);
}

export function rafPending(): number {
  return (globalThis as unknown as { __rafPending: () => number }).__rafPending();
}

export function resetAnimRecords(): void {
  animRecords.length = 0;
}

/** Catatan start() untuk elemen + id logis tertentu (id opsional). */
export function recordsFor(el: Element, animId?: string): AnimRecord[] {
  return animRecords.filter((r) => r.el === el && (animId === undefined || r.animId === animId));
}

/** Catatan start() di seluruh dokumen untuk id logis tertentu. */
export function recordsWithId(animId: string): AnimRecord[] {
  return animRecords.filter((r) => r.animId === animId);
}
