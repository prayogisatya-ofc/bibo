/**
 * Test-helper: WAAPI palsu yang mencatat semua animate() + rAF terkontrol.
 *
 * jsdom tidak mengimplementasikan Element.animate maupun requestAnimationFrame,
 * jadi kedua API dipalsukan di sini agar koreografi bisa diverifikasi dengan
 * jam palsu (vi.useFakeTimers): kapan animasi dimulai, keyframes/opsinya,
 * dan apakah dibatalkan (deteksi kebocoran).
 */

export interface AnimRecord {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  /** Date.now() (jam palsu) saat animate() dipanggil. */
  startStamp: number;
  cancelled: boolean;
  finished: boolean;
  paused: boolean;
  playbackRate: number;
  /** Live dari animasi (getter), bukan salinan. */
  readonly currentTime: number | null;
  /** Id logis dari Animator (via __animId), bila ada. */
  readonly animId: string | undefined;
}

class FakeAnimation {
  currentTime: number | null = 0;
  playbackRate = 1;
  playState: AnimationPlayState = "running";
  onfinish: ((this: Animation, ev: AnimationPlaybackEvent) => unknown) | null = null;
  oncancel: ((this: Animation, ev: AnimationPlaybackEvent) => unknown) | null = null;
  startTime: number | null = 0;
  readonly effect: {
    getTiming: () => { duration: unknown; iterations: unknown };
  };
  #record: AnimRecord;
  constructor(record: AnimRecord) {
    this.#record = record;
    const options = record.options;
    this.effect = {
      getTiming: () => ({
        duration: options.duration ?? 0,
        iterations: options.iterations ?? 1,
      }),
    };
  }
  cancel(): void {
    this.#record.cancelled = true;
    this.playState = "idle";
    this.currentTime = null;
  }
  finish(): void {
    this.#record.finished = true;
    this.playState = "finished";
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
  const proto = Element.prototype as unknown as {
    animate: (keyframes: unknown, options?: unknown) => Animation;
  };
  proto.animate = function (this: Element, keyframes: unknown, options?: unknown): Animation {
    const kf = (Array.isArray(keyframes) ? keyframes : []) as Keyframe[];
    const opts = (
      typeof options === "number" ? { duration: options } : ((options ?? {}) as object)
    ) as KeyframeAnimationOptions;
    let anim!: FakeAnimation;
    const record: AnimRecord = {
      el: this,
      keyframes: kf,
      options: opts,
      startStamp: Date.now(),
      cancelled: false,
      finished: false,
      paused: false,
      playbackRate: 1,
      get currentTime(): number | null {
        return (anim as unknown as { currentTime?: number | null } | undefined)?.currentTime ?? null;
      },
      get animId(): string | undefined {
        return (anim as unknown as { __animId?: string } | undefined)?.__animId;
      },
    };
    anim = new FakeAnimation(record);
    animRecords.push(record);
    return anim as unknown as Animation;
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

/** Catatan animate() untuk elemen + id logis tertentu (id opsional). */
export function recordsFor(el: Element, animId?: string): AnimRecord[] {
  return animRecords.filter((r) => r.el === el && (animId === undefined || r.animId === animId));
}

/** Catatan animate() di seluruh dokumen untuk id logis tertentu. */
export function recordsWithId(animId: string): AnimRecord[] {
  return animRecords.filter((r) => r.animId === animId);
}
