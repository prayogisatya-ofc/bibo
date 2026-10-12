# ADR-007: Sinyal "sibuk / selesai" — event primer + polling sebagai jaring pengaman

Status: diterima (M0, 2026-10-11) · OpenCode v2.0.16 · Bukti: `docs/fixtures/opencode-events/`

## Konteks

Avatar harus mencerminkan status nyata agent (G2, delay event→animasi p95 < 300 ms).
Kandidat sinyal: event stream (`/api/event`), polling `session.active`,
`permission.request.list`, `form.list`, `message.list`.

## Fakta dari spike (M0)

1. `session.execution.started/succeeded/failed/interrupted` terkirim untuk SETIAP giliran,
   termasuk gagal provider (00), tool gagal (05), interrupt (03-reject, 06).
2. `session.idle` dan `session.status` memiliki tipe TS tetapi TIDAK PERNAH terkirim
   pada 6 skenario → tidak boleh dipakai.
3. Sesi yang menunggu jawaban form/permission TETAP muncul sebagai
   `{type:"running"}` di `session.active` (04: TIMEOUT 120 s menunggu idle yang tak datang).
   Jadi `active` saja tidak bisa membedakan "bekerja" vs "menunggu".
4. `permission.asked` dan `form.created` TERKIRIM sebagai event (03, 04), tetapi mengandalkan
   satu jenis event saja rapuh (laporan komunitas + kontrak live-only tanpa replay).
   Polling `permission.list` / `session.form.list` mengembalikan data yang sama.
5. Stream bersifat global (semua sesi/lokasi) dan live-only tanpa auto-reconnect —
   bridge wajib memfilter `data.sessionID` dan subscribe ulang + rekonsiliasi.

## Keputusan

Sinyal berlapis (prioritas turun):

1. **Primer — event eksekusi**: `exec.started` → `agent=thinking/working`;
   `exec.ended(success|failed|interrupted)` → `idle`/`celebrate`/`confused`.
2. **Estimasi kerja — event step/tool/teks**: `step.started`, `tool.called` (+nama dari
   `tool.input.started`), `text.delta` → `working.<kind>` / pose mengetik.
3. **Menunggu — event ATAU polling**: `permission.asked` / `form.created` → `awaiting`;
   polling `permission.list` + `session.form.list` tiap 1,5 s saat sesi ada di `active`
   mendeteksi hal yang sama bila event hilang.
4. **Rekonsiliasi — polling**: `session.active` (tiap 1 s saat prompt aktif) +
   `message.list` terbaru setelah (re)connect; hasil polling dan event di-dedupe
   per (`sessionID`, kind, id).
5. **Reconnect**: backoff 500 ms→10 s; setelah pulih selalu rekonsiliasi (PRD §6.5).

## Konsekuensi

- Normalizer memakai tabel `event.type → AgentSignal`, toleran (unknown → log, bukan crash).
- `session.active==running` + form/permission pending ⇒ `awaiting`, bukan `working`.
- Tidak ada ketergantungan pada `session.idle`/`session.status`.
