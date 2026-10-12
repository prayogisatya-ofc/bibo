# OpenCode v2 Findings (M0) — final 2026-10-11

Uji terhadap **OpenCode v2.0.16** (`opencode --version` dan `GET /api/info` →
`{"version":"2.0.16",...}`), klien `@opencode/client` **2.0.16** (pin eksak di
`tools/spike/package.json`), model `openagentic/muse-spark-1.3-free` (model default
lingkungan — provider `9router` via `http://127.0.0.1:20128` — MATI di env ini;
bukti di `00-provider-failure.*`).

- OpenAPI: `docs/fixtures/openapi.v2.json` (118 paths, 282 schemas, diunduh 2026-10-11
  dari `https://opencode.ai/v2/openapi.json`).
- Spike: `tools/spike/capture-events.ts` (memakai `Service.ensure()` + `OpenCode.make`,
  murni `@opencode/client` — tanpa `fetch` manual kecuali uji CORS).
- Fixture: `docs/fixtures/opencode-events/` — 7 file event (`00` + 6 skenario) + 7 file
  polling + `_summary.json`. Tiap `.jsonl` = SATU event mentah per baris (tanpa modifikasi).
  Tiap `.poll.jsonl` = snapshot `{at, active, permissionPending, sessionPermissions,
  forms, globalForms, messages}` tiap ~1,5 s.

> **Peringatan fixture**: stream event bersifat GLOBAL (semua sesi + semua lokasi di server
> ini). Analisis memfilter `data.sessionID == sesi skenario`. Bridge WAJIB memfilter yang sama
> (dampak desain §4.5).

## 1. Bentuk event (wire) — TERJAWAB

- Envelope SSE: `{ event: "<type>", data: "<V2Event JSON string>" }`. Setelah parse klien,
  event = `{ id: "evt_*", created, type, location?: {directory}, data, durable?: {aggregateID,
  seq, version}, metadata? }`. Payload bisnis SELALU di `data` (bukan `properties`).
- `durable.seq` naik per agregat (sesi); cocok untuk deteksi gap/urutan.
- `server.connected` (`data:{}`) diterima pertama oleh subscriber yang terlambat — sesuai docs.

## 2. Tabel pertanyaan → jawaban → bukti → dampak

| # | Pertanyaan (PRD §14 M0 / §16) | Jawaban | Bukti | Dampak desain |
|---|---|---|---|---|
| M0-a | Apakah stream putus di tengah giliran? | TIDAK teramati: 0 stream-end selama ±25 mnt / 6 skenario + 2 periode quiet 10 s (`streamEndsDuringRun: 0`). Kontrak tetap live-only tanpa replay (docs), jadi reconnect wajib walau tak terpicu di uji ini | `_summary.json`, `capture*.log` | Reconnect+rekonsiliasi tetap diimplementasi (NFR-REL-01); skenario `stream-drop` di mock mensimulasikannya |
| M0-b | Event apa yang benar-benar muncul? | Teramati: `server.connected`, `session.created`, `session.instructions.updated`, `session.inbox.enqueued/delivered`, `session.execution.started/succeeded/failed/interrupted`, `session.step.started/streamed/ended/failed`, `session.text.started/delta/ended`, `session.reasoning.started/delta/ended`, `session.tool.input.started/delta/ended`, `session.tool.called/progress/success/failed`, `session.retry.scheduled`, `session.usage.updated`, `permission.asked/replied`, `form.created`, `shell.created/exited/deleted`, `project.updated`, `*.updated` (config-ish saat connect). TAK teramati: `session.idle`, `session.status`, `question.asked`, `session.next.*` | 01–06 `*.jsonl` | Normalizer: tabel `type→AgentSignal` dari daftar teramati; `session.idle`/`status` DIABAIKAN; unknown → log, bukan crash |
| M0-c | Bentuk body permission reply + nilai keputusan? | Request: `POST /api/session/{id}/permission/{reqID}/reply` body `{decision: "once"\|"always"\|"reject", message?}` → respons `void`. Event `permission.replied` = `{sessionID, requestID, reply}`. Akses klien: `client.permission.reply/list/get` (top-level, BUKAN `client.session.permission.*`; rute HTTP sama) | 03 (reject → `tool.failed{aborted}` → `execution.interrupted`); tipe `PermissionReplyInput` | Bridge memanggil `client.permission.reply`; `always` + `via:voice`/`risk:high` ditolak di bridge (`VOICE_NOT_ALLOWED`) |
| M0-d | Enum `Session.Inbox.Delivery`? | `"steer" \| "queue"`. Default `session.prompt` tanpa argumen = `"steer"` (terlihat di respons prompt). Ubah antrean via `PATCH inbox/{inboxID}` `{delivery}` | skema openapi + respons prompt di log | FR-014: default "Antre" = kirim dengan `delivery:"queue"`; "Sela" = `steer` atau PATCH inbox |
| M0-e | Field `Permission.Request`? | `{id: "per_*", sessionID, action, resources[], save?[], metadata?, source?{type:"tool",messageID,id}, message?}`. Nyata: (a) action `"shell"`, resources `["echo spike-permission-test"]`; (b) action `"external_directory"`, resources `["/tmp/spike-work/*"]` | 03 + 05-pertama `permission.asked` | `risk.ts` memakai `action+resources+source`; klasifikasi fail-safe tetap (field `message` tidak selalu ada) |
| M0-f | Skema Form + reply? | `Form.Info {id:"frm_*", sessionID, title, metadata{kind:"question", tool:{messageID, id:call_*}}, fields[{key,title,description,type,options[{value,label,description}],custom}]}`. Reply: `POST …/form/{formID}/reply` `{answer:{<key>: value}}`. Event: `form.created` (bukan `question.asked`) | 04 (`question` tool → `form.created`); tipe `SessionFormReplyInput` | `FormCard` render dari `fields`; jawaban suara hanya untuk single-choice; `form.asked` di PRD = `form.created` |
| M0-g | Nama tool nyata? | Teramati via `session.tool.input.started → data.name`: `read`, `edit`, `shell`, `execute`, `question`. `session.tool.called` TIDAK memuat nama — join via `id: "call_*"`. Daftar lengkap = tool bawaan agen build (lihat `agent.list`) | 02 (`read×2, execute×2, edit×1`), 03 (`shell`), 04 (`question`), 05 (`read`) | Revisi tabel §8.3a: `shell` (bukan `bash`), `execute`, `question`; mapping callID→nama di normalizer |
| M0-h | Instruction entry tersedia? | YA. `PUT …/instructions/entries/{key}` `{value}` → 204; `GET …/entries` me-list; key regex `^[a-z0-9][a-z0-9._-]*$`; tiap put memancarkan `session.instructions.updated` | 01 verifikasi (`codepet.voice`, 1 entry) | Jalur utama `<speak>` (§9.5 opsi a) VALID — pakai key `codepet.voice` |
| M0-i | Perilaku `session.generate`? | ADA (`POST …/generate` `{prompt}` → `{text}`), tanpa mengubah riwayat. Memakai kuota model yang sama: saat limit free habis → `429 FreeUsageLimitError` (membuktikan endpoint hidup + berbayar-kuota) | 01 (`generateError: 429…`) | `summaryMode:auto` tetap; `generate` dibatasi 1×/giliran, timeout 8 s, dapat dimatikan (R8 valid) |
| M0-j | Auth (`Service.headers`, pairing)? | `Service.ensure()` → `opencode serve --service`; auth = header `Authorization: Basic base64("opencode:<password>")` (username HARUS `opencode`; user kosong DITOLAK 401). Pairing (`POST /api/pair`, `GET /auth/connect/{code}`) ada di openapi, tak diuji (butuh akses remote — di luar MVP lokal) | uji langsung + sumber `service-timing-*.js` klien | Bridge: `Service.ensure()` + `Service.headers()`; token WS sendiri untuk browser |
| M0-k | CORS / browser langsung (Q1)? | Server me-echo `Origin` apa pun (`access-control-allow-origin: <origin>`); REST + SSE bisa dipanggil dari browser, TAPI password Basic harus dipegang JS → rahasia bocor. Bridge tetap DIPERLUKAN | uji `fetch` dengan `Origin: http://localhost:5173` (200 + echo) | ADR-001 DIPERTAHANKAN (bridge); browser langsung DITOLAK untuk MVP |
| Q2 | Nilai `delivery` saat sibuk? | Lihat M0-d. Mengirim prompt kedua saat running dengan default `steer` diterima (01: PING setelah sukses). Semantik antre vs sela dikonfirmasi di level skema; perilaku antrean penuh diuji di M1 via mock | 01 inbox check (`inbox.list: []` setelah selesai) | FR-014: tawarkan Antre(`queue`)/Sela(`steer`) |
| Q3 | Batas/biaya `session.generate`? | Tak ada batas khusus di API; 1 panggilan = 1 completion atas konteks sesi penuh (biaya = token konteks sesi). Kena 429 yang sama dengan prompt biasa | 01 | Dokumentasikan sebagai opsional + hemat (1×/giliran, off-switch) |
| Q4 | Sub-agent / child session? | `Session.Info.parentID`; `session.list` filter `parentID` (`null` = root only). Event hanya membawa `sessionID` (anak) tanpa penanda induk → bridge mengabaikan event yang `sessionID`-nya bukan sesi aktif (aturan filter umum sudah mencakup ini) | skema `Session.Info`, `session.list` params | Aturan filter: hanya proses event milik sesi yang dilacak; sesi anak diabaikan kecuali switcher sesi (v0.2) |

## 3. Urutan kanonis per skenario (milik sesi skenario saja)

- **01 sederhana**: `created → inbox.enqueued → execution.started → instructions.updated → inbox.delivered → step.started → text.started/delta/ended → step.streamed/ended → usage.updated → execution.succeeded` (17 event).
- **02 edit**: sama + `tool.input.started/ended → tool.called → tool.success` per tool (`read, execute, edit`); `retry.scheduled` saat 429 lalu pulih (79 event).
- **03 permission-reject**: `… tool.called → permission.asked → permission.replied{reject} → tool.failed{type:"aborted"} → step.failed → execution.interrupted` — CATAT: `interrupted`, bukan `failed` (19 event).
- **04 form**: `… tool.called(question) → form.created`; sesi TETAP `running` di `active` + form persist di `form.list`; `wait()` TIMEOUT 120 s (14 event milik sesi; 90 snapshot poll).
- **05 tool-error**: `… tool.called(read) → tool.failed{type:"tool.execution", message:"File not found: …"} → step.ended → (agent lanjut) → execution.succeeded`. Bandingkan error: `tool.execution` (gagal jalan) vs `aborted` (ditolak user) vs `provider.transport` (00).
- **06 interrupt**: 13× `text.delta` → `interrupt{interrupted:true}` → `text.ended → step.failed → execution.interrupted` dalam ±30 ms.
- **00 provider-mati**: `retry.scheduled{attempt, at, error{type:"provider.transport"}}` ×14 → `step.failed → execution.failed`. `wait()` kembali setelah 85 s.

## 4. Keputusan sinyal → ADR-007 ✅ (lihat `docs/adr/ADR-007-busy-done-signal.md`)

## 6. Adendum M1: envelope `{data}` dan unwrap klien

Inspeksi bundle `@opencode/client` 2.0.16 (`dist/chunks/service-timing-*.js`) +
uji mock membuktikan aturan envelope respons:

- Klien meng-unwrap `value.data` untuk: `session.create/get/active/fork`,
  `session.prompt/synthetic/compact/generate/context/diff/background`,
  `session.instructions.*`, `session.inbox.list/update`, `permission.create/list/get`,
  `session.form.list/create/get`, `form.list`, `experimental.generate.text`.
  → server HARUS mengembalikan `{data: …}` pada rute-rute ini.
- Klien TIDAK unwrap (body mentah): `server.info`, `session.list`, `session.remove`,
  `session.interrupt`, `session.message.list`, `permission.reply`, `session.form.reply/cancel`,
  `permission.request.list`, `form` global versi mentah `{location, data}`.
  → mock meniru bentuk yang sama; bukti: spike M0 memakai bentuk ini terhadap server nyata.
- Endpoint reply void (`permission.reply`, `session.form.reply/cancel`) memakai
  status **204 tanpa body** (ditemukan M6: mock 200 → `ClientError: UnexpectedStatus`).

Dampak: implementasi mock & bridge mengikuti tabel di atas, bukan tebakan.

## 7. Adendum M5: direktori sesi harus ada (500 kosong)

`session.create` BERHASIL untuk direktori yang tidak ada di disk, tetapi
`session.prompt` berikutnya gagal dengan **500 tanpa body** (diamati 2026-10-11,
server 2.0.16, diverifikasi di direktori proyek vs `/tmp` yang tak ada).
Bridge kini memvalidasi eksistensi direktori pada `session.select` dan menjawab
`DIR_NOT_FOUND` ("Folder itu tidak ada…") alih-alih HANDLER_ERROR generik.
Mock meniru perilaku ini (prompt → 500 bila direktori hilang).

## 8. Adendum: model default diganti ke Muse Spark 1.3 Free

M4: `~/.config/opencode/opencode.json` `"model"` diubah dari
`9router/oc/muse-spark-1.3-contributor-free` (sidecar `:20128` mati; turn
menggantung retry) ke `openagentic/muse-spark-1.3-free` (backup config di
`/tmp/opencode.json.bak-m4`). Bridge TIDAK pin model (keputusan pemilik produk);
verifikasi ujung-ke-ujung: prompt "halo" → 200 → idle → "Halo! Ada yang bisa
saya bantu?" (+ `agent.speak` ack) via bridge nyata.

## 5. Yang BERBEDA dari PRD (wajib perbarui PRD)

1. §5.2: `client.session.permission.*` → `client.permission.*` (rute HTTP sama).
2. §8.3a: nama tool (`bash→shell`, +`execute`, `question`; nama hanya di `tool.input.started`).
3. §5.3/§6.4: tambah filter `data.sessionID` (stream global); `question.asked` → `form.created`.
4. §5.3: `session.generate` + instruction entry TERVERIFIKASI (bukan ⚠️ lagi).
5. Lingkungan: model default 9router mati saat M0 (spike memakai pin model; pin
   DICABUT di M1 — bridge memakai model default server; smoke nyata butuh
   provider default yang hidup, keputusan pemilik produk).
