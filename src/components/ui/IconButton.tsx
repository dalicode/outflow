import { type ComponentType, type MouseEventHandler } from "react";

interface IconProps {
  className?: string;
}

export function PencilIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export function CheckIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function TrashIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

interface IconButtonProps {
  icon: ComponentType<IconProps>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  active?: boolean;
  danger?: boolean;
  label?: string;
  className?: string;
}

export default function IconButton({
  icon: Icon,
  onClick,
  active = false,
  danger = false,
  label,
  className = "",
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`w-8 h-8 flex items-center justify-center rounded-theme-small transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary/40 ${
        active
          ? "bg-theme-primary text-white"
          : danger
            ? "bg-theme-danger text-white hover:opacity-90"
            : "bg-theme-background text-theme-muted border border-theme-border hover:bg-theme-border"
      } ${className}`}
    >
      <Icon />
    </button>
  );
}
