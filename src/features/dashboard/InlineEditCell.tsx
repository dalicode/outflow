import { useState, useEffect } from "react";
import { cn } from "../../utils/cn";

interface InlineEditCellProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  onTab?: (shiftKey: boolean) => void;
  type?: "text" | "number";
  className?: string;
}

export default function InlineEditCell({
  initialValue,
  onCommit,
  onCancel,
  onTab,
  type = "text",
  className,
}: InlineEditCellProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const commit = () => onCommit(value);

  return (
    <input
      type={type}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          onTab?.(false);
        }
        if (e.key === "Tab") {
          e.preventDefault();
          commit();
          onTab?.(e.shiftKey);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className={cn("input-inline", className)}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}
