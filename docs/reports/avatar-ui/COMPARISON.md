# Perbandingan Visual — Avatar + UI (fase E)

Tanggal: 2026-10-12 · viewport 1280x800 · pixelmatch threshold 0.1
Angka selisih bersifat informatif (teks dinamis), bukan syarat lolos.

| Adegan | Referensi | Aplikasi | Piksel beda | % | Side-by-side |
|---|---|---|---|---|---|
| a-chat-working | ui-mode-chat.png | scene-a-chat-working.png | 45931 | 4.49% | side-by-side-a-chat-working.png |
| b-talk-speaking | ui-mode-ngobrol-bicara.png | scene-b-talk-speaking.png | 45310 | 4.42% | side-by-side-b-talk-speaking.png |
| c-talk-permission | ui-mode-ngobrol-izin.png | scene-c-talk-permission.png | 67426 | 6.58% | side-by-side-c-talk-permission.png |

## Catatan
- (a) working di Mode Chat: ditangkap saat chip aktivitas tampil.
- (b) ringkasan diucapkan di Mode Ngobrol: bubble ucapan saat TTS (stub) berbicara.
- (c) izin medium di Mode Ngobrol: popup di bawah Bibo + petunjuk suara.
## Analisis selisih (manual)

- **(a) chat-working (4,49%)**: selisih terutama dari teks dinamis (nama folder
  `/tmp/vis-a`, isi chat, chip "Bekerja…"), posisi avatar (animasi float),
  dan status koneksi "mock". Tata letak (TopBar 68px, kartu kiri 360px,
  panel chat kanan) setara referensi.
- **(b) talk-speaking (4,42%)**: bubble "SPIKE-OK" (teks mock) + chip
  "Bibo sedang berbicara" dengan ekualiser tampil. Referensi memakai teks
  Indonesia; posisi bubble (kanan atas kepala) dan hierarki setara.
- **(c) talk-permission (6,58%)**: popup di bawah Bibo + panah + kotak
  perintah gelap + tombol Tolak/Izinkan sekali + petunjuk suara — semua
  setara referensi. Perbedaan: badge "Risiko rendah" (bukan "sedang")
  karena `risk.ts` mengklasifikasi `echo …` (fixture mock) sebagai low —
  `risk.ts` tidak boleh diubah (aturan keras). Bubble pertanyaan izin tidak
  tertangkap (sudah memudar 1,5 dtk setelah ucapan selesai).
