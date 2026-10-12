# CHARACTER.md — Karakter Robot & Spesifikasi Animasi (CodePet)

| Item | Isi |
|---|---|
| **Karakter** | Robot mungil bernama sementara "Bibo" (nama belum final) |
| **Konsep desain** | **Konsep B**: badan squircle putih, wajah layar gelap (visor) dengan mata menyala + mulut kecil, **lampu status di ujung antena**, dua tangan melayang terpisah |
| **Versi** | 1.0 |
| **Status terhadap PRD** | Dokumen ini **menggantikan PRD §8.4** (spesifikasi karakter lama bergaya referensi gambar) dan tabel pose di dalamnya. Jika bertentangan dengan PRD, **CHARACTER.md menang**. State machine, prioritas pose (PRD §8.1–8.3) dan integrasi OpenCode **tidak berubah** |
| **Pembaca** | AI coding agent (utama) dan developer/desainer |
| **Teknologi** | SVG 2D inline + Web Animations API/CSS. Tanpa library animasi berat |

> **Untuk agent:** semua koordinat, ID, durasi, dan kurva di bawah adalah **kontrak**. Jangan mengarang nilai lain tanpa alasan; kalau tampilan nyata terasa janggal, ubah nilainya di satu tempat (`timing.ts`) dan catat di ADR. Lembar desain visual disimpan oleh pemilik produk sebagai `docs/reference/character-sheet.png` (tangkapan layar lembar karakter). Bila file itu belum ada, geometri di §3 sudah cukup untuk menggambar ulang karakter.

---

## 0. Ringkasan 10 pose

| # | Pose | Inti gerakan | Lampu antena |
|---|---|---|---|
| 1 | **Diam (idle)** | mata berkedip, badan mengambang naik-turun, sesekali **satu tangan melambai** | padam (abu) |
| 2 | **Berpikir** | **tiga titik muncul satu per satu** berulang selama loading, **tangan kanan mengusap dagu** (sesuai lembar desain), badan mengambang pelan | biru stabil |
| 3 | **Bekerja** | mata menatap keyboard dan **bergerak kiri→kanan**, kedip, ulang; **kedua tangan di atas keyboard mengetik** naik-turun | biru, kedip seperti LED aktivitas |
| 4 | **Bertanya** | **tangan terangkat** (raise hand), **tanda tanya hilang-timbul** agar menarik perhatian | kuning, kedip ganda |
| 5 | **Senang** | badan mengambang **lebih cepat**, **tangan naik-turun gembira** di samping badan, **kertas konfeti meledak berulang** | hijau |
| 6 | **Bingung** | **mulut bergelombang** berulang, **keringat naik-turun-hilang** berulang, **satu tangan menggaruk kepala** | merah, kedip cepat |
| 7 | **Berbicara** | **mulut kecil↔besar** berulang, **tanda suara muncul satu per satu** dari yang kecil, **lampu status berkedip** | biru, berdenyut 2 Hz |
| 8 | **Tidur** | **badan diam**, **"zzz" muncul satu per satu ke atas** berulang | redup, "bernapas" pelan |
| 9 | Mendengar (tambahan) | condong ke depan, mata lebar, busur suara menyusut ke arah karakter | biru, denyut mengikuti level mic |
| 10 | Offline (tambahan) | mata datar, tubuh pudar, lampu mati dan sesekali kedip merah (mencari koneksi) | mati / kedip merah jarang |

"Berbicara" adalah **overlay** (ditumpuk di atas pose dasar lewat `setSpeechLevel`), bukan pose tubuh yang berdiri sendiri. Pose 1–8 diminta pemilik produk; 9–10 diperlukan oleh state machine PRD.

---

## 1. Identitas Karakter (tidak boleh berubah)

| # | Ciri | Aturan |
|---|---|---|
| 1 | **Badan** | Satu squircle putih kebiruan, lebih lebar daripada tinggi (±1,13 : 1), tanpa kaki dan leher |
| 2 | **Wajah = visor gelap** | Persegi membulat navy di bagian tengah badan. Isinya hanya: dua mata oval menyala, mulut kecil, dua semburat pipi pink |
| 3 | **Antena + lampu** | Satu antena pendek di atas kepala; bola lampu di ujungnya adalah **indikator status** utama (warna + pola kedip) |
| 4 | **Dua tangan melayang** | Dua bola putih-lavender **tidak menempel** ke badan (celah ≥ 8 unit). Tangan adalah alat ekspresi utama |
| 5 | **Tanpa alis, hidung, kaki, telinga** | Ekspresi hanya dari mata, mulut, lampu, tangan, gerak badan, dan props |
| 6 | **Gaya** | Flat, lembut, sudut bulat. Warna kuat hanya pada mata dan lampu; sisanya netral |

**Larangan:** menambah elemen wajah baru; menyambung tangan ke badan; memakai lebih dari satu lampu status; mengubah warna badan menjadi non-putih; animasi yang membuat karakter terlihat panik di luar pose "Bingung".

---

## 2. Palet & Token

CSS variables di `svg#bot` (satu sumber kebenaran; tidak ada hex di dalam kode animasi).

| Token | Gelap (default) | Terang | Dipakai untuk |
|---|---|---|---|
| `--bot-stage` | `#161616` | `#EDF0FB` | latar panggung (di luar SVG) |
| `--bot-body` | `#F5F7FF` | `#F5F7FF` | badan |
| `--bot-body-stroke` | `transparent` | `#D5DAF3` (1.5) | tepi badan |
| `--bot-body-glint` | `#FFFFFF` (opa .9) | `#FFFFFF` (opa .9) | sorot atas badan |
| `--bot-hand` | `#E6EAFB` | `#E6EAFB` | tangan |
| `--bot-hand-stroke` | `#CDD4F1` | `#CDD4F1` | tepi tangan |
| `--bot-visor` | `#1F2540` | `#1F2540` | layar wajah |
| `--bot-eye` | `#7CF3D6` | `#7CF3D6` | mata & mulut (glow mint) |
| `--bot-blush` | `#FF9DB8` (opa .65) | `#FF9DB8` (opa .65) | pipi, lidah |
| `--bot-stem` | `#C5CCEE` | `#C5CCEE` | batang antena, lampu padam |
| `--bot-info` | `#4C8DFF` | `#4C8DFF` | lampu: berpikir/bekerja/berbicara/mendengar |
| `--bot-ok` | `#2EC27E` | `#1FA866` | lampu: sukses |
| `--bot-ask` | `#FFB020` | `#F59E0B` | lampu & gelembung: bertanya |
| `--bot-bad` | `#F0524A` | `#E5453D` | lampu: error/bingung |
| `--bot-shadow` | `rgba(0,0,0,.40)` | `rgba(40,48,96,.14)` | bayangan tanah |
| `--bot-sweat` | `#7AB8FF` | `#7AB8FF` | keringat |
| `--bot-zzz` | `#8FA0E8` | `#8FA0E8` | huruf z |
| `--bot-key` | `#8FA0E8` / `#C9D2F7` | sama | badan & tombol keyboard |
| `--bot-confetti-1..5` | `#FFC94D #FF9DB8 #7CF3D6 #4C8DFF #FF7A59` | sama | konfeti |

---

## 3. Anatomi SVG & Geometri

`viewBox="0 0 200 200"`. Tampil default 176×176 px (1 unit ≈ 0,88 px); harus tetap tajam di 96–400 px.

### 3.1 Koordinat dasar (pose Diam)

| Elemen | Nilai |
|---|---|
| Bayangan tanah | `ellipse cx=100 cy=178 rx=50 ry=7` |
| Tangan kiri / kanan (posisi istirahat) | `ellipse rx=12 ry=11` di `(42,152)` / `(158,148)`; stroke 1,5 |
| Batang antena | `path M100 62 V46`, lebar 4, ujung bulat |
| Lampu | `circle cx=100 cy=39 r=8.5`; kilap `circle cx=97 cy=36 r=2.4` putih opa .7 |
| Badan | `rect x=40 y=60 width=120 height=106 rx=46` |
| Sorot badan | `ellipse cx=68 cy=75 rx=16 ry=6` |
| Visor | `rect x=57 y=86 width=86 height=50 rx=23` |
| Pipi | `ellipse cx=68/132 cy=123 rx=6 ry=3.4` |
| Mata kiri / kanan | `ellipse cx=84 / 116, cy=108, rx=5, ry=7.5`; kilap putih `circle r=1.7` di `(cx+1.6, 105)` |
| Mulut default (senyum) | `path M94 121 q6 6 12 0` (stroke 2,8, ujung bulat, tanpa isi) |

### 3.2 Hierarki layer (ID wajib, urutan dari belakang ke depan)

```
svg#bot  (viewBox 0 0 200 200, data-pose, data-mood)
├─ g#shadow                      ← bayangan tanah (skala mengikuti float)
├─ g#hands-back                  ← tangan di belakang badan (default)
│   ├─ g#hand-l   g#hand-r       (pivot: pusat tangan)
├─ g#body-float                  ← grup yang mengambang (translate/rotate/scale)
│   ├─ g#antenna                 (pivot: pangkal batang 100,62) → path#stem, g#bulb
│   │     g#bulb → circle#bulb-core, circle#bulb-glint, circle#bulb-ring
│   ├─ g#body → rect#body-shape, ellipse#body-glint
│   ├─ g#visor → rect#visor-shape
│   │     g#cheeks
│   │     g#eyes → g#eye-l, g#eye-r
│   │          varian per mata (tampil satu): .e-open .e-blink .e-happy .e-focus
│   │          .e-wide .e-worried .e-sleep .e-flat .e-down(keyboard) 
│   │     g#mouth → .m-smile .m-flat .m-o .m-bigsmile .m-wavy .m-open(+#tongue) .m-yawn
│   └─ g#props-float             ← ikut mengambang: dot-1..3, q-bubble, zzz-1..3, sweat-1/2
├─ g#props-world                 ← tidak ikut mengambang: keyboard, arc suara, konfeti pool
│   ├─ g#keyboard   g#sound-arcs (arc-r1..3, arc-l1..3)   g#confetti (24 elemen pool)
├─ g#hands-front                 ← tangan yang harus tampil DI DEPAN badan/keyboard
└─ g#fx                          ← kilat, riak, kepulan kecil (efek sesaat)
```

Aturan layer:
1. Tangan berpindah antara `#hands-back` dan `#hands-front` **sesuai pose** (tabel §6); perpindahan dilakukan saat tangan berada di luar siluet badan atau saat crossfade 80 ms agar tidak melompat.
2. Pose **Berpikir** (tangan di dagu) dan **Bekerja** (di atas keyboard) menaruh tangan terkait di `#hands-front`.
3. **Catatan koreksi dari lembar contoh:** pada lembar desain, keyboard tergambar di atas tangan. Di implementasi, **tangan harus di depan keyboard**.
4. Hanya satu varian `.e-*` dan satu `.m-*` yang tampil sekaligus. Sisanya `opacity:0` (jangan `display:none` agar transisi crossfade bisa jalan).

### 3.3 Pivot (transform-origin)

Semua grup memakai `transform-box: fill-box` dengan origin berikut:

| Grup | Origin |
|---|---|
| `#body-float` | `100px 166px` (tengah-bawah badan; squash/stretch dan miring terasa menapak) |
| `#antenna` | `100px 62px` (pangkal batang) |
| `#hand-l`, `#hand-r` | `50% 50%` (pusat tangan); gerakan lambai memakai pivot "pergelangan" `50% 130%` |
| `#eye-l`, `#eye-r` | `50% 50%` |
| `#bulb` | `50% 50%` |
| `#shadow` | `50% 50%` |

---

## 4. Bank Ekspresi

### 4.1 Mata

| Varian | Bentuk | Dipakai di |
|---|---|---|
| `e-open` | oval `rx5 ry7.5` + kilap | idle, berpikir, berbicara |
| `e-blink` | `ry` → 0.6 (garis tipis); hanya animasi sesaat 120 ms | semua (kedip) |
| `e-happy` | busur `^ ^`: `M78 113 q6 -10 12 0` dan `M110 113 q6 -10 12 0`, stroke 3,6 | senang, lambaian, dipoke |
| `e-focus` | `ry` 4,5 (menyipit), turun ke `cy=113` | bekerja |
| `e-wide` | `ry` 9 | bertanya, mendengar, startle |
| `e-worried` | oval miring: `rotate(-16)` kiri, `rotate(+16)` kanan | bingung, "kesal" saat dipoke berulang |
| `e-sleep` | busur ke bawah `M78 107 q6 7 12 0` (opa .85) | tidur |
| `e-flat` | garis datar `M78 108 h12` | offline |

**Arah pandang** (`setLook(x,y)`, -1..1) menggeser grup `#eyes` sejauh maksimum **±4 unit (x)** dan **±3 unit (y)** dengan lerp 0,18 per frame. Kilap mata ikut bergeser 20% lebih jauh agar terasa menatap.

### 4.2 Mulut

| Varian | Bentuk |
|---|---|
| `m-smile` | `M94 121 q6 6 12 0` |
| `m-flat` | `M95 123 h10` |
| `m-o` | `ellipse cx=100 cy=123 rx=3.2 ry=3.8` (mint) |
| `m-bigsmile` | `M90 118 q10 14 20 0 z` (terisi mint) |
| `m-wavy` | garis sinus panjang di-*clip* ke jendela `x 92..108`, digeser horizontal (lihat §6.6) |
| `m-open` | elips terisi mint + lidah pink; **parametris** (lihat §6.7) |
| `m-yawn` | `m-open` maksimum (`a=1`) bertahan ±1 s |

### 4.3 Lampu antena (bahasa status)

Warna **tidak** boleh jadi satu-satunya pembeda (aksesibilitas): setiap status punya **pola kedip** sendiri.

| Status | Warna | Pola |
|---|---|---|
| Diam | `--bot-stem` | padam, "standby" opasitas .75↔1, periode 4 s |
| Berpikir | `--bot-info` | menyala stabil, denyut halus .85↔1 periode 2 s |
| Bekerja | `--bot-info` | berkedip tak beraturan mengikuti ketikan (lihat §6.3) |
| Bertanya | `--bot-ask` | **kedip ganda** (on-off-on-off-jeda) periode 1,6 s |
| Senang | `--bot-ok` | menyala + denyut ringan periode 0,8 s |
| Bingung | `--bot-bad` | kedip cepat 4 Hz selama 1 s, jeda 0,8 s, ulang |
| Berbicara | `--bot-info` | **2 Hz** (opasitas 1↔.35) + cincin riak setiap 0,5 s |
| Tidur | `--bot-stem` | redup .35↔.6, periode 4,5 s |
| Mendengar | `--bot-info` | denyut mengikuti level mic |
| Offline | mati | kedip merah 150 ms setiap 3 s (mencari koneksi) |

### 4.4 Tangan

Tangan boleh: bergeser, berotasi (±25°), skala (0,9–1,1, untuk menekan). Tangan **tidak** berubah bentuk (tetap elips) kecuali *squash* ≤ 8% saat mengetik/mendarat.

---

## 5. Prinsip Animasi & Arsitektur

### 5.1 Tiga lapisan animasi (ditumpuk dengan `composite:"add"`)

| Lapisan | Isi | Siklus hidup |
|---|---|---|
| **A. Ambient** | float badan, napas, kedip, standby lampu, bayangan | berjalan terus selama pose aktif; parameternya (amplitudo/periode) ditentukan pose |
| **B. Pose** | posisi tangan, varian mata/mulut, lampu, props, loop khas pose | dimulai saat `setPose`, berhenti saat pose berganti |
| **C. Reaksi (one-shot)** | lambaian, poke, startle, nod, intro, mengintip kursor | dipicu `IdleDirector` atau `react()`, selesai lalu dilepas |

Prioritas bila bentrok: **C > B > A**. Reaksi bertanda `critical:false` **dibatalkan otomatis** bila pose berganti ke `asking`, `confused`, atau `working`.

### 5.2 Token easing

| Nama | Kurva | Dipakai untuk |
|---|---|---|
| `ease-soft` | `cubic-bezier(.45,0,.55,1)` | float, napas, goyang pelan |
| `ease-out` | `cubic-bezier(.22,1,.36,1)` | gerak tangan naik/masuk |
| `ease-pop` | `cubic-bezier(.34,1.56,.64,1)` | muncul dengan *overshoot* (dot, ?, lencana, tangan) |
| `ease-fall` | `cubic-bezier(.5,0,.9,.6)` | jatuh (keringat, konfeti) |
| `linear` | — | geser terus-menerus (mulut bergelombang, sapuan mata) |

### 5.3 Prinsip "hidup, tidak monoton"

1. **Squash & stretch ringan** pada setiap lompatan/pendaratan (skala Y 0,94–1,06, X berlawanan).
2. **Antisipasi** sebelum gerak besar (turun 2–3 unit sebelum naik) dan **follow-through** sesudahnya (kembali dengan sedikit melampaui).
3. **Gerak sekunder tertunda**: tangan mengikuti badan dengan lag 0,25–0,7 s; antena miring berlawanan arah dengan percepatan badan (±3°, lag 120 ms).
4. **Jitter acak**: periode loop `T` diacak ±15% **setiap siklus** (PRNG ber-seed; seed tetap saat tes).
5. **Fase berbeda** antar elemen (tangan kiri ≠ tangan kanan ≠ badan) agar tidak bergerak serempak seperti mesin.
6. **Variasi kedip**: interval 2,5–5,5 s; 15% kedip ganda (jeda 180 ms); 10% kedip lambat (220 ms).
7. **Jeda**: pola berulang selalu punya jeda diam 0,3–1,5 s agar tidak terasa tak berhenti bergerak.
8. **Mood** (§9.4) mengubah amplitudo dan peluang perilaku, jadi karakter yang sama terasa berbeda setelah sukses atau gagal.

### 5.4 Konvensi teknis

- Properti yang dianimasikan **hanya** `transform` dan `opacity` (kecuali `d`/`rx`/`ry` pada mulut parametris yang diubah lewat JS per frame).
- Gunakan Web Animations API (`element.animate`) dan **jangan** membuat elemen DOM baru per frame. Konfeti memakai **pool tetap 24 elemen**.
- Pose baru **mulai dari nilai transform saat ini** (baca `getComputedStyle`/`commitStyles`) sehingga perpindahan pose tidak melompat. Durasi transisi pose default **280 ms** dengan `ease-pop` untuk tangan, `ease-soft` untuk badan, 120 ms crossfade untuk mata/mulut.
- Satu **jam global** (`requestAnimationFrame`) hanya berjalan saat dibutuhkan (bicara, lip-sync, eye-tracking) dan berhenti saat tab disembunyikan.
- Semua angka waktu/amplitudo berada di `packages/avatar/src/timing.ts` (satu objek konstanta bertipe), bukan tersebar di komponen.

EOF
wc -l /mnt/user-data/outputs/CHARACTER.md---

## 6. Spesifikasi 8 Pose

Notasi: koordinat `translate(x,y)` adalah **offset relatif** dari posisi istirahat §3.1 dalam unit SVG. "L" = tangan di sisi **kiri layar** (`#hand-l`), "R" = tangan di sisi **kanan layar** (`#hand-r`). Semua penyebutan kiri/kanan mengikuti **sudut pandang layar**, bukan sudut pandang karakter. `T±15%` berarti periode diacak setiap siklus.

### 6.1 Diam (idle)

**Bahan:** mata `e-open`; mulut `m-smile`; lampu padam (standby); tangan di `#hands-back`; tanpa props.

| Elemen | Gerakan | Parameter |
|---|---|---|
| **Badan mengambang** | `translateY 0 → -4 → 0` | `T=3,2 s ±15%`, `ease-soft`, infinite. Rotasi bergoyang `-1° ↔ +1°` periode 6,4 s |
| **Bayangan** | skala X `1 → 0,9`, opasitas `.14 → .09` bersama float (terbalik) | sinkron dengan float |
| **Tangan (ambient)** | L naik-turun ±3, R ±3 | lag L = 0,35 s, R = 0,7 s terhadap badan |
| **Kedip** | `ry → 0.6` lalu kembali, 120 ms total (60 tutup + 60 buka) | interval acak 2,5–5,5 s; 15% kedip ganda; 10% kedip lambat |
| **Antena (follow-through)** | rotasi `±3°` berlawanan arah float, lag 120 ms | ikut float |
| **Lampu standby** | opasitas `.75 ↔ 1` | `T=4 s` |
| **Melirik** | `#eyes` bergeser `x ±3, y ±2` selama 0,6–1,4 s lalu kembali | acak 4–9 s sekali |

**Lambaian sebelah tangan (sesekali)** — dipicu `IdleDirector`, interval acak **8–14 s**, 70% tangan **R**, 30% tangan **L** (tidak sama dua kali berturut-turut):

| Waktu | Aksi (contoh tangan R) | Kurva |
|---|---|---|
| 0–120 ms | antisipasi: tangan turun `translate(0,+3)`; badan miring `+1,5°` ke sisi tangan | `ease-soft` |
| 120–400 ms | tangan naik ke `translate(+8,-48)` (±(166,100)); mata berganti `e-happy`; mulut `m-bigsmile` | `ease-pop` |
| 400–1280 ms | **melambai**: rotasi pivot pergelangan `-20° → +20° → -20° → +20°`, 4 setengah-siklus × 220 ms | `ease-soft` |
| 1280–1600 ms | kembali ke posisi istirahat; mata `e-open`; mulut `m-smile` | `ease-in-out` |

Untuk tangan L: cerminkan (`translate(-8,-44)`, rotasi tanda berlawanan).

**Variasi anti-monoton (diundi `IdleDirector`, §9.1):** antena goyang kecil, regangan (kedua tangan naik, badan `scaleY 1,04`), lompat mini, menguap setelah 60 s tak ada aktivitas, melirik ke kursor.

**Kriteria penerimaan:**
- Dalam jendela 12 detik (jam palsu) terjadi ≥ 2 kedip, float ≥ 3 siklus, dan ≥ 1 lambaian sepanjang 60 detik uji.
- Dua lambaian berturut-turut tidak menggunakan tangan dan jeda yang identik.
- Tidak ada elemen yang bergerak di luar `#body-float`, `#hands-*`, `#shadow` (tak ada props).

---

### 6.2 Berpikir (thinking)

**Bahan:** mata `e-open` melirik **kanan-atas** (`x+4, y-4`); mulut `m-flat` (sesekali bergeser 1 unit kiri-kanan); lampu biru stabil; **tangan R (sisi kanan layar) di `#hands-front`**; props: tiga titik `dot-1..3` di `#props-float`.

| Elemen | Gerakan | Parameter |
|---|---|---|
| **Badan mengambang perlahan** | `translateY 0 → -3 → 0`; miring `-3°` (kepala menunduk berpikir) | `T=4,0 s ±15%`, `ease-soft` |
| **Tangan R ke dagu** | dari istirahat `(158,148)` ke titik dagu kanan `(114,148)` | 350 ms, `ease-pop` (masuk ke `#hands-front` saat 80 ms pertama) |
| **Usapan dagu** | tangan R berayun `x ±2,5`, `y ±1,5`, rotasi `±8°`: **3 usapan × 300 ms**, lalu **diam 1,2 s**, ulang | siklus ≈ 2,1 s; jeda diundi 0,9–1,6 s |
| **Tangan L** | melayang santai ±3 (lag 0,5 s) di sisi kiri | ambient |
| **Mata** | melirik kanan-atas ↔ kiri-atas (pindah tiap 2,5–4 s, 400 ms); kedip lambat 3–6 s | — |
| **Lampu** | biru stabil + denyut `.85 ↔ 1` | `T=2 s` |

**Animasi tiga titik (loading), berulang:** posisi `dot-1 (124,32) r2.6`, `dot-2 (133,25) r3.4`, `dot-3 (144,20) r4.4`, warna `--bot-info`, ikut float.

| Waktu (siklus 1,8 s) | Aksi |
|---|---|
| 0,00 s | `dot-1` muncul: skala `0 → 1`, opasitas `0 → 1`, 180 ms, `ease-pop` |
| 0,35 s | `dot-2` muncul (sama) |
| 0,70 s | `dot-3` muncul (sama) |
| 0,70–1,35 s | ketiganya tampil; masing-masing "berdenyut" skala `1 → 1,12 → 1` bergiliran 150 ms |
| 1,35–1,60 s | ketiganya memudar bersama: opasitas `1 → 0`, skala `1 → .8` |
| 1,60–1,80 s | kosong, lalu ulang |

Titik terus berulang **selama agent berpikir**; berhenti dengan memudar 150 ms saat pose berganti.

**Kriteria penerimaan:**
- Titik tampil **satu per satu** dengan selisih 0,35 s ±0,02 (tes jam palsu).
- Tangan R berada di `#hands-front` dan berjarak ≤ 10 unit dari titik dagu selama pose.
- Berpindah ke pose lain mengembalikan tangan R ke `#hands-back` tanpa lompatan visual.

---

### 6.3 Bekerja (working) — varian default: **mengetik**

**Bahan:** mata `e-down` (menyipit, turun ke `cy=113`); mulut `m-flat`; lampu biru kedip aktivitas; **keyboard** di `#props-world`; **kedua tangan di `#hands-front`** di atas keyboard.

Posisi: keyboard `rect x=54 y=166 width=92 height=14 rx=6` (`--bot-key`) + alur tombol `rect x=62 y=170 width=76 height=3` (`#C9D2F7`). Tangan L istirahat di `(72,170)`, R di `(128,170)`.

| Elemen | Gerakan | Parameter |
|---|---|---|
| **Mengetik** | L dan R bergantian `translateY 0 → -5 → 0` + squash `scaleY .94` saat menekan | periode **0,22 s** per tangan, R tertunda 0,11 s |
| **Burst & jeda** | 1,2–2,0 s mengetik cepat (periode **0,14 s**), lalu jeda 0,4–0,9 s (tangan melayang diam di atas tombol), ulang | menirip pola manusia |
| **Enter** | tiap 3–5 burst: kedua tangan menekan **serentak** + badan mengangguk `translateY +2` 150 ms | — |
| **Tombol menyala** | highlight tombol di bawah tangan yang menekan (`#C9D2F7 → #FFFFFF`, 80 ms) | sinkron ketikan |
| **Badan** | mengambang kecil `±1,5`, `T=3,6 s`; membungkuk ke depan `rotate +2°` | fokus |
| **Lampu** | opasitas `.7 ↔ 1` kedip tidak teratur, sinkron burst (terang saat mengetik, redup saat jeda) | seperti LED aktivitas |

**Gerak mata (membaca layar-keyboard), siklus 1,9 s ±15%:**

| Waktu | Aksi |
|---|---|
| 0,00–1,40 s | `#eyes` bergeser **kiri → kanan**: `x -4 → +4`, `linear` (seperti membaca baris) |
| 1,40–1,52 s | **kedip** (120 ms) |
| 1,52–1,77 s | mata kembali ke kiri cepat (`x +4 → -4`, 250 ms, `ease-out`) |
| 1,77–1,90 s | jeda; ulang. Setiap siklus ke-3 geser `y` sedikit (`+1 → 0`) seolah pindah baris |

**Kriteria penerimaan:**
- Tangan L dan R **tidak pernah** berada pada fase gerak yang sama (selisih ≥ 0,08 s).
- Mata menyelesaikan sapuan kiri→kanan, kedip, lalu kembali; ≥ 3 siklus per 6 detik uji.
- Tangan tampil **di depan** keyboard (z-order benar).

---

### 6.4 Bertanya (asking)

**Bahan:** mata `e-wide` menatap pengguna; mulut `m-o`; lampu kuning (kedip ganda); props: gelembung `q-bubble` (kuning, `circle (160,44) r14` + teks "?" putih tebal 18 px) di `#props-float`.

| Elemen | Gerakan | Parameter |
|---|---|---|
| **Raise hand (R)** | tangan R terangkat ke `(160,86)` (`translate(+2,-62)`) | masuk 350 ms `ease-pop`, antisipasi turun 2 unit sebelum naik |
| **Goyang tangan** | rotasi `-8° ↔ +8°` pivot pergelangan, 3 goyangan × 260 ms, **jeda 0,9 s**, ulang | siklus ≈ 1,7 s |
| **Badan** | condong ke arah pengguna: `scale 1,03`, `rotate +3°` (ke sisi tangan), float `±3` `T=2,6 s` | bersemangat |
| **Tangan L** | tetap istirahat, mengetuk-ngetuk paha: `translateY ±2` periode 0,6 s | gelisah halus |
| **Mata** | menatap pusat; tiap 3–5 s melirik singkat ke bawah (seakan memeriksa) lalu kembali | — |

**Tanda tanya hilang-timbul (siklus 1,6 s ±15%):**

| Waktu | Aksi |
|---|---|
| 0,00–0,25 s | muncul: skala `0 → 1,15 → 1`, opasitas `0 → 1` (`ease-pop`) |
| 0,25–0,95 s | tampil, **goyang** rotasi `±6°` periode 0,35 s |
| 0,95–1,20 s | memudar: opasitas `1 → 0`, skala `1 → .9` |
| 1,20–1,60 s | tidak tampil (jeda) |

Lampu kuning berkedip ganda **bersamaan** dengan munculnya tanda tanya (on 120 ms, off 80, on 120, off 1280).

**Eskalasi anti-monoton (untuk menarik perhatian):**

| Lama tanpa jawaban | Perubahan |
|---|---|
| 0–20 s | pola normal di atas |
| 20–60 s | siklus tanda tanya 1,1 s; goyang tangan 4× lebih energik (`±12°`); tanda tanya kedua kecil (`r9`) muncul di kiri, tertunda 0,5 s |
| > 60 s | tetap pola 20–60 s dan memicu **pengingat lisan** satu kali (PRD FR-045); tidak pernah auto-approve |

**Kriteria penerimaan:** tanda tanya benar-benar **hilang** (opasitas 0) minimal 0,3 s tiap siklus; tangan R berada di atas garis atas visor (`y < 86`) selama pose; eskalasi terjadi pada jam palsu 20 s.

---

### 6.5 Senang (celebrate)

**Bahan:** mata `e-happy`; mulut `m-bigsmile`; lampu hijau denyut `T=0,8 s`; props: konfeti pool + kilau kecil.

| Elemen | Gerakan | Parameter |
|---|---|---|
| **Badan mengambang lebih cepat** | `translateY 0 → -6 → 0` | `T=1,6 s ±10%` (≈ 2× lebih cepat dari idle); amplitudo 6 (idle 4) |
| **Tangan naik-turun di samping badan** | L di `(36,96)`, R di `(164,96)`; **berlawanan fase**: `translateY ±12`, rotasi `±12°` | periode **0,8 s**; L dan R selisih setengah siklus |
| **Lompat** | tiap burst ke-3: badan `translateY -14` (antisipasi turun 3), `scaleY .94` saat mendarat | 500 ms |
| **Mata** | `e-happy`; mengerjap cepat sesekali (`ry` → `e-open` 120 ms) | tiap 2–3 s |
| **Lampu hijau** | denyut opasitas `.8 ↔ 1` | `T=0,8 s` |

**Konfeti meledak berulang** (kertas kecil dari atas badan):

| Parameter | Nilai |
|---|---|
| Pool | **24 elemen tetap**: 16 persegi panjang `4×7`, 8 lingkaran `r2.5`; warna bergilir `--bot-confetti-1..5` |
| Asal ledakan | `(100,56)` (atas badan), di `#props-world` |
| Interval ledakan | **1,5 s** (ledakan pertama langsung saat pose mulai) |
| Sudut lontar | menyebar ke atas `-160° … -20°` (`angle_i = -160 + i·(140/(n-1)) ± 8°`) |
| Jarak lontar | `55–90` unit; lalu jatuh `+40` unit karena gravitasi |
| Rotasi | `±(360–720)°` per butir |
| Durasi tiap butir | `1,3–1,7 s` (acak per butir) |
| Kurva | naik `ease-out` (0–35% waktu), jatuh `ease-fall`; opasitas memudar di 30% terakhir |
| Awal | skala `.4 → 1` dalam 80 ms |

Parameter per butir diberikan lewat CSS variables (`--dx`, `--dy`, `--fall`, `--rot`, `--dur`) lalu `animate()`; pool didaur ulang tanpa membuat/menghapus node.

**Durasi pose:** default **3,0 s** (≥ 2 ledakan) lalu kembali ke `idle` dengan mood `happy` (§9.4). Bisa dikonfigurasi; di galeri dev dapat di-*loop* terus.

**Kriteria penerimaan:** ≥ 2 ledakan dalam 3 s; jumlah node DOM konfeti **konstan** (24) sebelum, selama, dan sesudah; tidak ada butir yang tersisa setelah pose berakhir; tangan L/R tidak pernah sefase.

---

### 6.6 Bingung (confused)

**Bahan:** mata `e-worried` (miring ±16°) yang bergerak mencari; mulut `m-wavy`; lampu merah (kedip cepat 4 Hz selama 1 s, jeda 0,8 s); props: keringat `sweat-1`, `sweat-2`.

| Elemen | Gerakan | Parameter |
|---|---|---|
| **Mulut bergelombang** | garis sinus panjang (periode gelombang 16 unit, amplitudo 3, stroke 2,8) di-*clip* ke jendela `x 92..108`, `translateX 0 → -16` **berulang tanpa putus** | `T=0,7 s`, `linear`, infinite |
| **Tangan R menggaruk kepala** | pindah ke `(136,76)` (sisi atas kanan kepala), lalu gosok: `translate(±5, ±2)`, rotasi `±10°` | **5 gosokan × 140 ms**, jeda 0,8 s, ulang; masuk 300 ms `ease-pop` |
| **Tangan L** | menggantung di samping badan, bergetar halus `±1` periode 0,25 s | gugup |
| **Badan** | menggeleng `translateX ±3`, rotasi `±3°`, periode 1,6 s; float kecil `±2` | — |
| **Mata** | bergerak kiri-kanan mencari (`x -3 ↔ +3`, 1,2 s), kedip lambat | — |

**Keringat naik-turun-hilang, berulang (siklus 1,8 s ±15%):** bentuk tetes `M150 82 q-6 9 0 13 q6 -4 0 -13z` (`--bot-sweat`), ikut float.

| Waktu | Aksi |
|---|---|
| 0,00–0,20 s | muncul di pelipis kanan: skala `0 → 1`, opasitas `0 → 1` |
| 0,20–0,35 s | **naik** sedikit `translateY -4` (melayang) |
| 0,35–1,50 s | **jatuh** `translateY → +22`, `ease-fall`; skala `1 → .8` |
| 1,50–1,65 s | memudar `1 → 0` |
| 1,65–1,80 s | jeda, ulang |

`sweat-2` (lebih kecil, di pelipis kiri) mengikuti pola yang sama dengan **tunda 0,9 s**.

**Durasi:** transient default **4,0 s** lalu menurun ke `idle` mood `wary`; tetap tampil selama state `error` aktif bila PRD memerlukannya.

**Kriteria penerimaan:** gelombang mulut bergerak terus-menerus tanpa lompatan (loop mulus); keringat benar-benar menghilang tiap siklus; garukan tangan R berhenti sejenak (jeda) tiap siklus.

---

### 6.7 Berbicara (speaking) — **overlay**

Berjalan **di atas** pose dasar (`idle`, `working`, `asking` bila perlu). Aktif dari `onstart` TTS sampai `onend`/cancel, dengan `setSpeechLevel(level)` (0..1) dipanggil ≤ 30 Hz.

**Mulut parametris** (`m-open`), dihitung per frame dari `level` terhaluskan (`a = lerp(a, level, .35)`):

| Besaran | Rumus |
|---|---|
| `rx` | `3 + 3,5·a` |
| `ry` | `1,5 + 6,5·a` |
| pusat `cy` | `120 + ry·0,6` |
| lidah | elips pink `cy = 120 + ry·1,3`, `rx = rx·0,6`, `ry = ry·0,4`, tampil bila `a > .4` |
| tertutup | bila `a < .08` gambar `m-smile` (bukan elips) |

Hasilnya mulut **kecil ↔ besar berulang** mengikuti suara. Generator level TTS tanpa analisis audio memakai rumus PRD §9.3 (`0,25 + 0,6·|sin(2π·f·t)| + noise`, aksen +0,2 pada `boundary`).

**Tanda suara muncul satu per satu (siklus 1,2 s ±15%), di kedua sisi kepala:**

| Busur | Kanan (path) | Kiri (cermin `x' = 200 − x`) |
|---|---|---|
| kecil | `M164 92 q5 6 0 12` | `M36 92 q-5 6 0 12` |
| sedang | `M171 85 q9 12 0 26` | `M29 85 q-9 12 0 26` |
| besar | `M179 77 q13 19 0 42` | `M21 77 q-13 19 0 42` |

Stroke 3,4, ujung bulat, `--bot-info`, opasitas puncak .85 (dikali `0,6 + 0,4·level`).

| Waktu | Aksi |
|---|---|
| 0,00 s | busur **kecil** muncul: opasitas `0 → .85`, skala `.7 → 1` (180 ms, `ease-pop`) |
| 0,20 s | busur **sedang** muncul |
| 0,40 s | busur **besar** muncul |
| 0,40–0,90 s | ketiganya tampil |
| 0,90–1,20 s | memudar bersama, ulang |

**Lampu status berkedip:** `--bot-info` opasitas `1 ↔ .35` periode **0,5 s** (2 Hz) + cincin riak `r 8,5 → 16`, opasitas `.45 → 0` tiap 0,5 s.

**Gerak pendukung:** badan menunduk-angguk mengikuti level `translateY -1,5·a`; pada tiap **`boundary`/aksen kata** satu tangan (bergantian L/R) melakukan *beat* `translateY -6` 250 ms `ease-out` (gestur bicara); mata tetap menatap pengguna, kedip normal.

**Kriteria penerimaan:** mulut tertutup ≤ 100 ms setelah TTS berhenti; busur suara muncul berurutan kecil→besar dengan selisih 0,2 s ±0,02; lampu berkedip 2 Hz ±0,2; tidak ada gerak mulut saat tidak berbicara.

---

### 6.8 Tidur (sleeping)

**Bahan:** mata `e-sleep`; mulut elips mungil `rx2.4 ry2` (napas), opa .85; lampu redup (`--bot-stem` opa .35↔.6, `T=4,5 s`); tangan di `#hands-back` menepi ke `(64,172)` dan `(136,172)`; props: `zzz-1..3`.

| Elemen | Gerakan | Parameter |
|---|---|---|
| **Badan** | **diam** (tanpa translasi/rotasi). *Opsional* napas `scaleY 1 → 1,008` `T=4,5 s` hanya bila `sleepBreathing=true` (default **false**) | sesuai permintaan: badan diam |
| **Tangan** | diam menepi; sesekali berkedut `±1` (acak 20–40 s) | sangat halus |
| **Bayangan** | statis | — |
| **Mata & mulut** | statis | — |

**ZZZ muncul satu per satu ke atas, berulang (siklus 3,0 s):** huruf "z" (`font-weight 800`, `--bot-zzz`) ukuran 16, 22, 28 pada tangga `(140,60)`, `(154,42)`, `(172,22)`.

| Waktu | Aksi |
|---|---|
| 0,0 s | `zzz-1` (kecil) muncul: opasitas `0 → .9`, skala `.7 → 1`, drift `-4` ke atas selama 1,2 s |
| 0,5 s | `zzz-2` (sedang) muncul (sama) |
| 1,0 s | `zzz-3` (besar) muncul (sama) |
| 1,0–2,3 s | ketiganya tampil dan masih melayang naik pelan |
| 2,3–2,8 s | memudar bersama |
| 2,8–3,0 s | jeda, ulang |

**Bonus anti-monoton (P1, tidak mengganggu "badan diam"):** setiap 10–15 s sebuah **gelembung ingus** kecil mengembang di sisi kanan mulut (`r 0 → 6`, 2 s) lalu pecah (skala `1 → 1,4`, opasitas `→ 0`, 120 ms).

**Kriteria penerimaan:** `#body-float` tidak memiliki animasi transform aktif (mode default); ketiga z muncul berurutan dari kecil ke besar dengan selisih 0,5 s ±0,03 dan bergerak **ke atas**; semua hilang tiap siklus.

---

## 7. Pose Tambahan (dibutuhkan state machine PRD)

### 7.1 Mendengar (listening)

**Bahan:** mata `e-wide` menatap ke depan; mulut `m-flat` kecil; lampu biru **berdenyut mengikuti level mikrofon**; tangan L/R terangkat sedikit dan terbuka ke luar (`translate(∓6,-10)`); props: busur suara **menyusut ke arah karakter** (kebalikan arah busur "Berbicara").

| Elemen | Gerakan |
|---|---|
| Badan | condong ke depan `rotate +2°`, `scale 1,02`; float `±2`, `T=2,4 s` |
| Busur mic | tiga busur kiri-kanan muncul **dari besar ke kecil** bergiliran (selisih 0,2 s), bergerak 6 unit ke arah wajah lalu memudar; siklus 1,2 s |
| Lampu | skala bola `1 + 0,25·levelMic`, opasitas `.7 + .3·levelMic` |
| Mata | sesekali mengangguk kecil (`y +1`) seolah menyimak, tiap 2–4 s |
| Tangan | terbuka ke luar dan sedikit terangkat; karakter tidak punya telinga, jadi "menyimak" ditunjukkan lewat tangan terbuka dan badan condong |

Kriteria: aktif ≤ 120 ms setelah mic menyala; saat mic berhenti, kembali ke pose sebelumnya ≤ 280 ms.

### 7.2 Offline

**Bahan:** mata `e-flat`; mulut `m-flat`; badan **pudar** (`filter` tidak dipakai; gunakan overlay abu `opacity .35` di atas badan); tangan menepi dan diam; lampu mati.

| Elemen | Gerakan |
|---|---|
| Badan | diam; tanpa float |
| Lampu | **kedip merah** 150 ms setiap 3 s (mencari koneksi), opasitas puncak .8 |
| Antena | terkulai `rotate -12°` (ujung condong turun) |
| Props | ikon kecil "putus koneksi" (dua titik terpisah) di atas kepala, opasitas .6 |

Kriteria: tidak ada animasi float; hanya kedip lampu dan perubahan ikon.

---

## 8. Varian Pose Bekerja (menurut jenis tool)

Pose `working` punya satu **varian** yang dipilih dari nama tool (tabel pemetaan nama tool berasal dari hasil M0, PRD §8.3a). Semua varian berbagi: lampu biru aktivitas, float kecil, badan membungkuk 2°. Perbedaan:

| Varian | Dipakai untuk | Props & tangan | Gerak mata |
|---|---|---|---|
| `typing` (**default**, §6.3) | edit, write, patch | keyboard di bawah; kedua tangan mengetik | sapuan kiri→kanan, kedip, ulang |
| `reading` | read, glob, grep, list | tangan memegang lembar dokumen kecil (`rect 40×52`) di depan visor; tangan R menggeser lembar ke atas pelan | sapuan **atas→bawah** (`y -3 → +3`) tiap baris, kedip tiap 3 baris |
| `running` | bash, shell | keyboard + chip terminal `>_` melayang di atas lampu; baris kode kecil berjalan di chip | seperti `typing`, tapi sesekali menoleh ke chip (`x +3, y -3`) |
| `searching` | webfetch, websearch | tangan R memegang kaca pembesar (`circle r9` + gagang) bergerak melingkar kecil | mata melirik berpindah acak (`±4`) mengikuti kaca pembesar |
| `delegating` | task, subagent | tangan R menunjuk; robot mini 30% ukuran muncul di kanan | menoleh ke robot mini |
| `generic` | tool tak dikenal/MCP | ikon roda gigi kecil berputar di atas antena | seperti `typing` |

Perpindahan antar varian: crossfade props 120 ms; tangan berpindah posisi 280 ms `ease-pop`.

---

## 9. Interaktivitas & Anti-Monoton

### 9.1 `IdleDirector` (jadwal perilaku mikro)

Hanya aktif pada pose `idle` (dan versi terbatas saat `listening`). Memakai PRNG ber-seed.

| Perilaku | Bobot | Cooldown min | Durasi | Deskripsi |
|---|---|---|---|---|
| `lookAround` | 30 | 12 s | 0,6–1,4 s | mata melirik `x ±3, y ±2` lalu kembali |
| `antennaWiggle` | 15 | 20 s | 0,8 s | antena bergoyang `±8°` 3× meredam |
| `waveR` | 12 | 25 s | 1,6 s | lambaian tangan kanan (§6.1) |
| `waveL` | 8 | 25 s | 1,6 s | lambaian tangan kiri |
| `stretch` | 8 | 40 s | 1,4 s | tangan naik ke atas, badan `scaleY 1,04`, lalu turun santai |
| `hum` | 7 | 40 s | 2,0 s | not musik kecil "♪" (path, bukan emoji) melayang dari kanan atas; mata `e-happy` setengah |
| `miniJump` | 5 | 40 s | 0,5 s | lompat 6 unit dengan squash saat mendarat |
| `antennaSpin` | 5 | 60 s | 1,0 s | bola lampu berkilat dan antena berputar kecil |
| `yawn` | 10* | 60 s | 1,6 s | menguap: mulut `m-yawn`, mata terpejam, tangan naik ke mulut (*hanya setelah ≥ 60 s idle*) |

Aturan: jeda acak **3–8 s** antar perilaku; tidak boleh perilaku yang sama dua kali berturut-turut; setiap perilaku menghormati cooldown-nya; bila `reducedMotion` aktif, hanya `lookAround` yang dipakai (perubahan arah mata tanpa gerak badan).
**Urutan mengantuk:** setelah **120 s** idle → `yawn` → mata mengantuk (`ry` menurun 2 detik) → transisi ke `sleeping`.

### 9.2 Mengikuti kursor & hover

- **Eye tracking** (hanya `idle`, `listening`, `asking`): arah pandang mengikuti kursor di jendela, `setLook` dengan lerp 0,18; di luar jendela kembali ke tengah dalam 600 ms. Dimatikan di `working`, `sleeping`, `offline`.
- **Hover** (kursor ≤ 120 px dari karakter): lampu antena **bersinar** (cincin riak sekali), tangan terdekat naik `-4`. Hover ≥ 1,2 s: satu lambaian singkat (hanya bila `idle`, cooldown 20 s).

### 9.3 Klik / "poke"

| Kondisi | Reaksi |
|---|---|
| 1 klik (`idle`/`listening`) | **squash** `scaleY .88, scaleX 1.08` 100 ms → pantul `1.04/.97` → normal (total 360 ms, `ease-pop`); mata `e-happy` 400 ms; mulut `m-bigsmile`; lampu berkilat |
| 3 klik dalam 2 s | **kesal lucu**: mata `e-worried` 600 ms, badan menggeleng `±3` 2×, mulut `m-flat`; lalu normal |
| 5+ klik dalam 3 s | pusing singkat: mata berputar (rotasi `±360°` kecil 500 ms), lalu normal; cooldown 8 s |
| klik saat `sleeping` | **terbangun kesal**: startle (§10) → mata setengah terbuka 1 s → kembali tidur bila tidak ada aktivitas |
| klik saat `working`/`asking` | **tidak ada** efek besar (hanya lampu berkilat) agar tidak mengganggu fokus |

### 9.4 Mood (kontinuitas emosi)

`mood ∈ {neutral, happy, wary}`; berlaku 10 detik lalu kembali `neutral` (peluruhan halus).

| Mood | Pemicu | Efek |
|---|---|---|
| `happy` | setelah `celebrate` | frekuensi kedip ×1,5; amplitudo float ×1,3; peluang `waveR/waveL` ×2; mata sesekali `e-happy` 300 ms |
| `wary` | setelah `confused` | amplitudo float ×0,7; `lookAround` ×1,5 lebih sering (mata waspada); kedip lebih lambat; tidak ada `hum`/`miniJump` |
| `neutral` | default | nilai dasar |

`data-mood` pada `svg#bot` dipakai tes visual.

### 9.5 Reaksi dari aplikasi (`react(kind)`)

| `kind` | Kapan dipanggil | Animasi (one-shot) |
|---|---|---|
| `hello` | saat aplikasi pertama kali dibuka/terhubung | **intro**: muncul skala `.6 → 1,08 → 1` (400 ms, `ease-pop`), lambaian, kedip |
| `nod` | prompt pengguna berhasil terkirim (ack) | anggukan `translateY +3 → 0` 280 ms + mata `e-happy` 250 ms |
| `perk` | pengguna mulai bicara (sebelum masuk `listening`) | lampu menyala + antena menegak (`rotate 0 → -6 → 0`), mata `e-wide` 200 ms |
| `startle` | bangun dari tidur atau event tak terduga | lompat `-8`, mata `ry` 0 → 9 → 7,5 (220 ms), antena goyang |
| `shrug` | agent mengembalikan jawaban kosong | kedua tangan naik ±6 dan turun, mulut `m-flat`, 600 ms |
| `thanks` | pengguna menekan "Izinkan sekali" | anggukan kecil + mata `e-happy` 300 ms |

Reaksi `critical:false` dibatalkan otomatis bila pose berubah ke `asking`, `confused`, atau `working`.

---

## 10. Koreografi Transisi Antar Pose

Prinsip: setiap perpindahan terasa **disengaja** (antisipasi → aksi → pengendapan), tetapi selesai ≤ 400 ms kecuali tidur/bangun.

| Dari → Ke | Koreografi |
|---|---|
| `idle → thinking` | badan turun 2 unit (antisipasi 80 ms), kepala miring `-3°`; tangan R bergerak ke dagu 350 ms; titik pertama muncul di 0,2 s |
| `idle → working` | membungkuk `+2°`; keyboard naik dari bawah (`translateY +14 → 0`, 250 ms `ease-out`); tangan turun ke keyboard 300 ms; mata turun |
| `working → thinking` | keyboard turun/memudar 150 ms; tangan R ke dagu |
| `* → asking` | **jeda 1 frame**, badan menegak, tangan R naik dengan overshoot; tanda tanya muncul pada 120 ms (menarik perhatian; boleh memotong reaksi) |
| `asking → working/thinking` | tangan R turun 280 ms, tanda tanya memudar 120 ms, mata kembali normal |
| `* → celebrate` | antisipasi turun 3 unit (80 ms) → lompat -14 → ledakan konfeti pertama pada puncak lompatan |
| `celebrate → idle` | **mengendap**: dua ayunan float meredam (amplitudo 6 → 3 → 4) selama 1,6 s, mood `happy` |
| `* → confused` | badan tersentak mundur `translateX -4` 120 ms, mata `e-worried`, lampu kedip merah, tangan R langsung ke kepala |
| `confused → idle` | tangan R turun, hela napas (badan turun 2 unit lalu naik), mood `wary` |
| `idle → sleeping` | `yawn` → mata mengantuk → antena menunduk `rotate -10°` → badan **berhenti** pelan (float meredam 1 s) → z pertama muncul |
| `sleeping → *` | **bangun**: `startle`, mata terbuka cepat, antena tegak; lalu lanjut ke pose tujuan |
| `* → offline` | lampu padam dengan redup 200 ms; badan memudar 300 ms; antena terkulai |
| `offline → idle` | lampu kedip hijau 2×, badan kembali berwarna, `hello` ringan (tanpa lambaian) |
| overlay `speaking` on/off | mulut dan lampu berganti 120 ms; busur suara memudar 150 ms saat berhenti |

Aturan interupsi: pose baru **membatalkan** animasi pose lama, memulai dari nilai saat ini, dan tidak pernah membiarkan elemen "tersangkut" di posisi tengah (ada pembersihan: `cancel()` + reset ke keadaan netral untuk props yang tidak dipakai).

---

## 11. Pemetaan State Agent → Pose & Lampu

Mengikuti prioritas PRD §8.2 (tidak diubah). Kolom kanan adalah tampilan baru.

| State PRD | Pose | Lampu | Catatan |
|---|---|---|---|
| `offline` | Offline | mati / kedip merah jarang | link putus |
| `confused` (error) | Bingung | merah | transient 4 s |
| `asking` (izin/form pending) | Bertanya | kuning kedip ganda | eskalasi §6.4 |
| `speaking` | **overlay** Berbicara | biru 2 Hz | di atas pose dasar |
| `listening` | Mendengar | biru mengikuti mic | barge-in: TTS dibatalkan |
| `working.*` | Bekerja + varian (§8) | biru kedip aktivitas | dari nama tool |
| `thinking` | Berpikir | biru stabil | eksekusi aktif tanpa tool |
| `celebrate` | Senang | hijau | transient 3 s |
| `idle` | Diam | padam | + `IdleDirector` |
| `sleeping` | Tidur | redup | idle > 120 s |

Overlay `speaking` bisa hidup bersamaan dengan `working`/`thinking`/`asking`: **tubuh dan tangan mengikuti pose dasar**, sedangkan **mulut, busur suara, dan pola lampu** mengikuti overlay (lampu: prioritas pola `asking` > `speaking` > pola pose dasar).

---

## 12. Antarmuka Renderer (kontrak untuk `packages/avatar`)

```ts
export type AvatarPose =
  | "idle" | "thinking" | "working" | "asking" | "celebrate"
  | "confused" | "sleeping" | "listening" | "offline";

export type WorkingVariant =
  | "typing" | "reading" | "running" | "searching" | "delegating" | "generic";

export type AvatarMood = "neutral" | "happy" | "wary";
export type ReactionKind = "hello" | "nod" | "perk" | "startle" | "shrug" | "thanks" | "poke";

export interface AvatarRenderer {
  mount(el: HTMLElement, opts: {
    theme: "light" | "dark";
    reducedMotion: boolean;
    seed?: number;            // PRNG; tetap saat tes
  }): void;

  setPose(pose: AvatarPose, opts?: { variant?: WorkingVariant; durationMs?: number }): void;
  setSpeechLevel(level: number): void;     // 0..1; >0 mengaktifkan overlay speaking; 0 menonaktifkan
  setLook(x: number, y: number): void;     // -1..1; null-safe
  setMood(mood: AvatarMood): void;
  react(kind: ReactionKind): void;
  setTheme(theme: "light" | "dark"): void;
  setReducedMotion(on: boolean): void;
  pause(): void; resume(): void;           // dipanggil saat tab disembunyikan / di luar viewport
  destroy(): void;
}
```

Kontrak tambahan:
- Atribut DOM untuk tes: `svg#bot[data-pose][data-variant][data-mood][data-speaking="true|false"]`, serta `data-anim="<nama>"` pada tiap elemen yang sedang dianimasikan.
- `timing.ts` mengekspor satu objek `T` bertipe (`T.idle.float.period`, `T.think.dots.stagger`, `T.speak.blinkHz`, …). Tidak ada angka waktu di luar file ini.
- Logika bisnis **hanya** memanggil `AvatarRenderer`; tidak boleh menyentuh DOM SVG.

---

## 13. Performa, Aksesibilitas, Reduced Motion

**Performa**
- Hanya `transform`/`opacity`; `will-change: transform` pada `#body-float`, `#hand-l`, `#hand-r`, `#antenna` (dilepas saat pose tidak aktif).
- Maksimum ±12 animasi WAAPI berjalan bersamaan; konfeti memakai pool 24 (satu `animate()` per butir hanya selama ledakan).
- Jam rAF **berhenti** saat `document.hidden`, saat di luar viewport (`IntersectionObserver`), dan saat tidak ada overlay speaking atau eye tracking.
- Target: ≥ 55 fps pada laptop menengah; CPU idle < 5%, pose ramai (senang) < 15%.
- Ukuran: SVG < 20 KB; paket `avatar` < 60 KB gzip.

**Aksesibilitas**
- `svg#bot` memakai `role="img"` dan `aria-label` dinamis, mis. "Bibo sedang mengetik", "Bibo bertanya, menunggu izin".
- Pembeda status **tidak hanya warna**: pola kedip lampu (§4.3) dan props (titik, tanda tanya, zzz) tetap ada.
- Semua ucapan juga tampil sebagai teks (caption) di UI.

**Reduced motion (`prefers-reduced-motion: reduce` atau `setReducedMotion(true)`)**
| Fitur | Perilaku |
|---|---|
| Float, napas, goyang, lompat | dimatikan (posisi statis) |
| Kedip | tetap, tapi 60 ms dan jarang |
| Tiga titik, tanda tanya, zzz | **tidak berulang**: tampil statis (titik/tanda tanya/z tetap terlihat) atau denyut opasitas sangat lambat (`T≥3 s`) |
| Konfeti | diganti 3 kilau statis |
| Tangan | berpindah posisi pose tanpa animasi gerak (crossfade 80 ms) |
| Mulut berbicara | tetap berubah bentuk (informasi penting) tetapi tanpa gerak badan |
| `IdleDirector` | hanya `lookAround` |

---

## 14. Pengujian & Galeri Dev

**Galeri `/dev/avatar`** (wajib, bagian M3):
- Tombol tiap pose × varian `working`, tombol tiap reaksi, slider `speechLevel`, pemilih mood, toggle tema, toggle reduced motion, toggle "slow-mo ×0,25", input seed.
- Mode **beku**: `?freeze=<ms>` men-*seek* semua animasi ke waktu `t` lalu jeda (untuk screenshot deterministik).

**Tes otomatis**
| Jenis | Isi |
|---|---|
| Unit (jam palsu) | jadwal kedip (interval 2,5–5,5 s), `IdleDirector` (cooldown, tidak berulang berturut-turut), selisih stagger tiga titik 0,35 s, tiga z 0,5 s, tiga busur suara 0,2 s, rumus mulut parametris, pool konfeti konstan 24 |
| Fase | tangan L/R tidak sefase di `working`/`celebrate`; lampu `asking` kedip ganda; `speaking` 2 Hz |
| Layer | tangan di `#hands-front` pada `thinking`(R) dan `working`(L,R); kembali ke `#hands-back` setelahnya |
| Transisi | pose berganti cepat 20× berturut-turut → tidak ada elemen tersangkut, jumlah animasi aktif tidak bocor |
| Visual | screenshot beku tiap pose × varian × tema (dark/light) pada `t=0`, `t=T/4`, `t=T/2` |
| Reduced motion | semua loop berhenti; titik/tanda tanya/z tetap terlihat |
| Aksesibilitas | `aria-label` berubah per pose; axe-core tanpa pelanggaran serius |
| Performa | skrip ukur fps/CPU pada pose `celebrate` dan `working` selama 10 s |

**Kriteria penerimaan global:** 8 pose utama sesuai §6 dan lolos kriteria masing-masing; dua pose tambahan §7 ada; `bun run check` hijau; screenshot galeri disetujui pemilik produk.

---

## 15. Checklist Agent & Sinkronisasi PRD

**Urutan kerja yang disarankan (menggantikan butir avatar di Milestone M3/M4):**
1. Gambar SVG sesuai §3 (semua ID layer) dan tampilkan pose statis tiap ekspresi §4.
2. Bangun lapisan A (ambient) lalu pose 1 (Diam) lengkap dengan lambaian.
3. Pose 2, 3, 4 (props dan loop), lalu 5 (konfeti pool), 6, 8.
4. Overlay Berbicara (§6.7) bersama `setSpeechLevel` dan integrasi TTS (M4).
5. `IdleDirector`, hover/poke/eye-tracking, mood, reaksi, transisi §10.
6. Galeri dev + tes §14.

**Hal yang berubah terhadap PRD dan harus disinkronkan (usulan):**
| Bagian PRD | Perubahan |
|---|---|
| §8.4 | diganti rujukan ke dokumen ini; hapus palet/geometri/pose lama (badge biru sudut, tanpa mulut) |
| §8.5 | `AvatarRenderer` memakai kontrak §12 (ada `setMood`, `react`, `setPose` dengan varian; `setSpeechLevel` tetap) |
| §9.3 | "voice-pulse badan" diganti **gerak mulut parametris + busur suara + lampu 2 Hz** (§6.7) |
| FR-030..036 | jumlah pose: 9 pose dasar + overlay; konfeti & mood masuk FR-036 |
| M3 / prompt agent | acuan visual = dokumen ini dan `docs/reference/character-sheet.png`; dua gambar referensi lama hanya inspirasi awal |
| Durasi `celebrate` | 2 s → **3 s** (≥ 2 ledakan konfeti) |

**Di luar cakupan dokumen ini:** pemetaan nama tool nyata (hasil M0), aturan izin/keselamatan (PRD §10), suara dan STT (PRD §9).
