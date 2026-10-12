/**
 * Set ikon SVG garis (fase C). Tanpa emoji sebagai ikon.
 * Semua ikon memakai stroke="currentColor" agar mengikuti warna teks tombol.
 */

interface IconProps {
  size?: number;
  className?: string;
  title?: string;
}

function Base({
  size = 22,
  className,
  title,
  children,
  spin,
}: IconProps & { children: React.ReactNode; spin?: boolean }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={`ic${spin ? " spin-ic" : ""}${className ? ` ${className}` : ""}`}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function MicIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Base>
  );
}

export function SpeakerIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
    </Base>
  );
}

export function SpeakerOffIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16 9l5 6M21 9l-5 6" />
    </Base>
  );
}

export function GearIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </Base>
  );
}

export function SendIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Base>
  );
}

export function StopIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <rect x="6" y="6" width="12" height="12" rx="3" />
    </Base>
  );
}

export function CheckIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <path d="M5 12l5 5 9-10" />
    </Base>
  );
}

export function XIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function QuestionIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.6-2.4 2.1-2.4 3.8" />
      <circle cx="12" cy="17.5" r="0.6" fill="currentColor" />
    </Base>
  );
}

export function FolderIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Base>
  );
}

export function ChevronDownIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p}>
      <path d="M6 9l6 6 6-6" />
    </Base>
  );
}

export function SpinnerIcon(p: IconProps): JSX.Element {
  return (
    <Base {...p} spin>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Base>
  );
}
