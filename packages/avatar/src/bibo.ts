import type { AvatarPose } from "./types.js";

/**
 * Geometri + tabel pose Bibo (PRD §8.4). Sumber visual:
 * docs/reference/character-ref-{1-idle,2-thinking}.png.
 * viewBox 0 0 480 320. Semua ID grup sesuai hierarki PRD.
 */

export const BiboSVG = `
<svg id="bibo" viewBox="0 0 480 320" role="img" aria-label="Bibo">
  <defs>
    <linearGradient id="bibo-body-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--bibo-body-top)"/>
      <stop offset="1" stop-color="var(--bibo-body-bottom)"/>
    </linearGradient>
    <linearGradient id="bibo-badge-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--bibo-badge)"/>
      <stop offset="1" stop-color="var(--bibo-badge-2)"/>
    </linearGradient>
  </defs>
  <ellipse id="ground-shadow" cx="240" cy="274" rx="112" ry="12" fill="var(--bibo-shadow)"/>
  <g id="hand-left"><g class="float-a">
    <circle cx="0" cy="0" r="20" fill="var(--bibo-body-top)" stroke="var(--bibo-body-stroke)"/>
  </g></g>
  <g id="hand-right"><g class="float-b">
    <rect x="-24" y="-14" width="48" height="28" rx="14" fill="var(--bibo-body-top)" stroke="var(--bibo-body-stroke)" transform="rotate(-25)"/>
  </g></g>
  <g id="body-wrap"><g class="breathe"><g id="speech-pulse">
    <path id="body" d="M120,150 C120,92 150,64 240,64 C330,64 360,92 360,150 C360,208 330,236 240,236 C150,236 120,208 120,150 Z"
      fill="url(#bibo-body-grad)" stroke="var(--bibo-body-stroke)" stroke-width="1.5"/>
    <path id="body-highlight" d="M150,96 C170,78 210,70 250,70" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
    <g id="face"><g id="eyes">
      <g class="e-open" fill="var(--bibo-eye)">
        <ellipse cx="220" cy="140" rx="6" ry="11"/>
        <ellipse cx="260" cy="140" rx="6" ry="11"/>
      </g>
      <g class="e-wide" fill="var(--bibo-eye)" style="display:none">
        <ellipse cx="220" cy="140" rx="7" ry="14"/>
        <ellipse cx="260" cy="140" rx="7" ry="14"/>
      </g>
      <g class="e-focus" fill="var(--bibo-eye)" style="display:none">
        <ellipse cx="222" cy="141" rx="5" ry="9"/>
        <ellipse cx="258" cy="141" rx="5" ry="9"/>
      </g>
      <g class="e-happy" style="display:none" fill="none" stroke="var(--bibo-eye)" stroke-width="5" stroke-linecap="round">
        <path d="M210,146 Q216,134 222,146"/>
        <path d="M258,146 Q264,134 270,146"/>
      </g>
      <g class="e-sleep" style="display:none" stroke="var(--bibo-eye)" stroke-width="5" stroke-linecap="round">
        <line x1="212" y1="142" x2="228" y2="142"/>
        <line x1="252" y1="142" x2="268" y2="142"/>
      </g>
      <g class="e-worried" fill="var(--bibo-eye)" style="display:none">
        <ellipse cx="220" cy="140" rx="6" ry="11" transform="rotate(-12 220 140)"/>
        <ellipse cx="260" cy="140" rx="6" ry="11" transform="rotate(12 260 140)"/>
      </g>
      <g class="e-flat" style="display:none" stroke="var(--bibo-eye)" stroke-width="5" stroke-linecap="round">
        <line x1="213" y1="142" x2="227" y2="142"/>
        <line x1="253" y1="142" x2="267" y2="142"/>
      </g>
    </g></g>
  </g></g></g>
  <g id="badge-pos" transform="translate(138,78)">
  <g id="badge">
    <circle id="badge-bg" cx="0" cy="0" r="34" fill="url(#bibo-badge-grad)"/>
    <circle id="badge-ring" cx="0" cy="0" r="34" fill="none" stroke="var(--bibo-icon)" stroke-width="2" opacity="0"/>
    <g id="badge-icon" fill="var(--bibo-icon)" stroke="var(--bibo-icon)">
      <g class="bi-dots"><circle cx="-12" cy="0" r="4" stroke="none"/><circle cx="0" cy="0" r="4" stroke="none"/><circle cx="12" cy="0" r="4" stroke="none"/></g>
      <g class="bi-wave" style="display:none" stroke="none"><rect x="-13" y="-6" width="6" height="12" rx="3"/><rect x="-3" y="-10" width="6" height="20" rx="3"/><rect x="7" y="-4" width="6" height="8" rx="3"/></g>
      <g class="bi-mic" style="display:none"><rect x="-6" y="-14" width="12" height="20" rx="6" stroke="none"/><path d="M-11,-2 A11,11 0 0,0 11,-2" fill="none" stroke-width="3"/><line x1="0" y1="9" x2="0" y2="15" stroke-width="3"/></g>
      <g class="bi-code" style="display:none" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="-4,-10 -14,0 -4,10"/><polyline points="4,-10 14,0 4,10"/></g>
      <g class="bi-terminal" style="display:none" fill="none" stroke-width="3" stroke-linecap="round"><rect x="-15" y="-11" width="30" height="22" rx="4"/><polyline points="-9,-3 -3,2 -9,7"/><line x1="1" y1="7" x2="9" y2="7"/></g>
      <g class="bi-eye" style="display:none" fill="none" stroke-width="3"><ellipse cx="0" cy="0" rx="14" ry="9"/><circle cx="0" cy="0" r="4" stroke="none" fill="var(--bibo-icon)"/></g>
      <g class="bi-globe" style="display:none" fill="none" stroke-width="2.5"><circle cx="0" cy="0" r="13"/><ellipse cx="0" cy="0" rx="6" ry="13"/><line x1="-13" y1="0" x2="13" y2="0"/></g>
      <g class="bi-gear" style="display:none"><circle cx="0" cy="0" r="7" fill="none" stroke-width="3.5"/><g stroke="none"><rect x="-3" y="-14" width="6" height="7" rx="2"/><rect x="-3" y="7" width="6" height="7" rx="2"/><rect x="-14" y="-3" width="7" height="6" rx="2"/><rect x="7" y="-3" width="7" height="6" rx="2"/></g></g>
      <g class="bi-question" style="display:none" stroke="none"><text x="0" y="11" text-anchor="middle" font-size="30" font-weight="bold" fill="var(--bibo-icon)">?</text></g>
      <g class="bi-exclaim" style="display:none" stroke="none"><rect x="-3.5" y="-13" width="7" height="16" rx="3.5"/><circle cx="0" cy="9" r="4"/></g>
      <g class="bi-check" style="display:none" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="-12,1 -4,9 13,-9"/></g>
      <g class="bi-zzz" style="display:none" stroke="none"><text x="0" y="8" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--bibo-icon)">z z</text></g>
      <g class="bi-offline" style="display:none" fill="none" stroke-width="3.5"><circle cx="0" cy="0" r="12"/><line x1="-9" y1="9" x2="9" y2="-9"/></g>
    </g>
  </g>
  </g>
  <g id="props" fill="var(--bibo-badge)" stroke="var(--bibo-badge)">
    <g class="prop-magnifier" style="display:none" fill="none" stroke-width="4"><circle cx="0" cy="0" r="13"/><line x1="10" y1="10" x2="20" y2="20" stroke-linecap="round"/></g>
    <g class="prop-keyboard" style="display:none"><rect x="-30" y="-12" width="60" height="24" rx="5" fill="var(--bibo-body-top)" stroke="var(--bibo-body-stroke)"/><g fill="var(--bibo-badge)" stroke="none"><circle cx="-15" cy="-3" r="2.5"/><circle cx="0" cy="-3" r="2.5"/><circle cx="15" cy="-3" r="2.5"/><circle cx="-15" cy="5" r="2.5"/><circle cx="0" cy="5" r="2.5"/><circle cx="15" cy="5" r="2.5"/></g></g>
    <g class="prop-terminal" style="display:none"><rect x="-26" y="-16" width="52" height="32" rx="5" fill="#22242A" stroke="none"/><g stroke="#7FD0FF" stroke-width="2.5" fill="none" stroke-linecap="round"><polyline points="-15,-4 -9,1 -15,6"/><line x1="-5" y1="6" x2="8" y2="6"/></g></g>
    <g class="prop-globe" style="display:none" fill="none" stroke-width="3"><circle cx="0" cy="0" r="14"/><ellipse cx="0" cy="0" rx="6.5" ry="14"/></g>
    <g class="prop-minibot" style="display:none"><rect x="-16" y="-14" width="32" height="24" rx="9" fill="#FFFFFF" stroke="none"/><g fill="#111114" stroke="none"><ellipse cx="-6" cy="-2" rx="2.5" ry="4.5"/><ellipse cx="6" cy="-2" rx="2.5" ry="4.5"/></g></g>
    <g class="prop-sparkles" style="display:none" stroke="#FFD84D" stroke-width="3" stroke-linecap="round"><path d="M0,-14 L0,-4 M-5,-9 L5,-9"/><path d="M-20,4 L-20,12 M-24,8 L-16,8"/><path d="M18,2 L18,10 M14,6 L22,6"/></g>
    <g class="prop-sweat" style="display:none" fill="#7FD0FF" stroke="none"><path d="M0,-12 C6,-3 9,1 9,5 A9,9 0 0,1 -9,5 C-9,1 -6,-3 0,-12 Z"/></g>
    <g class="prop-signal" style="display:none" fill="none" stroke-width="3" stroke-linecap="round"><path d="M0,0 A16,16 0 0,1 16,-16"/><path d="M0,0 A26,26 0 0,1 26,-26" opacity="0.6"/></g>
  </g>
</svg>`;

export type EyeVariant = "open" | "wide" | "focus" | "happy" | "sleep" | "worried" | "flat";
export type BadgeIcon =
  | "dots" | "wave" | "mic" | "code" | "terminal" | "eye" | "globe"
  | "gear" | "question" | "exclaim" | "check" | "zzz" | "offline"
  | null;
export type BadgeTone = "normal" | "warn" | "ok" | "bad" | "off";
export type PropName =
  | "magnifier" | "keyboard" | "terminal" | "globe" | "minibot"
  | "sparkles" | "sweat" | "signal";

export interface PoseSpec {
  eye: EyeVariant;
  gaze: [number, number];
  badge: BadgeIcon;
  tone: BadgeTone;
  /** [x, y] tangan kiri; kanan + rotasi */
  handL: [number, number];
  handR: [number, number, number];
  /** tilt derajat + squash scale di pivot tengah-bawah */
  body: [number, number, number];
  props: Array<{ name: PropName; at: [number, number]; scale?: number }>;
  loop: string;
}

/** Tabel pose (§8.4). Koordinat absolut viewBox. */
export const POSES: Record<AvatarPose, PoseSpec> = {
  offline: {
    eye: "flat", gaze: [0, 0], badge: "offline", tone: "off",
    handL: [84, 210], handR: [376, 176, -15], body: [0, 1, 1], props: [], loop: "still",
  },
  sleeping: {
    eye: "sleep", gaze: [0, 0], badge: "zzz", tone: "off",
    handL: [96, 216], handR: [368, 200, -10], body: [0, 1.01, 0.99], props: [], loop: "sleep",
  },
  idle: {
    eye: "open", gaze: [0, 0], badge: null, tone: "normal",
    handL: [72, 198], handR: [388, 161, -25], body: [0, 1, 1], props: [], loop: "idle",
  },
  listening: {
    eye: "wide", gaze: [0, 2], badge: "mic", tone: "normal",
    handL: [60, 178], handR: [398, 140, -35], body: [3, 1.01, 1], props: [{ name: "signal", at: [392, 120] }], loop: "listen",
  },
  thinking: {
    eye: "open", gaze: [6, -8], badge: "dots", tone: "normal",
    handL: [72, 198], handR: [330, 200, -45], body: [-4, 1, 1], props: [], loop: "think",
  },
  "working.reading": {
    eye: "focus", gaze: [0, 0], badge: "eye", tone: "normal",
    handL: [72, 198], handR: [352, 170, -20], body: [0, 1, 1],
    props: [{ name: "magnifier", at: [368, 150] }], loop: "read",
  },
  "working.editing": {
    eye: "focus", gaze: [0, 6], badge: "code", tone: "normal",
    handL: [198, 242], handR: [282, 242, 0], body: [3, 1, 1],
    props: [{ name: "keyboard", at: [240, 252] }], loop: "type",
  },
  "working.running": {
    eye: "focus", gaze: [0, 0], badge: "terminal", tone: "normal",
    handL: [150, 240], handR: [330, 240, 0], body: [0, 1, 1],
    props: [{ name: "terminal", at: [240, 210] }], loop: "run",
  },
  "working.searching": {
    eye: "open", gaze: [0, -6], badge: "globe", tone: "normal",
    handL: [72, 198], handR: [372, 130, -40], body: [3, 1, 1],
    props: [{ name: "globe", at: [388, 104] }], loop: "search",
  },
  "working.delegating": {
    eye: "open", gaze: [10, 0], badge: "dots", tone: "normal",
    handL: [72, 198], handR: [392, 160, -80], body: [0, 1, 1],
    props: [{ name: "minibot", at: [436, 220], scale: 1 }], loop: "idle",
  },
  "working.generic": {
    eye: "focus", gaze: [0, 0], badge: "gear", tone: "normal",
    handL: [72, 198], handR: [388, 161, -25], body: [0, 1, 1], props: [], loop: "gear",
  },
  asking: {
    eye: "wide", gaze: [0, 2], badge: "question", tone: "warn",
    handL: [72, 198], handR: [380, 110, -70], body: [4, 1.01, 1], props: [], loop: "ask",
  },
  celebrate: {
    eye: "happy", gaze: [0, 0], badge: "check", tone: "ok",
    handL: [56, 130], handR: [404, 130, -120], body: [0, 0.94, 1.06],
    props: [{ name: "sparkles", at: [240, 60] }], loop: "party",
  },
  confused: {
    eye: "worried", gaze: [-4, 0], badge: "exclaim", tone: "bad",
    handL: [72, 198], handR: [348, 120, -30], body: [0, 1, 1],
    props: [{ name: "sweat", at: [352, 96] }], loop: "worry",
  },
};
