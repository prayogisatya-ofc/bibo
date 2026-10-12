# Audit keamanan M7 (NFR-SEC-01..04, NFR-PRIV-01) — 2026-10-12

Verifikasi ulang atas kode M1–M6 (bukan klaim baru).

## NFR-SEC-01 — bridge hanya 127.0.0.1 + token + Origin
- `server.listen(port, "127.0.0.1")` (`apps/bridge/src/server.ts`).
- WS `/ws` wajib `?token=` acak 24 byte per start (disimpan `.codepet/token`, tak pernah dikirim ke klien selain via `/bootstrap` lokal).
- Origin non-lokal ditolak (close 4403); tanpa token ditolak (4401). Tes: `integration.test.ts` (tanpa token, origin jahat).
- HTTP: CORS echo hanya untuk origin localhost/127.0.0.1; preflight OPTIONS ditangani.

## NFR-SEC-02 — rahasia tak ke browser
- Basic auth OpenCode (`Service.headers`) hanya hidup di proses bridge.
- Browser hanya menerima token WS acak + data non-rahasia (teks, status, diff stat).
- `verify-no-secrets` memindai `dist/` tiap check: pola `sk-`, `thk_`, `apiKey`, private key, `Basic`/`Bearer` — nihil.

## NFR-SEC-03 — log tanpa rahasia
- `logDecision` hanya mencatat waktu/requestID/risiko/via/keputusan (tanpa perintah/resource).
- Tidak ada log isi pesan, kunci, token, atau isi `.env`. Tes: `guard.test.ts` (kunci JSONL).
- Fixture M0 diredaksi (`<redacted>`); pindaian repo nihil pola kunci.

## NFR-SEC-04 — allowlist endpoint
- `opencode/allowlist.ts`: DENIED (credential, integration, pty, persistentPty,
  fs/write, config, mcp, pairing) menang atas semua; hanya rute §5.2 + pola
  `instructions/entries` yang lolos. `OP_ROUTES` + `test/op-usage.test.ts` memindai
  SEMUA pemakaian `client.*` di src dan menegaskan terdaftar + diizinkan; token grup
  terlarang dilarang muncul di src (38 kasus allowlist).
- Grup terlarang tidak punya representasi di kode bridge (tidak ada import/panggilan).

## NFR-PRIV-01 — privasi
- Tanpa telemetri (tidak ada fetch keluar kecuali ke OpenCode lokal; grep `fetch(` — hanya
  bootstrap/bridge/mock/OpenCode).
- Tanpa penyimpanan audio (STT streaming, transkrip hanya di memori + sesi OpenCode).
- Catatan privasi Web Speech API tampil di Settings.
- Tidak ada cookie/analytics di web.

## Risiko sisa
- Token WS di URL (`?token=`) bisa tercatat di histori/log proxy lokal — dapat diterima
  untuk aplikasi 127.0.0.1; alternatif header tidak didukung semua klien WS browser lawas.
- Klasifikasi risiko melihat pola perintah, bukan niat model — jalur selalu-bertanya
  (fail-safe medium) menutup celahnya.
