import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-extrabold rounded-[14px] " +
  "transition-colors disabled:opacity-50 disabled:cursor-default cursor-pointer " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-white border border-transparent hover:brightness-110",
  secondary: "bg-[var(--card)] text-[var(--text)] border border-[var(--line)] hover:border-[var(--accent)]",
  ghost: "bg-transparent text-[var(--text-2)] border border-transparent hover:bg-[var(--hover)]",
  danger: "bg-[var(--danger,#d64545)] text-white border border-transparent hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[13px]",
  md: "px-5 py-2.5 text-[15px]",
  lg: "px-6 py-3.5 text-[16px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

/** Tombol reusable Bibo (Tailwind + design tokens). */
export function Button({ variant = "secondary", size = "md", className = "", children, ...rest }: ButtonProps): JSX.Element {
  return (
    <button type="button" className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
