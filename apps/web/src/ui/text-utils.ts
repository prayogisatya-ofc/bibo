/** Hilangkan blok <speak> dari teks tampilan (isi dipakai TTS di M4). */
export function stripSpeak(text: string): string {
  return text
    .replace(/<speak>[\s\S]*?<\/speak>/gi, "")
    .replace(/<\/?speak>/gi, "")
    .replace(/ {2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Potong detail feed maksimal 2 KB (PRD §11.2). */
export function truncate2k(s: string): string {
  if (s.length <= 2048) return s;
  return `${s.slice(0, 2044)}…`;
}
