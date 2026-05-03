import { type ReactNode } from "react";
import { cn } from "../../utils/cn";

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export default function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
