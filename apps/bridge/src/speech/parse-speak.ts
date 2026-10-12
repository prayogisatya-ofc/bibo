/**
 * Ekstrak blok <speak>…</speak> untuk ringkasan lisan (PRD §9.5).
 * - Teks tampilan TIDAK PERNAH memuat tag speak.
 * - Tahan terhadap streaming: blok tak lengkap di akhir buffer dianggap
 *   belum selesai dan disembunyikan dari tampilan sampai tutupnya tiba.
 * - Saat giliran selesai dengan blok tak tertutup, sisanya dianggap isi speak.
 */

const OPEN = /<speak>/i;
const CLOSE = /<\/speak>/i;

export interface SpeakParts {
  display: string;
  speak: string[];
}

/** Pisahkan blok speak LENGKAP dari teks (satu-shot, untuk teks final). */
export function splitSpeak(text: string): SpeakParts {
  const speak: string[] = [];
  let display = "";
  let rest = text;
  for (;;) {
    const o = rest.search(OPEN);
    if (o < 0) {
      display += rest;
      break;
    }
    const afterOpen = rest.slice(o).replace(OPEN, "");
    const c = afterOpen.search(CLOSE);
    if (c < 0) {
      // Tak ada tutup: sisa dianggap speak (kasus final tak lengkap).
      display += rest.slice(0, o);
      speak.push(afterOpen.trim());
      rest = "";
      break;
    }
    display += rest.slice(0, o);
    speak.push(afterOpen.slice(0, c).trim());
    rest = afterOpen.slice(c).replace(CLOSE, "");
  }
  return { display: display.trim(), speak: speak.filter((s) => s.length > 0) };
}

/**
 * Pelacak streaming per messageID: merakit buffer mentah, menerbitkan
 * HANYA pertambahan teks tampilan yang aman (blok speak lengkap dibuang,
 * buka-tanpa-tutup disembunyikan).
 */
export class SpeakTracker {
  private raw = new Map<string, string>();
  private shown = new Map<string, string>();

  /** Kembalikan pertambahan display untuk delta ini ("" bila belum aman). */
  push(messageID: string, delta: string): string {
    const buf = `${this.raw.get(messageID) ?? ""}${delta}`;
    this.raw.set(messageID, buf);
    const safe = safeDisplay(buf);
    const prev = this.shown.get(messageID) ?? "";
    if (safe.length <= prev.length) return "";
    const add = safe.slice(prev.length);
    this.shown.set(messageID, safe);
    return add;
  }

  /** Finalisasi: teks tampilan penuh + daftar speak. */
  done(messageID: string): { display: string; speak: string[] } {
    const buf = this.raw.get(messageID) ?? "";
    this.raw.delete(messageID);
    this.shown.delete(messageID);
    return splitSpeak(buf);
  }

  reset(messageID?: string): void {
    if (messageID) {
      this.raw.delete(messageID);
      this.shown.delete(messageID);
    } else {
      this.raw.clear();
      this.shown.clear();
    }
  }
}

/** Tampilan aman dari buffer mentah: buang blok lengkap + ekor tak lengkap. */
export function safeDisplay(buf: string): string {
  let out = "";
  let rest = buf;
  for (;;) {
    const o = rest.search(OPEN);
    if (o < 0) {
      out += rest;
      break;
    }
    const afterOpen = rest.slice(o).replace(OPEN, "");
    const c = afterOpen.search(CLOSE);
    if (c < 0) {
      // Blok belum lengkap: sembunyikan dari tampilan.
      out += rest.slice(0, o);
      break;
    }
    out += rest.slice(0, o);
    rest = afterOpen.slice(c).replace(CLOSE, "");
  }
  return out;
}
