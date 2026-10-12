import { useEffect, useRef, useState } from "react";
import { AVATAR_POSES, BiboSvgRenderer, type AvatarPose } from "@codepet/avatar";
import { poseLabel } from "../orchestrator/pose.js";

/**
 * Galeri uji visual manual (?dev=avatar): 14 pose × 2 tema + slider suara.
 * Screenshot deterministik via hash: #pose=<nama>&theme=<dark|light>&speech=<0..1>
 */
export function DevAvatar(): JSX.Element {
  const [pose, setPose] = useState<AvatarPose>("idle");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [speech, setSpeech] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<BiboSvgRenderer | undefined>(undefined);

  useEffect(() => {
    const read = (): void => {
      const h = new URLSearchParams(window.location.hash.slice(1));
      const p = h.get("pose");
      const t = h.get("theme");
      const s = h.get("speech");
      if (p && (AVATAR_POSES as readonly string[]).includes(p)) setPose(p as AvatarPose);
      if (t === "light" || t === "dark") setTheme(t);
      if (s) setSpeech(Number(s) || 0);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const r = new BiboSvgRenderer();
    r.mount(box, { theme, reducedMotion: false });
    rendererRef.current = r;
    return () => {
      r.destroy();
      rendererRef.current = undefined;
    };
  }, [theme]);

  useEffect(() => {
    rendererRef.current?.setPose(pose);
  }, [pose]);
  useEffect(() => {
    rendererRef.current?.setSpeechLevel(speech);
  }, [speech, pose]);

  function pick(p: AvatarPose): void {
    setPose(p);
    window.location.hash = `pose=${p}&theme=${theme}&speech=${speech}`;
  }

  return (
    <div className="dev-gallery" data-theme={theme}>
      <h1>Bibo — galeri pose (M3)</h1>
      <div className="dev-stage" data-testid="dev-stage">
        <div ref={boxRef} data-testid="bibo-svg" style={{ width: 480 }} />
        <p data-testid="dev-caption">
          {pose} — {poseLabel(pose)}
        </p>
      </div>
      <div className="dev-controls">
        <div role="group" aria-label="pose">
          {AVATAR_POSES.map((p) => (
            <button key={p} type="button" data-testid={`pose-${p}`} data-active={p === pose} onClick={() => pick(p)}>
              {p}
            </button>
          ))}
        </div>
        <div role="group" aria-label="tema">
          <button type="button" onClick={() => setTheme("dark")}>
            gelap
          </button>
          <button type="button" onClick={() => setTheme("light")}>
            terang
          </button>
        </div>
        <label>
          level suara: {speech.toFixed(2)}
          <input type="range" min={0} max={1} step={0.05} value={speech} data-testid="speech-slider" onChange={(e) => setSpeech(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}
