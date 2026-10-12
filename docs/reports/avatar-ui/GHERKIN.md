# Pemetaan Skenario Gherkin PRD §13.3 → Tes Otomatis (fase E)

Semua skenario §13.3 yang menyentuh avatar tetap lolos. Istilah lama
"voice-pulse badan" kini = overlay Berbicara (mulut parametris + busur
suara + lampu 2 Hz, CHARACTER.md §6.7); pose memakai kontrak baru
(`idle|thinking|working|asking|…` + varian, tanpa string bertitik).

| Skenario Gherkin (§13.3) | Tes otomatis | Status |
|---|---|---|
| Perintah suara sukses (listening→thinking→working.editing→celebrate→idle, ringkasan ≤2 kalimat, kartu Perubahan) | e2e `voice-success` + `simple-answer` + `speak` (ringkasan ≤2 kalimat) | ✅ lolos |
| Izin risiko medium via suara ("ya" → reply once, kembali working) | e2e `safety-medium` | ✅ lolos |
| Izin risiko tinggi tidak bisa via suara (tidak ada reply; konfirmasi lewat layar; Izinkan-sekali butuh ketik OK) | e2e `safety-high` + unit `cards.test.tsx` (high: tanpa always, ketik OK) | ✅ lolos |
| Barge-in (TTS berhenti ≤100 ms, animasi bicara berhenti) | e2e `voice-bargein` (cancel TTS; overlay bicara berhenti — unit `mouth.test.ts`/`renderer.test.ts` untuk mulut ≤100 ms) | ✅ lolos |
| Stop ("berhenti" → session.interrupt, avatar idle ≤500 ms) | e2e `voice-stop` | ✅ lolos |
| Event stream putus (tanpa idle palsu, rekonsiliasi tanpa duplikat) | e2e `pose-drop` | ✅ lolos |
| OpenCode mati (≤3 dtk avatar offline, input mati + pesan jelas) | e2e `offline` (chat.spec.ts) + unit `machine.test.ts` | ✅ lolos |
| Event diam / silent-events (polling tetap deteksi aktif + izin pending) | e2e `pose-silent` + unit `machine.test.ts` (asking selama awaiting) | ✅ lolos |
| STT tidak tersedia (chat teks jalan, banner "Mic tidak tersedia") | e2e `voice-nomic` | ✅ lolos |

Catatan verifikasi fase E:
- Caption/teks pose di E2E diperbarui ke kontrak baru ("Bibo siap",
  "Bibo sedang bertanya", "Bibo selesai!") — `avatar-flow.spec.ts`,
  `voice.spec.ts`.
- Tes mini mode dihapus (fitur dihapus, keputusan ADR d); diganti
  `mode-switch`, `talk-permission`, `talk-high`, `esc-minimize` di
  `m7.spec.ts`.
- Galeri pose E2E memakai API baru `?dev=avatar&pose=&theme=` (9 pose,
  bukan 14 string bertitik) — `avatar.spec.ts`.
