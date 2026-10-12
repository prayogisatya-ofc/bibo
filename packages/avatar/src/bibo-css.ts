/* Palet + loop animasi Bibo (PRD §8.4). Tanpa library; WAAPI/CSS saja. */
export const BIBO_CSS = `
/* Palet + loop animasi Bibo (PRD §8.4). Tanpa library; WAAPI/CSS saja. */

#bibo {
  --bibo-stage: #161616;
  --bibo-body-top: #ffffff;
  --bibo-body-bottom: #e9ebf0;
  --bibo-body-stroke: none;
  --bibo-eye: #111114;
  --bibo-shadow: rgba(0, 0, 0, 0.4);
  --bibo-badge: #2f8cff;
  --bibo-badge-2: #1e6fe0;
  --bibo-ok: #2ec27e;
  --bibo-warn: #ffb020;
  --bibo-bad: #f0524a;
  --bibo-off: #8a8f9a;
  --bibo-icon: #ffffff;
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
#bibo[data-theme="light"] {
  --bibo-stage: #eef0f5;
  --bibo-body-bottom: #e4e7ee;
  --bibo-body-stroke: #d5d9e2;
  --bibo-eye: #1a1a1f;
  --bibo-shadow: rgba(20, 30, 60, 0.18);
  --bibo-ok: #1fa866;
  --bibo-warn: #f59e0b;
  --bibo-bad: #e5453d;
}
#bibo[data-tone="warn"] #badge-bg { fill: var(--bibo-warn); }
#bibo[data-tone="ok"] #badge-bg { fill: var(--bibo-ok); }
#bibo[data-tone="bad"] #badge-bg { fill: var(--bibo-bad); }
#bibo[data-tone="off"] #badge-bg { fill: var(--bibo-off); }
#bibo[data-tone="off"] { filter: saturate(0); opacity: 0.6; }
#bibo[data-dim="1"] { opacity: 0.85; }

#badge {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 180ms cubic-bezier(0.2, 1.4, 0.4, 1);
}
#badge[data-hidden="1"] { transform: scale(0); }
#badge-icon, #eyes { transition: opacity 120ms; }
#eyes { transform-box: fill-box; transform-origin: center; }
#body-wrap, #hand-left, #hand-right, #face { transition: transform 200ms cubic-bezier(0.3, 0.7, 0.4, 1); }

/* --- loop idle --- */
#bibo[data-loop="idle"] #eyes, #bibo[data-loop="think"] #eyes,
#bibo[data-loop="listen"] #eyes, #bibo[data-loop="search"] #eyes,
#bibo[data-loop="gear"] #eyes, #bibo[data-loop="read"] #eyes,
#bibo[data-loop="type"] #eyes, #bibo[data-loop="run"] #eyes {
  animation: bibo-blink 4.2s infinite;
}
@keyframes bibo-blink {
  0%, 93%, 100% { transform: scaleY(1); }
  95.5% { transform: scaleY(0.08); }
}
#bibo[data-loop="idle"] .float-a, #bibo[data-loop="think"] .float-a,
#bibo[data-loop="search"] .float-a, #bibo[data-loop="gear"] .float-a {
  animation: bibo-float 3.1s ease-in-out infinite;
}
#bibo[data-loop="idle"] .float-b, #bibo[data-loop="think"] .float-b,
#bibo[data-loop="search"] .float-b, #bibo[data-loop="gear"] .float-b {
  animation: bibo-float 3.9s ease-in-out infinite reverse;
}
@keyframes bibo-float {
  0%, 100% { transform: translateY(-4px); }
  50% { transform: translateY(4px); }
}
.float-a, .float-b { transform-box: fill-box; transform-origin: center; }
.breathe { transform-box: fill-box; transform-origin: 50% 100%; }
#bibo[data-loop="idle"] .breathe, #bibo[data-loop="sleep"] .breathe {
  animation: bibo-breathe 3s ease-in-out infinite;
}
#bibo[data-loop="sleep"] .breathe { animation-duration: 5s; }
@keyframes bibo-breathe {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.015); }
}
/* --- thinking: titik menyala bergantian --- */
#bibo[data-loop="think"] .bi-dots circle { animation: bibo-dot 0.9s infinite; }
#bibo[data-loop="think"] .bi-dots circle:nth-child(2) { animation-delay: 0.15s; }
#bibo[data-loop="think"] .bi-dots circle:nth-child(3) { animation-delay: 0.3s; }
@keyframes bibo-dot {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
#bibo[data-loop="think"] #badge, #bibo[data-loop="listen"] #badge,
#bibo[data-loop="ask"] #badge {
  animation: bibo-badge-pulse 1.8s ease-in-out infinite;
}
@keyframes bibo-badge-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
#bibo[data-loop="ask"] #badge-ring {
  transform-box: fill-box;
  transform-origin: center;
}
#bibo[data-loop="ask"] #badge-ring { opacity: 1; animation: bibo-ring 1.8s ease-out infinite; }
@keyframes bibo-ring {
  from { transform: scale(1); opacity: 0.8; }
  to { transform: scale(1.5); opacity: 0; }
}
/* --- membaca: mata menyapu --- */
#bibo[data-loop="read"] #face { animation: bibo-sweep 1.2s ease-in-out infinite; }
@keyframes bibo-sweep {
  0%, 100% { transform: translateX(-10px); }
  50% { transform: translateX(10px); }
}
/* --- mengetik: tangan bergantian (grup dalam, posisi JS di luar tetap) --- */
#bibo[data-loop="type"] .float-a { animation: bibo-tap 0.22s ease-in-out infinite; }
#bibo[data-loop="type"] .float-b { animation: bibo-tap 0.22s ease-in-out 0.11s infinite; }
@keyframes bibo-tap {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(5px); }
}
/* --- running: getar halus (grup breathe; tidak menimpa tilt pose) --- */
#bibo[data-loop="run"] .breathe { animation: bibo-buzz 0.125s linear infinite; }
@keyframes bibo-buzz {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(1px); }
}
/* --- gear berputar --- */
#bibo[data-loop="gear"] .bi-gear {
  animation: bibo-spin 2.4s linear infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes bibo-spin { to { transform: rotate(360deg); } }
/* --- celebrate: tangan melambai (grup dalam) --- */
#bibo[data-loop="party"] .float-a { animation: bibo-wave-l 0.4s ease-in-out infinite; }
#bibo[data-loop="party"] .float-b { animation: bibo-wave-r 0.4s ease-in-out infinite; }
@keyframes bibo-wave-l {
  0%, 100% { transform: rotate(-12deg); }
  50% { transform: rotate(12deg); }
}
@keyframes bibo-wave-r {
  0%, 100% { transform: rotate(12deg); }
  50% { transform: rotate(-12deg); }
}
#bibo[data-loop="party"] #badge { animation: bibo-pop 180ms cubic-bezier(0.2, 1.4, 0.4, 1); }
/* --- confused: geleng (grup breathe) --- */
#bibo[data-loop="worry"] .breathe { animation: bibo-shake 0.5s ease-in-out 4; }
@keyframes bibo-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
/* --- wave bars (voice) --- */
#bibo[data-speaking="1"] .bi-wave rect { animation: bibo-bar 0.5s ease-in-out infinite; }
#bibo[data-speaking="1"] .bi-wave rect:nth-child(2) { animation-delay: 0.12s; }
#bibo[data-speaking="1"] .bi-wave rect:nth-child(3) { animation-delay: 0.24s; }
@keyframes bibo-bar {
  0%, 100% { transform: scaleY(0.5); }
  50% { transform: scaleY(1.2); }
}
#bibo .bi-wave rect { transform-box: fill-box; transform-origin: center; }

/* --- reduced motion: tanpa gerak besar, ekspresi statis --- */
@media (prefers-reduced-motion: reduce) {
  #bibo * { animation: none !important; }
}
#bibo[data-rm="1"] * { animation: none !important; }
`; 
