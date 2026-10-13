import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "w-8 h-8",
  md: "w-11 h-11",
  lg: "w-[72px] h-[72px]",
};

/** Tombol ikon bundar reusable (mis. mic, kirim, henti). */
export function IconButton({ label, children, size = "md", className = "", ...rest }: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={
        `inline-flex items-center justify-center rounded-full shrink-0 cursor-pointer ` +
        `bg-[var(--card)] text-[var(--text)] border border-[var(--line)] ` +
        `hover:border-[var(--accent)] transition-colors ` +
        `disabled:opacity-50 disabled:cursor-default ${sizes[size]} ${className}`
      }
      {...rest}
    >
      {children}
    </button>
  );
}
