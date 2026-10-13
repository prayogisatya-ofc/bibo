# PRD — Bibo: Avatar Robot Digital untuk OpenCode v2

| Item | Isi |
|---|---|
| **Nama kerja** | Bibo (placeholder, boleh diganti) |
| **Karakter MVP** | "Bibo" — robot mungil putih berbentuk squircle, dua mata oval, dua tangan melayang (SVG 2D, mengikuti gambar referensi) |
| **Versi dokumen** | 1.1 (karakter diganti dari kucing "Mochi" menjadi robot "Bibo") |
| **Tanggal** | 10 Oktober 2026 |
| **Target pembaca** | AI coding agent (utama) dan developer manusia |
| **Bahasa produk** | Indonesia (default), Inggris (opsional) |
| **Target OpenCode** | **OpenCode v2** (`opencode.ai/v2/docs`, paket `@opencode/*`). **Bukan v1.** |

**Riwayat revisi:** v1.0 karakter kucing "Mochi" → **v1.1** karakter diganti robot "Bibo" (§8.4–8.5, §9.3, FR-030..036), mengikuti dua gambar referensi dari pemilik produk. Logika state machine tidak berubah. → **v1.2** (2026-10-13): kontrak avatar baru per CHARACTER.md §12 (mulut parametris, bukan voice-pulse; + `setMicLevel`, ADR-009); FR-035 mini mode **dihapus** (keputusan owner, digantikan pemilih mode Chat | Ngobrol); layout §11.1 = desain Chat/Ngobrol; celebrate 3 dtk.

> **Cara membaca dokumen ini (untuk AI agent):** setiap kebutuhan punya ID (`FR-xxx`, `NFR-xxx`). Setiap ID wajib punya test atau bukti verifikasi. Bagian bertanda **⚠️ VERIFIKASI** berisi klaim tentang OpenCode v2 yang berasal dari sumber komunitas atau yang skemanya belum dipastikan. Agent **dilarang menebak**; verifikasi di Milestone 0 (lihat §14) lalu catat hasilnya di `docs/opencode-v2-findings.md`.

---

## 0. Ringkasan Eksekutif

Bibo adalah aplikasi web lokal berisi **karakter kartun animasi** yang menjadi "wajah" dari OpenCode. Pengguna berbicara (suara) atau mengetik (chat) ke karakter. Perintah diteruskan ke OpenCode v2 yang menjalankan pekerjaan coding sungguhan (baca/edit file, jalankan perintah, dll). Karakter:

1. **Mendengar** (mic → teks),
2. **Bereaksi** secara visual terhadap apa yang OpenCode kerjakan (berpikir, mengetik, menjalankan, bertanya, senang, bingung),
3. **Menjawab dengan suara** (ringkasan pendek, bukan membacakan kode),
4. **Meminta izin** secara lisan sebelum aksi berisiko, dan
5. **Menampilkan hasil** (jawaban, aktivitas tool, daftar file yang berubah) di layar.

Inti nilai: ngobrol dengan agent coding terasa seperti bekerja bersama rekan, bukan menatap terminal.

---

## 1. Latar Belakang & Masalah

- Agent coding saat ini berpusat pada terminal/IDE dan teks. Pengguna harus terus melihat layar untuk tahu agent sedang apa.
- Sulit melakukan multitasking (agent bekerja lama, pengguna tidak tahu kapan selesai, kapan butuh izin).
- Interaksi suara untuk coding hampir tidak ada, padahal banyak instruksi lebih cepat diucapkan.
- OpenCode v2 menyediakan server HTTP + klien TypeScript + event stream sehingga cocok dijadikan "otak" bagi antarmuka baru.

**Hipotesis:** antarmuka berkarakter dengan umpan balik visual dan suara membuat pengguna lebih sadar status agent, lebih nyaman memberi izin, dan lebih menikmati sesi coding panjang.

---

## 2. Tujuan & Non-Tujuan

### 2.1 Tujuan (Goals)

| ID | Tujuan | Metrik keberhasilan |
|---|---|---|
| G1 | Pengguna bisa memberi perintah coding lewat **suara atau chat** dan OpenCode benar-benar mengeksekusinya | ≥ 95% prompt terkirim ke OpenCode tanpa error transport pada uji 50 prompt |
| G2 | Karakter selalu **mencerminkan status nyata** OpenCode | Delay event→animasi p95 < 300 ms; 0 kasus karakter "idle" saat agent bekerja pada uji 20 sesi |
| G3 | Karakter **membalas dengan suara** ringkas | ≥ 90% jawaban akhir punya ringkasan lisan ≤ 2 kalimat |
| G4 | Aksi berisiko **selalu** dikonfirmasi manusia | 0 aksi risiko tinggi disetujui otomatis atau hanya lewat suara |
| G5 | Setup cepat | Dari clone sampai demo jalan ≤ 10 menit, 1 perintah start |
| G6 | Arsitektur modular agar karakter bisa diganti (SVG → Rive/Live2D/VRM) tanpa mengubah logika | Renderer di balik interface `AvatarRenderer` (§8.5) |

### 2.2 Non-Tujuan (MVP)

- Bukan pengganti TUI/IDE OpenCode penuh (tidak ada editor kode, tidak ada terminal emulator).
- Tidak ada karakter manusia 3D / Live2D / VRM di MVP (hanya kartun 2D sederhana).
- Tidak ada wake-word ("Hey Bibo") di MVP (push-to-talk dan tombol saja).
- Tidak ada multi-user / cloud hosting / akun. Aplikasi lokal untuk satu pengguna.
- Tidak membuat model LLM/STT/TTS sendiri.
- Tidak mengelola kredensial provider LLM (itu urusan OpenCode).

---

## 3. Persona & Skenario

### 3.1 Persona

**P1 — Dev solo "Raka"**: ngoding sambil kerja lain, ingin memberi perintah lisan dan mendengar kabar selesai/butuh izin tanpa menatap terminal.
**P2 — Mahasiswa/pemula "Sari"**: suka antarmuka ramah, butuh penjelasan singkat lisan tentang apa yang dilakukan agent.
**P3 — Streamer/edukator "Dimas"**: ingin karakter sebagai "co-host" yang bereaksi saat live-coding.

### 3.2 User Stories

| ID | Sebagai | Saya ingin | Supaya |
|---|---|---|---|
| US-01 | Pengguna | menahan tombol/spasi dan bicara "tambahkan validasi email di form login" | tidak perlu mengetik |
| US-02 | Pengguna | mengetik pesan di chat | tetap bisa bekerja di tempat sepi/ramai |
| US-03 | Pengguna | melihat karakter berpikir lalu mengetik saat OpenCode mengedit file | tahu agent sedang apa tanpa baca log |
| US-04 | Pengguna | mendengar ringkasan "Sudah kutambah validasi di `LoginForm`, 2 file berubah" | tidak perlu membaca semua keluaran |
| US-05 | Pengguna | ditanya lisan "Boleh jalankan `npm test`?" dan menjawab "ya" | cepat mengizinkan aksi aman |
| US-06 | Pengguna | aksi berbahaya (hapus, push, sudo) **tidak** bisa disetujui hanya dengan suara | terlindung dari salah dengar |
| US-07 | Pengguna | berkata "berhenti" untuk menghentikan agent | bisa menyela kapan saja |
| US-08 | Pengguna | memilih folder proyek dan melanjutkan sesi sebelumnya | konteks tidak hilang |
| US-09 | Pengguna | melihat daftar file yang berubah setelah tugas selesai | bisa meninjau |
| US-10 | Pengguna | karakter tetap berguna jika mic/TTS tidak tersedia | tidak bergantung satu browser |
| US-11 | Pengguna | mengatur seberapa cerewet karakter (senyap/normal/cerewet) | sesuai suasana |
| US-12 | Pengguna | melihat jelas bila OpenCode tidak terhubung | tidak bingung kenapa tidak merespons |

---

## 4. Ruang Lingkup per Rilis

| Rilis | Isi |
|---|---|
| **MVP (v0.1)** | Chat + PTT suara (Web Speech API), TTS browser, avatar Bibo (SVG), state machine, koneksi OpenCode v2 via bridge, event→animasi, ringkasan lisan, permission & form flow, interrupt, daftar file berubah, pengaturan dasar, reconnect, tes otomatis |
| **v0.2** | Whisper STT (lokal/API), TTS natural (Piper/ElevenLabs/dll) + animasi bicara audio-reaktif, voice shortcuts lebih kaya, multi-session switcher, revert perubahan via suara+konfirmasi, skin karakter tambahan |
| **v0.3** | Wake word, overlay desktop (Tauri), PWA mobile sebagai remote, adapter Rive/Live2D/VRM, plugin OpenCode v2 pendamping |

---

## 5. Integrasi OpenCode v2 (WAJIB dibaca agent)

### 5.1 Definisi "v2" dan sumber dokumentasi yang sah

OpenCode saat ini punya dua lini dokumentasi. **Proyek ini hanya memakai lini v2.**

| | **v2 (DIPAKAI)** | v1 (JANGAN dipakai) |
|---|---|---|
| Docs | `https://opencode.ai/v2/docs/` | `https://opencode.ai/docs/` |
| API reference | `https://opencode.ai/v2/docs/api` | — |
| OpenAPI JSON | `https://opencode.ai/v2/openapi.json` | `http://localhost:4096/doc` (v1) |
| Client JS | `@opencode/client` | `@opencode-ai/sdk` |
| Embedded SDK | `@opencode/sdk` | `createOpencode` dari `@opencode-ai/sdk` |
| Prefix route | `/api/...` | `/session/...`, `/event`, dll |
| Lokasi proyek | objek `location: { directory }` | query `directory` |
| Config MCP | `mcp.servers.<nama>` | `mcp.<nama>` |
| Config provider | `providers`, `package`, `settings` | `provider`, `npm`, `options` |

Aturan keras untuk agent:
1. **Dilarang** meng-import `@opencode-ai/sdk`, `@opencode-ai/plugin`, atau memakai pola `client.session.prompt({ path, body })` gaya v1.
2. Jika contoh kode di internet memakai `/session/:id/message` atau `session.idle` sebagai satu-satunya sinyal selesai, anggap itu **v1** dan jangan disalin.
3. Sumber kebenaran tertinggi = `https://opencode.ai/v2/openapi.json` + halaman docs v2. Jika dokumen dan perilaku nyata berbeda, **perilaku nyata menang** dan wajib dicatat di findings.

### 5.2 Fakta terverifikasi dari dokumentasi v2

**Klien (`@opencode/client`)** — `https://opencode.ai/v2/docs/build/client`

- Install: `bun add @opencode/client`.
- Membuat klien dan sesi:
  ```ts
  import { OpenCode } from "@opencode/client"

  const client = OpenCode.make({ baseUrl: "http://localhost:4096" })
  const session = await client.session.create({ location: { directory: "/workspace" } })
  await client.session.prompt({ sessionID: session.id, text: "Review the current changes" })
  ```
- Header auth / `fetch` kustom lewat opsi `headers` dan `fetch` pada `OpenCode.make`. Setiap operasi menerima argumen terakhir berisi `signal` (AbortSignal) dan/atau `headers`.
- **Event stream:** `for await (const event of client.event.subscribe()) { ... }`.
  - Langganan **live-only: tanpa replay dan tanpa auto-reconnect.** Jika sumber gagal, langganan berakhir dan harus subscribe ulang.
  - Pelanggan yang terlambat menerima penanda `server.connected`, bukan event bisnis masa lalu.
  - Semua subscriber berbagi satu koneksi lazy per klien; konsumen **harus mem-buffer** sebelum kerja lambat (sumber menunggu subscriber menerima tiap event).
- **Service lokal (khusus Node/Bun):** `import { Service } from "@opencode/client/service"` → `Service.discover()`, `Service.ensure()`, `Service.stop()`, `Service.headers(endpoint)`. `ensure()` memakai perintah default `opencode serve --service`. Entry utama klien kompatibel browser, tetapi `Service` tidak.
  ```ts
  const endpoint = await Service.ensure()
  const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) })
  const info = await client.server.info()
  ```

**SDK embedded (`@opencode/sdk`)** — `https://opencode.ai/v2/docs/build/sdk`
- `OpenCode.create()` menjalankan host OpenCode **di dalam proses aplikasi**, tanpa HTTP listener. Memakai tipe/stream yang sama dengan klien dan menambah alias `sessions` & `events`.
- Dipertimbangkan sebagai alternatif (ADR-002), tetapi **keputusan MVP: pakai `@opencode/client` + server `opencode serve`** agar pengguna tetap bisa memakai TUI OpenCode berdampingan.

**HTTP API** — `https://opencode.ai/v2/docs/api` (142 operasi, 260 skema)

Endpoint yang dipakai Bibo (nama operasi → rute):

| Kebutuhan | Operation ID | Rute | Catatan |
|---|---|---|---|
| Info/health server | `server.info` | `GET /api/info` | cek versi, readiness |
| Daftar/buat sesi | `session.list` / `session.create` | `GET/POST /api/session` | body create: `title`, `agent`, `model`, `location`, `metadata`, `permissions`, `parentID` (ID sesi berpola `^ses`) |
| Sesi aktif | `session.active` | `GET /api/session/active` | sesi yang sedang dieksekusi proses ini |
| Kirim pesan | `session.prompt` | `POST /api/session/{id}/prompt` | body: `text` (wajib), `files`, `agents`, `skills`, `metadata`, `delivery`, `resume`. Mengantre input secara *durable* lalu menjadwalkan loop agent kecuali `resume:false` |
| Interrupt | `session.interrupt` | `POST /api/session/{id}/interrupt` | query `resume`; balasan `interrupted: boolean` |
| Tunggu idle | `experimental.session.wait` | `POST /api/experimental/session/{id}/wait` | eksperimental |
| Pesan sesi | `session.message.list` / `.get` | `GET /api/session/{id}/message` | paginasi cursor; filter `type` (`user`, `assistant`, `shell`, `system`, `skill`, `compaction`, dll) |
| Diff per giliran | `session.diff` | `GET /api/session/{id}/diff` | daftar `FileDiff.Info[]` |
| Gabung/steer | `session.inbox.*` | `/api/session/{id}/inbox` | ubah mode `delivery` item antrean |
| Permission pending | `permission.request.list` | `GET /api/permission/request` | per location (tanpa argumen = lokasi default server; bridge wajib kirim `location.directory`) |
| Permission per sesi | `permission.list/get/reply` (akses klien: `client.permission.*`, BUKAN `client.session.permission.*`; rute HTTP `/api/session/{id}/permission...`) | `/api/session/{id}/permission...` | ✅ M0: body reply `{decision: "once"\|"always"\|"reject", message?}` → `void`; event `permission.replied={sessionID,requestID,reply}` |
| Form/pertanyaan | `session.form.list/get/reply/cancel`, `form.list` | `/api/session/{id}/form...`, `/api/form` | ID form berpola `^frm_`; event = `form.created` (bukan `question.asked`); ✅ M0 |
| Agent/model | `agent.list`, `model.list`, `session.switchAgent`, `session.switchModel` | `/api/agent`, `/api/model`, ... | P2 |
| Teks sekali-jalan dari konteks sesi | `session.generate` | `POST /api/session/{id}/generate` | menghasilkan teks **tanpa mengubah riwayat**; kandidat untuk ringkasan lisan (§9.5); ✅ M0: ada, 1 panggilan = 1 completion konteks penuh (ikut kuota provider) |
| Event | `event.subscribe` | `GET /api/event` (SSE) | ✅ M0: envelope `{event, data(JSON string)}`; payload di `data`; stream global → filter `data.sessionID` |
| Revert | `session.revert.stage/commit/clear` | `/api/session/{id}/revert...` | v0.2 |
| Pairing | `server.pair` / `server.connect` | `POST /api/pair`, `GET /auth/connect/{code}` | opsional bila akses remote |

**⚠️ ENDPOINT TERLARANG di bridge:** `GET /api/credential` mengembalikan *nilai rahasia* kredensial integrasi. Bridge **tidak boleh** memanggil atau mem-proxy grup `credential`, `integration`, `pty`, `persistentPty`, `fs.write`, maupun `config` update. Bridge memakai **allowlist** endpoint (NFR-SEC-04).

### 5.3 Kontrak event v2 — HASIL M0 (2026-10-11, OpenCode 2.0.16)

Dokumentasi v2 menjelaskan *cara* subscribe, tetapi daftar event dan payload hanya
dipastikan lewat observasi. Hasil spike (`docs/fixtures/opencode-events/`, 7 fixture):

**Terkonfirmasi dari sumber komunitas:**
- ✅ Host memancarkan `session.execution.started | succeeded | failed | interrupted`;
  payload bisnis di properti **`data`** (bukan `properties`).
- ✅ `session.idle` dan `session.status` (nama wire `session.status`) memiliki tipe di klien
  tetapi **tidak pernah terkirim** pada 6 skenario → jangan dipakai (ADR-007).
- ❌ Klaim "hanya 4 tipe event teramati" TIDAK berlaku untuk 2.0.16: puluhan tipe teramati,
  termasuk `permission.asked`, `form.created`, keluarga `session.step.*`, `session.tool.*`,
  `session.text.*`, `session.reasoning.*`, `session.retry.scheduled`, `session.usage.updated`.

**Temuan baru (tak ada di PRD v1.1):**
- Stream bersifat **global** (semua sesi + lokasi). Bridge WAJIB memfilter `data.sessionID`.
  Nama tool nyata: `read`, `edit`, `shell`, `execute`, `question` (dari
  `session.tool.input.started → data.name`; `session.tool.called` tidak memuat nama).
- Event pertanyaan = `form.created` + `metadata.kind:"question"` (bukan `question.asked`).
- Error tool dibedakan: `tool.failed{type:"tool.execution"}` (gagal jalan) vs
  `{type:"aborted"}` (permission ditolak → diikuti `execution.interrupted`) vs
  `provider.transport` (provider mati → `retry.scheduled` lalu `execution.failed`).
- Sesi yang menunggu form/permission tetap `running` di `session.active`.
- Stream tidak putus selama ±25 menit uji (`streamEnds: 0`), tetapi kontrak live-only tetap
  berlaku → reconnect + rekonsiliasi wajib (NFR-REL-01).

**Konsekuensi desain (wajib):**
1. Bridge memakai **lapisan normalisasi event** (§6.4) yang toleran: menerima payload di `properties` **atau** `data`, mengabaikan event tak dikenal, tidak crash.
2. Status "bekerja/selesai" **tidak boleh** bergantung pada satu jenis event. Gunakan *sinyal berlapis*:
   a. event eksekusi/step/tool bila ada,
   b. polling `GET /api/session/active` (default tiap 1 s saat ada prompt aktif),
   c. `message.list` untuk mendeteksi pesan assistant baru/selesai,
   d. `permission.request.list` & `form.list` polling (tiap 1,5 s saat sesi aktif) untuk mendeteksi permintaan izin yang eventnya tidak datang.
3. Milestone 0 **menangkap rekaman event nyata** (fixture JSON) dari OpenCode v2 versi terpasang dan menjadikannya dasar tes (§13).
4. Karena stream bisa putus: bridge melakukan **reconnect + rekonsiliasi** (§6.5).

### 5.4 Kompatibilitas versi

- Bridge membaca `server.info` saat start dan mencatat versi di log. Simpan versi + hasil spike di findings.
- Jika versi mayor bukan `2.x`, tampilkan error jelas di UI ("Bibo membutuhkan OpenCode v2").
- Pin versi `@opencode/client` secara eksak di `package.json` setelah spike (v2 masih berkembang; ada laporan perubahan antar rilis).

---

## 6. Arsitektur

### 6.1 Diagram

```
┌──────────────────────────── Browser (Chrome/Edge) ─────────────────────────────┐
│  apps/web (React + Vite + TS)                                                    │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Chat UI  │  │ Voice In   │  │ Voice Out   │  │ Avatar   │  │ Approval /  │  │
│  │ + Feed   │  │ (STT, PTT) │  │ (TTS queue) │  │ Renderer │  │ Form UI     │  │
│  └────┬─────┘  └─────┬──────┘  └──────▲──────┘  └────▲─────┘  └──────┬──────┘  │
│       └──────────────┴────── Orchestrator (XState) ──┴───────────────┘         │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ WebSocket JSON (127.0.0.1 only, token)
┌───────────────────────────────▼─────────────────────────────────────────────────┐
│  apps/bridge (Bun + Hono + ws)                                                   │
│  ├─ WS Gateway ── protocol (zod)                                                 │
│  ├─ OpenCode Adapter (@opencode/client) ── allowlist endpoint                    │
│  │    ├─ Event Pump (subscribe + reconnect + buffer)                             │
│  │    ├─ Poller (session.active, permission.list, form.list, message.list)       │
│  │    └─ Normalizer → AgentSignal                                                │
│  ├─ Agent State Reducer → AgentState + ActivityFeed                              │
│  ├─ Speech Summarizer (<speak> parser | session.generate | heuristic)            │
│  ├─ Risk Classifier (permission → low/medium/high)                               │
│  └─ Persistence (JSON file: last session per directory, settings)                │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ HTTP + SSE (@opencode/client)
                      ┌─────────▼──────────┐
                      │ opencode serve (v2) │ ──► LLM provider, tools, MCP, files
                      └────────────────────┘
```

### 6.2 Keputusan arsitektur (ADR ringkas)

| ADR | Keputusan | Alasan | Alternatif |
|---|---|---|---|
| 001 | **Bridge lokal (Bun) di antara browser dan OpenCode** | Menyembunyikan kredensial/token; `Service` hanya Node/Bun; normalisasi & polling event di satu tempat; CORS/auth server untuk browser belum pasti; kunci TTS cloud tidak bocor ke browser | Browser langsung ke `opencode serve` (lebih sederhana tapi risiko CORS/auth/event) |
| 002 | `@opencode/client` + `opencode serve`, bukan `@opencode/sdk` embedded | Pengguna bisa tetap memakai TUI/IDE pada server yang sama | SDK embedded (tanpa listener, tapi sesi terpisah dari TUI) |
| 003 | Avatar = SVG + CSS/WAAPI di balik `AvatarRenderer` | Cepat, ringan, mudah diganti | Rive, Lottie, Live2D, three-vrm (v0.3) |
| 004 | XState v5 untuk orkestrasi voice/avatar | State paralel & prioritas eksplisit, mudah diuji | Reducer manual |
| 005 | Web Speech API untuk STT/TTS di MVP | Tanpa biaya/setup | Whisper/Piper/ElevenLabs (v0.2) |
| 006 | Protokol WS JSON tervalidasi zod (paket `protocol` bersama) | Kontrak tunggal front-back | tRPC/GraphQL |

### 6.3 Stack & struktur repo

- Runtime: **Bun ≥ 1.2** (selaras dokumentasi v2 yang memakai `bun add`). Node 22 sebagai fallback yang harus tetap jalan untuk web app.
- Bahasa: TypeScript strict. Web: React 18 + Vite. Bridge: Hono + `ws`. Validasi: zod. State: XState v5. Test: Vitest, Playwright. Lint: Biome atau ESLint+Prettier (pilih satu, catat di ADR).

```
codepet/
├─ AGENTS.md                      # aturan kerja agent (lihat §15)
├─ PRD.md
├─ docs/
│  ├─ opencode-v2-findings.md     # hasil Milestone 0 (WAJIB)
│  ├─ adr/                        # ADR-001.. dst
│  └─ fixtures/opencode-events/   # rekaman event nyata (*.jsonl)
├─ packages/
│  ├─ protocol/                   # zod schema pesan WS + tipe AgentState/AvatarState
│  └─ avatar/                     # AvatarRenderer interface + BiboSvgRenderer + state→pose map
├─ apps/
│  ├─ bridge/
│  │  └─ src/{server.ts,ws.ts,opencode/{client.ts,pump.ts,poller.ts,normalize.ts,allowlist.ts},
│  │          state/{reducer.ts,feed.ts},speech/{summarize.ts,parse-speak.ts},
│  │          safety/risk.ts,store.ts,config.ts}
│  └─ web/
│     └─ src/{main.tsx,App.tsx,ws/,orchestrator/,voice/{stt.ts,tts.ts,commands.ts},
│             ui/{Chat,Feed,ApprovalCard,FormCard,Settings,StatusBar}.tsx,avatar/}
├─ tools/mock-opencode/           # server palsu v2 untuk tes (replay fixture)
└─ package.json (workspaces)
```

### 6.4 Normalisasi event (bridge)

Semua event OpenCode diubah menjadi `AgentSignal` internal (tipe di `packages/protocol`):

```ts
type AgentSignal =
  | { t: "exec.started";  sessionID: string }
  | { t: "exec.ended";    sessionID: string; outcome: "success" | "failed" | "interrupted"; error?: string }
  | { t: "text.delta";    sessionID: string; messageID: string; text: string }
  | { t: "text.done";     sessionID: string; messageID: string; text: string }
  | { t: "tool.started";  sessionID: string; callID: string; tool: string; input?: unknown }
  | { t: "tool.ended";    sessionID: string; callID: string; tool: string; ok: boolean; output?: string }
  | { t: "permission.asked";  request: PermissionRequestView }
  | { t: "permission.replied"; requestID: string; decision: string }
  | { t: "form.asked";    form: FormView }
  | { t: "session.updated"; sessionID: string; title?: string }
  | { t: "conn"; status: "connected" | "reconnecting" | "down" }
```

Aturan normalisasi:
- `unwrap(e) = e.data ?? e` (payload v2 selalu di `data`; toleran bila server mengirim bentuk lain).
- Event tak dikenal → log level debug + simpan ke ring buffer 500 event (untuk debug & pembuatan fixture), **jangan** throw.
- Pemetaan nama event nyata → `AgentSignal` ditulis sebagai **tabel data** di `normalize.ts` (bukan if-else tersebar) dan diperbarui sesuai hasil spike.
- Sinyal dari polling dan dari event **didedupe** per (`sessionID`, `kind`, `id`) agar karakter tidak "berkedip" dobel.

### 6.5 Reconnect & rekonsiliasi

1. Event pump: `while(running){ try { for await (e of client.event.subscribe()) queue.push(e) } catch {} ; backoff }`. Backoff 500 ms → 1 s → 2 s → 5 s → 10 s (maks), reset setelah koneksi stabil 30 s.
2. Konsumen membaca dari `queue` terbatas (maks 1000; jika penuh, buang event `text.delta` terlama dan tandai `gap=true`).
3. Setelah (re)connect → **rekonsiliasi**: panggil `session.active`, `permission.request.list`, `form.list`, dan `session.message.list` (halaman terbaru) untuk membangun ulang `AgentState`. Kirim ke web `agent.state` penuh.
4. Status koneksi dikirim ke web (`bridge.status`) → avatar `offline` bila `down`.

### 6.6 Protokol WebSocket Web ↔ Bridge

Semua pesan: `{ v: 1, id?: string, type: string, ...payload }`, divalidasi zod di kedua sisi. Handshake: `ws://127.0.0.1:<port>/ws?token=<token>`; token dibuat saat bridge start, ditulis ke stdout & `.codepet/token`, dan diinjeksi ke web lewat endpoint `GET /bootstrap` (hanya dari origin yang diizinkan).

**Web → Bridge**

| type | payload | Efek |
|---|---|---|
| `hello` | `{clientVersion}` | bridge balas `bridge.ready` + `agent.state` |
| `user.message` | `{text, source:"chat"\|"voice", locale, delivery?:"queue"\|"steer"}` | `session.prompt` |
| `agent.interrupt` | `{}` | `session.interrupt` |
| `permission.reply` | `{requestID, decision:"once"\|"reject"\|"always", via:"click"\|"voice"}` | validasi risiko lalu reply ke OpenCode |
| `form.reply` | `{formID, answer}` | `session.form.reply` |
| `form.cancel` | `{formID}` | `session.form.cancel` |
| `session.select` | `{directory, sessionID?}` | buat/lanjutkan sesi |
| `session.list` | `{directory?}` | daftar sesi |
| `settings.update` | `{...}` | simpan pengaturan |
| `speech.request_summary` | `{messageID}` | picu ringkasan ulang |

**Bridge → Web**

| type | payload |
|---|---|
| `bridge.ready` | `{bridgeVersion, opencode:{status:"up"\|"down", version?}, directory, sessionID?, recentDirs[]}` |
| `bridge.status` | `{opencode:"up"\|"reconnecting"\|"down"}` |
| `agent.state` | `{phase:"idle"\|"busy"\|"awaiting"\|"error", busyKind?:"reading"\|"editing"\|"running"\|"searching"\|"delegating"\|"thinking", pending:{permissions[],forms[]}}` |
| `agent.text.delta` / `agent.text.final` | `{messageID, text}` (teks tampilan, tag `<speak>` sudah dibuang) |
| `agent.speak` | `{id, text, priority:"normal"\|"urgent", kind:"ack"\|"summary"\|"ask"\|"error"}` |
| `feed.item` | `{id, kind:"tool"\|"shell"\|"note", title, detail?, status:"running"\|"ok"\|"fail", ts}` |
| `permission.requested` | `{requestID, tool, title, patterns[], preview?, risk:"low"\|"medium"\|"high", voiceAllowed:boolean}` |
| `form.requested` | `{formID, title, fields[]}` |
| `diff.ready` | `{sessionID, files:[{path, additions, deletions}]}` |
| `error` | `{code, message, recoverable}` |

---

## 7. Kebutuhan Fungsional (FR)

Prioritas: **P0** = wajib MVP, **P1** = MVP bila waktu cukup, **P2** = pasca-MVP.

### 7.1 Koneksi & sesi

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-001 | P0 | Bridge menemukan/menjalankan server OpenCode v2 (`Service.ensure()` atau `OPENCODE_URL` manual) | Start tanpa server → bridge menjalankannya; jika gagal, UI menampilkan error actionable ("jalankan `opencode serve`") |
| FR-002 | P0 | Cek `server.info`; tolak jika bukan v2.x | Versi tidak cocok → banner error, input dinonaktifkan |
| FR-003 | P0 | Pilih direktori proyek (input teks + riwayat 10 terakhir) lalu buat sesi (`location.directory`) atau lanjutkan sesi terakhir | Direktori tersimpan; restart bridge melanjutkan sesi yang sama bila masih ada |
| FR-004 | P1 | Daftar sesi proyek (`session.list`) dan ganti sesi | Pilih sesi → riwayat pesan terakhir termuat (maks 50) |
| FR-005 | P0 | Indikator koneksi (hijau/kuning/merah) dan avatar `offline` bila putus | Matikan server OpenCode → ≤ 3 s status merah & avatar offline; nyalakan → pulih otomatis ≤ 15 s |
| FR-006 | P1 | Tampilkan agent & model aktif (read-only di MVP) | Terlihat di status bar |

### 7.2 Input

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-010 | P0 | Chat teks: Enter kirim, Shift+Enter baris baru, riwayat panah ↑ | Pesan muncul sebagai bubble pengguna dan terkirim via `session.prompt` |
| FR-011 | P0 | Push-to-talk: tahan tombol mic **atau** tahan Spasi (saat fokus bukan di textarea) | Lepas tombol → transkrip final dikirim (atau ditaruh di kotak input bila "konfirmasi sebelum kirim" aktif) |
| FR-012 | P0 | Transkrip sementara (interim) tampil real-time sebagai caption | Teks interim muncul ≤ 300 ms setelah bicara |
| FR-013 | P0 | Jika STT tak didukung/ditolak izin → fallback teks tanpa error mentah | Banner "Mic tidak tersedia", chat tetap berfungsi |
| FR-014 | P0 | Saat agent sibuk, pesan baru ditawarkan: **Antre** (default) / **Sela (steer)** | `delivery: "queue"` (antre) / `"steer"` (sela, juga default prompt); default aman = antre |
| FR-015 | P0 | Interrupt: tombol Stop, tombol Esc, dan suara "berhenti/stop/batal" | `session.interrupt` terpanggil; avatar kembali ke `idle`/`confused` ≤ 500 ms; TTS berhenti seketika |
| FR-016 | P1 | Lampirkan file/path dengan mengetik `@path` (autocomplete via `fs.find`) | Menambah `files[]` pada prompt |

### 7.3 Output

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-020 | P0 | Streaming teks jawaban agent ke bubble (markdown ringan, blok kode dengan tombol salin) | Teks muncul bertahap; tag `<speak>` tidak pernah tampil |
| FR-021 | P0 | **Activity feed**: baris per tool/shell (ikon, judul ringkas, status running/ok/fail) | Setiap tool yang dijalankan OpenCode muncul ≤ 500 ms |
| FR-022 | P0 | Ringkasan lisan (TTS) saat giliran selesai, sesuai verbosity (§9.5–9.6) | ≥ 90% giliran sukses menghasilkan ringkasan ≤ 2 kalimat |
| FR-023 | P0 | Ucapan pendek "ack" saat perintah diterima (mode normal/cerewet) | Terucap ≤ 1 s setelah prompt terkirim |
| FR-024 | P0 | Daftar file berubah setelah giliran selesai (`session.diff`) dengan +/− baris | Tampil di kartu "Perubahan"; kosong → tidak ditampilkan |
| FR-025 | P1 | Klik file di kartu perubahan → tampil diff sederhana (read-only) | Diff unified ditampilkan di panel |
| FR-026 | P2 | Revert perubahan giliran terakhir (`session.revert.*`) dengan konfirmasi klik | v0.2 |

### 7.4 Avatar

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-030 | P0 | Avatar Bibo menampilkan 10 state (§8.1) dengan transisi halus | Setiap state terlihat berbeda; tes visual menangkap tiap state |
| FR-031 | P0 | State dihitung dari **prioritas** sinyal (§8.2) | Tes unit untuk semua kombinasi prioritas |
| FR-032 | P0 | Pose kerja berbeda per jenis tool (membaca/mengedit/menjalankan/mencari) | Event `tool.started` jenis edit → pose "mengetik" |
| FR-033 | P0 | Animasi bicara (overlay Berbicara) saat TTS aktif (§9.3): mulut parametris + busur suara + lampu antena 2 Hz (CHARACTER.md §6.7) | Animasi aktif hanya saat TTS aktif; mulut tertutup ≤ 100 ms setelah TTS berhenti |
| FR-034 | P0 | Menghormati `prefers-reduced-motion` | Mode reduced: tanpa gerak besar, ganti dengan perubahan ekspresi statis |
| FR-035 | — | **DIHAPUS** (2026-10-13, keputusan owner): digantikan pemilih mode Chat \| Ngobrol (ADR-avatar-ui-redesign keputusan d) | — |
| FR-036 | P1 | Idle behaviors acak (berkedip tiap 3–6 s, tangan melayang naik-turun, melirik acak, tidur setelah 120 s tanpa aktivitas) | Tidak mengalahkan state lain |

### 7.5 Izin, pertanyaan, error

| ID | Prioritas | Kebutuhan | Kriteria penerimaan |
|---|---|---|---|
| FR-040 | P0 | Permission request → kartu persetujuan + avatar `asking` + ucapan pertanyaan | Muncul ≤ 1 s sejak request tercatat (event **atau** polling) |
| FR-041 | P0 | Balasan: **Izinkan sekali**, **Tolak**, (**Selalu izinkan** hanya via klik, dengan peringatan) | Reply sampai ke OpenCode; avatar lanjut `working` |
| FR-042 | P0 | Klasifikasi risiko & aturan persetujuan suara (§10) | Risiko tinggi: tombol suara dinonaktifkan; ucapan "ya" ditolak dengan penjelasan |
| FR-043 | P0 | Form/pertanyaan dari agent → kartu form + ucapan; jawaban via klik/ketik; jawaban suara untuk pilihan tunggal | `session.form.reply` berhasil; form kedaluwarsa/dibatalkan ditangani |
| FR-044 | P0 | Error terklasifikasi: koneksi, auth, timeout, eksekusi gagal, provider/model error | Pesan manusiawi + avatar `confused`; tidak ada stack trace mentah di UI |
| FR-045 | P1 | Permission menunggu > 60 s → ingatkan sekali secara lisan; **tidak pernah auto-approve** | Tes dengan fake timer |

### 7.6 Pengaturan

| ID | Prioritas | Kebutuhan |
|---|---|---|
| FR-050 | P0 | Verbosity: Senyap / Normal / Cerewet (§9.6) |
| FR-051 | P0 | STT: bahasa (`id-ID`/`en-US`), mode kirim (otomatis / konfirmasi), tombol PTT |
| FR-052 | P0 | TTS: pilih suara (daftar `speechSynthesis.getVoices()`), kecepatan (0.7–1.4), pitch, volume, tombol uji suara |
| FR-053 | P0 | Mute global (ikon pengeras suara) — menghentikan TTS dan mem-bypass ucapan |
| FR-054 | P1 | Kamus koreksi istilah teknis STT (mis. "reakt"→"React") dapat diedit |
| FR-055 | P1 | Tema (terang/gelap/otomatis), ukuran avatar |
| FR-056 | P0 | Semua pengaturan persisten (bridge `store.json` untuk sisi server, `localStorage` untuk preferensi UI) |

---

## 8. Avatar & State Machine

### 8.1 Model state

Tiga region **paralel** (XState `type: "parallel"`):

| Region | State | Sumber |
|---|---|---|
| `link` | `offline` · `online` | status bridge/OpenCode |
| `agent` | `idle` · `thinking` · `working{reading,editing,running,searching,delegating}` · `awaiting{permission,form}` · `error` | `AgentSignal` |
| `voice` | `mic{off,armed,listening,finalizing}` · `speech{silent,speaking}` | STT/TTS lokal |

Transient (otomatis kembali): `celebrate` (±3 s setelah sukses, CHARACTER.md §6.5), `acknowledge` (±0,6 s setelah perintah diterima).

**State avatar yang terlihat (10):** `offline`, `sleeping`, `idle`, `listening`, `thinking`, `working`, `speaking`, `asking`, `celebrate`, `confused`.

### 8.2 Prioritas penentuan pose (tinggi → rendah)

1. `offline` (link down)
2. `confused` (agent.error atau kegagalan eksekusi, bertahan 4 s lalu turun)
3. `asking` (menunggu izin/form)
4. `speaking` (TTS aktif)
5. `listening` (mic aktif)
6. `working.*` (tool berjalan)
7. `thinking` (eksekusi aktif tanpa tool)
8. `celebrate` (transient setelah sukses)
9. `idle`
10. `sleeping` (idle > 120 s)

Catatan: `speaking` adalah **overlay** (mulut parametris + busur suara + lampu 2 Hz, CHARACTER.md §6.7/§11) — bukan nilai `AvatarPose`; ia ditumpuk di atas pose dasar (mis. `idle` atau `working`) lewat `setSpeechLevel`. Fungsi `derivePose(ctx)` murni, diuji dengan tabel kasus.

### 8.3 Pemetaan sinyal → state

| Sinyal | Efek |
|---|---|
| `conn: down` | `link=offline` |
| `conn: connected` | `link=online`; rekonsiliasi |
| mic mulai | `voice.mic=listening` (TTS dibatalkan: barge-in) |
| prompt terkirim | `acknowledge` lalu `agent=thinking` |
| `exec.started` / `session.active` memuat sesi ini | `agent=thinking` |
| `tool.started` | `agent=working.<kind>` (kind dari nama tool, §8.3a) |
| `tool.ended` | kembali `thinking` bila tak ada tool lain berjalan |
| `permission.asked` / `form.asked` | `agent=awaiting.*` |
| `permission.replied` / form selesai | `agent=thinking` |
| `exec.ended(success)` | `agent=idle` + `celebrate` |
| `exec.ended(failed)` | `agent=error` → `confused` |
| `exec.ended(interrupted)` | `agent=idle` (tanpa celebrate) |
| `agent.speak` mulai/selesai | `voice.speech=speaking/silent` |

**8.3a Pemetaan nama tool → `busyKind`** (tabel data; nama TERVERIFIKASI M0 dari fixture
— nama berasal dari `session.tool.input.started → data.name`; fallback `thinking`):

| Kelompok | Nama nyata (v2.0.16) | busyKind | Properti visual |
|---|---|---|---|
| Membaca | read | `reading` | kaca pembesar, mata menyapu |
| Mengedit | edit | `editing` | mengetik di papan ketik kecil |
| Menjalankan | shell, execute | `running` | terminal kecil + badge `>_` |
| Bertanya | question | `asking` (via `form.created`) | badge tanya kuning |
| Mencari web | webfetch, websearch | `searching` | globe/teropong |
| Delegasi | task, subagent | `delegating` | menunjuk ke robot mini |
| MCP/lainnya | `<server>_<tool>` | `working` generik | ikon roda gigi |

### 8.4 Spesifikasi karakter "Bibo" (robot mungil, SVG)

**Sumber kebenaran: `CHARACTER.md` (+ `docs/reference/shots/`).** Bagian ini hanya
meringkas; bila bertentangan dengan CHARACTER.md, CHARACTER.md yang menang
(keputusan ADR-avatar-ui-redesign).

- Robot putih bulat: badan squircle putih kebiruan, layar wajah gelap (visor)
  dengan mata mint menyala, mulut kecil parametris, pipi pink, antena + lampu
  status, dua tangan melayang terpisah di depan keyboard.
- 9 pose (`idle`, `thinking`, `working`, `asking`, `celebrate`, `confused`,
  `sleeping`, `listening`, `offline`) + 6 varian `working`
  (`typing`, `reading`, `running`, `searching`, `delegating`, `generic`) +
  overlay `speaking` (bukan nilai pose).
- Animasi tiga lapisan via Web Animations API; semua angka waktu terpusat di
  `packages/avatar/src/timing.ts`. Galeri uji: `/dev/avatar`.
- Spesifikasi lama (badge biru sudut, tanpa mulut, voice-pulse badan, 14 pose
  bertitik) **tidak berlaku lagi** sejak redesign 2026-10-12.

### 8.5 Antarmuka renderer (agar bisa ditukar ke Rive/Live2D/VRM)

Kontrak `AvatarRenderer` = CHARACTER.md §12, disalin ringkas di sini
(lihat `packages/avatar/src/types.ts` untuk sumber kebenaran kode):

```ts
export type AvatarPose =
  | "idle" | "thinking" | "working" | "asking" | "celebrate"
  | "confused" | "sleeping" | "listening" | "offline";
export type WorkingVariant =
  | "typing" | "reading" | "running" | "searching" | "delegating" | "generic";
export type AvatarMood = "neutral" | "happy" | "wary";

export interface AvatarRenderer {
  mount(el: HTMLElement, opts: {
    theme: "light" | "dark"; reducedMotion: boolean; seed?: number;
    characterName: string;                       // wajib (aria-label, tanpa hardcode)
    getAriaLabel?: (pose: AvatarPose, variant?: WorkingVariant) => string;
  }): void;
  setPose(pose: AvatarPose, opts?: { variant?: WorkingVariant; durationMs?: number }): void;
  setSpeechLevel(level: number): void;  // 0..1; overlay speaking (mulut parametris)
  setMicLevel(level: number): void;     // 0..1; lampu antena ikut level saat Mendengar (ADR-009)
  setLook(x: number, y: number): void;
  setMood(mood: AvatarMood): void;
  react(kind: "hello" | "nod" | "perk" | "startle" | "shrug" | "thanks" | "poke"): void;
  setTheme(theme: "light" | "dark"): void;
  setReducedMotion(on: boolean): void;
  pause(): void; resume(): void;
  destroy(): void;
}
```

Aturan: logika bisnis **tidak boleh** tahu detail SVG; hanya memanggil `AvatarRenderer`.
Paket avatar mendefinisikan tipenya sendiri (tidak mengimpor dari `@codepet/protocol`).
`BotRenderer` memakai Web Animations API (tanpa library animasi berat).
Atribut tes: `svg#bot[data-pose][data-variant][data-mood][data-speaking]`.

---

## 9. Suara & Ucapan

### 9.1 Speech-to-Text (STT)

**MVP:** Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`).
- Bahasa default `id-ID`; `interimResults=true`; `continuous=false`; `maxAlternatives=3` (ambil terbaik, simpan alternatif untuk koreksi).
- Mode: **PTT** (default), **toggle** (klik mulai, klik selesai), **auto-submit**: kirim setelah hasil final + jeda 600 ms (konfigurasi).
- Dukungan browser: Chrome/Edge (utama). Safari parsial, Firefox tidak. Wajib deteksi fitur; jika tidak ada → mode teks.
- **Catatan privasi:** di Chrome, audio Web Speech API diproses layanan eksternal. Tampilkan catatan ini di onboarding & pengaturan. Tidak menyimpan audio.
- Post-proses: normalisasi spasi/huruf besar, kamus istilah teknis (FR-054), penggantian "titik/koma/baris baru" **tidak** dilakukan (ini percakapan, bukan dikte kode).

**v0.2:** `MediaRecorder` → bridge `/stt` → Whisper (whisper.cpp server atau API kompatibel OpenAI). Antarmuka `SttEngine { start(); stop(); onInterim; onFinal; onError }` agar engine dapat ditukar.

### 9.2 Perintah suara lokal (voice shortcuts)

Ditangani **di klien sebelum** teks dikirim ke OpenCode. Pencocokan memakai **tata bahasa tertutup** (kecocokan penuh setelah normalisasi, bukan substring) dan hanya aktif pada konteks yang relevan.

| Frasa (ID) | Frasa (EN) | Konteks | Aksi |
|---|---|---|---|
| "berhenti", "stop", "batal", "diam dulu" | "stop", "cancel" | agent sibuk / TTS aktif | interrupt + hentikan TTS |
| "ya", "boleh", "izinkan", "lanjut" | "yes", "allow", "go ahead" | ada permission **risiko low/medium** | reply `once` |
| "tidak", "jangan", "tolak" | "no", "deny", "reject" | ada permission apa pun | reply `reject` |
| "ulangi" | "repeat" | ada ucapan terakhir | ucapkan ulang |
| "senyap" / "bicara lagi" | "mute" / "unmute" | kapan saja | toggle mute |

Aturan keselamatan: (1) "selalu izinkan" **tidak ada** versi suara; (2) permission **risiko tinggi** tidak menerima "ya" suara (§10); (3) di luar konteks, frasa seperti "ya" diteruskan sebagai teks biasa ke agent (mis. menjawab pertanyaan agent), bukan ke aksi lokal; (4) setiap aksi lokal menampilkan toast "Perintah suara: <aksi>" agar transparan.

### 9.3 Text-to-Speech (TTS) & animasi bicara

**MVP:** `speechSynthesis`.
- Pilih suara `id-ID` bila ada, jika tidak, suara default + peringatan.
- **Antrean ucapan**: prioritas `urgent` (permission/error) menyela `normal` (ringkasan). Potong per kalimat (maks ±180 karakter per utterance) agar mudah dibatalkan.
- Pembatalan: `speechSynthesis.cancel()` saat interrupt, barge-in, mute, atau antrean usang (jawaban lama setelah prompt baru dikirim).
- Teks sanitasi sebelum diucapkan: buang markdown/blok kode/URL panjang; path → "file `App.tsx`" (hanya nama file); angka besar dibulatkan; singkatan umum dieja (opsional).
- **Animasi bicara (MVP, tanpa analisis audio):** "bicara" ditampilkan lewat overlay Berbicara: mulut parametris (m-open) + busur suara + lampu antena 2 Hz (CHARACTER.md §6.7). Saat `onstart`→`onend`, jalankan generator level suara: `level = clamp(0.25 + 0.6*|sin(2π·f·t)| + noise, 0, 1)`, `f ≈ 3.5–5 Hz` acak per kata; pada event `boundary` beri "aksen" (level +0,2 selama 80 ms). Saat jeda antar-kalimat level turun ke 0; `setSpeechLevel(0)` ≤ 100 ms saat stop/cancel. `setSpeechLevel` dipanggil ≤ 30 Hz via `requestAnimationFrame`.
- **v0.2:** untuk TTS berbasis audio (Piper/ElevenLabs/dll) pakai `AnalyserNode` (RMS → `level`), tanpa mengubah `AvatarRenderer`.

### 9.4 Barge-in & echo

- Mic aktif (PTT ditekan) → **segera** `speechSynthesis.cancel()`.
- Saat TTS bicara, mic **tidak** otomatis hidup (hindari pengenalan suara sendiri). PTT manual tetap diizinkan.
- Pengaturan "mode headphone" (P1) mengizinkan mic hands-free saat TTS bicara.

### 9.5 Ringkasan lisan: dari mana teksnya?

Tujuan: karakter berbicara **singkat dan relevan**, bukan membaca seluruh output/kode.

Strategi berlapis (urutan coba):

1. **Protokol `<speak>` (utama):** sesi diberi instruksi agar jawaban akhir ditutup dengan blok `<speak>…</speak>` berisi 1–2 kalimat Bahasa Indonesia sehari-hari, tanpa kode/path panjang.
   - Cara menyuntik instruksi: (a) `experimental.session.instructions.entry.put` (key `codepet.voice`) — ✅ TERVERIFIKASI M0 (PUT → 204, `instructions.updated` terkirim), (b) berkas `AGENTS.md`/instruksi proyek (snippet di Lampiran A), (c) `metadata`/prefix prompt **hanya sebagai opsi terakhir**.
   - `parse-speak.ts` mengekstrak blok, menghapusnya dari teks tampilan, dan mengirim `agent.speak{kind:"summary"}`.
2. **`session.generate` (fallback):** bila giliran sukses tanpa tag `<speak>`, panggil `POST /api/session/{id}/generate` dengan prompt ringkas ("Ringkas hasil terakhir dalam maksimal 2 kalimat Bahasa Indonesia untuk diucapkan, tanpa kode"). Tidak mengubah riwayat sesi. Batasi: maks 1 panggilan per giliran, timeout 8 s, dapat dimatikan (hemat biaya).
3. **Heuristik lokal (fallback terakhir):** ambil 1–2 kalimat pertama teks assistant yang bersih dari kode; bila kosong → "Sudah selesai." / "Selesai, ada {n} file yang berubah." (dari `diff`).

Konfigurasi: `speech.summaryMode = "tag" | "generate" | "heuristic" | "auto"` (default `auto` = urutan di atas).

### 9.6 Tingkat kecerewetan

| Mode | Ack saat terima perintah | Ucapan progres | Ringkasan akhir | Permission/form/error |
|---|---|---|---|---|
| **Senyap** | — | — | — (hanya bunyi "ting" opsional) | **tetap diucapkan** (urgent) |
| **Normal** (default) | ya ("Oke, kukerjakan") | — | ya | ya |
| **Cerewet** | ya, bervariasi | "Aku lagi baca file X…" maks 1 per 8 s | ya + saran langkah berikut | ya |

Varian kalimat ack/selesai/bingung disimpan di `phrases.id.ts` (≥ 5 varian per jenis, dipilih acak tanpa pengulangan berturut-turut).

---

## 10. Izin & Keselamatan Aksi

### 10.1 Klasifikasi risiko (`safety/risk.ts`)

Input: `PermissionRequestView` (tool, patterns, metadata/perintah). Output: `low | medium | high`. Field nyata (M0): `{id, sessionID, action, resources[], save?, source?{type,messageID,id}}` — field `message` tidak selalu ada, jadi klasifikasi memakai `action+resources`.

| Risiko | Contoh | Persetujuan suara | Persetujuan klik |
|---|---|---|---|
| **low** | baca file, glob, grep, list direktori | ✅ "ya" | ✅ |
| **medium** | edit/tulis file dalam proyek, `npm test`, `git status/diff/log` | ✅ "ya" | ✅ |
| **high** | `rm`/`rmdir`/`del`, `sudo`, `chmod -R`, `git push`/`reset --hard`/`clean`/`rebase`, `curl … \| sh`, penulisan di luar direktori proyek, instal paket global, `DROP`/`TRUNCATE`, akses `.env`/kunci/SSH, perintah dengan `>` ke berkas sistem | ❌ | ✅ + dialog konfirmasi ("Ketik OK") |

Aturan:
- Klasifikasi **fail-safe**: jika tidak yakin → naikkan satu tingkat.
- Pola berbahaya didefinisikan di `risk-patterns.ts` (regex + tes tabel ≥ 40 kasus, termasuk upaya pengelabuan: spasi/quote/variabel/`$(...)`/backtick).
- **Selalu izinkan (always):** hanya via klik, tidak untuk risiko high, dengan teks peringatan; bridge menolak `always` bila `via:"voice"` atau `risk:"high"`.
- Tidak ada auto-approve. Tidak ada approval berbasis timeout.
- Ucapan permintaan izin menyebut **apa** dan **di mana** secara ringkas: "Aku mau jalankan perintah `npm test`. Boleh?" (perintah panjang dipotong; detail penuh di kartu).

### 10.2 Bridge sebagai penjaga

- Bridge memvalidasi setiap `permission.reply`: jika `via:"voice"` dan `risk:"high"` → balas `error{code:"VOICE_NOT_ALLOWED"}`.
- Bridge mencatat (log lokal, tanpa data rahasia) setiap keputusan: waktu, requestID, risiko, via.
- Bridge **tidak** pernah menjalankan perintah shell sendiri; hanya meneruskan pesan ke OpenCode.

---

## 11. Spesifikasi UX / UI

### 11.1 Layout (dua mode, redesign 2026-10-12)

TopBar 68 px: logotype, chip folder proyek, chip status koneksi, pemilih mode
**Chat | Ngobrol**, tombol bisukan, tombol pengaturan. Tema default terang.

**Mode Chat** (desktop ≥ 1024 px): kartu kiri 360 px (panggung Bibo ~250 px +
latar gradasi, chip aktivitas, judul status, mic 72 px, "Hentikan Bibo") +
kartu kanan fleksibel (header sesi + chip agent, gelembung pengguna/agent,
kartu aktivitas tool, ChangesCard, komposer mic + kirim). ApprovalCard/FormCard
menempel di atas komposer.

**Mode Ngobrol**: hanya topbar minimal + Bibo ~400 px di tengah + mic 88 px di
bawah. Bubble ucapan di kanan atas kepala (pop 180 ms, maks 3 baris, fade
1,5 dtk); equalizer 3 batang mengikuti speechLevel saat TTS; caption interim
di atas mic; saat izin Bibo mengecil ~290 px + popup ApprovalCard di bawahnya.

- Mobile/sempit (< 768 px): Mode Chat bertumpuk; Bibo di atas (35% tinggi),
  popup izin menjadi bottom sheet.
- **Mini mode (FR-035): DIHAPUS** (2026-10-13, keputusan owner) — digantikan
  pemilih mode Chat | Ngobrol.

### 11.2 Komponen

| Komponen | Perilaku kunci |
|---|---|
| `StatusBar` | titik status koneksi, versi OpenCode, direktori (klik → ganti), agent/model, tombol pengaturan & mute |
| `AvatarStage` | merender avatar, caption (transkrip interim / teks yang sedang diucapkan), label state ("Mengedit…") |
| `MicButton` | tahan = bicara; ring animasi level suara (opsional); status izin mic |
| `ChatPanel` | bubble pengguna/agent, markdown ringan, blok kode + salin, auto-scroll yang bisa dijeda |
| `ActivityFeed` | baris tool ringkas dengan ikon & status; klik untuk detail (input/output terpotong 2 KB) |
| `ChangesCard` | daftar file + diff ringkas |
| `ApprovalCard` | judul aksi, perintah/pola, **badge risiko**, tombol [Tolak] [Izinkan sekali] [Selalu…]; petunjuk "Ucapkan 'ya' / 'tolak'" hanya bila `voiceAllowed` |
| `FormCard` | render field generik (teks, pilihan tunggal/ganda, boolean) dari skema form v2 |
| `Settings` | §7.6 |
| `Onboarding` | cek mic, uji suara, pilih direktori, catatan privasi STT |

### 11.3 Pintasan keyboard

`Space` (tahan, fokus bukan di input) = PTT · `Esc` = interrupt/tutup kartu · `Ctrl/Cmd+Enter` = kirim · `Ctrl/Cmd+M` = mute · `Ctrl/Cmd+K` = ganti sesi/direktori · `?` = bantuan.

### 11.4 Copywriting (Bahasa Indonesia, nada ramah, kalimat pendek)

| Situasi | Contoh |
|---|---|
| Ack | "Oke, kukerjakan." · "Siap, aku mulai ya." |
| Berpikir | "Hmm, aku pikir dulu…" |
| Selesai | "Beres! Aku sudah menambah validasi di LoginForm, dua file berubah." |
| Minta izin | "Aku mau jalankan `npm test`. Boleh?" |
| Izin berisiko | "Ini perintah berbahaya: hapus folder `dist`. Tolong konfirmasi lewat layar ya." |
| Error | "Aduh, ada yang gagal: {alasan singkat}. Mau kucoba lagi?" |
| Offline | "Aku kehilangan kontak dengan OpenCode. Coba cek server-nya ya." |

### 11.5 Aksesibilitas

- Semua ucapan juga muncul sebagai teks (caption). Daerah `aria-live="polite"` untuk status & transkrip; `assertive` untuk permission.
- Fokus keyboard terkelola; kartu persetujuan menangkap fokus; kontras ≥ WCAG AA.
- `prefers-reduced-motion` dan `prefers-color-scheme` dihormati.
- Avatar punya `role="img"` + `aria-label` dinamis dari `character.name` + i18n (mis. "Bibo: sedang mengedit" — nama tidak di-hardcode di komponen).

---

## 12. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan | Target / cara ukur |
|---|---|---|---|
| NFR-PERF-01 | Latensi | Event OpenCode → perubahan pose avatar | p95 < 300 ms (diukur di tes e2e dengan timestamp event) |
| NFR-PERF-02 | Latensi | Akhir ucapan pengguna → `session.prompt` terkirim | < 800 ms (mode auto-submit) |
| NFR-PERF-03 | Latensi | Teks siap diucapkan → suara mulai (TTS browser) | < 500 ms |
| NFR-PERF-04 | Render | Animasi avatar | ≥ 55 fps pada laptop menengah; CPU idle < 5%, aktif < 15% |
| NFR-PERF-05 | Ukuran | Bundle web (gzip, tanpa font) | < 300 KB |
| NFR-PERF-06 | Memori | Bridge | < 150 MB RSS setelah 1 jam sesi |
| NFR-REL-01 | Keandalan | Bridge pulih dari putusnya SSE | Reconnect otomatis, tanpa restart; state direkonsiliasi (§6.5) |
| NFR-REL-02 | Keandalan | Event tak dikenal / payload berubah | Tidak crash; tercatat; fitur degradasi anggun |
| NFR-SEC-01 | Keamanan | Bridge hanya listen `127.0.0.1`; cek `Origin`; token acak per start untuk WS | Tes: koneksi tanpa token/origin salah ditolak |
| NFR-SEC-02 | Keamanan | Rahasia (password/token OpenCode, kunci TTS) tidak pernah dikirim ke browser | Audit kode + tes |
| NFR-SEC-03 | Keamanan | Log tidak memuat isi `.env`, kunci API, token | Redaksi pola rahasia; tes |
| NFR-SEC-04 | Keamanan | **Allowlist endpoint OpenCode**; larang grup `credential`, `integration`, `pty`, `persistentPty`, `fs.write`, `config.update` | Tes unit `allowlist.ts` + lint aturan impor |
| NFR-PRIV-01 | Privasi | Tidak menyimpan audio; transkrip hanya di memori/sesi OpenCode; tanpa telemetri default | Review + dokumentasi |
| NFR-A11Y-01 | Aksesibilitas | WCAG AA, keyboard-only dapat dioperasikan | axe-core di CI tanpa pelanggaran serius |
| NFR-I18N-01 | i18n | String UI & frasa ucapan terpisah (`id`, `en`) | Ganti locale tanpa ubah kode |
| NFR-COMPAT-01 | Kompatibilitas | Chrome & Edge terbaru (utama); Firefox/Safari: mode teks + TTS | Matriks uji manual |
| NFR-DX-01 | DX | `bun install && bun run dev` menjalankan bridge + web; `bun run check` = lint+type+test | Terdokumentasi di README |

---

## 13. Strategi Pengujian

### 13.1 Piramida

| Level | Alat | Cakupan wajib |
|---|---|---|
| Unit | Vitest | `normalize` (fixture nyata), `derivePose` (tabel kasus), `risk` (≥ 40 kasus), `parse-speak`, `sanitizeForSpeech`, `voice commands` (konteks & kecocokan penuh), reducer state |
| Kontrak | Vitest + zod | Semua pesan WS valid dua arah; fixture event OpenCode lolos normalizer |
| Integrasi | Vitest + `tools/mock-opencode` | Bridge ↔ mock v2: buat sesi, prompt, replay event, permission, form, interrupt, reconnect, rekonsiliasi |
| E2E | Playwright (Chromium) | STT dipalsukan (inject transkrip), TTS dipalsukan (stub `speechSynthesis`), mock OpenCode; verifikasi urutan state avatar |
| Visual | Playwright screenshot | Tiap pose (14 pose) × tema (2) |
| Aksesibilitas | axe-core | Halaman utama + kartu |
| Uji nyata | manual/skrip | Terhadap OpenCode v2 sungguhan (script `bun run smoke:real`) |

### 13.2 Mock OpenCode v2 (`tools/mock-opencode`)

- Server HTTP kecil yang meniru subset rute `/api/*` yang dipakai (§5.2) dan **mereplay** `docs/fixtures/opencode-events/*.jsonl` dengan penjadwalan waktu.
- Skenario bawaan: `simple-answer`, `edit-files`, `permission-medium`, `permission-high`, `form-question`, `tool-failure`, `stream-drop` (SSE putus di tengah), `silent-events` (tanpa event, hanya polling), `server-down`.

### 13.3 Skenario penerimaan (Gherkin — wajib otomatis di E2E)

```gherkin
Fitur: Perintah suara menjalankan pekerjaan nyata
  Skenario: Perintah suara sukses
    Diberikan OpenCode terhubung dan avatar "idle"
    Ketika pengguna menahan mic dan mengucapkan "tambahkan validasi email"
    Maka avatar menjadi "listening" lalu "thinking"
    Dan prompt "tambahkan validasi email" dikirim ke OpenCode
    Dan saat tool edit berjalan avatar menjadi "working.editing"
    Dan setelah selesai avatar "celebrate" lalu "idle"
    Dan karakter mengucapkan ringkasan ≤ 2 kalimat
    Dan kartu "Perubahan" menampilkan file yang berubah

Fitur: Keselamatan izin
  Skenario: Izin risiko medium via suara
    Diberikan permission "npm test" (risiko medium) pending
    Ketika pengguna mengucapkan "ya"
    Maka reply "once" dikirim dan avatar kembali "working.running"

  Skenario: Izin risiko tinggi tidak bisa via suara
    Diberikan permission "rm -rf dist" (risiko high) pending
    Ketika pengguna mengucapkan "ya"
    Maka tidak ada reply dikirim
    Dan karakter berkata bahwa konfirmasi harus lewat layar
    Dan tombol "Izinkan sekali" membutuhkan konfirmasi "OK"

Fitur: Interupsi
  Skenario: Barge-in
    Diberikan karakter sedang berbicara
    Ketika pengguna menahan mic
    Maka TTS berhenti ≤ 100 ms dan animasi bicara (voice-pulse) berhenti

  Skenario: Stop
    Diberikan agent sibuk
    Ketika pengguna berkata "berhenti"
    Maka session.interrupt dipanggil dan avatar menjadi "idle" ≤ 500 ms

Fitur: Ketahanan
  Skenario: Event stream putus
    Diberikan agent sedang bekerja
    Ketika koneksi event putus 5 detik lalu pulih
    Maka avatar tidak salah menampilkan "idle" selama agent masih aktif
    Dan state direkonsiliasi tanpa duplikat item feed

  Skenario: OpenCode mati
    Ketika server OpenCode berhenti
    Maka dalam ≤ 3 detik avatar "offline" dan input dinonaktifkan dengan pesan jelas

  Skenario: Event diam (silent events)
    Diberikan server tidak mengirim event tool/permission
    Maka polling tetap mendeteksi agent aktif dan permission pending

Fitur: Tanpa mikrofon
  Skenario: STT tidak tersedia
    Maka chat teks tetap berfungsi dan banner "Mic tidak tersedia" tampil
```

### 13.4 Definition of Done (per FR)

Kode + tes lolos (`bun run check`) + dokumentasi singkat bila ada keputusan baru (ADR) + tidak ada `TODO` tanpa isu tercatat + FR terkait ditandai ✅ di `docs/traceability.md`.

---

## 14. Rencana Pengerjaan (Milestone untuk AI Agent)

Kerjakan **berurutan**. Jangan lompat sebelum DoD milestone terpenuhi. Setiap milestone = 1 PR/commit besar yang bisa dijalankan.

### M0 — Spike & Verifikasi OpenCode v2 (WAJIB PERTAMA)

Tujuan: menghapus semua tanda ⚠️ VERIFIKASI dengan bukti.

Tugas:
- [ ] Pasang OpenCode v2 (ikuti `https://opencode.ai/v2/docs/`), catat versi persis (`opencode --version`, `GET /api/info`).
- [ ] Jalankan `opencode serve` (atau `Service.ensure()`), unduh `https://opencode.ai/v2/openapi.json` ke `docs/fixtures/openapi.v2.json`.
- [ ] Skrip `tools/spike/capture-events.ts`: buat sesi, subscribe `client.event.subscribe()` dan **rekam semua event mentah** ke JSONL selama skenario: (1) pertanyaan sederhana, (2) edit file, (3) bash yang memicu permission, (4) pertanyaan/form dari agent, (5) tool gagal, (6) interrupt.
- [ ] Rekam juga hasil polling `session.active`, `permission.request.list`, `form.list`, `session.message.list` pada skenario yang sama untuk membandingkan sinyal.
- [ ] Uji: apakah stream menutup di tengah giliran? apakah `session.idle`/`session.status`/`permission.asked`/`session.next.*` muncul? tulis tabel hasil.
- [ ] Verifikasi: bentuk body `session.permission.reply` dan nilai keputusan; enum `Session.Inbox.Delivery`; field `Permission.Request`; skema `Form.*`; nama tool nyata; ketersediaan `experimental.session.instructions.entry.put`; perilaku `session.generate`; auth (`Service.headers`, pairing) dan CORS bila browser langsung (untuk ADR-001).
- [ ] Tulis `docs/opencode-v2-findings.md` (tabel: pertanyaan → jawaban → bukti/fixture → dampak ke desain) dan perbarui PRD bagian 5.3/8.3a/10.1 bila fakta berbeda.

**DoD M0:** findings lengkap; fixture JSONL ≥ 6 skenario; keputusan final sinyal "selesai/sibuk" (event vs polling) ditulis sebagai ADR-007.

### M1 — Fondasi monorepo + Bridge core

- [ ] Workspace Bun, TS strict, lint/format, `bun run check`.
- [ ] `packages/protocol` (zod: pesan WS, `AgentSignal`, `AgentState`).
- [ ] `apps/bridge`: `config.ts` (env), `allowlist.ts`, `opencode/client.ts` (Service/URL), `pump.ts` (subscribe+reconnect+buffer), `poller.ts`, `normalize.ts` (tabel dari fixture), `state/reducer.ts`, `ws.ts` (token+origin), `store.ts`.
- [ ] `tools/mock-opencode` + skenario replay.
- [ ] Tes unit + integrasi (FR-001..005, NFR-REL-01/02, NFR-SEC-01..04).

**DoD M1:** `bun run dev:bridge` + klien WS uji (skrip CLI) dapat mengirim prompt ke OpenCode nyata **dan** mock, dan menerima `agent.state`, `agent.text.*`, `feed.item`.

### M2 — Web UI teks

- [ ] Vite+React, koneksi WS, `StatusBar`, `ChatPanel`, `ActivityFeed`, `ChangesCard`, `Settings` dasar, onboarding direktori.
- [ ] FR-003, 010, 014, 015, 020, 021, 024, 044, 056.

**DoD M2:** chat penuh tanpa suara & tanpa avatar; e2e skenario `simple-answer` & `edit-files` lolos.

### M3 — Avatar Bibo + state machine

- [ ] `packages/avatar`: `AvatarRenderer`, `BiboSvgRenderer`, SVG sesuai §8.4 (semua ID), CSS/WAAPI.
- [ ] XState orchestrator + `derivePose`.
- [ ] Halaman `/dev/avatar` (galeri 14 pose + slider level suara) untuk uji visual manual.
- [ ] FR-030..036, tes visual & unit prioritas.

**DoD M3:** menjalankan skenario mock → pose berubah sesuai §8.3; tes screenshot disetujui.

### M4 — Suara keluar (TTS) + ringkasan lisan

- [ ] `tts.ts` (antrean, sanitasi, kalimat, cancel), animasi bicara via `setSpeechLevel` (≤30 Hz, overlay mulut parametris — kontrak baru, bukan voice-pulse), `phrases.id.ts` (varian kalimat di `apps/bridge/src/speech/summarize.ts`).
- [ ] Bridge: `parse-speak.ts`, `summarize.ts` (auto: tag → generate → heuristik), injeksi instruksi (§9.5).
- [ ] FR-022, 023, 033, 050, 052, 053.

**DoD M4:** giliran sukses menghasilkan ucapan ≤ 2 kalimat pada ≥ 9/10 uji di OpenCode nyata; verbosity bekerja.

### M5 — Suara masuk (STT) + perintah suara

- [ ] `stt.ts` (Web Speech), PTT, caption interim, auto-submit/konfirmasi, kamus koreksi.
- [ ] `commands.ts` (tata bahasa tertutup, konteks), barge-in.
- [ ] FR-011..013, 015, 051, 054.

**DoD M5:** skenario Gherkin "Perintah suara sukses", "Barge-in", "Stop", "Tanpa mikrofon" lolos.

### M6 — Izin, form, keselamatan

- [ ] `risk.ts` + `risk-patterns.ts` (+ tes ≥ 40 kasus), `ApprovalCard`, `FormCard`, ucapan permintaan, validasi bridge `VOICE_NOT_ALLOWED`.
- [ ] FR-040..045.

**DoD M6:** semua skenario "Keselamatan izin" lolos; audit: tidak ada jalur auto-approve.

### M7 — Polish & rilis MVP

- [ ] Reconnect/rekonsiliasi lengkap, mode silent-events, error matrix, a11y (axe), i18n id/en, reduced motion, tema. (Mini mode dilewati — FR-035 dihapus permanen 2026-10-13.)
- [ ] README (setup 10 menit), `bun run start` satu perintah, `bun run smoke:real`.
- [ ] Traceability FR→tes, CHANGELOG, tag `v0.1.0`.

**DoD M7:** semua P0 ✅; NFR-PERF dan NFR-SEC terukur dan lolos; demo end-to-end direkam.

### Pasca-MVP (urutan saran)
v0.2: Whisper STT → TTS natural + animasi bicara audio-reaktif → switcher sesi → revert → skin. v0.3: wake word → overlay desktop (Tauri) → PWA remote → adapter Rive/Live2D/VRM → plugin pendamping OpenCode v2 (push event lewat RPC plugin).

---

## 15. Aturan Kerja untuk AI Agent (taruh juga di `AGENTS.md`)

```markdown
# AGENTS.md — Bibo

## Aturan utama
1. Target OpenCode **v2**. Baca https://opencode.ai/v2/docs/ dan https://opencode.ai/v2/docs/api
   sebelum menulis kode integrasi. DILARANG memakai paket/dokumen v1
   (@opencode-ai/sdk, https://opencode.ai/docs/..., rute /session/:id/message).
2. Jangan menebak API. Jika endpoint/field/event tidak terdokumentasi atau berbeda dari perilaku
   nyata: tulis di docs/opencode-v2-findings.md, tambahkan fixture, lalu implementasikan berdasarkan bukti.
3. Kerjakan milestone berurutan (PRD §14). Satu milestone = satu PR. Jangan menambah fitur di luar PRD
   tanpa ADR singkat di docs/adr/.
4. Setiap FR/NFR harus punya tes atau bukti. Jalankan `bun run check` sebelum menyatakan selesai.
5. Keamanan: bridge hanya 127.0.0.1; rahasia tidak ke browser; pakai allowlist endpoint (NFR-SEC-04);
   tidak pernah memanggil grup credential/integration/pty/config-update; tidak ada auto-approve izin.
6. Event OpenCode diperlakukan sebagai tidak dapat dipercaya penuh: normalisasi toleran, jangan crash,
   jangan hanya bergantung pada satu jenis event (PRD §5.3).
7. Logika bisnis tidak boleh bergantung pada detail SVG; gunakan AvatarRenderer.
8. String UI/ucapan di file i18n, bukan hard-code.
9. Commit kecil, pesan jelas (Conventional Commits). Perbarui docs/traceability.md.

## Definisi selesai
Tes hijau, tipe ketat tanpa `any` baru, tanpa TODO tak tercatat, README/ADR diperbarui bila perlu.
```

**Prompt pembuka yang disarankan untuk agent:**
> "Baca `PRD.md` dan `AGENTS.md` sepenuhnya. Mulai dari Milestone M0 (spike OpenCode v2). Jangan lanjut ke M1 sebelum `docs/opencode-v2-findings.md` dan fixture event selesai. Setelah setiap milestone, ringkas apa yang selesai, apa yang berbeda dari PRD, dan pertanyaan terbuka."

---

## 16. Risiko & Pertanyaan Terbuka

| ID | Risiko / pertanyaan | Dampak | Mitigasi / pemilik |
|---|---|---|---|
| R1 | Kontrak event v2 tidak stabil/berbeda dari dokumentasi (laporan komunitas §5.3) | Avatar salah status | Sinyal berlapis + polling + fixture + M0 |
| R2 | Event `permission.asked` mungkin tidak terkirim | Permission "tersangkut" tanpa disadari | Polling `permission.request.list` (§5.3) |
| R3 | API v2 berlabel *experimental*; rute bisa berubah antar rilis | Break saat upgrade | Pin versi, adapter tipis, tes smoke nyata |
| R4 | Web Speech API: akurasi istilah teknis, privasi, dukungan browser | UX/privasi | Kamus koreksi, catatan privasi, fallback teks, Whisper v0.2 |
| R5 | Echo (TTS terdengar mic) | Salah kenal | PTT default, mic nonaktif saat bicara, mode headphone |
| R6 | Agent tidak patuh format `<speak>` | Ringkasan tak ada | Fallback `generate` + heuristik |
| R7 | Salah dengar menyetujui aksi berbahaya | Kerusakan data | Risiko tinggi hanya klik+konfirmasi; fail-safe klasifikasi |
| R8 | Biaya tambahan panggilan `generate` | Biaya token | Opsional, 1×/giliran, bisa dimatikan |
| R9 | Pengguna ingin karakter manusia/3D | Ekspektasi | `AvatarRenderer` + roadmap v0.3 |
| Q1 | Apakah browser bisa langsung ke `opencode serve` (CORS + auth v2)? | Bisa menyederhanakan arsitektur | ✅ M0: BISA teknis (CORS echo Origin), tetapi password Basic harus dipegang JS → bridge TETAP dipakai (ADR-001 dipertahankan) |
| Q2 | Apa saja nilai `delivery` untuk prompt saat agent sibuk (steer/antre)? | UX FR-014 | ✅ M0: `"steer" \| "queue"`, default `steer`; antre = `delivery:"queue"` / PATCH inbox |
| Q3 | Apakah `session.generate` dikenai batas/biaya khusus? | R8 | ✅ M0: tak ada batas khusus; 1 panggilan = 1 completion konteks penuh (ikut kuota provider; 429 saat limit habis) |
| Q4 | Bagaimana v2 membedakan sub-agent (child session) pada event? | Avatar & feed | ✅ M0: `parentID` di `Session.Info` + filter `session.list`; event hanya bawa `sessionID` → bridge abaikan sesi yang tak dilacak |

---

## 17. Lampiran

### Lampiran A — Instruksi suara untuk OpenCode (disuntik ke sesi / `AGENTS.md`)

```markdown
## Gaya jawaban untuk antarmuka suara (Bibo)
Setelah menyelesaikan tugas, akhiri jawabanmu dengan SATU blok:
<speak>1–2 kalimat Bahasa Indonesia santai yang merangkum hasilnya untuk diucapkan.</speak>
Aturan blok <speak>:
- Maksimal 220 karakter. Tanpa kode, tanpa tanda markdown, tanpa URL.
- Sebut nama file singkat saja (mis. "LoginForm"), bukan path panjang.
- Sebut hal terpenting: apa yang berubah dan apakah ada tes yang gagal.
- Jika butuh keputusan dari pengguna, tanyakan di blok <speak> dengan satu pertanyaan jelas.
Jawaban lengkap/teknis tetap ditulis seperti biasa DI LUAR blok <speak>.
```

### Lampiran B — Sketsa kode (ilustratif; **sesuaikan dengan tipe nyata hasil M0**)

```ts
// apps/bridge/src/opencode/client.ts
import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/service"

export async function connect(urlOverride?: string) {
  if (urlOverride) return OpenCode.make({ baseUrl: urlOverride })
  const endpoint = await Service.ensure({ version: (v) => v.startsWith("2.") })
  return OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) })
}

// apps/bridge/src/opencode/pump.ts  (event pump + reconnect + buffer terbatas)
export async function runPump(client: OpenCodeClient, push: (e: unknown) => void, signal: AbortSignal) {
  let delay = 500
  while (!signal.aborted) {
    try {
      for await (const event of client.event.subscribe()) {
        delay = 500
        push(event)                // JANGAN kerja lambat di sini
      }
    } catch (err) { /* log */ }
    await sleep(delay); delay = Math.min(delay * 2, 10_000)
    await reconcile()              // session.active, permission list, form list, messages
  }
}

// kirim prompt
await client.session.prompt({ sessionID, text })            // sesuaikan field `delivery` bila perlu
await fetch(/* interrupt */)                                // gunakan operasi session.interrupt dari klien
```

### Lampiran C — Variabel lingkungan & konfigurasi

| Variabel | Default | Arti |
|---|---|---|
| `OPENCODE_URL` | (kosong → `Service.ensure()`) | URL server OpenCode v2 manual |
| `OPENCODE_AUTH_HEADER` | — | Header auth manual bila server jarak jauh |
| `CODEPET_BRIDGE_PORT` | `4317` | Port bridge (127.0.0.1) |
| `CODEPET_WEB_PORT` | `5173` | Port dev web |
| `CODEPET_LOG_LEVEL` | `info` | `debug`/`info`/`warn`/`error` |
| `CODEPET_SUMMARY_MODE` | `auto` | `tag`/`generate`/`heuristic`/`auto` |
| `CODEPET_POLL_MS` | `1000` | Interval polling sesi aktif |
| `CODEPET_CAPTURE_EVENTS` | `0` | `1` = simpan event mentah ke JSONL (untuk fixture) |

### Lampiran D — Glosarium

- **OpenCode v2**: lini baru OpenCode (docs `/v2/docs`, paket `@opencode/*`).
- **Location**: konteks proyek (mis. `{ directory }`) tempat sesi/operasi berjalan di v2.
- **Session**: percakapan/pekerjaan agent (ID `ses…`). **Inbox**: antrean input durable sebuah sesi.
- **Steer vs antre**: menyela eksekusi berjalan vs menunggu giliran.
- **PTT**: push-to-talk. **Barge-in**: pengguna menyela ucapan karakter.
- **Pose**: konfigurasi visual avatar. **Bridge**: proses lokal penghubung web↔OpenCode.

### Lampiran E — Referensi

- Docs v2: https://opencode.ai/v2/docs/
- Klien JS v2: https://opencode.ai/v2/docs/build/client
- SDK embedded v2: https://opencode.ai/v2/docs/build/sdk
- API reference v2: https://opencode.ai/v2/docs/api
- OpenAPI v2: https://opencode.ai/v2/openapi.json
- Migrasi plugin v1→v2: https://opencode.ai/v2/docs/build/plugins/migrate-v1
- Catatan komunitas tentang event v2 (untuk verifikasi, **bukan** sumber resmi): issue `anomalyco/opencode#38458`; dokumen kompatibilitas `alvinunreal/oh-my-opencode-slim` (`docs/opencode-v2-compatibility.md`).
