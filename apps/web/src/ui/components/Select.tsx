import type { SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Select dropdown reusable. */
export function Select({ className = "", children, ...rest }: SelectProps): JSX.Element {
  return (
    <select
      className={
        `font-inherit rounded-lg border border-[var(--line)] bg-[var(--app-bg)] ` +
        `text-[var(--text)] px-3 py-2 pr-10 cursor-pointer ` +
        `focus:outline-none focus:border-[var(--accent)] ${className}`
      }
      {...rest}
    >
      {children}
    </select>
  );
}
