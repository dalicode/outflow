import { useEffect, useState } from "react";

import { cn } from "../../utils/cn";

function getInitialOnlineState(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export default function OfflineStatusBadge() {
  const [isOnline, setIsOnline] = useState<boolean>(getInitialOnlineState);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[84] flex justify-center px-3"
    >
      <div
        className={cn(
          "pointer-events-auto inline-flex items-center gap-3 rounded-full border px-3 py-2 shadow-sm backdrop-blur-sm",
          "bg-theme-surface border-theme-border text-theme-text",
        )}
      >
        <span className="inline-flex h-2 w-2 rounded-full bg-theme-muted" />
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">Offline</span>
          <span className="text-xs text-theme-muted">
            Changes are saved on this device.
          </span>
        </div>
      </div>
    </div>
  );
}
