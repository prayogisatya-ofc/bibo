import { useEffect, useRef, useState } from "react";
import {
  AVATAR_POSES,
  AVATAR_REACTIONS,
  WORKING_VARIANTS,
  BotRenderer,
  type AvatarMood,
  type AvatarPose,
  type ReactionKind,
  type WorkingVariant,
} from "@bibo/avatar";

/**
 * Galeri uji visual manual (?dev=avatar) — CHARACTER.md §14.
 * Pose × varian working, reaksi, slider speechLevel + micLevel (ADR-009),
 * mood, tema, reduced motion, slow-mo ×0,25, seed, dan mode beku ?freeze=<ms>.
 */

// Nama karakter sementara. Satu-satunya kemunculan di apps/web;
// fase C memindahkannya ke config/character.ts (sumber tunggal).
const CHARACTER_NAME = "Bibo";

function getAriaLabel(pose: AvatarPose, variant?: WorkingVariant): string {
  return variant ? `${CHARACTER_NAME}: ${pose} (${variant})` : `${CHARACTER_NAME}: ${pose}`;
}

const MOODS: readonly AvatarMood[] = ["neutral", "happy", "wary"];

/** Baca state awal dari query string (untuk screenshot deterministik fase E). */
function initialFromUrl(): {
  pose: AvatarPose;
  variant: WorkingVariant;
  theme: "dark" | "light";
  speech: number;
  mic: number;
  mood: AvatarMood;
  seed: number;
  freeze: number | null;
} {
  const q = new URLSearchParams(window.location.search);
  const pose = q.get("pose");
  const variant = q.get("variant");
  const theme = q.get("theme");
  const mood = q.get("mood");
  return {
    pose: AVATAR_POSES.includes(pose as AvatarPose) ? (pose as AvatarPose) : "idle",
    variant: WORKING_VARIANTS.includes(variant as WorkingVariant)
      ? (variant as WorkingVariant)
      : "typing",
    theme: theme === "light" ? "light" : "dark",
    speech: Number(q.get("speech")) || 0,
    mic: Number(q.get("mic")) || 0,
    mood: (MOODS as readonly string[]).includes(mood ?? "") ? (mood as AvatarMood) : "neutral",
    seed: Number(q.get("seed")) || 1234,
    freeze: q.get("freeze") === null ? null : Number(q.get("freeze")) || 0,
  };
}

export function DevAvatar(): JSX.Element {
  const init = useRef(initialFromUrl()).current;
  const [pose, setPose] = useState<AvatarPose>(init.pose);
  const [variant, setVariant] = useState<WorkingVariant>(init.variant);
  const [theme, setTheme] = useState<"dark" | "light">(init.theme);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [slowMo, setSlowMo] = useState(false);
  const [speech, setSpeech] = useState(init.speech);
  const [mic, setMic] = useState(init.mic);
  const [mood, setMood] = useState<AvatarMood>(init.mood);
  const [seed, setSeed] = useState(init.seed);
  const boxRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<BotRenderer | null>(null);
  const frozen = init.freeze !== null;

  /** Mode beku: biarkan koreografi berjalan t ms, lalu seek & jeda. */
  function applyFreeze(r: BotRenderer): void {
    if (!frozen) return;
    const t = init.freeze as number;
    window.setTimeout(() => r.freeze(t), t);
  }

  // Mount / remount saat tema, reduced motion, atau seed berubah.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const r = new BotRenderer();
    r.mount(box, {
      theme,
      reducedMotion,
      seed,
      characterName: CHARACTER_NAME,
      getAriaLabel,
    });
    rendererRef.current = r;
    r.setPlaybackRate(slowMo ? 0.25 : 1);
    r.setPose(pose, { variant });
    applyFreeze(r);
    return () => {
      r.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, reducedMotion, seed]);

  // Pose & varian.
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.setPose(pose, { variant });
    applyFreeze(r);
  }, [pose, variant, frozen]);

  // Level bicara.
  useEffect(() => {
    rendererRef.current?.setSpeechLevel(speech);
  }, [speech]);

  // Level mic (ADR-009): lampu antena berdenyut mengikuti level saat pose Mendengar.
  useEffect(() => {
    rendererRef.current?.setMicLevel(mic);
  }, [mic]);

  // Mood.
  useEffect(() => {
    rendererRef.current?.setMood(mood);
  }, [mood]);

  // Slow-mo.
  useEffect(() => {
    rendererRef.current?.setPlaybackRate(slowMo ? 0.25 : 1);
  }, [slowMo]);

  function react(kind: ReactionKind): void {
    rendererRef.current?.react(kind);
  }

  return (
    <div className="dev-gallery" data-theme={theme}>
      <h1>
        {CHARACTER_NAME} — galeri avatar
      </h1>
      <div className="dev-stage" data-testid="dev-stage">
        <div ref={boxRef} data-testid="avatar-svg" style={{ width: 420 }} />
        <p data-testid="dev-caption">
          {getAriaLabel(pose, pose === "working" ? variant : undefined)} · mood {mood} · seed {seed}
          {frozen ? ` · beku t=${init.freeze}ms` : ""}
        </p>
      </div>
      <div className="dev-controls">
        <div role="group" aria-label="pose">
          {AVATAR_POSES.map((p) => (
            <button
              key={p}
              type="button"
              data-testid={`pose-${p}`}
              data-active={p === pose}
              onClick={() => setPose(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div role="group" aria-label="varian working">
          {WORKING_VARIANTS.map((v) => (
            <button
              key={v}
              type="button"
              data-testid={`variant-${v}`}
              data-active={v === variant}
              disabled={pose !== "working"}
              onClick={() => setVariant(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div role="group" aria-label="reaksi">
          {AVATAR_REACTIONS.map((k) => (
            <button key={k} type="button" data-testid={`react-${k}`} onClick={() => react(k)}>
              {k}
            </button>
          ))}
        </div>
        <div role="group" aria-label="mood">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              data-testid={`mood-${m}`}
              data-active={m === mood}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <label>
          speechLevel: {speech.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={speech}
            data-testid="speech-slider"
            onChange={(e) => setSpeech(Number(e.target.value))}
          />
        </label>
        <label>
          micLevel: {mic.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={mic}
            data-testid="mic-slider"
            onChange={(e) => setMic(Number(e.target.value))}
          />
        </label>
        <div role="group" aria-label="tampilan">
          <button
            type="button"
            data-testid="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            tema: {theme}
          </button>
          <button
            type="button"
            data-testid="reduced-toggle"
            data-active={reducedMotion}
            aria-pressed={reducedMotion}
            onClick={() => setReducedMotion((v) => !v)}
          >
            reduced motion
          </button>
          <button
            type="button"
            data-testid="slowmo-toggle"
            data-active={slowMo}
            aria-pressed={slowMo}
            onClick={() => setSlowMo((v) => !v)}
          >
            slow-mo ×0,25
          </button>
        </div>
        <label>
          seed:{" "}
          <input
            type="number"
            value={seed}
            data-testid="seed-input"
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
          />
        </label>
      </div>
    </div>
  );
}
