import { useEffect, useRef } from "react";
import { BiboSvgRenderer, type AvatarRenderer } from "@codepet/avatar";
import { poseLabel } from "../orchestrator/pose.js";
import type { AvatarPose } from "@codepet/avatar";

export function AvatarStage({
  pose,
  level,
  theme,
  locale,
}: {
  pose: AvatarPose;
  /** Level suara 0..1 untuk voice-pulse (0 = diam). */
  level: number;
  theme: "light" | "dark";
  locale: "id" | "en";
}): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AvatarRenderer | undefined>(undefined);
  const caption = poseLabel(pose, locale);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const r = new BiboSvgRenderer();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    r.mount(box, { theme, reducedMotion: reduced });
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
    rendererRef.current?.setSpeechLevel(level);
  }, [level]);

  return (
    <section className="avatar-stage" aria-label="Avatar">
      <div className="avatar-box avatar-live" ref={boxRef} role="img" aria-label={`Bibo: ${caption}`} data-testid="bibo-svg" />
      <p className="caption" aria-live="polite" data-testid="avatar-caption">
        {caption}
      </p>
    </section>
  );
}
