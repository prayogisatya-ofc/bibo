# Traceability FR/NFR → tes (M1)

| ID | Kebutuhan | Implementasi | Tes / bukti |
|---|---|---|---|
| FR-001 | Temukan/jalankan server v2 | `opencode/client.ts` `connect()` (`Service.ensure()` / `OPENCODE_URL`) | integrasi (semua memakai connect), smoke mock+real |
| FR-002 | Cek `server.info`, tolak bukan v2.x | `SUPPORTED_MAJOR`, error bila mayor ≠ `2.` | `client.ts` (review); mock info `2.0.16-mock` |
| FR-003 | Pilih direktori, buat/lanjutkan sesi | `session.select` → `ensureSession` + `store.ts` (lastSessionByDir, recentDirs ≤10) | integrasi (select → prompt jalan) |
| FR-004 | Daftar sesi + ganti | `session.listed` + Onboarding daftar + select | E2E m7 ganti-sesi |
| FR-005 | Indikator koneksi + reconnect | `bridge.status`, pump backoff+rekonsiliasi, `conn` signal, degraded-start retry + pulih otomatis | integrasi stream-drop + server-down; reducer `conn down → error` |
| FR-014 | Antre/Sela | `delivery` terdokumentasi; bridge kirim default `steer` (pilihan UI di M2) | findings M0 |
| FR-015 | Interrupt | `agent.interrupt` → `session.interrupt` | integrasi interrupt (mock 06) |
| NFR-REL-01 | Pulih dari putusnya SSE | `pump.ts` (backoff, buffer 1000, gap flag) + `reconcile()` | integrasi stream-drop |
| NFR-REL-02 | Event tak dikenal tak crash | normalizer → null + `unknownCount` + ring buffer 500 | normalize.test (project.updated, session.idle) |
| NFR-SEC-01 | 127.0.0.1 + token + cek Origin | `ws.ts` gateway (token, Origin localhost-only), listen 127.0.0.1 | integrasi no-token + bad-origin |
| NFR-SEC-02 | Rahasia tak ke browser | bridge pegang Basic auth; WS hanya token acak + data non-rahasia | review + redaksi fixture M0 |
| NFR-SEC-03 | Log tanpa rahasia | tidak ada log isi pesan/kunci | review |
| NFR-SEC-04 | Allowlist endpoint | `opencode/allowlist.ts` (38 kasus + OP_ROUTES + enforcement scan) | allowlist.test.ts + op-usage.test.ts |
| Kontrak WS | Semua pesan valid dua arah + 14 AvatarPose | `packages/protocol` (zod infer) | contract.test.ts |
| DoD M1 | `dev:bridge` + `tools/ws-cli` vs nyata+mock | `smoke:mock` OK (idle+final+feed); vs nyata: `bridge.ready` OK (prompt nyata tergantung provider default user — saat ini 9router mati, dicatat) | smoke log + integrasi 8/8 |

## M2 — Web UI teks

| FR-003 | Pilih direktori + riwayat 10 | Onboarding (bridge recentDirs + localStorage) + StatusBar ganti | E2E (onboard tiap skenario) |
| FR-010 | Chat Enter/Shift+Enter/riwayat ↑ | ChatPanel | unit implisit E2E + review |
| FR-014 | Antre (default) / Sela | busy-choice + `delivery` protokol + bridge passthrough (`queue` default) | E2E + contract.test |
| FR-015 | Stop + Esc = interrupt | tombol Stop + handler Esc + `agent.interrupt` | E2E interrupt (bridge) + review |
| FR-020 | Streaming markdown + salin + speak tak tampil | Markdown ringan, stripSpeak di store | markdown.test + store.test + E2E assert |
| FR-021 | Activity feed | ActivityFeed (ikon/status/detail 2KB) | E2E edit-files |
| FR-024 | Daftar file berubah | ChangesCard via `diff.ready` (bridge fetch session.diff) | E2E edit-files |
| FR-044 | Error manusiawi | humanError(), tanpa stack | text-utils.test + E2E offline |
| FR-056 | Pengaturan persisten | bridge store (server) + localStorage (tema/autoscroll/bridge-url/riwayat) | review + E2E |
| DoD M2 | Chat penuh vs mock+nyata; tanpa rahasia di bundle | E2E 3/3 vs mock; vs nyata: UI↔bridge teruji M1, prompt nyata tergantung provider | `verify:no-secrets` OK; bundle 220KB (gzip 66KB) |

## M3 — Avatar + state machine

| FR-030 | 10 state + transisi | BotRenderer (9 pose + 6 varian working + overlay speaking) | galeri /dev/avatar + renderer.test |
| FR-031 | Prioritas sinyal | derivePose murni (19 kasus) + XState paralel | pose.test.ts + machine.test.ts |
| FR-032 | Pose per jenis tool | TOOL_BUSY_KIND (nama M0, incl. subagent→delegating) + busyKind bridge | pose.test + E2E pose-edit |
| FR-033 | Overlay speaking + mulut parametris | setSpeechLevel 0..1 → mulut m-open + busur suara; prioritas lampu asking>speaking>pose | renderer.test + gallery speaking |
| FR-034 | prefers-reduced-motion | mount reducedMotion + setReducedMotion; animasi diam | review + mount reducedMotion |
| FR-035 | Mini mode | tertunda → fase C (UI baru) | — |
| FR-036 | Idle behaviors | IdleDirector: kedip 4,2 s, melayang, melirik 5–9 s; tidur >120 s | renderer.test (fake timer) |
| NFR-PERF-04 | Animasi ≥55fps | CSS keyframes/WAAPI, tanpa lib; terukur 60,4 headless | E2E fps probe |
| DoD M3 | Urutan pose mock; tak idle saat aktif; galeri disetujui | E2E pose-edit/permission/silent/drop + machine.test | gallery/ (29 PNG) |

## M4 — Suara keluar + ringkasan lisan

| FR-022 | Ringkasan lisan ≤2 kalimat | summarize auto (tag→generate 8 s→heuristik) + speak summary | speech.test + trials 10/10 nyata |
| FR-023 | Ack saat perintah diterima | phrase ack (normal/cerewet; senyap diam) | review + E2E speak |
| FR-033 | Overlay speaking via setSpeechLevel ≤30 Hz | TTS level generator → mulut parametris (overlay Berbicara); setSpeechLevel(0) ≤100 ms saat stop/cancel | tts.test + E2E cancel |
| FR-050 | Verbosity Senyap/Normal/Cerewet | bridge store + settings.update + local | review + E2E |
| FR-052 | Suara/rate/pitch/volume/uji | SettingsPanel + pickVoice id-ID + peringatan | review |
| FR-053 | Mute global + Ctrl+M | engine mute + cancel seketika | tts.test + review |
| Baru | setMicLevel(level) — kontrak ADR-009 | lampu antena denyut mengikuti level saat pose Mendengar (CHARACTER.md §4.3); deviasi setSpeechLevel-ganda dihapus; slider mic + ?mic= di galeri /dev/avatar | renderer.test (4) + types.ts |
| DoD M4 | 9/10 giliran nyata bersuara; tanpa tag/kode; mute/interrupt seketika | trials vs OpenCode 2.0.16 nyata | 10/10 (tag 5, generate 4, heuristik 1) |

## M5 — Suara masuk + perintah suara

| FR-011 | PTT (tombol/spasi), toggle, auto/konfirmasi | MicButton + Space-hold + sendMode | E2E voice-success (+confirm path review) |
| FR-012 | Caption interim real-time | interim state + aria-live (engine interim langsung) | E2E voice-success assert caption |
| FR-013 | Fallback tanpa mic | banner + chat tetap jalan (?stt=none) | E2E voice-nomic |
| FR-015 | Stop suara + Esc | matchCommand interrupt + TTS cancel + toast | E2E voice-stop |
| FR-051 | Bahasa/mode/PTT | Settings (sttLang, sendMode) + persist | review |
| FR-054 | Kamus koreksi editable | dictionary.ts (kata utuh; titik/koma tak disentuh) + editor | commands.test |
| Baru | setMicLevel(0) di batas micStart/micStop (ADR-009) | reset level mic saat masuk/keluar listening; tanpa metering nyata (Web Speech API) | review + voice.spec |
| Gherkin | voice sukses, barge-in, stop, no-mic, negatif ×2 | E2E stub STT/TTS | 6/6 lolos |

## M6 — Izin, form, keselamatan

| FR-040 | Kartu izin + avatar asking + ucapan ≤1 s | ApprovalCard + permission.requested (risk/voiceAllowed) + speak urgent | E2E safety-medium/high |
| FR-041 | Sekali/tolak/selalu-klik | guard + log + UI (always warning; high tanpa always) | guard.test + E2E high |
| FR-042 | Risiko + aturan suara | risk.ts fail-safe + VOICE_NOT_ALLOWED + hint suara kondisional | risk 50 + E2E |
| FR-043 | Form generik + suara opsi tunggal + settled | FormCard + matchFormAnswer + FORM_SETTLED | cards.test + E2E safety-form |
| FR-044 | Error manusiawi | humanError VOICE/ALWAYS/SETTLED/DIR | review |
| FR-045 | Pengingat 60 s sekali, tanpa auto-approve | ReminderTracker + interval bridge | guard.test (fake timer) |
| G4 | 0 high via suara/otomatis | audit: 1 jalur reply (server.ts:502), selalu via guard+log | E2E high + guard.test |
| Baru | Audit kontrak baru (2026-10-13) | speaking overlay saat ucapan izin (urgent) di atas pose asking: prioritas lampu asking > speaking; voiceAllowed = risk !== 'high' (server + reducer, defense in depth) | review + safety.spec |

## M7 — Polish & rilis (P0 wajib hijau semua)

| FR-006 | Agent/model read-only | bridge.ready agent/model + StatusBar | E2E snapshot + review |
| FR-025 | Diff per file (P1) | DITUNDA v0.2 (butuh sumber konten diff) | — |
| FR-055 | Tema auto + ukuran avatar | Settings + stage | review + E2E |
| NFR-PERF-01 | event→pose p95 <300ms | ukur: p50=61ms p95=98ms (5 iter, mock) | scripts/perf.ts |
| NFR-PERF-02 | kirim <800ms | ukur: p50=58ms p95=65ms (echo lokal) | scripts/perf.ts |
| NFR-PERF-03 | TTS mulai <500ms | ukur: 121ms (stub, klik→pulse) | probe M7 |
| NFR-PERF-04 | ≥55fps | ukur: 60,4 headless | E2E fps (gate 55) |
| NFR-PERF-05 | bundle <300KB gzip | ukur: 95,9KB | verify-no-secrets/build |
| NFR-PERF-06 | bridge <150MB RSS | ukur: 57MB setelah 15 giliran (bukan 1 jam penuh) | /health rssMB |
| NFR-A11Y-01 | axe tanpa serius | 0 serious/critical (halaman, settings, kartu) | e2e/a11y.spec.ts |
| NFR-I18N-01 | id/en tanpa ubah kode | locales + switch + frasa bridge | i18n.test + speech.test |
| NFR-SEC/PRIV | audit ulang | docs/security-audit-m7.md | op-usage + verify |
| DoD M7 | check + smoke:real hijau; Gherkin semua | semua P0 hijau; smoke:real OK vs 2.0.16 | laporan M7 |

## Redesain avatar+UI — fase C (2026-10-13, cabang redesign/avatar-ui)

| FR-035 | Mini mode | DIHAPUS — digantikan pemilih mode Chat / Ngobrol (keputusan ADR d) | review; e2e/m7.spec.ts perlu pemutakhiran (fase E) |
| FR-040 | Kartu izin + avatar asking + ucapan ≤1 s | ApprovalCard varian popup (panah ke Bibo, di bawah Bibo) + dock (di atas komposer); Bibo asking otomatis via orchestrator | cards.test.tsx (popup/dock/Esc) + E2E safety-medium/high |
| FR-041 | Sekali/tolak/selalu-klik | tidak berubah (selalu 2 langkah + peringatan; high tanpa selalu) | cards.test.tsx |
| FR-042 | Risiko + aturan suara | high: "Konfirmasi lewat layar" + ketik OK; petunjuk suara hanya bila voiceAllowed (di bawah kartu popup) | cards.test.tsx |
| FR-043 | Form generik + suara opsi tunggal + settled | FormCard varian popup/dock; Esc = minimalkan, bukan batal | cards.test.tsx |
| FR-055 | Tema auto + ukuran avatar | tema default TERANG (keputusan ADR c); ukuran avatar → ukuran panggung chat | review |
| Baru | Mode Chat/Ngobrol + Ctrl/Cmd+. | useUiMode (localStorage codepet.ui-mode); riwayat chat dipertahankan | uiMode.test.tsx |
| Baru | Bubble ucapan mode Ngobrol | speechBubble.ts murni (pop 180ms, 2 kalimat terakhir, fade 1,5 dtk, urgent ganti seketika, tone error) + TtsEngine.onChunk/onUtteranceEnd (aditif) | speechBubble.test.ts + tts.test.ts |
| Baru | poseLabel tanpa nama | "Bibo" hanya dari character.name + i18n; komponen menyusun `${character.name}: …` | pose.test.ts (tanpa nama) |
| Baru | react() avatar | nod saat prompt terkirim, perk saat mic ditekan, thanks saat izin sekali, hello saat pertama terhubung (via avatar/rendererRef) | review |
| NFR-A11Y-01 | Kontras AA tema terang+gelap | token diverifikasi: semua pasangan teks ≥4,5 (aksen hanya untuk ikon/fokus, bukan teks) | skrip cek kontras (laporan fase C) |
| NFR-I18N-01 | Kunci baru id+en | mode, bubble, popup izin, petunjuk suara, chip, status panggung, {name} via fill() | i18n.test |

## Redesain avatar+UI — fase E (2026-10-13, cabang redesign/avatar-ui)

| FR-035 | Mini mode | E2E dimutakhirkan: tes mini mode dihapus; diganti mode-switch, talk-permission, talk-high, esc-minimize | e2e/m7.spec.ts |
| Baru | Testid mic ganda | ChatMode punya 2 mic (panggung big + komposer small); komposer memakai testid "mic-input-btn", panggung tetap "mic-btn" | MicButton testId prop; e2e voice/safety |
| FR-031 | derivePose | +5 kasus speaking-overlay (asking/offline/confused/listening/thinking tetap; prioritas lampu asking>speaking di renderer.test) | pose.test.ts |
| Baru | useSpeechBubble | hook + timer fade 1,5 dtk (fake timers): hilang tepat waktu, speak baru batalkan timer, unmount bersih | useSpeechBubble.test.tsx |
| FR-040..042 | ApprovalCard low | low: petunjuk suara ada (dock+popup), badge rendah, selalu-izinkan tampil | cards.test.tsx |
| NFR-A11Y-01 | axe mode Ngobrol + popup | 0 serious/critical; focus trap Tab/Shift+Tab; Esc→chip; chip dibuka via Enter | e2e/a11y.spec.ts |
| NFR-PERF-04 | fps avatar | galeri ?dev=avatar (9 pose × 2 tema, freeze); skrip fps/CPU 10 dtk celebrate+working | e2e/avatar.spec.ts; scripts/perf-avatar.ts; docs/reports/avatar-ui/PERF.md |
| Visual | 3 adegan vs referensi | pixelmatch informatif (bukan gate) | scripts/visual-compare.ts; docs/reports/avatar-ui/COMPARISON.md |
| Gherkin §13.3 | semua skenario avatar | dipetakan ke tes otomatis | docs/reports/avatar-ui/GHERKIN.md |
