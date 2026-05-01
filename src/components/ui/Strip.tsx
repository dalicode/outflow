import { useRef, useLayoutEffect, type ReactNode } from "react";

interface StripProps {
  maxVisible: number;
  scrollClass: string;
  scrollSelector: string;
  align?: "center" | "end";
  navLeft?: ReactNode;
  navRight?: ReactNode;
  beforeScroll?: ReactNode;
  afterScroll?: ReactNode;
  children: ReactNode;
}

export default function Strip({
  maxVisible,
  scrollClass,
  scrollSelector,
  align = "center",
  navLeft,
  navRight,
  beforeScroll,
  afterScroll,
  children,
}: StripProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector(scrollSelector) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "auto",
      });
    }
  }, [scrollSelector]);

  return (
    <div
      className={`flex items-${align} justify-center`}
    >
      {navLeft}
      {beforeScroll}
      <div
        className={scrollClass}
        ref={containerRef}
        style={{ maxWidth: `${maxVisible * 44}px` }}
      >
        {children}
      </div>
      {afterScroll}
      {navRight}
    </div>
  );
}
