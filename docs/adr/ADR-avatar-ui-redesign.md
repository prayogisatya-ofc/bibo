# ADR: Redesain Avatar + UI (Konsep B, Mode Chat/Ngobrol) — Fase A: Audit & Keputusan

Status: diterima (fase A, 2026-10-12) · Cabang: `redesign/avatar-ui`
Sumber kebenaran: `CHARACTER.md` (v1.0) + `docs/reference/*.html` + tangkapan layar `docs/reference/shots/`
Prompt induk: `AGENT-PROMPT-AVATAR-UI.md` (menggantikan butir avatar M3 dan butir tampilan visual M2)

Fase A ini **hanya** audit + tangkapan layar referensi + ADR. Tidak ada kode aplikasi yang
ditulis. Implementasi (fase B–E) mengikuti daftar file dan keputusan di bawah.

---

## 1. Temuan audit (kondisi repo saat ini)

### 1.1 Implementasi avatar lama — `packages/avatar/src/` (diganti total)

| File | Isi saat ini |
|---|---|
| `types.ts` (23 baris) | Re-export `AvatarPose`, `AVATAR_POSES`, `isAvatarPose` dari `@codepet/protocol`. Interface `AvatarRenderer`: `mount(el, {theme, reducedMotion})`, `setPose(pose)`, `setSpeechLevel(level)` (**voice-pulse**, eksplisit "TANPA mulut — setMouth tidak ada"), `setLook(x,y)`, `setTheme(theme)`, `destroy()`. **Tidak ada**: `variant` di `setPose`, `setMood`, `react()`, `setReducedMotion`, `pause()/resume()`. |
| `bibo.ts` (185 baris) | Template string `BiboSVG`: `svg#bibo`, `viewBox="0 0 480 320"`, `aria-label="Bibo"`. Geometri PRD §8.4 lama: squircle putih, **dua oval mata hitam tanpa mulut/pipi/visor/antena**, badge biru sudut (`circle#badge` r=34 di (138,78)) dengan 13 ikon `.bi-*`, props `.prop-*`. Tabel `POSES` per pose: badge + varian mata + posisi tangan + transform badan. |
| `bibo-css.ts` (169 baris) | Token `--bibo-*`, keyframes float/breathe/blink. |
| `renderer.ts` (~230 baris) | `BiboSvgRenderer`. `setSpeechLevel`: voice-pulse via `transform: scale(1−0.02·l, 1+0.045·l)` pada `#speech-pulse` + badge diganti ikon gelombang selama bicara. Mata/varian badge di-toggle pakai `display:none` (bukan crossfade opacity seperti dituntut CHARACTER.md §3.2). Timer internal: `scheduleLook` (melirik acak 5–9 dtk) dan `scheduleSleep` (setelah 120 dtk menerapkan visual tidur **sementara pose logis tetap `idle`** — dua mekanisme tidur yang tumpang tindih dengan `derivePose`). Animasi = CSS keyframes + rantai `setTimeout`, bukan tiga lapisan WAAPI. |
| `index.ts` | Re-export semuanya (`BiboSvgRenderer`, `BiboSVG`). |
| `package.json` | Dependensi `"@codepet/protocol": "*"` — satu-satunya alasan kopling. |

Pendekatan lama = **badge sudut + voice-pulse badan, tanpa mulut** — tepat yang digantikan
CHARACTER.md (visor gelap, mata mint, mulut kecil, pipi, antena + lampu status, tangan di depan
keyboard).

### 1.2 Kopling ke `@codepet/protocol` (akan diputus dari sisi avatar)

- `packages/protocol/src/avatar.ts` mendefinisikan `AVATAR_POSES` (14 string bertitik:
  `"working.reading"` …), tipe `AvatarPose`, dan `isAvatarPose`; di-re-export oleh
  `packages/protocol/src/index.ts`. **Tidak ada pesan WS yang membawa pose avatar**
  (skema zod tidak merujuknya) — pemakaian satu-satunya di luar paket avatar adalah
  `apps/bridge/test/contract.test.ts:66` yang mengassert `AVATAR_POSES` panjangnya 14.
- Pemakai kontrak lama di aplikasi (semua harus diperbarui di fase B–D):
  - `apps/web/src/ui/AvatarStage.tsx` — `new BiboSvgRenderer()`, `setSpeechLevel(level)`
    untuk voice-pulse, `data-testid="bibo-svg"`, `aria-label={`Bibo: ${caption}`}` (nama hardcoded).
  - `apps/web/src/ui/DevAvatar.tsx` — galeri `?dev=avatar`; hash `#pose=<nama>&theme=&speech=`;
    tombol `data-testid="pose-<p>"`; heading hardcoded "Bibo — galeri pose (M3)".
  - `apps/web/src/orchestrator/pose.ts` — `import type { AvatarPose } from "@codepet/avatar"`;
    `POSE_LABEL` memakai key pose bertitik; label `idle: "Bibo siap."` / `"Bibo is ready."`.
  - `apps/web/src/orchestrator/machine.ts` — `id: "bibo"`; transient celebrate
    `now + 2000` (**2 dtk**, lihat konflik #3); `import type { AvatarPose } from "@codepet/avatar"`.
  - `apps/web/src/orchestrator/useOrchestrator.ts` — `Snapshot { pose: AvatarPose }`.
  - `apps/web/e2e/avatar.spec.ts` — iterasi `AVATAR_POSES` dari `@codepet/avatar`.
  - `apps/web/src/voice/tts.ts` — generator level PRD §9.3
    (`0.25 + 0.6·|sin(2πft)| + noise`, aksen +0.2 pada `boundary`, ≤30 Hz via rAF) →
    `onLevel` → state `level` di `App.tsx` → prop `AvatarStage` → `setSpeechLevel`.
    Tanda tangan `setSpeechLevel(level)` **tetap** di kontrak baru; yang berubah hanya
    semantiknya (mulut parametris + busur suara + lampu 2 Hz, bukan denyut badan).

### 1.3 Struktur UI web saat ini (`apps/web/src/`)

- `App.tsx`: `StatusBar` di atas; `main.layout` berisi `.left` (AvatarStage, caption mic,
  ActivityFeed, ApprovalCard, FormCard) + `.right` (ChatPanel, toast, ChangesCard, errors).
  State `mini` (`localStorage "codepet.mini"`, lihat §1.4), `avatarSize` s/m/l, `theme`
  (`"dark"` default, `"auto"` → `prefers-color-scheme`), PTT Spasi, Ctrl/Cmd+M mute,
  Esc = interrupt (di `ChatPanel.tsx:87`).
- `ui/`: `StatusBar, AvatarStage, ChatPanel, ActivityFeed, ChangesCard, ApprovalCard,
  FormCard, MicButton, Settings, Onboarding, DevAvatar` + `errors.ts, markdown.ts, text-utils.ts`.
- `app.css` (145 baris): token dark-first di `:root` (`--bg: #161616`, dst.; varian
  `:root[data-theme="light"]` ada tapi nilainya **berbeda** dari token referensi),
  font `system-ui` (**bukan Nunito**), layout `.left 38% / .right flex`,
  `.app.mini` (avatar 96 px fixed pojok kiri-bawah, panel kanan disembunyikan),
  breakpoint 767 px, `prefers-reduced-motion` kill-switch global.
- `voice/`: `tts.ts`, `stt.ts`, `commands.ts`, `dictionary.ts`. `ws/`, `state/`, `i18n/` standar.

### 1.4 Mini mode (FR-035) — digantikan mode switcher, perlu konfirmasi owner

- `App.tsx`: `mini` state + `toggleMini()` (sekaligus toggle `showChat`);
  `chat-fab` memakai **emoji 💬** (melanggar aturan keras "tanpa emoji sebagai ikon").
- `StatusBar.tsx:45`: tombol `data-testid="mini-btn"` (`aria-label="mini"`).
- `app.css`: `.app.mini …` — avatar max 96 px, `.right` disembunyikan.
- `apps/web/e2e/m7.spec.ts`: tes "mini mode: avatar pojok 96px + chat bisa dibuka"
  memakai `mini-btn`, `chat-fab`, `bibo-svg`.
- Keputusan: mode switcher **Chat | Ngobrol** menggantikan mini mode (keputusan d) —
  penghapusan kode + tes di atas **menunggu konfirmasi eksplisit pemilik produk**.

### 1.5 String "Bibo" yang di-hardcode (harus lewat satu konfigurasi + i18n)

Hasil `grep -rn "Bibo" apps/web/src packages/avatar/src`:

| # | Lokasi | String |
|---|---|---|
| 1 | `i18n/locales/id.ts:2`, `en.ts:2` | `appTitle: "Bibo — Bibo"` |
| 2 | `i18n/locales/id.ts:31` | `emptyChat: "Belum ada pesan. Sapa Bibo dulu!"` |
| 3 | `i18n/locales/en.ts:31` | `emptyChat: "No messages yet. Say hi to Bibo!"` |
| 4 | `orchestrator/pose.ts:74` | `idle: "Bibo siap."` |
| 5 | `orchestrator/pose.ts:90` | `idle: "Bibo is ready."` |
| 6 | `ui/AvatarStage.tsx:45` | `` aria-label={`Bibo: ${caption}`} `` |
| 7 | `ui/DevAvatar.tsx:57` | `<h1>Bibo — galeri pose (M3)</h1>` |
| 8 | `ui/Settings.tsx:71` | `"Halo, ini Bibo. Suara test satu dua tiga."` |
| 9 | `packages/avatar/src/bibo.ts` | `aria-label="Bibo"` (template SVG) |
| 10 | `packages/avatar/src/renderer.ts` | pesan error `"SVG Bibo gagal dibuat"` |

Identifier yang terikat nama (ikut diganti di fase B): `id="bibo"` (SVG), token
`--bibo-*`, class/export `BiboSVG`/`BiboSvgRenderer`, `data-testid="bibo-svg"`,
machine `id: "bibo"`. Aturan: nama sementara "Bibo" hanya boleh muncul di
**satu konfigurasi** (`character.name`) dan file i18n — tidak di komponen, tidak di paket avatar.

### 1.6 i18n — kunci yang ada (`i18n/locales/id.ts` / `en.ts`, 44 baris)

`appTitle, onboardTitle/Hint/Placeholder/Go, recentTitle, statusOnline/Reconnecting/Down,
offlineBanner, badVersion, inputPlaceholder, send, stop, busyChoiceTitle/Queue/Steer,
permissionNote, changesTitle, settingsTitle, themeLabel/Dark/Light/Auto, autoscrollLabel,
bridgeUrlLabel, close, copy, copied, emptyChat, errorPrefix, tryAgain, thinking, working,
awaiting, avatarPlaceholder ("AvatarStage" — sisa placeholder), languageLabel, micLabel,
followLabel, dirChangeTitle, sessionLabel, newSession`.
Semua string UI sudah lewat `useT()` (bagus — pola ini dipertahankan; kunci baru untuk
uiMode, bubble, popup izin, dsb. ditambahkan di fase C).

### 1.7 Orchestrator — pemetaan pose (`orchestrator/`)

- `machine.ts` (211 baris): XState v5 paralel tiga region (`link`/`agent`/`voice`) sesuai
  PRD §8.1. Transient: `celebrateUntil = now + 2000`, `confusedUntil = now + 4000`.
  `snapshotPose` dihitung tiap event + TICK 500 dtk.
- `pose.ts`: `derivePose` murni; prioritas
  `offline > confused > awaiting→asking > listening > working.* > thinking >
  error→confused > celebrate > sleeping(idle>120 dtk) > idle` — sesuai PRD §8.2
  (state machine & prioritas **tidak berubah**).
- `TOOL_BUSY_KIND` (nama tool terverifikasi M0): `read→reading, edit→editing,
  shell/execute→running, webfetch/websearch→searching, task→delegating`,
  `question→thinking` ("asking via awaiting, bukan working"). **Celah kecil**:
  PRD §8.3a memetakan `task, subagent → delegating`, tetapi kode hanya memetakan
  `task` (nama `subagent` tak teramati di M0). Fase B: tambahkan `subagent` ke tabel
  data bila fixture mendukung, atau catat di `docs/opencode-v2-findings.md`.
- Transient `acknowledge` PRD §8.1 (±0,6 dtk setelah prompt) **tidak diimplementasikan**
  di machine; prompt D menggantinya dengan `react("nod")` — cukup, tidak perlu state baru.

### 1.8 Tes & testid yang dipakai e2e

- `packages/avatar/test/`: `bibo.test.ts`, `renderer.test.ts` (kontrak lama; ditulis ulang).
- e2e (`apps/web/e2e/`): `avatar.spec.ts` (iterasi `AVATAR_POSES`), `avatar-flow.spec.ts`,
  `speak.spec.ts`, `m7.spec.ts` (mini mode), `a11y.spec.ts`, `safety.spec.ts`, `chat.spec.ts`,
  `voice.spec.ts`. Testid relevan: `bibo-svg, avatar-caption, dev-stage, dev-caption,
  pose-<nama>, speech-slider, mini-btn, chat-fab, avatar-size, mic-caption, mic-btn,
  approval, perm-once, perm-reject, perm-always, risk-badge, formcard, theme, voice-toast,
  conn-label, offline-banner, chat-log, chat-input, send-btn, stop-btn, chat-count`.
- `traceability.md` baris M3 (FR-030…036) mendeskripsikan implementasi lama
  (14 pose bertitik, voice-pulse, mini mode, "galeri 29 screenshot") — **wajib
  diperbarui** saat perilaku berubah (aturan repo).

### 1.9 Referensi visual (fase A, selesai)

Empat file `docs/reference/*.html` dibaca penuh; tangkapan layar tersimpan di
`docs/reference/shots/` (viewport 1280×800; `character-sheet.png` full-page 1280×1040,
konten 1200×1040). Font Nunito dari CDN termuat (fallback sistem bila gagal).
Lembar karakter menampilkan 8 pose: Diam, Berpikir, Bekerja, Bertanya, Senang, Bingung,
Berbicara, Tidur + strip palet. File PNG lama (`character-ref-1/2.png`) bukan lagi acuan.

---

## 2. Daftar file — diubah / dibuat / dihapus (fase B–E, rencana)

### Diubah
- `packages/avatar/src/*` — tulis ulang total (SVG `viewBox 0 0 200 200` per CHARACTER.md
  §3, lapisan animasi A/B/C dengan WAAPI, bank ekspresi §4, 8 pose §6 + 2 pose §7 +
  varian §8, interaktivitas §9, transisi §10, reduced motion §13).
- `packages/avatar/package.json` — hapus dependensi `@codepet/protocol`.
- `packages/avatar/test/*` — tulis ulang mengikuti CHARACTER.md §14.
- `apps/web/src/orchestrator/pose.ts` — string pose baru (tanpa titik; varian via opsi),
  label tanpa nama hardcoded.
- `apps/web/src/orchestrator/machine.ts` — celebrate 2000→**3000 ms**; petakan
  `working.*`+varian dan flag overlay speaking ke pose §11; hapus `id: "bibo"`.
- `apps/web/src/orchestrator/useOrchestrator.ts` — wire `setPose`+varian, `setSpeechLevel`
  overlay, `react()` (nod/perk/thanks/hello), `setMood`.
- `apps/web/src/ui/AvatarStage.tsx` — mount opts baru (`characterName`, `getAriaLabel`);
  renderer baru; pertahankan `data-testid="bibo-svg"` → ganti jadi `avatar-svg`
  (keputusan penamaan di fase B; e2e ikut diperbarui).
- `apps/web/src/ui/DevAvatar.tsx` — galeri CHARACTER.md §14 (pose×varian, reaksi, slider
  speechLevel, mood, tema, reduced motion, slow-mo ×0,25, seed, `?freeze=<ms>`).
- `apps/web/src/App.tsx` — state `uiMode: "chat"|"talk"` (localStorage, Ctrl/Cmd+.),
  hapus `mini`/`toggleMini`/`chat-fab` (butuh konfirmasi owner, §1.4), layout dua mode.
- `apps/web/src/ui/StatusBar.tsx` — menjadi TopBar: logotype, chip folder, chip status,
  pemilih mode Chat|Ngobrol, bisukan, pengaturan. Hapus `mini-btn`.
- `apps/web/src/ui/ChatPanel.tsx`, `ActivityFeed.tsx`, `ChangesCard.tsx` — gaya
  `ui-mode-chat.html` (bubble, baris tool + ikon status, kartu perubahan).
- `apps/web/src/ui/ApprovalCard.tsx`, `FormCard.tsx` — varian popup di bawah avatar
  (mode Ngobrol): panah ke avatar, `role="alertdialog"`, focus trap, aturan risiko
  (high: tanpa "Selalu izinkan", ketik OK, tanpa petunjuk suara).
- `apps/web/src/ui/MicButton.tsx` — tombol besar 72/88 px, denyut mengikuti level mic.
- `apps/web/src/app.css` — bangun ulang total sebagai design tokens (CSS variables)
  dari referensi; font Nunito **lokal** (`@fontsource/nunito`, tambah ke
  `apps/web/package.json`); tema gelap diturunkan dari CHARACTER.md §2 (cek kontras AA).
- `apps/web/src/i18n/locales/id.ts`, `en.ts` — kunci baru (mode, bubble, popup,
  petunjuk suara); keluarkan nama dari `appTitle`/`emptyChat` (pakai `character.name`).
- `apps/web/src/voice/tts.ts` — `setSpeechLevel` tetap ≤30 Hz; semantik baru
  (mulut parametris, bukan voice-pulse).
- `apps/web/e2e/*` — perbarui string pose, hapus/ubah tes mini mode (setelah konfirmasi).
- `docs/traceability.md` — perbarui baris FR-033/034/035/036 + durasi celebrate.
- `README.md` — dokumentasikan `uiMode`, pintasan Ctrl/Cmd+., galeri dev.

### Dibuat
- `docs/adr/ADR-avatar-ui-redesign.md` — file ini (fase A).
- `docs/reference/shots/*.png` — 4 tangkapan layar referensi (fase A).
- `packages/avatar/src/timing.ts` — **satu-satunya** tempat angka waktu/amplitudo
  (keputusan e).
- `packages/avatar/src/character.ts` (+ modul pose) — SVG & animasi baru.
- `apps/web/src/ui/icons.tsx` — set ikon SVG garis (mic, speaker, gear, send, stop,
  check, spinner); **tanpa emoji**.
- `apps/web/src/ui/SpeechBubble.tsx` — bubble ucapan mode Ngobrol (pop 180 ms,
  maks 3 baris, fade 1,5 dtk, varian error).
- `apps/web/src/ui/ModeSwitcher.tsx` (atau bagian TopBar) — pemilih Chat|Ngobrol.
- `apps/web/src/config/character.ts` — `character.name` (sumber tunggal nama sementara).
- `docs/reports/avatar-ui/` — perbandingan visual 3 adegan (fase E).

### Dihapus
- `packages/avatar/src/bibo.ts`, `bibo-css.ts` — digantikan modul baru.
- `docs/reference/character-ref-1-idle.png`, `character-ref-2-thinking.png` — bukan acuan lagi.
- `docs/reference/character-sheet.png` (lama) — stale; sudah diganti
  `docs/reference/shots/character-sheet.png`. Verifikasi sebelum hapus di fase B.
- Kode mini mode (`mini` state, `toggleMini`, `mini-btn`, `.app.mini`, `.chat-fab`,
  key `codepet.mini`) — **menunggu konfirmasi owner** (keputusan d).

### Tidak disentuh (aturan keras)
`apps/bridge/**`, `packages/protocol/**` (termasuk `src/avatar.ts` — tetap ada sebagai
tipe mati; kandidat depresiasi di ADR berikutnya, bukan sekarang),
`apps/bridge/src/safety/risk.ts`, semantik permission. Bila perubahan protokol
benar-benar perlu: tulis ADR + minta persetujuan, jangan lanjut diam-diam.

---

## 3. Keputusan teknis

### (a) Kontrak `AvatarRenderer` = CHARACTER.md §12 + dua tambahan kecil

Tambahan di `mount` opts: `characterName: string` (wajib) dan
`getAriaLabel?: (pose: AvatarPose, variant?: WorkingVariant) => string` (opsional).

Alasan: paket avatar tidak boleh me-hardcode nama sementara "Bibo" (§1.5 menemukan
10 lokasi). Aplikasi mengoper `characterName` dari `config/character.ts` (yang nilainya
boleh datang dari i18n). `getAriaLabel` membuat `aria-label` dinamis per pose
("Bibo sedang mengetik") tanpa paket avatar mengimpor sistem i18n aplikasi.
Contoh label PRD §11.5 yang me-hardcode nama ikut diperbaiki lewat jalur ini.

### (b) Paket avatar mendefinisikan tipenya sendiri; berhenti impor dari `@codepet/protocol`

`packages/protocol` **tidak diubah** (aturan keras). `AvatarPose` baru =
union string tanpa titik (`"idle" | "thinking" | "working" | …`) + `WorkingVariant`
terpisah (`"typing" | "reading" | "running" | "searching" | "delegating" | "generic"`)
sesuai CHARACTER.md §12 — bukan 14 string bertitik seperti sekarang.
`packages/protocol/src/avatar.ts` tetap ada (dipakai `contract.test.ts` bridge);
ia menjadi tipe mati yang tidak lagi menjadi sumber kebenaran renderer.
Konsekuensi: hapus `"@codepet/protocol": "*"` dari `packages/avatar/package.json`;
`apps/web` mengimpor tipe pose dari `@codepet/avatar`, bukan dari protocol.

### (c) Tema default aplikasi menjadi terang

Referensi yang disetujui (`ui-mode-*.html`) adalah tema terang
(`#EDF0FB` latar, `#FFFFFF` kartu, dst.). Default `useState("dark")` di `App.tsx`
diubah menjadi `"light"`; opsi gelap/otomatis tetap ada. Palet gelap diturunkan dari
CHARACTER.md §2 (kolom "Gelap" di tabel itu adalah sumber token tema gelap —
bukan penentu default aplikasi) dan diperiksa kontras AA. Catatan: token light yang
ada di `app.css` saat ini nilainya berbeda dari referensi — diganti total mengikuti
token prompt (bagian C).

### (d) Mini mode digantikan pemilih mode Chat|Ngobrol — perlu konfirmasi owner

FR-035 (P1) "mode kecil/pojok" dan tes e2e m7 dibangun untuk mini mode. Desain baru
tidak lagi punya konsep mini: yang ada adalah dua mode penuh dengan Bibo besar di
tengah (mode Ngobrol) atau panggung 250 px (mode Chat). Maka `mini` state,
`mini-btn`, `chat-fab` (sekaligus menghapus pelanggaran emoji 💬), dan CSS
`.app.mini` dihapus — **setelah pemilik produk mengonfirmasi** bahwa FR-035
dinyatakan terpenuhi oleh mode switcher. Sampai konfirmasi ada, kode mini mode
tidak dihapus.

### (e) Semua angka waktu di `packages/avatar/src/timing.ts`

Satu objek konstanta bertipe (`T.idle.float.period`, `T.think.dots.stagger`,
`T.speak.blinkHz`, …). Tidak ada literal durasi/periode/amplitudo di modul lain.
Alasan: CHARACTER.md memuat puluhan angka presisi (jadwal kedip, stagger 0,35 dtk,
eskalasi 20/60 dtk, dsb.); satu sumber memudahkan penalaan visual ("kalau tampilan
terasa janggal, ubah di satu tempat") dan pengujian jam-palsu yang deterministik.

---

## 4. Konflik antar dokumen & keputusan

| # | Konflik | Keputusan |
|---|---|---|
| 1 | PRD §8.4/§8.5 (badge biru sudut, mata hitam, **tanpa mulut**, viewBox 480×320) vs CHARACTER.md §2–§4 (visor gelap, mata mint, **mulut kecil**, pipi, antena+lampu, viewBox 200×200) | **CHARACTER.md menang** (sesuai header-nya; diperintahkan prompt) |
| 2 | PRD §9.3 + FR-033 ("voice-pulse badan… karakter tidak punya mulut") vs CHARACTER.md §6.7 (mulut parametris + busur suara + lampu 2 Hz) | **CHARACTER.md menang**; FR-033 perlu sinkronisasi PRD |
| 3 | Durasi celebrate **2 dtk** (PRD §8.1 "±2 s", `machine.ts` 2000 ms, traceability M3) vs **3 dtk** (CHARACTER.md §6.5, "≥ 2 ledakan konfeti") | **3 dtk menang**; ubah `machine.ts` di fase D |
| 4 | PRD §8.2 mencantumkan `speaking` sebagai item prioritas #4, sementara catatan §8.2/§8.4 menyebutnya overlay | **Model overlay menang** (CHARACTER.md §11): `setSpeechLevel` menumpuk di atas pose dasar; prioritas pola lampu `asking > speaking > pose dasar` |
| 5 | FR-035 mini mode (P1) vs pemilih mode Chat\|Ngobrol | **Butuh konfirmasi owner** (keputusan d); FR-035 + tes m7 ditahan sampai ada keputusan |
| 6 | PRD §11.1 (StatusBar, layout kiri-kanan, mini mode) vs `ui-mode-*.html` (TopBar 68 px, mode switcher, layar Ngobrol minimal) | **`ui-mode-*.html` menang** untuk tata letak & gaya (prioritas prompt); PRD §11.1 perlu sinkronisasi |
| 7 | PRD §8.3a properti visual per tool (reading→kaca pembesar, editing→papan ketik, running→terminal+`>_`) vs CHARACTER.md §8 (reading→lembar dokumen, typing→keyboard default, running→keyboard+chip `>_` melayang) | **CHARACTER.md §8 menang** untuk visual; pemetaan nama tool→kind terverifikasi M0 tetap dipakai |
| 8 | FR-015/PRD §11.3: Esc = interrupt vs prompt C.4: "Esc TIDAK menyetujui/menolak izin; kartu tidak boleh hilang selama pending" | Keduanya berlaku di lapisan berbeda: Esc global = interrupt; **di kartu izin/form, Esc bukan keputusan dan tidak menutup kartu** (fase C: focus trap + `role="alertdialog"`) |
| 9 | Default tema: kode `"dark"` (+ label kolom "Gelap (default)" di CHARACTER.md §2) vs keputusan (c) default terang | **Keputusan (c)**: default aplikasi terang; kolom §2 hanya sumber token tema gelap |
| 10 | `traceability.md` M3 + `DevAvatar` hash API (`#pose/#theme/#speech`) vs CHARACTER.md §14 (galeri: `?freeze=<ms>`, slow-mo, seed, mood) | Diperbarui/dibangun ulang di fase B–E |
| 11 | PRD §11.5 contoh `aria-label` ("Bibo sedang mengedit file") me-hardcode nama | Diganti mekanisme `getAriaLabel` + `characterName` (keputusan a) |
| 12 | `character-sheet.html` termodifikasi (unstaged) vs `docs/reference/character-sheet.png` lama yang stale | PNG lama diverifikasi & diganti/dihapus di fase B; yang berlaku `shots/character-sheet.png` |

Usulan sinkronisasi PRD (untuk pemilik produk, bukan dikerjakan di fase A):
§8.4 (rujuk ke CHARACTER.md, hapus geometri/badge lama), §8.5 (kontrak §12 +
tambahan ADR ini), §9.3 (mulut parametris), FR-033 (definisi baru animasi bicara),
FR-035 (nasib mini mode), §11.1 (layout dua mode), durasi celebrate 2→3 dtk,
§13.3 (skenario Gherkin yang menyentuh avatar tetap lolos — cakupan visual berubah).

---

## Konsekuensi & tindak lanjut fase B–E

- Fase B (avatar): implementasi CHARACTER.md §2–§10 + §12–§14; hapus PNG lama;
  `subagent` → delegating bila bukti mendukung.
- Fase C (UI): bangun ulang `app.css` sebagai tokens (dilarang salin inline-style
  referensi mentah-mentah); ikon SVG garis; Nunito lokal; dua mode + popup izin.
- Fase D (wiring): orchestrator → pose/variant/overlay/bubble/popup per CHARACTER.md §11;
  `react()` (nod/perk/thanks/hello); lampu antena per §4.3; celebrate 3 dtk.
- Fase E (pengujian): unit + jam palsu + visual 3 adegan di `docs/reports/avatar-ui/`
  + axe + performa (§13) + Gherkin PRD §13.3.
- Butuh jawaban owner sebelum/saat fase C: (1) penghapusan mini mode (keputusan d);
  (2) depresiasi `packages/protocol/src/avatar.ts` di ADR berikutnya
  (tidak bisa dikerjakan sekarang karena aturan keras).
- Aturan repo tetap berlaku: Conventional Commits, tanpa `any` baru, tiap FR/NFR
  ada tes/bukti, API tak dikenal dicatat di `docs/opencode-v2-findings.md`,
  `docs/traceability.md` diperbarui tiap perubahan perilaku, tidak pernah push.
