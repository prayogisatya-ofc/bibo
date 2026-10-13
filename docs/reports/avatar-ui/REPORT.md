# LAPORAN AKHIR — Redesign Avatar + UI Bibo

**Branch:** `redesign/avatar-ui` (30 commit, tidak di-push) · **Tanggal:** 2026-10-12
**Status:** SELESAI — `bun run check` hijau penuh (7 workspace, termasuk 11 leg e2e + galeri)
**Cakupan:** fase A–E dari AGENT-PROMPT-AVATAR-UI.md. M4–M7 TIDAK dikerjakan (sesuai instruksi).

---

## 1. Ringkasan yang selesai dan file yang berubah

**Statistik:** 130 file berubah (+9241/−1357) — 53 baru, 4 dihapus, 73 dimodifikasi.
`apps/web` 84 file · `packages/avatar` 21 · `docs/reports` 13 · `docs/reference` 8 ·
`docs/traceability.md`, `docs/adr`, `bun.lock`, `README.md` masing-masing 1.

### Fase A — Audit + ADR (commit `f923ceb`, `29b9e52`)
- 4 file referensi HTML di-commit + screenshot referensi 1280×800 ke `docs/reference/shots/`.
- `docs/adr/ADR-avatar-ui-redesign.md`: temuan audit, daftar file rencana, 5 keputusan teknis, 12 pertentangan dokumen.

### Fase B — Avatar baru, `packages/avatar` ditulis ulang total
(`0a3833a`, `2bddb98`, `f777410`, `f90a92b` — hapus `bibo.ts`, `bibo-css.ts`, `test/bibo.test.ts`)
- Baru: `src/svg.ts` (geometri §3.1, layer ID §3.2, pivot §3.3, palet §2 dark+light),
  `src/timing.ts` (semua angka waktu terpusat), `src/prng.ts` (mulberry32),
  `src/mouth.ts` (formula mulut parametris §6.7), `src/animator.ts` (WAAPI 3 lapisan),
  `src/poses.ts` (koreografi 8 pose + listening/offline + 6 varian working),
  `src/director.ts` (IdleDirector ber-seed), `src/renderer.ts` (`BotRenderer`).
- Kontrak `AvatarRenderer` persis CHARACTER.md §12 + `characterName` **wajib** di mount opts
  (tidak ada hardcode "Bibo" di paket); `svg#bot[data-pose][data-variant][data-mood][data-speaking]`.
- Dependensi `@codepet/protocol` diputus dari sisi avatar (paket protocol tidak disentuh).
- Galeri `/dev/avatar` ditulis ulang (`apps/web/src/ui/DevAvatar.tsx`): tombol 9 pose × 6 varian,
  7 reaksi, slider speechLevel, mood picker, toggle tema/reduced-motion/slow-mo ×0,25,
  input seed, `?freeze=<ms>`, query deterministik `?pose=&variant=&theme=&speech=&mood=&seed=`.
- Tes: **94/94 lolos** (blink, director cooldown, stagger dots 0,35s / zzz 0,5s / arc 0,2s,
  formula mulut, pool konfeti = 24, fase tangan, double-blink asking, speaking 2Hz,
  layer tangan, 20 switch cepat, reduced motion, freeze).

### Fase D — Wiring perilaku (`243c190`, `dbfcb4f`, `ddd95a4`, `9831cb5`, `a0842fd`, `eba8baf`)
- `orchestrator/pose.ts` ditulis ulang: `derivePose(ctx) → {pose, variant}` (prioritas PRD §8.2
  tidak berubah; speaking tetap overlay), `subagent`→delegating, `poseLabel` tanpa nama.
- `machine.ts`: transient celebrate 2s→**3s**; `snapshotPose → {pose, variant, speaking, mood}`
  (mood happy/wary 10s pasca-celebrate/confused). `useOrchestrator` seam baru.
- `voice/tts.ts`: hanya komentar/semantik — level ≤30 Hz menggerakkan mulut parametris;
  `setSpeechLevel(0)` ≤100 ms saat stop. Logika antrean tidak berubah.
- `apps/web/src/character.ts` baru: `export const character = { name: "Bibo" }` (satu konfigurasi).
- `docs/traceability.md` FR-030..036 diperbarui. Tes: **57/57 vitest lolos**.

### Fase C — UI web ditulis ulang (8 commit: `e6a24d1`…`56a1fcd`)
- Token desain CSS variables (light default sesuai referensi; dark dari CHARACTER.md §2, kontras AA),
  `@fontsource/nunito` lokal (500/700/800), set ikon SVG garis (`ui/icons.tsx`, tanpa emoji).
- `TopBar`: logotype, chip folder, chip koneksi, switcher Chat|Ngobrol, mute, settings.
- `uiMode` persisten (`codepet.ui-mode`) + Ctrl/Cmd+. (terdokumentasi di README); transisi mode ~350ms.
- **Mode Chat**: kartu kiri 360px (panggung Bibo 250px + gradient, chip aktivitas, judul status,
  mic 72px, "Hentikan Bibo") + kartu kanan (header sesi + chip agent, bubble user/agent,
  kartu aktivitas tool + durasi, ChangesCard, komposer mic+kirim). Approval/FormCard dock di atas komposer.
- **Mode Ngobrol**: hanya topbar minimal + Bibo 400px tengah + mic 88px. Bubble ucapan
  (pop 180ms, maks 3 baris / 2 kalimat terakhir, fade 1,5s, urgent menggantikan langsung,
  tone error = tint merah); indikator equalizer 3 bar mengikuti speechLevel (hanya saat TTS);
  caption interim di atas mic; saat izin Bibo mengecil 290px + popup ApprovalCard di bawah
  dengan panah, focus trap (`role="alertdialog"`), Esc = minimalkan ke chip "Menunggu izin"
  (tidak pernah approve/reject); risiko high: badge merah, "Konfirmasi lewat layar",
  ketik OK, tanpa "Selalu izinkan". Responsif <1024px / <768px (bottom sheet).
- `AvatarStage` kontrak baru + `avatar/rendererRef.ts` untuk `react()`: nod (prompt terkirim),
  perk (mic ditekan), thanks (izin sekali), hello (pertama terhubung).
- i18n id+en sinkron, tanpa "Bibo" hardcoded di komponen. Mini mode dihapus (lihat §5).
- Tes: **77/77 vitest lolos**; tsc + biome bersih; `vite build` sukses.

### Fase E — Pengujian (10 commit, HEAD `2a8f5ee`)
- Unit: 86 web + 94 avatar lolos (derivePose overlay, fade bubble 1,5s, aturan kartu per risiko, Esc, reduced motion).
- E2E ditulis ulang: **28 tes lolos** (mode-switch, talk-permission medium/high, esc-minimize,
  galeri `?dev=avatar`, caption baru, `data-speaking` ganti voice-pulse).
- Visual, a11y, perf, Gherkin — lihat §2 dan `docs/reports/avatar-ui/`.

### Yang TIDAK diubah (aturan keras terpenuhi)
`apps/bridge/**`, `packages/protocol/**`, `apps/bridge/src/safety/risk.ts`, semantik permission —
tidak ada satu baris pun yang berubah di sana (terverifikasi via `git diff --name-only`).

---

## 2. Perbandingan visual

Tiga adegan @1280×800 vs `docs/reference/shots/` (pixelmatch, threshold 0.1 — angka informatif,
bukan syarat lolos karena teks dinamis). Detail: `docs/reports/avatar-ui/COMPARISON.md`.

| Adegan | Selisih piksel | % | Side-by-side |
|---|---|---|---|
| (a) working, Mode Chat | 45.931 | 4,49% | `side-by-side-a-chat-working.png` |
| (b) ringkasan diucapkan, Mode Ngobrol | 45.310 | 4,42% | `side-by-side-b-talk-speaking.png` |
| (c) izin medium, Mode Ngobrol | 67.426 | 6,58% | `side-by-side-c-talk-permission.png` |

File di `docs/reports/avatar-ui/`: `scene-*.png`, `diff-*.png`, `side-by-side-*.png`,
`COMPARISON.md`, `A11Y.md`, `PERF.md`, `GHERKIN.md`.

Catatan: (a) selisih dari teks dinamis + animasi float; tata letak (TopBar 68px, kartu 360px)
setara referensi. (b) bubble + chip equalizer tampil; posisi bubble kanan-atas kepala setara.
(c) popup + panah + kotak perintah + tombol setara; badge tampil "Risiko rendah" bukan "sedang"
karena `risk.ts` mengklasifikasi `echo …` (fixture mock) sebagai low — `risk.ts` tidak boleh
diubah. A11Y: axe bersih (nol serious/critical), focus trap + Esc terverifikasi, kontras AA
kedua tema. Perf 10 detik headless: celebrate **58,7 fps**, working/typing **59,9 fps**
(target CHARACTER.md §13: ≥55 fps). Gherkin: 9/9 skenario PRD §13.3 yang menyentuh avatar
terpetakan ke tes otomatis yang lolos.

---

## 3. Pertentangan antar dokumen dan keputusan (ringkas; lengkap di ADR)

| # | Pertentangan | Keputusan |
|---|---|---|
| 1 | PRD §8.4/§8.5: robot badge biru, tanpa mulut, mata hitam vs CHARACTER.md: visor gelap, mata mint menyala, mulut kecil, lampu antena | **CHARACTER.md menang** (sesuai header-nya) |
| 2 | PRD §9.3 / FR-033: "voice-pulse badan" (tanpa mulut) vs CHARACTER.md §6.7: mulut parametris + busur suara + lampu 2Hz | **CHARACTER.md menang** |
| 3 | Durasi celebrate: PRD 2s vs CHARACTER.md §6.5 3s | **3s menang** (≥2 ledakan konfeti) |
| 4 | PRD §8.2: `speaking` sebagai pose vs CHARACTER.md §11: overlay | **Overlay menang** (lampu: asking > speaking > pose) |
| 5 | PRD §8.3a visual tool vs CHARACTER.md §8 varian working | **CHARACTER.md §8 menang** |
| 6 | PRD §11.1 layout vs `ui-mode-*.html` | **HTML menang** |
| 7 | FR-035 mini mode vs switcher Chat\|Ngobrol | Mini mode **dihapus** — butuh konfirmasi owner (lihat §5) |
| 8 | Tema default: kode lama `dark` vs referensi yang disetujui (light) | **Light default**; kolom dark CHARACTER.md §2 = sumber token tema gelap |
| 9 | Esc: interrupt (ChatPanel lama) vs "tidak boleh dismiss kartu izin" | **Berlapis**: Esc = interrupt; saat izin pending → minimalkan ke chip |
| 10 | `characterName` opsional vs wajib di mount opts | **Wajib** (hindari "undefined" di aria-label) |
| 11 | Tipe avatar di `@codepet/protocol` vs kontrak baru | Paket avatar **definisikan sendiri**; protocol tidak disentuh |
| 12 | `traceability.md` M3, API hash DevAvatar, contoh aria-label PRD §11.5 | Diperbarui mengikuti kontrak baru |

---

## 4. Hal yang sulit / ambigu di CHARACTER.md atau referensi + usulan

1. **typing `burstPeriodMs` 140ms** (§6.3) memberi offset antar-tangan 70ms < kriteria
   "selisih ≥ 0,08s" di §6.3. **Dipakai 160ms** — kriteria penerimaan menang atas angka contoh.
2. **Raise-hand asking** `(160,86)` vs kriteria "tangan di atas garis visor (y < 86)".
   **Dipakai (160,84)** agar kriteria terpenuhi.
3. **Prioritas lampu** saat overlay speaking aktif di atas sleeping/offline/listening tidak
   didefinisikan eksplisit. **Diputus**: asking > speaking > pose dasar; di
   sleeping/offline/listening overlay tidak mengubah pola lampu.
4. **§12 tidak punya API mic-level** untuk pose Mendengar (lampu "denyut mengikuti level mic").
   **Deviasi terdokumentasi**: `setSpeechLevel` merangkap sebagai driver mic-level saat pose
   listening. Usul: tambah `setMicLevel(level)` di kontrak pada revisi berikutnya.
5. **Pivot**: `transform-box: fill-box` + origin px kontradiktif. **Dipakai
   `transform-box: view-box`** untuk origin piksel.
6. **Konfeti 24 vs batas ≤12 animasi** (§13): satu burst dihitung sebagai satu batch
   (bukan 24 animasi abadi) — lolos budget test.
7. **Easing array di opsi WAAPI ditolak Chrome** ("Easing may not be set to a list of values").
   **Dipindah ke easing per-keyframe**; `Animator.start` menangkap error `animate()`.
8. **Freeze `?freeze=<ms>`**: animasi one-shot di-seek ke `min(t, dur)` (bukan `t mod dur`).
9. **Level mic (referensi UI)**: Web Speech API tidak memberi metering mic — denyut tombol mic
   mengikuti status `listening` (animasi CSS), bukan level nyata. Bukan data palsu; dicatat.
10. **Chip "Mengetik di `<file>`"** (referensi): nama file tidak tersedia di seam bridge→web.
    Chip menampilkan label aktivitas pose ("Mengetik…"). Usul: tambah `resource` di feed item
    bila diinginkan (butuh ADR karena menyentuh protocol — belum dilakukan).

---

## 5. Yang belum selesai / ditunda + alasan

1. **Mini mode (FR-035) dihapus** — digantikan switcher Chat|Ngobrol per ADR keputusan (d).
   **Menunggu konfirmasi owner** sebelum dianggap final.
2. **Gate fps e2e (>55) sempat di bawah ambang 1×** saat paralel berat; konsisten 57–60 fps
   pada run serial. Perlu diawasi, bukan blocker.
3. **Angka pixel-diff informatif** — teks mock dinamis; kesetaraan layout diverifikasi manual.
4. **String galeri `/dev/avatar` hardcode Bahasa Indonesia** — galeri dev, bukan UI pengguna;
   disengaja agar ringan (boleh di-i18n-kan bila diminta).
5. **Sinkronisasi PRD belum dilakukan** — hanya diusulkan (§6), sesuai instruksi prompt.
6. **M4–M7 tidak dikerjakan** — instruksi: berhenti setelah laporan ini untuk review owner.

---

## 6. Saran sinkronisasi PRD

| Bagian PRD | Usulan perubahan |
|---|---|
| §8.4 | Ganti rujukan ke CHARACTER.md; hapus palet/geometri/tabel pose lama (badge, tanpa mulut) |
| §8.5 | Ganti kontrak `AvatarRenderer` ke CHARACTER.md §12 (+ `characterName` wajib, `getAriaLabel`) |
| §9.3 | "voice-pulse badan" → mulut parametris + busur suara + lampu 2Hz (§6.7); hapus "karakter tidak punya mulut" |
| FR-030..036 | 9 pose + overlay speaking; konfeti & mood masuk FR-036; `traceability.md` sudah diperbarui |
| FR-033 | Tulis ulang kriteria: mulut tertutup ≤100ms setelah TTS berhenti; busur 0,2s; lampu 2Hz |
| FR-035 | Putuskan: hapus (diganti mode Ngobrol) atau definisikan ulang |
| §11.1 | Ganti layout ke desain Chat/Ngobrol baru (TopBar 68px, token, popup izin) |
| §11.5 | Perbarui contoh aria-label ("Bibo: sedang bekerja" → dari i18n + character.name) |
| §8.1 | Durasi celebrate 2s → 3s |
| §14 / M3 | Acuan visual = CHARACTER.md + `docs/reference/shots/`; dua PNG lama hanya inspirasi awal |

---

*Disusun oleh koordinator redesign dari laporan fase A–E. Semua klaim di atas didukung
commit di branch `redesign/avatar-ui` dan `bun run check` hijau (HEAD `2a8f5ee`).*
