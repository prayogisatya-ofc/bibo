# ADR-009: Kontrak `setMicLevel(level)` pada AvatarRenderer

Status: diterima (M4, 2026-10-13) · Disetujui pemilik produk bersama 3 keputusan
redesign (hapus mini mode, visual OK, kontrak mic-level).

## Konteks

CHARACTER.md §4.3 mendefinisikan pola lampu antena pose Mendengar sebagai
"denyut mengikuti level mic", tetapi §12 (kontrak `AvatarRenderer`) tidak punya
API mic-level. Selama redesign (fase B–E), deviasi terdokumentasi dipakai:
`setSpeechLevel` merangkap sebagai driver mic-level saat pose `listening`
(lampu mengikuti, bukan overlay bicara) — lihat REPORT.md §4 butir 4.

Deviasi itu mengotori semantik kontrak baru: `setSpeechLevel` harus selalu berarti
"overlay Berbicara (mulut parametris + busur suara + lampu 2 Hz)" sesuai
AGENT-PROMPT-AVATAR-UI.md ("M4–M7 memakai kontrak baru").

## Keputusan

Tambah `setMicLevel(level: number): void` pada `AvatarRenderer`
(`packages/avatar/src/types.ts`):

- `level` 0..1 (di-clamp); menggerakkan denyut lampu antena **hanya** saat pose
  Mendengar (`scale` 1+0,25·lv, opasitas 0,7+0,3·lv pada `#bulb`).
- Di luar pose Mendengar, nilai disimpan tanpa efek visual (pola lampu pose
  yang sedang aktif tetap menang).
- Deviasi lama dihapus: `setSpeechLevel` tidak lagi punya cabang khusus
  listening; di pose listening ia berperilaku normal (overlay bicara).

## Konsekuensi

- `packages/avatar/src/renderer.ts`: implementasi `setMicLevel` + hapus cabang
  listening dari `setSpeechLevel`; `resetTransientStyles()` sudah membersihkan
  gaya inline bulb saat ganti pose (tidak ada kebocoran gaya).
- `packages/avatar/test/renderer.test.ts`: tes deviasi lama diganti 4 tes
  `setMicLevel` (lampu mengikuti, clamp 0..1, tak berefek di luar listening,
  `setSpeechLevel` di listening kini overlay normal).
- Galeri `/dev/avatar` (`apps/web/src/ui/DevAvatar.tsx`): slider `micLevel`
  baru (`data-testid="mic-slider"`, param `?mic=`) di samping slider speechLevel.
- CHARACTER.md §12 diperbarui (kontrak + catatan revisi yang disetujui).
- Aplikasi utama belum memanggil `setMicLevel` dengan data nyata: Web Speech API
  tidak menyediakan metering mic (sudah didokumentasikan di REPORT.md §4.9);
  denyut tombol mic mengikuti status `listening` via animasi CSS. Bila engine
  STT v0.2 (Whisper/MediaRecorder) memberi level nyata, App dapat meneruskannya
  ke `rendererRef.current?.setMicLevel` tanpa perubahan kontrak.

## Alternatif yang ditolak

- Mempertahankan deviasi `setSpeechLevel`-ganda: ditolak — melanggar kejelasan
  kontrak baru dan membingungkan pemanggil (TTS vs mic).
- Menghitung level mic sintetis di App (denyut palsu): ditolak — data palsu
  lebih buruk daripada tidak ada data; status listening yang jujur sudah cukup.
