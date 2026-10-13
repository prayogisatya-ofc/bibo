/**
 * Template SVG karakter — CHARACTER.md §2 (palet), §3 (anatomi & geometri),
 * §4 (bank ekspresi). viewBox 0 0 200 200.
 *
 * Palet HANYA sebagai CSS variables di svg#bot (satu sumber kebenaran).
 * Tidak ada inline style yang disalin dari referensi; geometri mengikuti
 * kontrak koordinat §3.1, ID layer §3.2, pivot §3.3.
 */

const EYE_VARIANTS_LEFT = `
      <g class="e-var e-open"><ellipse cx="0" cy="0" rx="5" ry="7.5" fill="var(--bot-eye)"/><circle class="e-glint" cx="1.6" cy="-3" r="1.7" fill="#fff" opacity=".9"/></g>
      <g class="e-var e-blink"><ellipse cx="0" cy="0" rx="5" ry=".6" fill="var(--bot-eye)"/></g>
      <g class="e-var e-happy"><path d="M-6 5 q6 -10 12 0" fill="none" stroke="var(--bot-eye)" stroke-width="3.6" stroke-linecap="round"/></g>
      <g class="e-var e-focus"><ellipse cx="0" cy="5" rx="5" ry="4.5" fill="var(--bot-eye)"/><circle class="e-glint" cx="1.6" cy="2" r="1.4" fill="#fff" opacity=".9"/></g>
      <g class="e-var e-down"><ellipse cx="0" cy="5" rx="5" ry="4.5" fill="var(--bot-eye)"/><circle class="e-glint" cx="1.6" cy="2" r="1.4" fill="#fff" opacity=".9"/></g>
      <g class="e-var e-wide"><ellipse cx="0" cy="0" rx="5" ry="9" fill="var(--bot-eye)"/><circle class="e-glint" cx="1.6" cy="-3" r="1.7" fill="#fff" opacity=".9"/></g>
      <g class="e-var e-worried"><ellipse cx="0" cy="0" rx="5" ry="7" fill="var(--bot-eye)" transform="rotate(-16)"/></g>
      <g class="e-var e-sleep"><path d="M-6 -1 q6 7 12 0" fill="none" stroke="var(--bot-eye)" stroke-width="3" stroke-linecap="round" opacity=".85"/></g>
      <g class="e-var e-flat"><path d="M-6 0 h12" stroke="var(--bot-eye)" stroke-width="3" stroke-linecap="round"/></g>`;

const EYE_VARIANTS_RIGHT = EYE_VARIANTS_LEFT.replace("rotate(-16)", "rotate(16)");

export const BOT_SVG = `<svg id="bot" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" data-pose="idle" data-variant="" data-mood="neutral" data-speaking="false" data-theme="dark">
<style>
#bot{
--bot-stage:#161616;--bot-body:#F5F7FF;--bot-body-stroke:transparent;--bot-body-glint:#FFFFFF;
--bot-hand:#9AA3D1;--bot-hand-stroke:#7E88BE;--bot-visor:#1F2540;--bot-eye:#7CF3D6;
--bot-blush:#FF9DB8;--bot-stem:#C5CCEE;--bot-info:#4C8DFF;--bot-ok:#2EC27E;
--bot-ask:#FFB020;--bot-bad:#F0524A;--bot-shadow:rgba(0,0,0,.40);
--bot-sweat:#7AB8FF;--bot-zzz:#8FA0E8;--bot-key:#8FA0E8;
--bot-confetti-1:#FFC94D;--bot-confetti-2:#FF9DB8;--bot-confetti-3:#7CF3D6;
--bot-confetti-4:#4C8DFF;--bot-confetti-5:#FF7A59;
display:block;width:100%;height:auto;overflow:visible}
#bot[data-theme="light"]{
--bot-stage:#EDF0FB;--bot-body-stroke:#D5DAF3;--bot-ok:#1FA866;
--bot-ask:#F59E0B;--bot-bad:#E5453D;--bot-shadow:rgba(40,48,96,.14)}
#bot .e-var,#bot .m-var{opacity:0}
#bot text{font-family:Nunito,system-ui,sans-serif;user-select:none}
#body-float{transform-box:view-box;transform-origin:100px 166px;will-change:transform}
#antenna{transform-box:view-box;transform-origin:100px 62px;will-change:transform}
#hand-l,#hand-r{transform-box:fill-box;transform-origin:50% 50%;will-change:transform}
#hand-l .hand-wave,#hand-r .hand-wave{transform-box:fill-box;transform-origin:50% 130%}
#eye-l,#eye-r{transform-box:fill-box;transform-origin:50% 50%}
#eyes{transform-box:fill-box;transform-origin:50% 50%}
#bulb{transform-box:fill-box;transform-origin:50% 50%}
#shadow{transform-box:fill-box;transform-origin:50% 50%}
#dots g,#q-bubble,#q-bubble-2,#zzz text,#sweat path,#prop-note,#snot,#prop-disc,#prop-gear,#mouth{transform-box:fill-box;transform-origin:center}
#sound-arcs g{transform-box:fill-box;transform-origin:center}
#bulb-ring{transform-box:fill-box;transform-origin:center}
</style>
<g id="shadow"><ellipse cx="100" cy="178" rx="50" ry="7" fill="var(--bot-shadow)"/></g>
<g id="hands-back">
</g>
<g id="body-float"><g id="body-nod">
<g id="antenna"><path id="stem" d="M100 62 V46" stroke="var(--bot-stem)" stroke-width="4" stroke-linecap="round" fill="none"/><g id="bulb"><circle id="bulb-ring" cx="100" cy="39" r="8.5" fill="none" stroke="var(--bot-info)" stroke-width="2" opacity="0"/><circle id="bulb-core" cx="100" cy="39" r="8.5" fill="var(--bot-stem)"/><circle id="bulb-glint" cx="97" cy="36" r="2.4" fill="#fff" opacity=".7"/></g></g>
<g id="body"><rect id="body-shape" x="40" y="60" width="120" height="106" rx="46" fill="var(--bot-body)" stroke="var(--bot-body-stroke)" stroke-width="1.5"/><ellipse id="body-glint" cx="68" cy="75" rx="16" ry="6" fill="var(--bot-body-glint)" opacity=".9"/></g>
<g id="visor"><rect id="visor-shape" x="57" y="86" width="86" height="50" rx="23" fill="var(--bot-visor)"/>
<g id="cheeks"><ellipse cx="68" cy="123" rx="6" ry="3.4" fill="var(--bot-blush)" opacity=".65"/><ellipse cx="132" cy="123" rx="6" ry="3.4" fill="var(--bot-blush)" opacity=".65"/></g>
<g id="eyes"><g id="eye-l" transform="translate(84,108)">${EYE_VARIANTS_LEFT}
</g><g id="eye-r" transform="translate(116,108)">${EYE_VARIANTS_RIGHT}
</g></g>
<g id="mouth" transform="translate(100,120)">
<g class="m-var m-smile"><path d="M-6 1 q6 6 12 0" fill="none" stroke="var(--bot-eye)" stroke-width="2.8" stroke-linecap="round"/></g>
<g class="m-var m-flat"><path d="M-5 3 h10" stroke="var(--bot-eye)" stroke-width="2.8" stroke-linecap="round"/></g>
<g class="m-var m-o"><ellipse cx="0" cy="3" rx="3.2" ry="3.8" fill="var(--bot-eye)"/></g>
<g class="m-var m-bigsmile"><path d="M-10 -2 q10 14 20 0 z" fill="var(--bot-eye)"/></g>
<g class="m-var m-wavy"><clipPath id="mouth-clip"><rect x="-8" y="-4" width="16" height="12" rx="4"/></clipPath><g clip-path="url(#mouth-clip)"><path id="wavy-path" d="M-16 3 q4 -6 8 0 t8 0 t8 0 t8 0" fill="none" stroke="var(--bot-eye)" stroke-width="2.8" stroke-linecap="round"/></g></g>
<g class="m-var m-open"><ellipse id="mopen-shape" cx="0" cy="3" rx="3" ry="1.5" fill="var(--bot-eye)"/><ellipse id="mopen-tongue" cx="0" cy="4" rx="1.8" ry=".6" fill="var(--bot-blush)" opacity="0"/></g>
<g class="m-var m-yawn"><ellipse cx="0" cy="4.8" rx="6.5" ry="8" fill="var(--bot-eye)"/><ellipse cx="0" cy="10.4" rx="3.9" ry="3.2" fill="var(--bot-blush)"/></g>
</g></g></g>
<g id="props-float">
<g id="dots"><g id="dot-1" opacity="0"><circle cx="124" cy="32" r="2.6" fill="var(--bot-info)"/></g><g id="dot-2" opacity="0"><circle cx="133" cy="25" r="3.4" fill="var(--bot-info)"/></g><g id="dot-3" opacity="0"><circle cx="144" cy="20" r="4.4" fill="var(--bot-info)"/></g></g>
<g id="q-bubble" opacity="0" transform="translate(160,44)"><circle r="14" fill="var(--bot-ask)"/><text y="6.5" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">?</text></g>
<g id="q-bubble-2" opacity="0" transform="translate(40,58)"><circle r="9" fill="var(--bot-ask)"/><text y="4.5" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">?</text></g>
<g id="zzz"><text id="zzz-1" x="140" y="60" font-size="16" font-weight="800" fill="var(--bot-zzz)" opacity="0">z</text><text id="zzz-2" x="154" y="42" font-size="22" font-weight="800" fill="var(--bot-zzz)" opacity="0">z</text><text id="zzz-3" x="172" y="22" font-size="28" font-weight="800" fill="var(--bot-zzz)" opacity="0">z</text></g>
<g id="sweat"><path id="sweat-1" d="M150 82 q-6 9 0 13 q6 -4 0 -13z" fill="var(--bot-sweat)" opacity="0"/><path id="sweat-2" d="M50 86 q-4.5 7 0 10 q4.5 -3 0 -10z" fill="var(--bot-sweat)" opacity="0"/></g>
<g id="prop-note" opacity="0" transform="translate(152,58)"><ellipse cx="0" cy="0" rx="4.5" ry="3.5" transform="rotate(-20)" fill="var(--bot-ask)"/><path d="M4 -2 V-18 q7 1 5 9" fill="none" stroke="var(--bot-ask)" stroke-width="2.4" stroke-linecap="round"/></g>
<circle id="snot" cx="112" cy="122" r="0" fill="var(--bot-eye)" opacity="0"/>
<g id="prop-disc" opacity="0"><circle cx="92" cy="30" r="3" fill="var(--bot-bad)"/><circle cx="108" cy="30" r="3" fill="var(--bot-bad)"/><path d="M96 30 h8" stroke="var(--bot-bad)" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/></g>
</g></g>
<g id="props-world">
<g id="keyboard" opacity="0"><rect x="54" y="166" width="92" height="14" rx="6" fill="var(--bot-key)"/><rect id="key-row" x="62" y="170" width="76" height="3" rx="1.5" fill="#C9D2F7"/></g>
<g id="sound-arcs">
<g id="arc-r1" opacity="0"><path d="M164 92 q5 6 0 12" fill="none" stroke="var(--bot-info)" stroke-width="3.4" stroke-linecap="round"/></g>
<g id="arc-r2" opacity="0"><path d="M171 85 q9 12 0 26" fill="none" stroke="var(--bot-info)" stroke-width="3.4" stroke-linecap="round"/></g>
<g id="arc-r3" opacity="0"><path d="M179 77 q13 19 0 42" fill="none" stroke="var(--bot-info)" stroke-width="3.4" stroke-linecap="round"/></g>
<g id="arc-l1" opacity="0"><path d="M36 92 q-5 6 0 12" fill="none" stroke="var(--bot-info)" stroke-width="3.4" stroke-linecap="round"/></g>
<g id="arc-l2" opacity="0"><path d="M29 85 q-9 12 0 26" fill="none" stroke="var(--bot-info)" stroke-width="3.4" stroke-linecap="round"/></g>
<g id="arc-l3" opacity="0"><path d="M21 77 q-13 19 0 42" fill="none" stroke="var(--bot-info)" stroke-width="3.4" stroke-linecap="round"/></g>
</g>
<g id="confetti"></g>
<g id="sparkles" opacity="0"><path d="M52 90 l2.2 4.8 4.8 2.2 -4.8 2.2 -2.2 4.8 -2.2 -4.8 -4.8 -2.2 4.8 -2.2z" fill="var(--bot-confetti-1)"/><path d="M148 82 l2.2 4.8 4.8 2.2 -4.8 2.2 -2.2 4.8 -2.2 -4.8 -4.8 -2.2 4.8 -2.2z" fill="var(--bot-confetti-2)"/><path d="M100 34 l2.2 4.8 4.8 2.2 -4.8 2.2 -2.2 4.8 -2.2 -4.8 -4.8 -2.2 4.8 -2.2z" fill="var(--bot-confetti-3)"/></g>
<g id="prop-doc" opacity="0" transform="translate(100,112)"><rect x="-20" y="-26" width="40" height="52" rx="6" fill="#fff" stroke="var(--bot-hand-stroke)" stroke-width="1.5"/><rect x="-13" y="-18" width="26" height="4" rx="2" fill="var(--bot-zzz)"/><rect x="-13" y="-10" width="26" height="4" rx="2" fill="var(--bot-zzz)" opacity=".6"/><rect x="-13" y="-2" width="18" height="4" rx="2" fill="var(--bot-zzz)" opacity=".6"/></g>
<g id="prop-chip" opacity="0" transform="translate(100,12)"><rect x="-24" y="-12" width="48" height="24" rx="8" fill="var(--bot-visor)"/><text y="5" text-anchor="middle" font-size="14" font-weight="700" font-family="monospace" fill="var(--bot-eye)">&gt;_</text></g>
<g id="prop-mini" opacity="0" transform="translate(178,148)"><rect x="-18" y="-16" width="36" height="32" rx="14" fill="var(--bot-body)" stroke="var(--bot-hand-stroke)" stroke-width="1"/><rect x="-12" y="-8" width="24" height="14" rx="7" fill="var(--bot-visor)"/><circle cx="-6" cy="-1" r="2.4" fill="var(--bot-eye)"/><circle cx="6" cy="-1" r="2.4" fill="var(--bot-eye)"/></g>
<g id="prop-gear" opacity="0" transform="translate(100,20)"><circle r="9.5" fill="none" stroke="var(--bot-ask)" stroke-width="4" stroke-dasharray="3.2 4.3"/><circle r="4" fill="none" stroke="var(--bot-ask)" stroke-width="3"/></g>
</g>
<g id="hands-front">
<g id="hand-l" transform="translate(72,148)"><g class="hand-wave"><ellipse cx="0" cy="0" rx="12" ry="11" fill="var(--bot-hand)" stroke="var(--bot-hand-stroke)" stroke-width="1.5"/></g></g>
<g id="hand-r" transform="translate(128,144)"><g class="hand-wave"><ellipse cx="0" cy="0" rx="12" ry="11" fill="var(--bot-hand)" stroke="var(--bot-hand-stroke)" stroke-width="1.5"/><g class="mag" opacity="0"><circle cx="13" cy="-17" r="9" fill="rgba(245,247,255,.35)" stroke="var(--bot-visor)" stroke-width="3"/><line x1="19" y1="-10" x2="27" y2="-1" stroke="var(--bot-visor)" stroke-width="3" stroke-linecap="round"/></g></g></g>
</g>
<g id="fx"></g>
</svg>`;

/** Bangun elemen SVG dari template (tanpa innerHTML di dokumen utama). */
export function buildAvatarSvg(): SVGSVGElement {
  const tpl = document.createElement("template");
  tpl.innerHTML = BOT_SVG.trim();
  const svg = tpl.content.querySelector("svg");
  if (!svg) throw new Error("template avatar rusak: elemen svg tidak ditemukan");
  return svg as unknown as SVGSVGElement;
}

/** Isi pool konfeti: 24 elemen tetap (16 persegi + 8 lingkaran), warna bergilir. */
export function buildConfettiPool(svg: SVGSVGElement, count = 24): void {
  const g = svg.querySelector("#confetti");
  if (!g) return;
  const colors = [1, 2, 3, 4, 5];
  let html = "";
  for (let i = 0; i < count; i++) {
    const c = colors[i % colors.length];
    const shape =
      i % 3 === 2
        ? `<circle r="2.5" cx="0" cy="0"/>`
        : `<rect x="-2" y="-3.5" width="4" height="7" rx="1"/>`;
    html += `<g class="cf" opacity="0" transform="translate(100,56)" fill="var(--bot-confetti-${c})">${shape}</g>`;
  }
  g.innerHTML = html;
}
