import { useRef, useCallback } from "react";

const LONG_PRESS_DURATION = 500;
const MOVE_THRESHOLD = 10;

interface UseLongPressOptions {
  onLongPress: (id: number) => void;
  onClick?: (id: number) => void;
}

export function useLongPress({ onLongPress, onClick }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const triggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    triggeredRef.current = false;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent, id: number) => {
      const touch = e.touches[0];
      startPosRef.current = { x: touch.clientX, y: touch.clientY };
      triggeredRef.current = false;

      timerRef.current = setTimeout(() => {
        triggeredRef.current = true;
        onLongPress(id);
      }, LONG_PRESS_DURATION);
    },
    [onLongPress],
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - startPosRef.current.x);
    const dy = Math.abs(touch.clientY - startPosRef.current.y);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clear();
    }
  }, [clear]);

  const onTouchEnd = useCallback(
    (_e: React.TouchEvent, id: number) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!triggeredRef.current && onClick) {
        onClick(id);
      }
      startPosRef.current = null;
      triggeredRef.current = false;
    },
    [onClick, clear],
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
