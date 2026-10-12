import { useEffect, useRef } from "react";
import { BotRenderer, type AvatarRenderer } from "@codepet/avatar";
import type { AvatarMood, AvatarPose, WorkingVariant } from "@codepet/avatar";
import { poseLabel } from "../orchestrator/pose.js";
import { character } from "../character.js";

/**
 * Panggung avatar — SEMENTARA (fase C menulis ulang total).
 * Fase D hanya memastikan ia mount dengan kontrak AvatarRenderer baru
 * (characterName wajib + pose {pose, variant} + setMood).
 */
export function AvatarStage({
  pose,
  variant,
  mood,
  level,
  theme,
  locale,
}: {
  pose: AvatarPose;
  /** Varian Bekerja; undefined untuk pose non-working. */
  variant: WorkingVariant | undefined;
  mood: AvatarMood;
  /** Level suara 0..1 → overlay Berbicara (mulut parametris); 0 = diam. */
  level: number;
  theme: "light" | "dark";
  locale: "id" | "en";
}): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AvatarRenderer | undefined>(undefined);
  const caption = poseLabel(pose, variant, locale);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const r = new BotRenderer();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    r.mount(box, {
      theme,
      reducedMotion: reduced,
      characterName: character.name,
      // Sementara: label dari poseLabel; fase C mengganti dengan i18n penuh.
      getAriaLabel: (p, v) => `${character.name}: ${poseLabel(p, v, locale)}`,
    });
    rendererRef.current = r;
    return () => {
      r.destroy();
      rendererRef.current = undefined;
    };
  }, [theme]);

  useEffect(() => {
    rendererRef.current?.setPose(pose, variant === undefined ? undefined : { variant });
  }, [pose, variant]);

  useEffect(() => {
    rendererRef.current?.setMood(mood);
  }, [mood]);

  useEffect(() => {
    rendererRef.current?.setSpeechLevel(level);
  }, [level]);

  return (
    <section className="avatar-stage" aria-label="Avatar">
      <div
        className="avatar-box avatar-live"
        ref={boxRef}
        role="img"
        aria-label={`${character.name}: ${caption}`}
        data-testid="bibo-svg"
      />
      <p className="caption" aria-live="polite" data-testid="avatar-caption">
        {caption}
      </p>
    </section>
  );
}
