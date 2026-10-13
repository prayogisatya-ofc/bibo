import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

/** Kartu konten reusable (latar card, radius 16-20px). */
export function Card({ children, padded = true, className = "", ...rest }: CardProps): JSX.Element {
  return (
    <div
      className={`bg-[var(--card)] text-[var(--text)] border border-[var(--line)] rounded-[20px] ${padded ? "p-5" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
