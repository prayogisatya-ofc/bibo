/**
 * Mulut parametris m-open (CHARACTER.md §6.7).
 * Dihitung per frame dari level terhaluskan a = lerp(a, level, 0.35).
 */

export interface MouthParams {
  /** Setengah-lebar elips mulut. */
  rx: number;
  /** Setengah-tinggi elips mulut. */
  ry: number;
  /** Pusat vertikal elips mulut. */
  cy: number;
  /** Geometri lidah; null bila a <= 0.4 (lidah disembunyikan). */
  tongue: { cx: number; cy: number; rx: number; ry: number } | null;
  /** true bila mulut dianggap tertutup -> gambar m-smile, bukan elips. */
  closed: boolean;
}

/** Nilai a terhaluskan dari level mentah (dipanggil per frame). */
export function smoothLevel(prev: number, level: number, lerp = 0.35): number {
  return prev + (level - prev) * lerp;
}

/** Rumus mulut parametris §6.7. */
export function mouthParams(a: number): MouthParams {
  const closed = a < 0.08;
  const rx = 3 + 3.5 * a;
  const ry = 1.5 + 6.5 * a;
  // Koordinat LOKAL (elips di dalam #mouth yang di-translate(100,120)).
  // CHARACTER.md §6.7 memakai absolut: cy = 120 + ry·0.6 → lokal: ry·0.6.
  const cy = ry * 0.6;
  const tongue =
    a > 0.4
      ? { cx: 0, cy: ry * 1.3, rx: rx * 0.6, ry: ry * 0.4 }
      : null;
  return { rx, ry, cy, tongue, closed };
}
