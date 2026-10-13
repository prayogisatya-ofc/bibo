import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--chip)] text-[var(--text-2)]",
  accent: "bg-[var(--accent)] text-white",
  ok: "bg-[var(--ok,#2e9e5b)] text-white",
  warn: "bg-[var(--warn,#d9a021)] text-white",
  danger: "bg-[var(--danger,#d64545)] text-white",
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children: ReactNode;
}

/** Chip/badge pil kecil reusable. */
export function Chip({ tone = "neutral", children, className = "", ...rest }: ChipProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
