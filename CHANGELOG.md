# Changelog

## v0.1.0 (2026-10-12) — MVP

- Chat teks + suara (STT/TTS browser, id-ID) melawan OpenCode v2 nyata.
- Avatar robot Bibo (14 pose + voice-pulse) + orkestrasi XState.
- Izin & form: klasifikasi risiko fail-safe, guard suara-high, kartu persetujuan,
  pengingat 60 detik, tanpa auto-approve.
- i18n id/en, tema gelap/terang/otomatis, mini mode, ganti sesi, ukuran avatar.
- Ketahanan: reconnect + rekonsiliasi, polling jaring pengaman, banner offline,
  degradasi rapi saat server mati.
- Keamanan: bridge 127.0.0.1 + token + cek Origin, allowlist endpoint, log tanpa
  rahasia, tanpa telemetri/audio tersimpan. Audit: `docs/security-audit-m7.md`.

### Ditunda ke v0.2 (P1/P2, lihat laporan M7)

- FR-025 diff per file (butuh sumber konten diff).
- FR-026 revert via suara+klik.
- FR-035 mini mode: HADIR (dasar). FR-054 kamus: HADIR.
- STT Whisper lokal, TTS natural + audio-reaktif, wake word, overlay Tauri,
  PWA remote, adapter Rive/Live2D/VRM, plugin OpenCode pendamping.
