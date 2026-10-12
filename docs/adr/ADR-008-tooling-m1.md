# ADR-008: Tooling M1 — Biome, Vitest, Hono + ws

Status: diterima (M1) · PRD §6.3 memberi pilihan lint; ADR ini mencatatnya.

## Keputusan

- **Lint/format: Biome** (satu binary, tanpa config ganda ESLint+Prettier).
  `bunx biome check` di tiap paket via `bun run check`.
- **Test: Vitest** (`bunx vitest run`). Alasan: API `describe/it/expect` standar,
  dukungan TS out-of-the-box, proses spawn untuk integrasi bridge↔mock.
- **Bridge HTTP+WS: Hono + `ws`** (sesuai PRD §6.3) di atas `node:http`, listen
  `127.0.0.1` saja. Hono melayani `/health` + `/bootstrap`; `ws` melayani `/ws`.
- **Runtime: Bun** (selaras docs OpenCode v2 `bun add`), TS strict +
  `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.

## Konsekuensi

- `bun run check` = biome + tsc + vitest di semua workspace.
- Kontrak WS divalidasi zod di kedua arah (`packages/protocol`).
