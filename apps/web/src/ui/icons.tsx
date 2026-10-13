/**
 * Set ikon garis memakai Tabler Icons (stroke 2, currentColor).
 * Nama komponen & props (IconProps) dipertahankan agar call-site tak berubah.
 */
import {
  IconArrowUp,
  IconCheck,
  IconChevronDown,
  IconFolder,
  IconLoader2,
  IconMicrophone,
  IconPlayerStop,
  IconQuestionMark,
  IconSend,
  IconSettings,
  IconVolume,
  IconVolumeOff,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";

interface IconProps {
  size?: number;
  className?: string;
  title?: string;
}

function wrap(T: TablerIcon, spin = false): (p: IconProps) => JSX.Element {
  return function Wrapped({ size = 22, className, title }: IconProps): JSX.Element {
    const cls = `ic${spin ? " spin-ic" : ""}${className ? ` ${className}` : ""}`;
    return (
      <T
        size={size}
        stroke={2}
        className={cls}
        {...(title === undefined ? { "aria-hidden": true as const } : { title })}
      />
    );
  };
}

export const MicIcon = wrap(IconMicrophone);
export const SpeakerIcon = wrap(IconVolume);
export const SpeakerOffIcon = wrap(IconVolumeOff);
export const GearIcon = wrap(IconSettings);
export const SendIcon = wrap(IconSend);
export const StopIcon = wrap(IconPlayerStop);
export const CheckIcon = wrap(IconCheck);
export const XIcon = wrap(IconX);
export const QuestionIcon = wrap(IconQuestionMark);
export const FolderIcon = wrap(IconFolder);
export const ChevronDownIcon = wrap(IconChevronDown);
export const SpinnerIcon = wrap(IconLoader2, true);
export const ArrowUpIcon = wrap(IconArrowUp);
