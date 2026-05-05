import { cn } from "../../utils/cn";

interface LoadingOverlayProps {
  isOpen: boolean;
  message?: string;
  subMessage?: string;
  showSpinner?: boolean;
}

export default function LoadingOverlay({
  isOpen,
  message = "Loading…",
  subMessage,
  showSpinner = true,
}: LoadingOverlayProps) {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3",
        "h-[100dvh] w-[100dvw]",
        "bg-theme-background-solid backdrop-blur-sm",
      )}
    >
      {showSpinner && (
        <div className="w-8 h-8 border-2 border-theme-primary border-t-transparent rounded-full animate-spin" />
      )}
      <p className="text-theme-text font-medium">{message}</p>
      {subMessage && (
        <p className="text-theme-muted text-sm">{subMessage}</p>
      )}
    </div>
  );
}
