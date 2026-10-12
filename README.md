# CodePet — avatar robot untuk OpenCode v2 (MVP v0.1.0)

Ngobrol (suara/teks) dengan agent coding OpenCode lewat karakter robot "Bibo":
perintah diteruskan ke OpenCode v2, karakter bereaksi (berpikir, mengetik,
bertanya, senang, bingung) dan menjawab dengan suara.

## Syarat

- Bun ≥ 1.2, Chrome/Edge terbaru (untuk suara), OpenCode v2 (`opencode --version` → `2.x`).
- Model default OpenCode harus BISA menjawab (mis. `openagentic/muse-spark-1.3-free`;
  lihat `opencode.json` → `"model"`). Provider default yang mati = agent tak menjawab.

## Setup ≤ 10 menit

```sh
bun install
bun run dev
```

Buka http://127.0.0.1:5173, pilih folder proyek yang **sudah ada**, ketik atau tahan
tombol mic / Spasi untuk bicara.

- `bun run dev` = bridge (:4317) + web (:5173) sekaligus.
- `bun run start` = mode produksi (build web + bridge + preview sekali jalan).
- `bun run check` = lint + typecheck + semua tes (unit, integrasi, E2E, galeri).
- `bun run smoke:real` = uji asap ke OpenCode v2 nyata (butuh model default hidup).

## Arsitektur singkat

Browser (React) ↔ WebSocket 127.0.0.1 ↔ **bridge** (Bun: normalisasi event,
polling, risk, ringkasan) ↔ **OpenCode v2** (`@opencode/client` 2.0.16, pin eksak).
Browser tak pernah memegang kredensial OpenCode. Detail: `PRD.md`,
`docs/opencode-v2-findings.md`, `docs/adr/`.

## Keamanan

Izin berisiko selalu dikonfirmasi manusia; risiko tinggi hanya lewat klik + ketik OK,
tak ada auto-approve, tak ada persetujuan suara untuk high. Audit: `docs/security-audit-m7.md`.
