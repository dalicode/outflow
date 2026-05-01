import { useMemo } from "react";

export function useMaxVisible(viewportWidth: number): number {
  return useMemo(() => {
    const scaled = Math.max(2, Math.floor((viewportWidth - 80) / 130));
    const half = Math.min(6, scaled);
    return 2 * half + 1;
  }, [viewportWidth]);
}
