/**
 * PRNG ber-seed (mulberry32) untuk IdleDirector & jitter animasi.
 * Seed tetap saat tes agar jadwal acak deterministik (CHARACTER.md §5.3.4).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Acak periode T sejauh +/-jitter (mis. 0.15 = +/-15%). */
export function jittered(rand: () => number, baseMs: number, jitter: number): number {
  return baseMs * (1 + (rand() * 2 - 1) * jitter);
}

/** Pilih indeks tertimbang dari bobot. */
export function weightedPick(rand: () => number, weights: readonly number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
