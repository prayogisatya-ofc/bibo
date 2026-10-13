/**
 * Tes perilaku BotRenderer — CHARACTER.md §14 (jam palsu + WAAPI palsu).
 *
 * Mencakup: kontrak DOM §12, jadwal kedip, stagger dots/zzz/busur,
 * rumus mulut, pool konfeti, fase tangan, lapisan tangan, transisi 20×,
 * reduced motion, aria-label, mood, pause/resume, poke, eye tracking.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BotRenderer } from "../src/renderer.js";
import { IdleDirector } from "../src/director.js";
import { T } from "../src/timing.js";
import { mulberry32 } from "../src/prng.js";
import { AVATAR_POSES, type AvatarMountOptions, type AvatarPose, type WorkingVariant } from "../src/types.js";
import {
  animRecords,
  installDomFakes,
  recordsFor,
  recordsWithId,
  reinstallRaf,
  resetAnimRecords,
  stepRaf,
  rafPending,
} from "./dom-fake.js";

installDomFakes();

const SEED = 1234;

let host: HTMLElement;
let r: BotRenderer;

function svg(): SVGSVGElement {
  return host.querySelector("svg") as unknown as SVGSVGElement;
}

function q(id: string): Element {
  const e = svg().querySelector(`#${id}`);
  if (!e) throw new Error(`#${id} tidak ada`);
  return e;
}

function mount(opts: { reducedMotion?: boolean; characterName?: string; getAriaLabel?: (p: AvatarPose, v?: WorkingVariant) => string } = {}): BotRenderer {
  host = document.createElement("div");
  document.body.appendChild(host);
  r = new BotRenderer();
  const mountOpts: AvatarMountOptions = {
    theme: "dark",
    reducedMotion: opts.reducedMotion ?? false,
    seed: SEED,
    characterName: opts.characterName ?? "TestBot",
  };
  if (opts.getAriaLabel) mountOpts.getAriaLabel = opts.getAriaLabel;
  r.mount(host, mountOpts);
  return r;
}

function opacityOf(id: string): string {
  return (q(id) as HTMLElement).style.opacity;
}

beforeEach(() => {
  vi.useFakeTimers();
  reinstallRaf();
  resetAnimRecords();
});

afterEach(() => {
  r?.destroy();
  host?.remove();
  vi.useRealTimers();
  resetAnimRecords();
});

describe("kontrak DOM §12", () => {
  it("mount: svg#bot dengan data-pose/mood/speaking + role img", () => {
    mount();
    const s = svg();
    expect(s.id).toBe("bot");
    expect(s.getAttribute("role")).toBe("img");
    expect(s.dataset.pose).toBe("idle");
    expect(s.dataset.mood).toBe("neutral");
    expect(s.dataset.speaking).toBe("false");
  });

  it("aria-label default memakai characterName (tidak hardcode Bibo)", () => {
    mount({ characterName: "Kiko" });
    expect(svg().getAttribute("aria-label")).toBe("Kiko: idle");
    expect(svg().getAttribute("aria-label")).not.toContain("Bibo");
  });

  it("getAriaLabel dipakai bila disediakan", () => {
    const seen: [AvatarPose, string | undefined][] = [];
    mount({
      getAriaLabel: (p, v) => {
        seen.push([p, v]);
        return `custom-${p}-${v ?? "none"}`;
      },
    });
    r.setPose("working", { variant: "reading" });
    expect(svg().getAttribute("aria-label")).toBe("custom-working-reading");
    expect(seen[seen.length - 1]).toEqual(["working", "reading"]);
  });

  it("setPose memperbarui data-pose & data-variant", () => {
    mount();
    r.setPose("thinking");
    expect(svg().dataset.pose).toBe("thinking");
    expect(svg().dataset.variant).toBe("");
    r.setPose("working", { variant: "searching" });
    expect(svg().dataset.pose).toBe("working");
    expect(svg().dataset.variant).toBe("searching");
  });

  it("setTheme mengganti data-theme", () => {
    mount();
    r.setTheme("light");
    expect(svg().dataset.theme).toBe("light");
  });

  it("setMood → data-mood; kembali neutral setelah 10 s", () => {
    mount();
    r.setMood("happy");
    expect(svg().dataset.mood).toBe("happy");
    vi.advanceTimersByTime(9999);
    expect(svg().dataset.mood).toBe("happy");
    vi.advanceTimersByTime(1);
    expect(svg().dataset.mood).toBe("neutral");
  });

  it("destroy: svg dilepas; semua animasi dibatalkan", () => {
    mount();
    r.setPose("thinking");
    vi.advanceTimersByTime(2000);
    r.destroy();
    expect(host.querySelector("svg")).toBeNull();
    expect(animRecords.length).toBeGreaterThan(0);
    expect(animRecords.every((rec) => rec.cancelled)).toBe(true);
  });
});

describe("kedip (§5.3.6, §6.1)", () => {
  it("≥2 kedip dalam 12 detik (seed tetap)", () => {
    mount();
    resetAnimRecords();
    vi.advanceTimersByTime(12000);
    const blinks = recordsFor(q("eye-l"), "blink");
    expect(blinks.length).toBeGreaterThanOrEqual(2);
    // Kedip normal 120 ms (60 tutup + 60 buka); lambat 280 ms.
    const dur = blinks[0]?.options.duration;
    expect(dur).toBeLessThanOrEqual(300);
  });

  it("tidak berkedip saat sleeping/offline", () => {
    mount();
    r.setPose("sleeping");
    resetAnimRecords();
    vi.advanceTimersByTime(10000);
    expect(recordsWithId("blink").length).toBe(0);
    r.setPose("offline");
    resetAnimRecords();
    vi.advanceTimersByTime(10000);
    expect(recordsWithId("blink").length).toBe(0);
  });
});

describe("thinking (§6.2)", () => {
  it("tiga titik muncul satu per satu, selisih 0,35 s", () => {
    mount();
    resetAnimRecords();
    r.setPose("thinking");
    vi.advanceTimersByTime(800);
    const t1 = recordsFor(q("dot-1"), "appear")[0]?.startStamp ?? -1;
    const t2 = recordsFor(q("dot-2"), "appear")[0]?.startStamp ?? -1;
    const t3 = recordsFor(q("dot-3"), "appear")[0]?.startStamp ?? -1;
    expect(t1).toBeGreaterThanOrEqual(0);
    expect(t2 - t1).toBeGreaterThanOrEqual(290);
    expect(t2 - t1).toBeLessThanOrEqual(410);
    expect(t3 - t2).toBeGreaterThanOrEqual(290);
    expect(t3 - t2).toBeLessThanOrEqual(410);
  });

  it("tangan R di #hands-front dekat dagu (≤10 unit)", () => {
    mount();
    r.setPose("thinking");
    vi.advanceTimersByTime(500);
    expect(q("hand-r").parentElement?.id).toBe("hands-front");
    const tr = (q("hand-r") as HTMLElement).style.getPropertyValue("translate");
    expect(tr).toBe("-44px 0px");
    // Posisi absolut: (158-44, 148) = (114,148) = titik dagu.
  });

  it("kembali ke #hands-back tanpa lompat setelah pose berganti", () => {
    mount();
    r.setPose("thinking");
    vi.advanceTimersByTime(500);
    r.setPose("idle");
    expect(q("hand-r").parentElement?.id).toBe("hands-back");
  });

  it("titik berhenti saat pose berganti", () => {
    mount();
    r.setPose("thinking");
    vi.advanceTimersByTime(500);
    resetAnimRecords();
    r.setPose("idle");
    vi.advanceTimersByTime(3000);
    expect(recordsFor(q("dot-1"), "appear").length).toBe(0);
  });
});

describe("working (§6.3, §8)", () => {
  it("kedua tangan di #hands-front, di depan keyboard", () => {
    mount();
    r.setPose("working");
    vi.advanceTimersByTime(400);
    expect(q("hand-l").parentElement?.id).toBe("hands-front");
    expect(q("hand-r").parentElement?.id).toBe("hands-front");
    expect(opacityOf("keyboard")).toBe("1");
    // z-order: hands-front setelah props-world di DOM.
    const html = svg().innerHTML;
    expect(html.indexOf('id="hands-front"')).toBeGreaterThan(html.indexOf('id="keyboard"'));
  });

  it("tangan L/R tidak sefase (selisih ≥ 80 ms)", () => {
    mount();
    resetAnimRecords();
    r.setPose("working");
    // moveHand 300 ms lalu burst pertama (tanpa Enter serentak).
    vi.advanceTimersByTime(2500);
    const pressL = recordsFor(q("hand-l"), "press").map((x) => x.startStamp);
    const pressR = recordsFor(q("hand-r"), "press").map((x) => x.startStamp);
    expect(pressL.length).toBeGreaterThanOrEqual(5);
    expect(pressR.length).toBeGreaterThanOrEqual(5);
    for (const tl of pressL) {
      for (const tr of pressR) {
        expect(Math.abs(tl - tr)).toBeGreaterThanOrEqual(75);
      }
    }
  });

  it("varian reading: dokumen tampil; running: chip tampil", () => {
    mount();
    r.setPose("working", { variant: "reading" });
    vi.advanceTimersByTime(500);
    expect(opacityOf("prop-doc")).toBe("1");
    r.setPose("working", { variant: "running" });
    vi.advanceTimersByTime(500);
    expect(opacityOf("prop-chip")).toBe("1");
    expect(opacityOf("prop-doc")).toBe("0");
  });

  it("varian searching: kaca pembesar di tangan R", () => {
    mount();
    r.setPose("working", { variant: "searching" });
    vi.advanceTimersByTime(500);
    expect(q("hand-r").querySelector(".mag")?.getAttribute("opacity")).toBe("1");
  });
});

describe("asking (§6.4)", () => {
  it("tangan R terangkat di atas visor (y < 86)", () => {
    mount();
    r.setPose("asking");
    vi.advanceTimersByTime(600);
    const tr = (q("hand-r") as HTMLElement).style.getPropertyValue("translate");
    expect(tr).toBe("2px -64px"); // absolut (160, 84)
  });

  it("tanda tanya hilang-timbul tiap siklus", () => {
    mount();
    resetAnimRecords();
    r.setPose("asking");
    vi.advanceTimersByTime(2500);
    expect(recordsFor(q("q-bubble"), "appear").length).toBeGreaterThanOrEqual(1);
    expect(recordsFor(q("q-bubble"), "fade").length).toBeGreaterThanOrEqual(1);
  });

  it("lampu kuning kedip ganda (periode 1,6 s)", () => {
    mount();
    resetAnimRecords();
    r.setPose("asking");
    const lamp = recordsFor(q("bulb-core"), "lamp")[0];
    expect(lamp?.options.duration).toBe(1600);
    // Dua pulsa on dalam keyframes.
    expect((lamp?.keyframes.length ?? 0)).toBeGreaterThanOrEqual(6);
    expect(q("bulb-core").getAttribute("fill")).toBe("var(--bot-ask)");
  });

  it("eskalasi setelah 20 s: siklus lebih cepat + bubble kedua", () => {
    mount();
    r.setPose("asking");
    vi.advanceTimersByTime(20000);
    expect(opacityOf("q-bubble-2")).toBe("1");
  });
});

describe("celebrate (§6.5)", () => {
  it("pool konfeti konstan 24 sebelum, selama, sesudah", () => {
    mount();
    const count = () => svg().querySelectorAll("#confetti .cf").length;
    expect(count()).toBe(24);
    r.setPose("celebrate");
    vi.advanceTimersByTime(1600);
    expect(count()).toBe(24);
    vi.advanceTimersByTime(2000);
    expect(count()).toBe(24);
  });

  it("≥2 ledakan dalam 3 s", () => {
    mount();
    resetAnimRecords();
    r.setPose("celebrate");
    vi.advanceTimersByTime(1600);
    expect(recordsWithId("burst").length).toBeGreaterThanOrEqual(48);
  });

  it("tangan L/R berlawanan fase (selisih setengah siklus)", () => {
    mount();
    resetAnimRecords();
    r.setPose("celebrate");
    const cl = recordsFor(q("hand-l"), "cheer")[0];
    const cr = recordsFor(q("hand-r"), "cheer")[0];
    expect((cr?.options.delay as number) - (cl?.options.delay as number)).toBe(400);
  });

  it("3 s → idle + mood happy", () => {
    mount();
    r.setPose("celebrate");
    expect(svg().dataset.pose).toBe("celebrate");
    vi.advanceTimersByTime(3000);
    expect(svg().dataset.pose).toBe("idle");
    expect(svg().dataset.mood).toBe("happy");
  });
});

describe("confused (§6.6)", () => {
  it("mulut bergelombang: loop mulus 0,7 s linear", () => {
    mount();
    resetAnimRecords();
    r.setPose("confused");
    const w = recordsFor(q("wavy-path"), "wave")[0];
    expect(w?.options.duration).toBe(700);
    expect(w?.options.easing).toBe("linear");
    expect(w?.options.iterations).toBe(Infinity);
  });

  it("keringat: sweat-2 tertunda 0,9 s; menghilang tiap siklus", () => {
    mount();
    resetAnimRecords();
    r.setPose("confused");
    vi.advanceTimersByTime(2500);
    const s1 = recordsFor(q("sweat-1"), "appear")[0]?.startStamp ?? -1;
    const s2 = recordsFor(q("sweat-2"), "appear")[0]?.startStamp ?? -1;
    expect(s2 - s1).toBeGreaterThanOrEqual(840);
    expect(s2 - s1).toBeLessThanOrEqual(960);
    expect(recordsFor(q("sweat-1"), "fade").length).toBeGreaterThanOrEqual(1);
  });

  it("4 s → idle + mood wary", () => {
    mount();
    r.setPose("confused");
    vi.advanceTimersByTime(4000);
    expect(svg().dataset.pose).toBe("idle");
    expect(svg().dataset.mood).toBe("wary");
  });
});

describe("speaking overlay (§6.7)", () => {
  it("setSpeechLevel>0: data-speaking true, busur stagger 0,2 s", () => {
    mount();
    resetAnimRecords();
    r.setSpeechLevel(0.6);
    expect(svg().dataset.speaking).toBe("true");
    const d1 = recordsFor(q("arc-r1"), "arc")[0]?.options.delay;
    const d2 = recordsFor(q("arc-r2"), "arc")[0]?.options.delay;
    const d3 = recordsFor(q("arc-r3"), "arc")[0]?.options.delay;
    expect(d1).toBe(0);
    expect(d2).toBe(200);
    expect(d3).toBe(400);
  });

  it("lampu berkedip 2 Hz (periode 500 ms)", () => {
    mount();
    r.setSpeechLevel(0.6);
    const lamps = recordsFor(q("bulb-core"), "lamp");
    const last = lamps[lamps.length - 1];
    expect(last?.options.duration).toBe(500);
  });

  it("mulut mengikuti rumus parametris per frame", () => {
    mount();
    r.setSpeechLevel(0.6);
    stepRaf(40);
    const rx = Number(q("mopen-shape").getAttribute("rx"));
    // a ≈ 0.6 setelah konvergen → rx = 3 + 3.5·0.6 = 5.1
    expect(rx).toBeGreaterThan(4.5);
    expect(rx).toBeLessThan(5.7);
    // Lidah tampil (a > 0.4).
    expect(q("mopen-tongue").getAttribute("opacity")).toBe("1");
  });

  it("mulut tertutup ≤100 ms setelah berhenti", () => {
    mount();
    r.setSpeechLevel(0.6);
    stepRaf(10);
    expect(svg().dataset.speaking).toBe("true");
    r.setSpeechLevel(0);
    vi.advanceTimersByTime(100);
    expect(svg().dataset.speaking).toBe("false");
    expect((svg().querySelector("#mouth .m-smile") as HTMLElement).style.opacity).toBe("1");
  });

  it("tidak ada gerak mulut saat tidak berbicara", () => {
    mount();
    resetAnimRecords();
    vi.advanceTimersByTime(1000);
    stepRaf(10);
    expect(q("mopen-shape").getAttribute("rx")).toBe("3");
  });

  it("overlay bertahan saat pose berganti (kecuali offline)", () => {
    mount();
    r.setSpeechLevel(0.7);
    r.setPose("thinking");
    expect(svg().dataset.speaking).toBe("true");
    expect(recordsFor(q("arc-r1"), "arc").length).toBeGreaterThanOrEqual(1);
  });

  it("di asking, pola lampu tetap kedip ganda (prioritas asking)", () => {
    mount();
    r.setPose("asking");
    r.setSpeechLevel(0.7);
    const lamps = recordsFor(q("bulb-core"), "lamp");
    const last = lamps[lamps.length - 1];
    expect(last?.options.duration).toBe(1600);
    expect(q("bulb-core").getAttribute("fill")).toBe("var(--bot-ask)");
  });
});

describe("sleeping (§6.8)", () => {
  it("badan diam: tanpa animasi float", () => {
    mount();
    resetAnimRecords();
    r.setPose("sleeping");
    vi.advanceTimersByTime(2000);
    expect(recordsFor(q("body-float"), "float-y").length).toBe(0);
  });

  it("zzz muncul berurutan, selisih 0,5 s, bergerak ke atas", () => {
    mount();
    resetAnimRecords();
    r.setPose("sleeping");
    vi.advanceTimersByTime(1200);
    const z1 = recordsFor(q("zzz-1"), "appear")[0]?.startStamp ?? -1;
    const z2 = recordsFor(q("zzz-2"), "appear")[0]?.startStamp ?? -1;
    const z3 = recordsFor(q("zzz-3"), "appear")[0]?.startStamp ?? -1;
    expect(z2 - z1).toBeGreaterThanOrEqual(440);
    expect(z2 - z1).toBeLessThanOrEqual(560);
    expect(z3 - z2).toBeGreaterThanOrEqual(440);
    expect(z3 - z2).toBeLessThanOrEqual(560);
    const kf = recordsFor(q("zzz-1"), "appear")[0]?.keyframes as { translate?: string }[];
    expect(JSON.stringify(kf)).toContain("-4px");
  });
});

describe("listening (§7.1)", () => {
  it("busur menyusut ke arah karakter: besar dulu", () => {
    mount();
    resetAnimRecords();
    r.setPose("listening");
    const dSmall = recordsFor(q("arc-r1"), "arc-in")[0]?.options.delay;
    const dBig = recordsFor(q("arc-r3"), "arc-in")[0]?.options.delay;
    expect(dBig).toBe(0);
    expect(dSmall).toBe(400);
  });

  it("setMicLevel menggerakkan lampu saat listening (ADR-009)", () => {
    mount();
    r.setPose("listening");
    r.setMicLevel(0.5);
    expect(svg().dataset.speaking).toBe("false");
    expect((q("bulb") as HTMLElement).style.getPropertyValue("scale")).toBe("1.125");
    expect((q("bulb") as HTMLElement).style.getPropertyValue("opacity")).toBe("0.85");
  });

  it("setMicLevel di-clamp 0..1", () => {
    mount();
    r.setPose("listening");
    r.setMicLevel(2);
    expect((q("bulb") as HTMLElement).style.getPropertyValue("scale")).toBe("1.25");
    r.setMicLevel(-1);
    expect((q("bulb") as HTMLElement).style.getPropertyValue("opacity")).toBe("0.7");
  });

  it("setMicLevel di luar listening tidak mengubah visual", () => {
    mount();
    r.setPose("idle");
    r.setMicLevel(0.8);
    expect((q("bulb") as HTMLElement).style.getPropertyValue("scale")).toBe("");
    expect(svg().dataset.speaking).toBe("false");
  });

  it("setSpeechLevel di listening kini overlay normal (deviasi lama dihapus)", () => {
    mount();
    r.setPose("listening");
    r.setSpeechLevel(0.6);
    expect(svg().dataset.speaking).toBe("true");
  });
});

describe("offline (§7.2)", () => {
  it("mata datar; kedip merah tiap 3 s", () => {
    mount();
    r.setPose("offline");
    expect((svg().querySelector("#eye-l .e-flat") as HTMLElement).style.opacity).toBe("1");
    vi.advanceTimersByTime(3000);
    expect(q("bulb-core").getAttribute("fill")).toBe("var(--bot-bad)");
    vi.advanceTimersByTime(200);
    expect(q("bulb-core").getAttribute("fill")).toBe("var(--bot-stem)");
  });
});

describe("transisi (§10)", () => {
  it("20× ganti pose cepat: tidak ada elemen tersangkut / bocor", () => {
    mount();
    for (let i = 0; i < 20; i++) {
      const p = AVATAR_POSES[i % AVATAR_POSES.length] as AvatarPose;
      r.setPose(p, p === "working" ? { variant: "typing" } : undefined);
      vi.advanceTimersByTime(50);
    }
    r.setPose("idle");
    expect(svg().dataset.pose).toBe("idle");
    expect(q("hand-l").parentElement?.id).toBe("hands-back");
    expect(q("hand-r").parentElement?.id).toBe("hands-back");
    expect(opacityOf("q-bubble")).toBe("0");
    r.destroy();
    expect(animRecords.every((rec) => rec.cancelled)).toBe(true);
  });

  it("reaksi dibatalkan bila pose → asking/confused/working", () => {
    mount();
    resetAnimRecords();
    r.react("nod");
    const nodRec = recordsWithId("nod")[0];
    expect(nodRec?.cancelled).toBe(false);
    r.setPose("asking");
    expect(nodRec?.cancelled).toBe(true);
  });

  it("reaksi bertahan bila pose → idle", () => {
    mount();
    r.setPose("thinking");
    resetAnimRecords();
    r.react("thanks");
    const rec = recordsWithId("thanks")[0];
    r.setPose("idle");
    expect(rec?.cancelled).toBe(false);
  });

  it("sapu varian: desync dua mulut/mata terlihat diperbaiki", () => {
    mount();
    // Simulasi desync: dua varian mulut + dua varian mata dipaksa terlihat.
    const mouth = q("mouth");
    const flat = mouth.querySelector(".m-flat") as HTMLElement;
    const smile = mouth.querySelector(".m-smile") as HTMLElement;
    flat.style.opacity = "1";
    smile.style.opacity = "1";
    const eyeL = q("eye-l");
    const open = eyeL.querySelector(".e-open") as HTMLElement;
    const worried = eyeL.querySelector(".e-worried") as HTMLElement;
    open.style.opacity = "1";
    worried.style.opacity = "1";
    // setMouth/setEyes ke varian yang SAMA (early-return) tetap menyapu.
    r.setMouth("m-smile");
    r.setEyes("e-open");
    for (const g of Array.from(mouth.children)) {
      const op = (g as HTMLElement).style.opacity;
      if ((g as Element).classList.contains("m-smile")) expect(op).toBe("1");
      else expect(op).toBe("0");
    }
    for (const g of Array.from(eyeL.children)) {
      const op = (g as HTMLElement).style.opacity;
      if ((g as Element).classList.contains("e-open")) expect(op).toBe("1");
      else expect(op).toBe("0");
    }
  });
});

describe("reduced motion (§13)", () => {
  it("loop berhenti; dots tampil statis", () => {
    mount({ reducedMotion: true });
    resetAnimRecords();
    r.setPose("thinking");
    vi.advanceTimersByTime(5000);
    expect(animRecords.filter((x) => x.options.iterations === Infinity).length).toBe(0);
    expect(opacityOf("dot-1")).toBe("1");
    expect(opacityOf("dot-2")).toBe("1");
    expect(opacityOf("dot-3")).toBe("1");
  });

  it("celebrate: konfeti diganti 3 kilau statis", () => {
    mount({ reducedMotion: true });
    resetAnimRecords();
    r.setPose("celebrate");
    vi.advanceTimersByTime(2000);
    expect(recordsWithId("burst").length).toBe(0);
    expect(opacityOf("sparkles")).toBe("1");
  });

  it("setReducedMotion(true) di tengah jalan menghentikan loop", () => {
    mount();
    r.setPose("idle");
    vi.advanceTimersByTime(500);
    r.setReducedMotion(true);
    resetAnimRecords();
    vi.advanceTimersByTime(3000);
    expect(animRecords.filter((x) => x.options.iterations === Infinity).length).toBe(0);
  });
});

describe("react() (§9.5) & poke (§9.3)", () => {
  it("nod: anggukan + mata happy sesaat", () => {
    mount();
    resetAnimRecords();
    r.react("nod");
    expect(recordsFor(q("body-nod"), "nod").length).toBe(1);
    expect((svg().querySelector("#eye-l .e-happy") as HTMLElement).style.opacity).toBe("1");
  });

  it("poke: squash 360 ms + e-happy", () => {
    mount();
    resetAnimRecords();
    r.react("poke");
    const rec = recordsFor(q("body-nod"), "poke")[0];
    expect(rec?.options.duration).toBe(360);
    expect(JSON.stringify(rec?.keyframes)).toContain("0.88");
  });

  it("3 poke dalam 2 s → kesal (e-worried)", () => {
    mount();
    r.react("poke");
    r.react("poke");
    r.react("poke");
    expect((svg().querySelector("#eye-l .e-worried") as HTMLElement).style.opacity).toBe("1");
  });

  it("5 poke dalam 3 s → pusing (mata berputar)", () => {
    mount();
    for (let i = 0; i < 5; i++) r.react("poke");
    expect(recordsFor(q("eye-l"), "dizzy").length).toBe(1);
  });

  it("poke saat working: hanya lampu berkilat", () => {
    mount();
    r.setPose("working");
    resetAnimRecords();
    r.react("poke");
    expect(recordsWithId("poke").length).toBe(0);
    expect(recordsFor(q("bulb-core"), "poke-flash").length).toBe(1);
  });

  it("hello: intro + lambaian", () => {
    mount();
    resetAnimRecords();
    r.react("hello");
    expect(recordsFor(q("body-nod"), "hello").length).toBe(1);
    vi.advanceTimersByTime(500);
    expect(recordsWithId("wave-rot").length).toBe(1);
  });
});

describe("eye tracking (§9.2)", () => {
  it("setLook menggerakkan mata maks ±4/±3 dengan lerp", () => {
    mount();
    r.setLook(1, 0.5);
    stepRaf(80);
    expect((q("eyes") as HTMLElement).style.getPropertyValue("translate")).toBe("4.00px 1.50px");
  });

  it("null-safe: nilai di-clamp, NaN → 0", () => {
    mount();
    r.setLook(5, -3);
    stepRaf(80);
    expect((q("eyes") as HTMLElement).style.getPropertyValue("translate")).toBe("4.00px -3.00px");
    r.setLook(NaN, NaN);
    stepRaf(80);
    expect((q("eyes") as HTMLElement).style.getPropertyValue("translate")).toBe("0.00px 0.00px");
  });

  it("kilap bergeser 20% lebih jauh", () => {
    mount();
    r.setLook(1, 0);
    stepRaf(80);
    const glint = svg().querySelector(".e-glint") as HTMLElement;
    expect(glint.style.getPropertyValue("translate")).toBe("4.80px 0.00px");
  });

  it("jam rAF berhenti saat tidak dibutuhkan", () => {
    mount();
    r.setLook(1, 0);
    stepRaf(80);
    expect(rafPending()).toBe(0);
  });
});

describe("freeze (?freeze=<ms>)", () => {
  it("one-shot → min(t, dur); infinite → t mod dur; lalu jeda", () => {
    mount();
    r.setPose("thinking");
    vi.advanceTimersByTime(500);
    r.freeze(1200);
    const appear = recordsFor(q("dot-1"), "appear")[0];
    expect(appear?.currentTime).toBe(180); // min(1200, 180)
    expect(appear?.paused).toBe(true);
    const floats = recordsFor(q("body-float"), "float-y").filter((x) => !x.cancelled);
    const float = floats[floats.length - 1];
    const period = float?.options.duration as number;
    expect(float?.currentTime).toBe(1200 % period);
    expect(float?.paused).toBe(true);
  });
});

describe("pause/resume", () => {
  it("pause menjeda semua animasi; resume melanjutkan", () => {
    mount();
    r.setPose("idle");
    vi.advanceTimersByTime(500);
    r.pause();
    expect(animRecords.filter((x) => !x.cancelled).every((x) => x.paused)).toBe(true);
    r.resume();
    expect(animRecords.filter((x) => !x.cancelled).every((x) => !x.paused)).toBe(true);
  });
});

describe("IdleDirector (§9.1)", () => {
  function hooks(over: Partial<{ reduced: boolean; mood: "neutral" | "happy" | "wary" }> = {}) {
    return {
      rand: mulberry32(99),
      mode: () => "idle" as const,
      reducedMotion: () => over.reduced ?? false,
      mood: () => over.mood ?? ("neutral" as const),
      onBehavior: () => {},
      onSleepy: () => {},
    };
  }

  it("tidak ada perilaku sama dua kali berturut-turut; cooldown dihormati", () => {
    const d = new IdleDirector(hooks());
    d.notifyIdle();
    let last: string | null = null;
    const lastTime = new Map<string, number>();
    for (let i = 0; i < 80; i++) {
      const now = i * 5000;
      const b = d.pickForTest(now, "idle");
      if (!b) continue;
      expect(b, `pengulangan ${b} pada ${now}ms`).not.toBe(last);
      const lt = lastTime.get(b);
      if (lt !== undefined) {
        const spec = T.director.behaviors[b];
        expect(now - lt).toBeGreaterThanOrEqual(spec?.cooldownMs ?? 0);
      }
      lastTime.set(b, now);
      last = b;
    }
    expect(lastTime.size).toBeGreaterThan(3);
  });

  it("reduced motion: hanya lookAround", () => {
    const d = new IdleDirector(hooks({ reduced: true }));
    d.notifyIdle();
    for (let i = 0; i < 40; i++) {
      const b = d.pickForTest(i * 5000, "idle");
      if (b) expect(b).toBe("lookAround");
    }
  });

  it("yawn hanya setelah ≥60 s idle", () => {
    const d = new IdleDirector(hooks());
    d.notifyIdle();
    let sawYawn = false;
    for (let i = 0; i < 12; i++) {
      const b = d.pickForTest(i * 5000, "idle"); // 0–55 s
      if (b === "yawn") sawYawn = true;
    }
    expect(sawYawn).toBe(false);
  });

  it("mode limited (listening): hanya lookAround", () => {
    const d = new IdleDirector(hooks());
    d.notifyIdle();
    for (let i = 0; i < 30; i++) {
      const b = d.pickForTest(i * 5000, "limited");
      if (b) expect(b).toBe("lookAround");
    }
  });
});
