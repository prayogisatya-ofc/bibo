import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Input teks reusable. */
export function Input({ className = "", ...rest }: InputProps): JSX.Element {
  return (
    <input
      className={
        `font-inherit rounded-lg border border-[var(--line)] bg-[var(--app-bg)] ` +
        `text-[var(--text)] px-3 py-2 ` +
        `focus:outline-none focus:border-[var(--accent)] ${className}`
      }
      {...rest}
    />
  );
}
