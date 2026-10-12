/**
 * Kamus koreksi istilah teknis STT (FR-054): pasca-proses penggantian kata utuh,
 * dapat diedit, tersimpan di localStorage. BUKAN dikte kode: tidak menyentuh
 * "titik/koma/baris baru".
 */

const KEY = "codepet.stt-dict";

export const DEFAULT_DICT: Record<string, string> = {
  reakt: "React",
  "view js": "Vue JS",
  "vi js": "Vue JS",
  "next js": "Next.js",
  "node js": "Node.js",
  "taypskrip": "TypeScript",
  "typescript": "TypeScript",
  "javascrip": "JavaScript",
  "paihton": "Python",
  "githab": "GitHub",
  "gethab": "GitHub",
  "open kod": "OpenCode",
  "pun kode": "OpenCode",
};

export function loadDict(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
    return { ...DEFAULT_DICT, ...raw };
  } catch {
    return { ...DEFAULT_DICT };
  }
}

export function saveDict(d: Record<string, string>): void {
  try {
    const custom: Record<string, string> = {};
    for (const [k, v] of Object.entries(d)) {
      if (DEFAULT_DICT[k] !== v) custom[k] = v;
    }
    localStorage.setItem(KEY, JSON.stringify(custom));
  } catch {
    // abaikan
  }
}

/** Terapkan kamus per kata utuh (case-insensitive), preserving kapital awal. */
export function applyDict(text: string, dict: Record<string, string>): string {
  const keys = Object.keys(dict)
    .filter((k) => k.trim().length > 0)
    .sort((a, b) => b.length - a.length);
  if (keys.length === 0) return text;
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(^|[\\s"“”‘’'([{])(${escaped.join("|")})(?=[\\s"“”‘’'\\]})?.,!?:;…]|$)`, "gi");
  return text.replace(re, (m, pre: string, word: string) => {
    const fix = dict[word.toLowerCase()] ?? dict[word] ?? word;
    return `${pre}${fix}`;
  });
}
