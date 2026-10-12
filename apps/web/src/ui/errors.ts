/** Pesan error manusiawi (FR-044): tanpa stack trace. */
const EN: Record<string, string> = {
  NO_SESSION: "Please pick a project folder first.",
  OPENCODE_DOWN: "I lost contact with OpenCode. Please check the server.",
  ALWAYS_REQUIRES_UI: "Always-allow is only available from the on-screen approval.",
  UNKNOWN_REQUEST: "That permission request has expired.",
  FORM_SETTLED: "That form was already answered or cancelled.",
  VOICE_NOT_ALLOWED: "High-risk actions must be confirmed on screen.",
  ALWAYS_NOT_ALLOWED: "Always-allow is only for low/medium risk via click.",
  DIR_NOT_FOUND: "That folder does not exist. Please check again.",
  NOT_IMPLEMENTED: "That feature is not available yet.",
};
export function humanError(code: string, message: string, locale: "id" | "en" = "id"): string {
  if (locale === "en") return EN[code] ?? `Oops, something failed${message ? `: ${message}` : "."} Want me to try again?`;
  switch (code) {
    case "NO_SESSION":
      return "Pilih folder proyek dulu ya.";
    case "DIR_NOT_FOUND":
      return "Folder itu tidak ada. Coba periksa lagi ya.";
    case "OPENCODE_DOWN":
      return "Aku kehilangan kontak dengan OpenCode. Coba cek server-nya ya.";
    case "ALWAYS_REQUIRES_UI":
      return "Opsi 'selalu izinkan' hanya bisa dari layar persetujuan.";
    case "UNKNOWN_REQUEST":
      return "Izin itu sudah tidak berlaku.";
    case "BAD_MESSAGE":
    case "HANDLER_ERROR":
      return "Aduh, ada yang gagal: pesan tak dikenali. Mau kucoba lagi?";
    case "NOT_IMPLEMENTED":
      return message || "Fitur ini belum tersedia.";
    case "FORM_SETTLED":
      return "Formulir itu sudah dijawab atau dibatalkan.";
    case "VOICE_NOT_ALLOWED":
      return "Risiko tinggi harus dikonfirmasi lewat layar.";
    case "ALWAYS_NOT_ALLOWED":
      return "Selalu izinkan hanya via klik untuk risiko rendah/medium.";
    default:
      return `Aduh, ada yang gagal${message ? `: ${message}` : "."} Mau kucoba lagi?`;
  }
}
