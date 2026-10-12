/**
 * Animator — lapisan tipis di atas Web Animations API.
 *
 * - Setiap animasi punya id logis per elemen ("float-y", "blink", ...).
 * - start() dengan id yang sama membatalkan animasi lama dulu.
 * - data-anim="<nama>" dijaga sinkron di tiap elemen (kontrak §12).
 * - pauseAll/resumeAll untuk pause(); seekAll untuk mode beku galeri dev;
 *   setRate untuk slow-mo galeri dev.
 */

export type AnimLayer = "A" | "B" | "C";

interface Tracked {
  id: string;
  layer: AnimLayer;
  anim: Animation;
  infinite: boolean;
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
    const anyEl = el as Element & { animate?: Element["animate"] };
    let anim: Animation;
    try {
      anim =
        typeof anyEl.animate === "function" ? anyEl.animate(keyframes, options) : noopAnimation();
    } catch {
      // Keyframes/options invalid di browser ini: jangan jatuhkan aplikasi.
      anim = noopAnimation();
    }
    anim.playbackRate = this.rate;
    // Tag untuk test-helper (hanya dibaca di test, tidak dipakai produksi).
    (anim as unknown as { __animId?: string }).__animId = id;
    if (this.paused) anim.pause();
    let per = this.tracked.get(el);
    if (!per) {
      per = new Map();
      this.tracked.set(el, per);
    }
    per.set(id, { id, layer, anim, infinite: options.iterations === Infinity });
    this.syncDataAnim(el);
    return anim;
  }

  stop(el: Element, id: string): void {
    const per = this.tracked.get(el);
    const t = per?.get(id);
    if (!t) return;
    try {
      t.anim.cancel();
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
            t.anim.cancel();
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
      t.anim.finish();
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
          t.anim.pause();
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
          t.anim.play();
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
          t.anim.playbackRate = rate;
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
    for (const per of this.tracked.values()) {
      for (const t of per.values()) {
        try {
          const dur = this.effectDuration(t.anim);
          const target = dur === null || dur === 0 ? ms : t.infinite ? ms % dur : Math.min(ms, dur);
          t.anim.currentTime = target;
          t.anim.pause();
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

  private effectDuration(anim: Animation): number | null {
    const effect = anim.effect as unknown as {
      getTiming?: () => { duration?: number | string; iterations?: number | string };
    } | null;
    const timing = effect?.getTiming?.();
    const d = timing?.duration;
    if (typeof d === "number") return d;
    return null;
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
