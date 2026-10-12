# Changelog

## v0.1.0 (2026-10-13) — MVP

- Chat teks + suara (STT/TTS browser, id-ID) melawan OpenCode v2 nyata.
- Avatar robot Bibo baru (9 pose + 6 varian working + overlay bicara mulut
  parametris; kontrak `AvatarRenderer` CHARACTER.md §12 + `setMicLevel`,
  ADR-009) + orkestrasi XState. Dua mode tampilan: Chat | Ngobrol
  (FR-035 mini mode DIHAPUS permanen, keputusan owner 2026-10-13).
- Izin & form: klasifikasi risiko fail-safe (49 kasus), guard suara-high
  (`VOICE_NOT_ALLOWED`), kartu persetujuan, pengingat 60 detik, tanpa
  auto-approve. Ringkasan lisan ≤2 kalimat (tag `<speak>` → generate →
  heuristik); verbosity Senyap/Normal/Cerewet.
- i18n id/en, tema terang/gelap/otomatis, ganti sesi.
- Ketahanan: reconnect + rekonsiliasi, polling jaring pengaman, banner offline,
  degradasi rapi saat server mati.
- Keamanan: bridge 127.0.0.1 + token + cek Origin, allowlist endpoint, log tanpa
  rahasia, tanpa telemetri/audio tersimpan. Audit: `docs/security-audit-m7.md`.

### Ditunda ke v0.2 (P1/P2, lihat laporan M7)

- FR-025 diff per file (butuh sumber konten diff).
- FR-026 revert via suara+klik.
- FR-035 mini mode: DIHAPUS permanen (keputusan owner 2026-10-13). FR-054 kamus: HADIR.
- STT Whisper lokal, TTS natural + audio-reaktif, wake word, overlay Tauri,
  PWA remote, adapter Rive/Live2D/VRM, plugin OpenCode pendamping.
