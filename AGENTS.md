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
